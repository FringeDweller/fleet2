#!/usr/bin/env bash
#
# Backup Verification Script for Fleet2
# ======================================
#
# This script verifies the integrity and restorability of database backups.
# It can download from S3 or use local files, and optionally restore to a
# test database for full validation.
#
# USAGE:
#   ./verify-backup.sh [OPTIONS]
#
# OPTIONS:
#   -f, --file PATH           Path to local backup file
#   -s, --s3-path PATH        S3 path to download (s3://bucket/path/file.sql.gz)
#   -k, --s3-key KEY          S3 key (requires BACKUP_BUCKET env var)
#       --latest TYPE         Download latest backup: daily, weekly, monthly
#       --test-restore        Restore to test database for validation
#       --test-db NAME        Test database name (default: auto-generated)
#       --min-size SIZE       Minimum backup size in bytes (default: 1000)
#       --expected-tables N   Expected minimum table count
#   -r, --report-dir PATH     Directory for reports (default: ./reports)
#       --keep-db             Don't delete test database after testing
#       --notify              Send notification on completion
#   -h, --help                Show this help message
#
# ENVIRONMENT VARIABLES:
#   TEST_DB_URL               Connection for test restore (optional)
#   DATABASE_URL              Fallback connection string
#   BACKUP_BUCKET             S3 bucket for --latest option
#   BACKUP_ENDPOINT           S3-compatible endpoint URL
#   AWS_ACCESS_KEY_ID         AWS credentials
#   AWS_SECRET_ACCESS_KEY
#   BACKUP_NOTIFY_WEBHOOK     Webhook for notifications
#
# EXAMPLES:
#   # Verify local backup file
#   ./verify-backup.sh -f /backups/backup_2025-01-15.sql.gz
#
#   # Download and verify from S3
#   ./verify-backup.sh -s s3://my-bucket/fleet2/daily/backup.sql.gz
#
#   # Verify latest daily backup with test restore
#   ./verify-backup.sh --latest daily --test-restore
#
#   # Full verification with minimum requirements
#   ./verify-backup.sh -f backup.sql.gz --test-restore --min-size 100000 --expected-tables 20
#
# EXIT CODES:
#   0 - All verifications passed
#   1 - General error
#   2 - Invalid arguments
#   3 - Download failed
#   4 - File verification failed
#   5 - Restore verification failed
#   6 - Data validation failed
#

set -euo pipefail

# Script constants
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
readonly TEST_DB_PREFIX="fleet_verify_"

# Configuration
BACKUP_FILE=""
S3_PATH=""
S3_KEY=""
LATEST_TYPE=""
TEST_RESTORE=false
TEST_DB_NAME=""
MIN_SIZE=1000
EXPECTED_TABLES=0
REPORT_DIR="${PROJECT_ROOT}/reports"
KEEP_DB=false
NOTIFY=false

# State
TEMP_FILE=""
CLEANUP_DONE=false

# Verification results
declare -A VERIFICATIONS
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Color output
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' BOLD='' NC=''
fi

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') $*"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $(date '+%H:%M:%S') $*"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $*"; ((WARNINGS++)); }
log_error() { echo -e "${RED}[FAIL]${NC} $(date '+%H:%M:%S') $*" >&2; }
log_step() { echo -e "\n${BOLD}=== $* ===${NC}"; }

# Show usage
show_help() {
    sed -n '3,48p' "$0" | sed 's/^# \?//'
}

# Record verification result
record_check() {
    local check_name="$1"
    local result="$2"  # PASS, FAIL, WARN
    local details="${3:-}"

    ((TOTAL_CHECKS++))
    VERIFICATIONS["$check_name"]="$result|$details"

    case "$result" in
        PASS) ((PASSED_CHECKS++)); log_success "$check_name: $details" ;;
        FAIL) ((FAILED_CHECKS++)); log_error "$check_name: $details" ;;
        WARN) log_warning "$check_name: $details" ;;
    esac
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--file) BACKUP_FILE="$2"; shift 2 ;;
            -s|--s3-path) S3_PATH="$2"; shift 2 ;;
            -k|--s3-key) S3_KEY="$2"; shift 2 ;;
            --latest) LATEST_TYPE="$2"; shift 2 ;;
            --test-restore) TEST_RESTORE=true; shift ;;
            --test-db) TEST_DB_NAME="$2"; shift 2 ;;
            --min-size) MIN_SIZE="$2"; shift 2 ;;
            --expected-tables) EXPECTED_TABLES="$2"; shift 2 ;;
            -r|--report-dir) REPORT_DIR="$2"; shift 2 ;;
            --keep-db) KEEP_DB=true; shift ;;
            --notify) NOTIFY=true; shift ;;
            -h|--help) show_help; exit 0 ;;
            *) log_error "Unknown option: $1"; exit 2 ;;
        esac
    done

    # Validate arguments
    local sources=0
    [[ -n "$BACKUP_FILE" ]] && ((sources++))
    [[ -n "$S3_PATH" ]] && ((sources++))
    [[ -n "$S3_KEY" ]] && ((sources++))
    [[ -n "$LATEST_TYPE" ]] && ((sources++))

    if [[ $sources -eq 0 ]]; then
        log_error "Must specify backup source: -f, -s, -k, or --latest"
        exit 2
    fi

    if [[ $sources -gt 1 ]]; then
        log_error "Only one backup source can be specified"
        exit 2
    fi

    # Validate latest type
    if [[ -n "$LATEST_TYPE" ]]; then
        case "$LATEST_TYPE" in
            daily|weekly|monthly) ;;
            *) log_error "Invalid backup type: $LATEST_TYPE"; exit 2 ;;
        esac
    fi

    # Generate test database name if needed
    if [[ "$TEST_RESTORE" == true && -z "$TEST_DB_NAME" ]]; then
        local random_suffix
        random_suffix=$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')
        TEST_DB_NAME="${TEST_DB_PREFIX}${TIMESTAMP}_${random_suffix}"
    fi
}

# Parse database URL
parse_database_url() {
    local url="$1"
    url="${url#postgresql://}"
    url="${url#postgres://}"

    local userpass="${url%%@*}"
    local hostportdb="${url#*@}"

    if [[ "$userpass" == *":"* ]]; then
        export PGUSER="${userpass%%:*}"
        export PGPASSWORD="${userpass#*:}"
    else
        export PGUSER="$userpass"
    fi

    local hostport="${hostportdb%%/*}"
    local database="${hostportdb#*/}"
    database="${database%%\?*}"

    if [[ "$hostport" == *":"* ]]; then
        export PGHOST="${hostport%%:*}"
        export PGPORT="${hostport#*:}"
    else
        export PGHOST="$hostport"
        export PGPORT="5432"
    fi

    export PGDATABASE="$database"
}

# Check dependencies
check_dependencies() {
    log_step "Checking Dependencies"

    local missing=()
    command -v gunzip &>/dev/null || missing+=("gunzip")
    command -v gzip &>/dev/null || missing+=("gzip")

    if [[ -n "$S3_PATH" || -n "$S3_KEY" || -n "$LATEST_TYPE" ]]; then
        command -v aws &>/dev/null || missing+=("aws-cli")
    fi

    if [[ "$TEST_RESTORE" == true ]]; then
        command -v psql &>/dev/null || missing+=("psql")
        command -v createdb &>/dev/null || missing+=("createdb")
        command -v dropdb &>/dev/null || missing+=("dropdb")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing[*]}"
        exit 1
    fi

    record_check "dependencies" "PASS" "All required tools available"
}

# Download backup from S3
download_backup() {
    log_step "Downloading Backup"

    local endpoint_args=""
    [[ -n "${BACKUP_ENDPOINT:-}" ]] && endpoint_args="--endpoint-url $BACKUP_ENDPOINT"

    local s3_source=""

    # Determine S3 source
    if [[ -n "$S3_PATH" ]]; then
        s3_source="$S3_PATH"
    elif [[ -n "$S3_KEY" ]]; then
        local bucket="${BACKUP_BUCKET:-}"
        if [[ -z "$bucket" ]]; then
            log_error "BACKUP_BUCKET not set for -k option"
            exit 2
        fi
        s3_source="s3://${bucket}/${S3_KEY}"
    elif [[ -n "$LATEST_TYPE" ]]; then
        local bucket="${BACKUP_BUCKET:-}"
        if [[ -z "$bucket" ]]; then
            log_error "BACKUP_BUCKET not set for --latest option"
            exit 2
        fi

        log_info "Finding latest $LATEST_TYPE backup..."

        # shellcheck disable=SC2086
        local latest_key
        latest_key=$(aws s3 ls "s3://${bucket}/fleet2/${LATEST_TYPE}/" --recursive $endpoint_args 2>/dev/null \
            | grep -E '\.sql\.gz$' \
            | sort -k1,2 \
            | tail -1 \
            | awk '{print $4}')

        if [[ -z "$latest_key" ]]; then
            record_check "find_backup" "FAIL" "No backups found in ${bucket}/fleet2/${LATEST_TYPE}/"
            exit 3
        fi

        s3_source="s3://${bucket}/${latest_key}"
        log_info "Found: $latest_key"
    fi

    if [[ -z "$s3_source" ]]; then
        return
    fi

    log_info "Source: $s3_source"

    # Create temp file
    TEMP_FILE=$(mktemp -t backup_verify_XXXXXX.sql.gz)
    BACKUP_FILE="$TEMP_FILE"

    log_info "Downloading to temporary file..."

    # shellcheck disable=SC2086
    if aws s3 cp "$s3_source" "$TEMP_FILE" $endpoint_args; then
        local file_size
        file_size=$(stat -c%s "$TEMP_FILE" 2>/dev/null || stat -f%z "$TEMP_FILE")
        local size_human
        size_human=$(numfmt --to=iec-i --suffix=B "$file_size" 2>/dev/null || echo "${file_size} bytes")
        record_check "download" "PASS" "Downloaded $size_human"
    else
        record_check "download" "FAIL" "S3 download failed"
        exit 3
    fi
}

# Verify file exists
verify_file_exists() {
    log_step "Verifying File Exists"

    if [[ ! -f "$BACKUP_FILE" ]]; then
        record_check "file_exists" "FAIL" "File not found: $BACKUP_FILE"
        exit 4
    fi

    log_info "File: $BACKUP_FILE"
    record_check "file_exists" "PASS" "File found"
}

# Verify file size
verify_file_size() {
    log_step "Verifying File Size"

    local file_size
    file_size=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE")

    local size_human
    size_human=$(numfmt --to=iec-i --suffix=B "$file_size" 2>/dev/null || echo "${file_size} bytes")

    log_info "Size: $size_human"
    log_info "Minimum: $MIN_SIZE bytes"

    if [[ "$file_size" -lt "$MIN_SIZE" ]]; then
        record_check "file_size" "FAIL" "Too small: $file_size bytes (minimum: $MIN_SIZE)"
        exit 4
    fi

    record_check "file_size" "PASS" "$size_human (>= $MIN_SIZE bytes)"
}

# Verify gzip integrity
verify_gzip_integrity() {
    log_step "Verifying Gzip Integrity"

    if [[ "$BACKUP_FILE" != *.gz ]]; then
        record_check "gzip_format" "WARN" "File is not gzip compressed"
        return
    fi

    log_info "Testing gzip integrity..."

    if gzip -t "$BACKUP_FILE" 2>/dev/null; then
        record_check "gzip_integrity" "PASS" "Valid gzip archive"
    else
        record_check "gzip_integrity" "FAIL" "Invalid or corrupted gzip archive"
        exit 4
    fi

    # Get uncompressed size
    local uncompressed_size
    uncompressed_size=$(gzip -l "$BACKUP_FILE" 2>/dev/null | tail -1 | awk '{print $2}')
    if [[ -n "$uncompressed_size" && "$uncompressed_size" -gt 0 ]]; then
        local size_human
        size_human=$(numfmt --to=iec-i --suffix=B "$uncompressed_size" 2>/dev/null || echo "${uncompressed_size} bytes")
        log_info "Uncompressed size: $size_human"
    fi
}

# Verify PostgreSQL dump format
verify_pg_dump_format() {
    log_step "Verifying PostgreSQL Dump Format"

    local header
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        header=$(gunzip -c "$BACKUP_FILE" 2>/dev/null | head -50)
    else
        header=$(head -50 "$BACKUP_FILE")
    fi

    # Check for pg_dump header
    if echo "$header" | grep -qE "^\-\- PostgreSQL database dump|^\-\- Dumped (from|by) database"; then
        record_check "pg_dump_header" "PASS" "PostgreSQL dump header found"
    else
        record_check "pg_dump_header" "WARN" "Standard pg_dump header not found"
    fi

    # Check for pg_dump version
    local pg_version
    pg_version=$(echo "$header" | grep -oE "pg_dump \(PostgreSQL\) [0-9]+\.[0-9]+" | head -1)
    if [[ -n "$pg_version" ]]; then
        log_info "Dump version: $pg_version"
    fi

    # Check for SQL statements
    if echo "$header" | grep -qE "^(CREATE|SET|SELECT|INSERT|ALTER|DROP)"; then
        record_check "sql_content" "PASS" "Valid SQL statements detected"
    else
        record_check "sql_content" "WARN" "Could not verify SQL content"
    fi

    # Check for table definitions
    local table_count
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        table_count=$(gunzip -c "$BACKUP_FILE" 2>/dev/null | grep -c "^CREATE TABLE" || echo "0")
    else
        table_count=$(grep -c "^CREATE TABLE" "$BACKUP_FILE" || echo "0")
    fi

    log_info "CREATE TABLE statements: $table_count"

    if [[ "$EXPECTED_TABLES" -gt 0 ]]; then
        if [[ "$table_count" -ge "$EXPECTED_TABLES" ]]; then
            record_check "table_count" "PASS" "$table_count tables (>= $EXPECTED_TABLES expected)"
        else
            record_check "table_count" "FAIL" "$table_count tables (< $EXPECTED_TABLES expected)"
        fi
    elif [[ "$table_count" -gt 0 ]]; then
        record_check "table_count" "PASS" "$table_count tables found"
    else
        record_check "table_count" "WARN" "No CREATE TABLE statements found"
    fi
}

# Verify checksum if available
verify_checksum() {
    log_step "Verifying Checksum"

    local checksum_file="${BACKUP_FILE}.md5"

    if [[ ! -f "$checksum_file" ]]; then
        # Try to download checksum from S3 if we downloaded the backup
        if [[ -n "$TEMP_FILE" && -n "${S3_PATH:-}${S3_KEY:-}${LATEST_TYPE:-}" ]]; then
            local endpoint_args=""
            [[ -n "${BACKUP_ENDPOINT:-}" ]] && endpoint_args="--endpoint-url $BACKUP_ENDPOINT"

            local s3_checksum_path=""
            if [[ -n "$S3_PATH" ]]; then
                s3_checksum_path="${S3_PATH}.md5"
            fi
            # Add logic for other S3 sources if needed

            if [[ -n "$s3_checksum_path" ]]; then
                # shellcheck disable=SC2086
                aws s3 cp "$s3_checksum_path" "$checksum_file" $endpoint_args 2>/dev/null || true
            fi
        fi
    fi

    if [[ ! -f "$checksum_file" ]]; then
        record_check "checksum" "WARN" "No checksum file available"
        return
    fi

    log_info "Checksum file: $checksum_file"

    # Calculate current checksum
    local current_checksum
    if command -v md5sum &>/dev/null; then
        current_checksum=$(md5sum "$BACKUP_FILE" | cut -d' ' -f1)
    elif command -v md5 &>/dev/null; then
        current_checksum=$(md5 -q "$BACKUP_FILE")
    else
        record_check "checksum" "WARN" "No MD5 tool available"
        return
    fi

    # Get expected checksum
    local expected_checksum
    expected_checksum=$(cat "$checksum_file" | awk '{print $1}')

    log_info "Expected:   $expected_checksum"
    log_info "Calculated: $current_checksum"

    if [[ "$current_checksum" == "$expected_checksum" ]]; then
        record_check "checksum" "PASS" "Checksum matches"
    else
        record_check "checksum" "FAIL" "Checksum mismatch"
        exit 4
    fi
}

# Test restore to database
test_restore_to_database() {
    log_step "Test Restore to Database"

    if [[ "$TEST_RESTORE" != true ]]; then
        log_info "Test restore skipped (use --test-restore to enable)"
        return
    fi

    # Parse database URL
    if [[ -n "${TEST_DB_URL:-}" ]]; then
        log_info "Using TEST_DB_URL"
        parse_database_url "$TEST_DB_URL"
    elif [[ -n "${DATABASE_URL:-}" ]]; then
        log_info "Using DATABASE_URL"
        parse_database_url "$DATABASE_URL"
    else
        record_check "db_connection" "FAIL" "No database URL configured"
        return
    fi

    export PGPASSWORD

    log_info "Host: $PGHOST:$PGPORT"
    log_info "User: $PGUSER"
    log_info "Test database: $TEST_DB_NAME"

    # Create test database
    log_info "Creating test database..."
    if createdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$TEST_DB_NAME" 2>&1; then
        record_check "create_test_db" "PASS" "Database created"
    else
        record_check "create_test_db" "FAIL" "Failed to create test database"
        return
    fi

    # Restore backup
    log_info "Restoring backup to test database..."
    local start_time
    start_time=$(date +%s)

    local restore_cmd
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        restore_cmd="gunzip -c '$BACKUP_FILE'"
    else
        restore_cmd="cat '$BACKUP_FILE'"
    fi

    local error_count=0
    if eval "$restore_cmd" | psql \
        -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
        -d "$TEST_DB_NAME" \
        --quiet --no-psqlrc \
        --set ON_ERROR_STOP=off \
        2>&1 | grep -ciE "(error|fatal)" || true; then
        error_count=$?
    fi

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    if [[ $error_count -gt 0 ]]; then
        record_check "restore" "WARN" "Restore completed with $error_count error(s) in ${duration}s"
    else
        record_check "restore" "PASS" "Restore completed in ${duration}s"
    fi

    # Validate restored data
    validate_restored_data
}

# Validate restored database
validate_restored_data() {
    log_step "Validating Restored Data"

    export PGPASSWORD

    # Helper function
    run_query() {
        psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_NAME" \
            --tuples-only --no-align --quiet --no-psqlrc -c "$1" 2>/dev/null
    }

    # Check table count
    local table_count
    table_count=$(run_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
    table_count="${table_count// /}"

    if [[ "$table_count" -gt 0 ]]; then
        record_check "restored_tables" "PASS" "$table_count tables restored"
    else
        record_check "restored_tables" "FAIL" "No tables found in restored database"
    fi

    # Check for Fleet2 key tables
    local key_tables=("organisations" "users" "assets" "work_orders")
    local found_tables=0

    for table in "${key_tables[@]}"; do
        local exists
        exists=$(run_query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');")
        [[ "$exists" == "t" ]] && ((found_tables++))
    done

    if [[ $found_tables -eq ${#key_tables[@]} ]]; then
        record_check "key_tables" "PASS" "All ${#key_tables[@]} Fleet2 key tables present"
    elif [[ $found_tables -gt 0 ]]; then
        record_check "key_tables" "WARN" "$found_tables/${#key_tables[@]} key tables present"
    else
        record_check "key_tables" "FAIL" "No Fleet2 key tables found"
    fi

    # Check row counts
    local total_rows=0
    for table in "${key_tables[@]}"; do
        local count
        count=$(run_query "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
        count="${count// /}"
        ((total_rows += count)) || true
    done

    if [[ $total_rows -gt 0 ]]; then
        record_check "data_rows" "PASS" "$total_rows total rows in key tables"
    else
        record_check "data_rows" "WARN" "No data in key tables"
    fi

    # Check indexes
    local index_count
    index_count=$(run_query "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';")
    index_count="${index_count// /}"

    if [[ "$index_count" -gt 0 ]]; then
        record_check "indexes" "PASS" "$index_count indexes present"
    else
        record_check "indexes" "WARN" "No indexes found"
    fi

    # Check foreign keys
    local fk_count
    fk_count=$(run_query "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';")
    fk_count="${fk_count// /}"

    if [[ "$fk_count" -gt 0 ]]; then
        record_check "foreign_keys" "PASS" "$fk_count FK constraints present"
    else
        record_check "foreign_keys" "WARN" "No foreign key constraints found"
    fi
}

# Cleanup
cleanup() {
    if [[ "$CLEANUP_DONE" == true ]]; then
        return
    fi

    log_step "Cleanup"

    # Remove temp file
    if [[ -n "$TEMP_FILE" && -f "$TEMP_FILE" ]]; then
        rm -f "$TEMP_FILE"
        log_info "Removed temporary backup file"
    fi

    # Drop test database
    if [[ -n "$TEST_DB_NAME" && "$KEEP_DB" != true && "$TEST_RESTORE" == true ]]; then
        if [[ -n "${PGPASSWORD:-}" ]]; then
            # Terminate connections
            psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres \
                --quiet --no-psqlrc \
                -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TEST_DB_NAME' AND pid <> pg_backend_pid();" \
                2>/dev/null || true

            if dropdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$TEST_DB_NAME" 2>&1; then
                log_info "Dropped test database: $TEST_DB_NAME"
            else
                log_warning "Failed to drop test database: $TEST_DB_NAME"
            fi
        fi
    elif [[ "$KEEP_DB" == true && -n "$TEST_DB_NAME" ]]; then
        log_info "Keeping test database: $TEST_DB_NAME"
    fi

    CLEANUP_DONE=true
}

trap cleanup EXIT INT TERM

# Generate report
generate_report() {
    log_step "Generating Report"

    mkdir -p "$REPORT_DIR"

    local report_file="${REPORT_DIR}/backup-verify-${TIMESTAMP}.md"
    local status="PASS"

    [[ $FAILED_CHECKS -gt 0 ]] && status="FAIL"

    local backup_name
    backup_name=$(basename "$BACKUP_FILE")

    cat > "$report_file" << EOF
# Backup Verification Report

**Generated:** $(date '+%Y-%m-%d %H:%M:%S')
**Status:** $status

## Summary

| Metric | Value |
|--------|-------|
| Total Checks | $TOTAL_CHECKS |
| Passed | $PASSED_CHECKS |
| Failed | $FAILED_CHECKS |
| Warnings | $WARNINGS |

## Backup Information

| Property | Value |
|----------|-------|
| Backup File | \`$backup_name\` |
| Test Restore | $TEST_RESTORE |
EOF

    if [[ "$TEST_RESTORE" == true && -n "$TEST_DB_NAME" ]]; then
        echo "| Test Database | \`$TEST_DB_NAME\` |" >> "$report_file"
    fi

    cat >> "$report_file" << EOF

## Verification Results

| Check | Status | Details |
|-------|--------|---------|
EOF

    for check_name in "${!VERIFICATIONS[@]}"; do
        local result="${VERIFICATIONS[$check_name]}"
        local check_status="${result%%|*}"
        local check_details="${result#*|}"

        echo "| $check_name | $check_status | $check_details |" >> "$report_file"
    done

    cat >> "$report_file" << EOF

---
*Report generated by Fleet2 Backup Verification Script*
EOF

    log_info "Report saved: $report_file"
    echo "$report_file"
}

# Send notification
send_notification() {
    local status="$1"

    if [[ "$NOTIFY" != true ]]; then
        return
    fi

    log_step "Sending Notification"

    if [[ -n "${BACKUP_NOTIFY_WEBHOOK:-}" ]]; then
        local color="good"
        [[ "$status" == "FAIL" ]] && color="danger"
        [[ $WARNINGS -gt 0 ]] && color="warning"

        local backup_name
        backup_name=$(basename "$BACKUP_FILE")

        local payload
        payload=$(cat << EOF
{
    "text": "Backup Verification: $status",
    "attachments": [{
        "color": "$color",
        "fields": [
            {"title": "Backup", "value": "$backup_name", "short": true},
            {"title": "Passed", "value": "$PASSED_CHECKS", "short": true},
            {"title": "Failed", "value": "$FAILED_CHECKS", "short": true},
            {"title": "Warnings", "value": "$WARNINGS", "short": true}
        ]
    }]
}
EOF
)

        if curl -s -X POST -H 'Content-type: application/json' --data "$payload" "$BACKUP_NOTIFY_WEBHOOK" &>/dev/null; then
            log_info "Webhook notification sent"
        else
            log_warning "Webhook notification failed"
        fi
    fi
}

# Print summary
print_summary() {
    local status="$1"
    local duration="$2"

    echo ""
    echo "=========================================="
    echo "  VERIFICATION SUMMARY"
    echo "=========================================="
    echo ""
    echo "  Total Checks:  $TOTAL_CHECKS"
    echo -e "  Passed:        ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "  Failed:        ${RED}$FAILED_CHECKS${NC}"
    echo -e "  Warnings:      ${YELLOW}$WARNINGS${NC}"
    echo ""
    echo "  Duration:      ${duration}s"
    echo ""
    echo "=========================================="

    if [[ "$status" == "PASS" ]]; then
        echo -e "  Status: ${GREEN}${BOLD}PASS${NC}"
    else
        echo -e "  Status: ${RED}${BOLD}FAIL${NC}"
    fi

    echo "=========================================="
}

# Main function
main() {
    local start_time
    start_time=$(date +%s)

    echo -e "\n${BOLD}========================================${NC}"
    echo -e "${BOLD}  Fleet2 Backup Verification${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""
    log_info "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

    parse_args "$@"
    check_dependencies

    # Download if needed
    if [[ -n "$S3_PATH" || -n "$S3_KEY" || -n "$LATEST_TYPE" ]]; then
        download_backup
    fi

    # Run verifications
    verify_file_exists
    verify_file_size
    verify_gzip_integrity
    verify_pg_dump_format
    verify_checksum

    # Test restore if requested
    if [[ "$TEST_RESTORE" == true ]]; then
        test_restore_to_database
    fi

    # Generate report
    local report_file
    report_file=$(generate_report)

    # Determine final status
    local final_status="PASS"
    [[ $FAILED_CHECKS -gt 0 ]] && final_status="FAIL"

    # Send notification
    send_notification "$final_status"

    # Print summary
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    print_summary "$final_status" "$duration"

    log_info "Report: $report_file"

    if [[ "$final_status" == "PASS" ]]; then
        log_success "All verifications passed!"
        exit 0
    else
        log_error "Some verifications failed"
        exit 6
    fi
}

# Run main
main "$@"
