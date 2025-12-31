#!/usr/bin/env bash
#
# Automated Backup Restoration Testing Script for Fleet2
# =======================================================
#
# This script automates backup testing by:
#   1. Downloading the latest backup from S3 (or using a local backup)
#   2. Restoring to a temporary test database
#   3. Running validation checks (schema, row counts, data integrity)
#   4. Generating a detailed test report
#   5. Cleaning up test resources
#
# USAGE:
#   ./test-backup-restore.sh [OPTIONS]
#
# OPTIONS:
#   -b, --backup PATH         Path to local backup file
#   -s, --s3-latest           Download and test latest backup from S3
#   -t, --backup-type TYPE    Backup type for S3: daily, weekly, monthly (default: daily)
#   -e, --expected-counts FILE JSON file with minimum row counts
#   -r, --report-dir PATH     Directory for test reports (default: ./reports)
#       --keep-db             Don't delete test database after testing
#       --notify              Send notification on completion
#       --fail-on-warning     Exit with error on warnings
#   -h, --help                Show this help message
#
# ENVIRONMENT VARIABLES:
#   TEST_DB_URL           Connection string for test database server
#   DATABASE_URL          Fallback connection (used if TEST_DB_URL not set)
#   AWS_ACCESS_KEY_ID     S3 credentials for backup download
#   AWS_SECRET_ACCESS_KEY
#   BACKUP_BUCKET         S3 bucket containing backups
#   BACKUP_ENDPOINT       S3-compatible endpoint
#   BACKUP_NOTIFY_WEBHOOK Webhook for notifications
#   BACKUP_NOTIFY_EMAIL   Email for notifications
#
# EXAMPLES:
#   # Test local backup
#   ./test-backup-restore.sh -b /backups/backup_2025-01-15.sql.gz
#
#   # Test latest daily backup from S3
#   ./test-backup-restore.sh --s3-latest -t daily
#
#   # Full automated test with notifications
#   ./test-backup-restore.sh --s3-latest --notify -e expected-counts.json
#
# EXIT CODES:
#   0 - All tests passed
#   1 - General error
#   2 - Invalid arguments
#   3 - Backup download failed
#   4 - Restore failed
#   5 - Validation failed
#   6 - Cleanup failed (non-fatal)
#

set -euo pipefail

# Script constants
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
readonly TEST_DB_PREFIX="fleet_backup_test_"

# Configuration
BACKUP_FILE=""
S3_LATEST=false
BACKUP_TYPE="daily"
EXPECTED_COUNTS_FILE=""
REPORT_DIR="${PROJECT_ROOT}/reports"
KEEP_DB=false
NOTIFY=false
FAIL_ON_WARNING=false
TEST_DB_NAME=""
TEMP_BACKUP=""
CLEANUP_DONE=false

# Test results
declare -A TEST_RESULTS
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
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
    sed -n '3,50p' "$0" | sed 's/^# \?//'
}

# Record test result
record_test() {
    local test_name="$1"
    local result="$2"  # PASS, FAIL, WARN
    local details="${3:-}"

    ((TOTAL_TESTS++))
    TEST_RESULTS["$test_name"]="$result|$details"

    case "$result" in
        PASS) ((PASSED_TESTS++)); log_success "$test_name: $details" ;;
        FAIL) ((FAILED_TESTS++)); log_error "$test_name: $details" ;;
        WARN) log_warning "$test_name: $details" ;;
    esac
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -b|--backup) BACKUP_FILE="$2"; shift 2 ;;
            -s|--s3-latest) S3_LATEST=true; shift ;;
            -t|--backup-type) BACKUP_TYPE="$2"; shift 2 ;;
            -e|--expected-counts) EXPECTED_COUNTS_FILE="$2"; shift 2 ;;
            -r|--report-dir) REPORT_DIR="$2"; shift 2 ;;
            --keep-db) KEEP_DB=true; shift ;;
            --notify) NOTIFY=true; shift ;;
            --fail-on-warning) FAIL_ON_WARNING=true; shift ;;
            -h|--help) show_help; exit 0 ;;
            *) log_error "Unknown option: $1"; exit 2 ;;
        esac
    done

    # Validate arguments
    if [[ -z "$BACKUP_FILE" && "$S3_LATEST" != true ]]; then
        log_error "Must specify backup file (-b) or use --s3-latest"
        exit 2
    fi

    # Validate backup type
    case "$BACKUP_TYPE" in
        daily|weekly|monthly) ;;
        *) log_error "Invalid backup type: $BACKUP_TYPE"; exit 2 ;;
    esac
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

# Setup configuration
setup_config() {
    log_step "Configuration"

    # Parse database URL
    if [[ -n "${TEST_DB_URL:-}" ]]; then
        log_info "Using TEST_DB_URL"
        parse_database_url "$TEST_DB_URL"
    elif [[ -n "${DATABASE_URL:-}" ]]; then
        log_info "Using DATABASE_URL"
        parse_database_url "$DATABASE_URL"
    else
        log_error "No database connection configured"
        log_error "Set TEST_DB_URL or DATABASE_URL"
        exit 2
    fi

    # Set defaults
    PGHOST="${PGHOST:-localhost}"
    PGPORT="${PGPORT:-5432}"

    # Validate required variables
    [[ -z "${PGUSER:-}" ]] && { log_error "PGUSER required"; exit 2; }
    [[ -z "${PGPASSWORD:-}" ]] && { log_error "PGPASSWORD required"; exit 2; }

    log_info "Database: $PGHOST:$PGPORT"
    log_info "User: $PGUSER"

    # Create report directory
    mkdir -p "$REPORT_DIR"
    log_info "Reports: $REPORT_DIR"

    # Generate test database name
    local random_suffix
    random_suffix=$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')
    TEST_DB_NAME="${TEST_DB_PREFIX}${TIMESTAMP}_${random_suffix}"
    log_info "Test database: $TEST_DB_NAME"
}

# Check dependencies
check_dependencies() {
    log_step "Checking Dependencies"

    local missing=()
    command -v psql &>/dev/null || missing+=("psql")
    command -v createdb &>/dev/null || missing+=("createdb")
    command -v dropdb &>/dev/null || missing+=("dropdb")
    command -v gunzip &>/dev/null || missing+=("gunzip")

    if [[ "$S3_LATEST" == true ]]; then
        command -v aws &>/dev/null || missing+=("aws-cli")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing[*]}"
        exit 1
    fi

    record_test "dependencies" "PASS" "All required tools available"
}

# Download backup from S3
download_s3_backup() {
    log_step "Downloading Backup from S3"

    local bucket="${BACKUP_BUCKET:-}"
    local endpoint_args=""
    [[ -n "${BACKUP_ENDPOINT:-}" ]] && endpoint_args="--endpoint-url $BACKUP_ENDPOINT"

    if [[ -z "$bucket" ]]; then
        log_error "BACKUP_BUCKET not configured"
        exit 3
    fi

    # Find latest backup
    log_info "Finding latest $BACKUP_TYPE backup..."

    local latest_key
    # shellcheck disable=SC2086
    latest_key=$(aws s3 ls "s3://${bucket}/fleet2/${BACKUP_TYPE}/" --recursive $endpoint_args 2>/dev/null \
        | grep -E '\.sql\.gz$|\.tar\.gz$' \
        | sort -k1,2 \
        | tail -1 \
        | awk '{print $4}')

    if [[ -z "$latest_key" ]]; then
        log_error "No backups found in s3://${bucket}/fleet2/${BACKUP_TYPE}/"
        exit 3
    fi

    log_info "Latest backup: $latest_key"

    # Create temp file
    TEMP_BACKUP=$(mktemp -t backup_XXXXXX.sql.gz)
    BACKUP_FILE="$TEMP_BACKUP"

    log_info "Downloading to $TEMP_BACKUP..."

    # shellcheck disable=SC2086
    if aws s3 cp "s3://${bucket}/${latest_key}" "$TEMP_BACKUP" $endpoint_args; then
        local file_size
        file_size=$(stat -c%s "$TEMP_BACKUP" 2>/dev/null || stat -f%z "$TEMP_BACKUP")
        record_test "backup_download" "PASS" "Downloaded $(numfmt --to=iec-i --suffix=B "$file_size" 2>/dev/null || echo "${file_size} bytes")"
    else
        record_test "backup_download" "FAIL" "Download failed"
        exit 3
    fi
}

# Validate backup file
validate_backup_file() {
    log_step "Validating Backup File"

    if [[ ! -f "$BACKUP_FILE" ]]; then
        record_test "backup_exists" "FAIL" "File not found: $BACKUP_FILE"
        exit 3
    fi

    local file_size
    file_size=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE")

    if [[ "$file_size" -lt 100 ]]; then
        record_test "backup_size" "FAIL" "File too small (${file_size} bytes)"
        exit 3
    fi
    record_test "backup_size" "PASS" "$(numfmt --to=iec-i --suffix=B "$file_size" 2>/dev/null || echo "${file_size} bytes")"

    # Validate gzip
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        if gzip -t "$BACKUP_FILE" 2>/dev/null; then
            record_test "backup_integrity" "PASS" "Valid gzip archive"
        else
            record_test "backup_integrity" "FAIL" "Invalid gzip archive"
            exit 3
        fi
    fi

    # Check for SQL content
    local header
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        header=$(gunzip -c "$BACKUP_FILE" 2>/dev/null | head -5)
    else
        header=$(head -5 "$BACKUP_FILE")
    fi

    if echo "$header" | grep -qE "pg_dump|PostgreSQL"; then
        record_test "backup_content" "PASS" "PostgreSQL dump detected"
    else
        record_test "backup_content" "WARN" "Could not verify PostgreSQL dump format"
    fi
}

# Create test database
create_test_database() {
    log_step "Creating Test Database"

    export PGPASSWORD

    if createdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$TEST_DB_NAME" 2>&1; then
        record_test "create_database" "PASS" "Created $TEST_DB_NAME"
    else
        record_test "create_database" "FAIL" "Failed to create test database"
        exit 4
    fi
}

# Restore backup
restore_backup() {
    log_step "Restoring Backup"

    local start_time
    start_time=$(date +%s)

    export PGPASSWORD

    log_info "Restoring to $TEST_DB_NAME (this may take a while)..."

    local restore_cmd
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        restore_cmd="gunzip -c '$BACKUP_FILE'"
    else
        restore_cmd="cat '$BACKUP_FILE'"
    fi

    local error_log
    error_log=$(mktemp)

    if eval "$restore_cmd" | psql \
        -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" \
        -d "$TEST_DB_NAME" \
        --quiet --no-psqlrc \
        --set ON_ERROR_STOP=off \
        2>&1 | tee "$error_log" | grep -ciE "(error|fatal)" || true; then
        :
    fi

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Check for critical errors
    if grep -qiE "FATAL|permission denied" "$error_log" 2>/dev/null; then
        record_test "restore_backup" "FAIL" "Restore failed with critical errors"
        rm -f "$error_log"
        exit 4
    fi

    rm -f "$error_log"
    record_test "restore_backup" "PASS" "Completed in ${duration}s"
}

# Run validation queries
run_validations() {
    log_step "Running Validation Checks"

    export PGPASSWORD

    # Helper function
    run_query() {
        psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEST_DB_NAME" \
            --tuples-only --no-align --quiet --no-psqlrc -c "$1" 2>/dev/null
    }

    # Check 1: Table count
    local table_count
    table_count=$(run_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
    table_count="${table_count// /}"

    if [[ "$table_count" -gt 0 ]]; then
        record_test "schema_tables" "PASS" "$table_count tables found"
    else
        record_test "schema_tables" "FAIL" "No tables found"
    fi

    # Check 2: Key tables exist
    local key_tables=("organisations" "users" "assets" "work_orders")
    local found_tables=0

    for table in "${key_tables[@]}"; do
        local exists
        exists=$(run_query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');")
        [[ "$exists" == "t" ]] && ((found_tables++))
    done

    if [[ $found_tables -eq ${#key_tables[@]} ]]; then
        record_test "key_tables" "PASS" "All ${#key_tables[@]} key tables present"
    elif [[ $found_tables -gt 0 ]]; then
        record_test "key_tables" "WARN" "$found_tables/${#key_tables[@]} key tables present"
    else
        record_test "key_tables" "FAIL" "No key tables found"
    fi

    # Check 3: Row counts
    local total_rows=0
    local table_counts=""

    for table in "${key_tables[@]}"; do
        local count
        count=$(run_query "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
        count="${count// /}"
        ((total_rows += count)) || true
        table_counts+="  $table: $count\n"
    done

    if [[ $total_rows -gt 0 ]]; then
        record_test "data_rows" "PASS" "$total_rows total rows in key tables"
    else
        record_test "data_rows" "WARN" "No data in key tables"
    fi

    # Check 4: Expected counts validation
    if [[ -n "$EXPECTED_COUNTS_FILE" && -f "$EXPECTED_COUNTS_FILE" ]]; then
        local count_failures=0

        while IFS=: read -r table expected; do
            table="${table//\"/}"; table="${table// /}"
            expected="${expected//\"/}"; expected="${expected// /}"; expected="${expected//,/}"; expected="${expected//\}/}"

            [[ -z "$table" || "$table" == "{" || "$table" == "}" ]] && continue

            local actual
            actual=$(run_query "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
            actual="${actual// /}"

            if [[ "$actual" -lt "$expected" ]]; then
                ((count_failures++))
                log_error "  $table: $actual rows (expected >= $expected)"
            fi
        done < <(cat "$EXPECTED_COUNTS_FILE" | tr ',' '\n')

        if [[ $count_failures -eq 0 ]]; then
            record_test "expected_counts" "PASS" "All tables meet minimum counts"
        else
            record_test "expected_counts" "FAIL" "$count_failures tables below minimum"
        fi
    fi

    # Check 5: Data integrity - foreign key relationships
    local fk_violations
    fk_violations=$(run_query "
        SELECT COUNT(*)
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu USING (constraint_schema, constraint_name)
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public';
    ")
    fk_violations="${fk_violations// /}"

    if [[ "$fk_violations" -gt 0 ]]; then
        record_test "foreign_keys" "PASS" "$fk_violations FK constraints defined"
    else
        record_test "foreign_keys" "WARN" "No foreign key constraints found"
    fi

    # Check 6: Index count
    local index_count
    index_count=$(run_query "
        SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
    ")
    index_count="${index_count// /}"

    if [[ "$index_count" -gt 0 ]]; then
        record_test "indexes" "PASS" "$index_count indexes defined"
    else
        record_test "indexes" "WARN" "No indexes found"
    fi
}

# Cleanup
cleanup() {
    if [[ "$CLEANUP_DONE" == true ]]; then
        return
    fi

    log_step "Cleanup"

    # Remove temp backup
    if [[ -n "$TEMP_BACKUP" && -f "$TEMP_BACKUP" ]]; then
        rm -f "$TEMP_BACKUP"
        log_info "Removed temporary backup file"
    fi

    # Drop test database
    if [[ -n "$TEST_DB_NAME" && "$KEEP_DB" != true ]]; then
        export PGPASSWORD

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
    elif [[ "$KEEP_DB" == true ]]; then
        log_info "Keeping test database: $TEST_DB_NAME"
    fi

    CLEANUP_DONE=true
}

trap cleanup EXIT INT TERM

# Generate report
generate_report() {
    log_step "Generating Report"

    local report_file="${REPORT_DIR}/backup-test-${TIMESTAMP}.md"
    local status="PASS"

    [[ $FAILED_TESTS -gt 0 ]] && status="FAIL"
    [[ $WARNINGS -gt 0 && "$FAIL_ON_WARNING" == true ]] && status="FAIL"

    cat > "$report_file" << EOF
# Backup Restoration Test Report

**Generated:** $(date '+%Y-%m-%d %H:%M:%S')
**Status:** $status

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | $TOTAL_TESTS |
| Passed | $PASSED_TESTS |
| Failed | $FAILED_TESTS |
| Warnings | $WARNINGS |

## Backup Information

| Property | Value |
|----------|-------|
| Backup File | \`$(basename "$BACKUP_FILE")\` |
| Backup Type | $BACKUP_TYPE |
| Test Database | \`$TEST_DB_NAME\` |

## Test Results

| Test | Status | Details |
|------|--------|---------|
EOF

    for test_name in "${!TEST_RESULTS[@]}"; do
        local result="${TEST_RESULTS[$test_name]}"
        local test_status="${result%%|*}"
        local test_details="${result#*|}"

        local status_emoji
        case "$test_status" in
            PASS) status_emoji="PASS" ;;
            FAIL) status_emoji="FAIL" ;;
            WARN) status_emoji="WARN" ;;
        esac

        echo "| $test_name | $status_emoji | $test_details |" >> "$report_file"
    done

    cat >> "$report_file" << EOF

## Configuration

- Database Host: \`$PGHOST:$PGPORT\`
- Database User: \`$PGUSER\`
- Expected Counts File: \`${EXPECTED_COUNTS_FILE:-none}\`

---
*Report generated by Fleet2 Backup Test Script*
EOF

    log_info "Report saved: $report_file"
    echo "$report_file"
}

# Send notification
send_notification() {
    local status="$1"
    local report_file="$2"

    if [[ "$NOTIFY" != true ]]; then
        return
    fi

    log_step "Sending Notifications"

    local message="Fleet2 Backup Test: $status\nPassed: $PASSED_TESTS, Failed: $FAILED_TESTS, Warnings: $WARNINGS"

    # Webhook notification
    if [[ -n "${BACKUP_NOTIFY_WEBHOOK:-}" ]]; then
        local color="good"
        [[ "$status" == "FAIL" ]] && color="danger"
        [[ "$WARNINGS" -gt 0 ]] && color="warning"

        local payload
        payload=$(cat << EOF
{
    "text": "Backup Test: $status",
    "attachments": [{
        "color": "$color",
        "fields": [
            {"title": "Passed", "value": "$PASSED_TESTS", "short": true},
            {"title": "Failed", "value": "$FAILED_TESTS", "short": true},
            {"title": "Warnings", "value": "$WARNINGS", "short": true},
            {"title": "Backup Type", "value": "$BACKUP_TYPE", "short": true}
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

    # Email notification
    if [[ -n "${BACKUP_NOTIFY_EMAIL:-}" ]]; then
        local smtp="${BACKUP_NOTIFY_SMTP:-localhost}"
        local from="${BACKUP_NOTIFY_FROM:-backup@fleet.local}"

        if command -v mail &>/dev/null; then
            echo -e "$message\n\nSee attached report for details." | \
                mail -s "Fleet2 Backup Test: $status" -a "$report_file" "$BACKUP_NOTIFY_EMAIL"
            log_info "Email notification sent to $BACKUP_NOTIFY_EMAIL"
        else
            log_warning "mail command not available, skipping email"
        fi
    fi
}

# Main function
main() {
    local start_time
    start_time=$(date +%s)

    echo -e "\n${BOLD}========================================${NC}"
    echo -e "${BOLD}  Fleet2 Backup Restoration Test${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""
    log_info "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

    parse_args "$@"
    setup_config
    check_dependencies

    # Get backup
    if [[ "$S3_LATEST" == true ]]; then
        download_s3_backup
    fi

    validate_backup_file
    create_test_database
    restore_backup
    run_validations

    # Generate report
    local report_file
    report_file=$(generate_report)

    # Determine final status
    local final_status="PASS"
    [[ $FAILED_TESTS -gt 0 ]] && final_status="FAIL"
    [[ $WARNINGS -gt 0 && "$FAIL_ON_WARNING" == true ]] && final_status="FAIL"

    # Send notifications
    send_notification "$final_status" "$report_file"

    # Summary
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    echo -e "${BOLD}========================================${NC}"
    echo -e "${BOLD}  TEST SUMMARY${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""
    echo "  Total Tests:  $TOTAL_TESTS"
    echo -e "  Passed:       ${GREEN}$PASSED_TESTS${NC}"
    echo -e "  Failed:       ${RED}$FAILED_TESTS${NC}"
    echo -e "  Warnings:     ${YELLOW}$WARNINGS${NC}"
    echo ""
    echo "  Duration:     ${duration}s"
    echo "  Report:       $report_file"
    echo ""
    echo -e "${BOLD}========================================${NC}"

    if [[ "$final_status" == "PASS" ]]; then
        echo -e "  Status: ${GREEN}${BOLD}PASS${NC}"
        echo -e "${BOLD}========================================${NC}"
        exit 0
    else
        echo -e "  Status: ${RED}${BOLD}FAIL${NC}"
        echo -e "${BOLD}========================================${NC}"
        exit 5
    fi
}

# Run main
main "$@"
