#!/usr/bin/env bash
#
# PostgreSQL Backup Verification Script
# ======================================
#
# Verifies backup integrity by restoring to a temporary database and
# running validation queries.
#
# USAGE:
#   ./scripts/verify-backup.sh <backup_file> [OPTIONS]
#
# ARGUMENTS:
#   backup_file          Path to the backup file (.sql.gz or .sql)
#
# OPTIONS:
#   --expected-counts FILE  JSON file with expected minimum row counts
#   -h, --help              Show this help message
#
# ENVIRONMENT VARIABLES:
#   VERIFY_DB_URL          Full connection string for verification database
#                          (will create temp database within this server)
#   DATABASE_URL           Fallback if VERIFY_DB_URL not set
#   PGHOST                 PostgreSQL host (default: localhost)
#   PGPORT                 PostgreSQL port (default: 5432)
#   PGUSER                 PostgreSQL superuser (required for creating temp DB)
#   PGPASSWORD             PostgreSQL password
#
# EXAMPLES:
#   # Basic verification
#   ./scripts/verify-backup.sh backups/backup_2025-01-01_00-00-00.sql.gz
#
#   # With expected counts
#   ./scripts/verify-backup.sh backups/backup.sql.gz --expected-counts expected-counts.json
#
#   # Using environment variables
#   VERIFY_DB_URL="postgresql://admin:pass@localhost:5432/postgres" \
#     ./scripts/verify-backup.sh backups/backup.sql.gz
#
# EXIT CODES:
#   0 - Verification passed
#   1 - General error
#   2 - Missing required arguments or configuration
#   3 - Backup file not found or invalid
#   4 - Restore failed
#   5 - Validation failed (row count mismatch)
#   6 - Cleanup failed (non-fatal warning)
#

set -euo pipefail

# Script constants
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly TEMP_DB_PREFIX="fleet_verify_"

# Configuration
BACKUP_FILE=""
EXPECTED_COUNTS_FILE=""
TEMP_DB_NAME=""
CLEANUP_DONE=false

# Key tables to verify (in order of importance)
readonly KEY_TABLES=(
  "organisations"
  "users"
  "roles"
  "assets"
  "work_orders"
  "inspections"
  "parts"
  "maintenance_schedules"
  "defects"
  "fuel_transactions"
)

# Color output (if terminal supports it)
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m' # No Color
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    BOLD=''
    NC=''
fi

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_section() {
    echo ""
    echo -e "${BOLD}=== $* ===${NC}"
}

# Show usage information
show_help() {
    sed -n '2,42p' "$0" | sed 's/^# \?//'
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --expected-counts)
                EXPECTED_COUNTS_FILE="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
            *)
                if [[ -z "$BACKUP_FILE" ]]; then
                    BACKUP_FILE="$1"
                else
                    log_error "Unexpected argument: $1"
                    exit 1
                fi
                shift
                ;;
        esac
    done

    if [[ -z "$BACKUP_FILE" ]]; then
        log_error "Backup file is required"
        echo "Usage: $SCRIPT_NAME <backup_file> [OPTIONS]"
        echo "Use --help for more information"
        exit 2
    fi
}

# Parse DATABASE_URL into individual components
parse_database_url() {
    local url="$1"

    # Remove postgresql:// or postgres:// prefix
    url="${url#postgresql://}"
    url="${url#postgres://}"

    # Extract user:password@host:port/database
    local userpass="${url%%@*}"
    local hostportdb="${url#*@}"

    # Extract user and password
    if [[ "$userpass" == *":"* ]]; then
        export PGUSER="${userpass%%:*}"
        export PGPASSWORD="${userpass#*:}"
    else
        export PGUSER="$userpass"
    fi

    # Extract host, port, and database
    local hostport="${hostportdb%%/*}"
    local database="${hostportdb#*/}"

    # Handle query parameters in database name
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

# Validate backup file exists and is readable
validate_backup_file() {
    log_info "Validating backup file..."

    if [[ ! -f "$BACKUP_FILE" ]]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 3
    fi

    if [[ ! -r "$BACKUP_FILE" ]]; then
        log_error "Backup file is not readable: $BACKUP_FILE"
        exit 3
    fi

    # Check if it's a gzip file or plain SQL
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
            log_error "Backup file is not a valid gzip archive"
            exit 3
        fi
        log_info "Backup format: gzip compressed"
    else
        log_info "Backup format: plain SQL"
    fi

    # Get file size
    local file_size
    file_size=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null)
    log_info "Backup file size: $(numfmt --to=iec-i --suffix=B "$file_size" 2>/dev/null || echo "${file_size} bytes")"
}

# Validate configuration
validate_config() {
    log_info "Validating configuration..."

    # Check for VERIFY_DB_URL first, then DATABASE_URL
    if [[ -n "${VERIFY_DB_URL:-}" ]]; then
        log_info "Using VERIFY_DB_URL for connection"
        parse_database_url "$VERIFY_DB_URL"
    elif [[ -n "${DATABASE_URL:-}" ]]; then
        log_info "Using DATABASE_URL for connection"
        parse_database_url "$DATABASE_URL"
    fi

    # Set defaults
    PGHOST="${PGHOST:-localhost}"
    PGPORT="${PGPORT:-5432}"

    # Check required variables
    local missing=()

    [[ -z "${PGUSER:-}" ]] && missing+=("PGUSER")
    [[ -z "${PGPASSWORD:-}" ]] && missing+=("PGPASSWORD")

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required configuration: ${missing[*]}"
        log_error "Set VERIFY_DB_URL, DATABASE_URL, or individual PG* environment variables"
        exit 2
    fi

    log_info "Configuration validated:"
    log_info "  Host: $PGHOST"
    log_info "  Port: $PGPORT"
    log_info "  User: $PGUSER"
}

# Check if required tools are available
check_dependencies() {
    log_info "Checking dependencies..."

    local missing=()

    command -v psql &> /dev/null || missing+=("psql")
    command -v createdb &> /dev/null || missing+=("createdb")
    command -v dropdb &> /dev/null || missing+=("dropdb")
    command -v gunzip &> /dev/null || missing+=("gunzip")

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required commands: ${missing[*]}"
        log_error "Install postgresql-client package"
        exit 1
    fi

    log_info "All dependencies available"
}

# Generate unique temp database name
generate_temp_db_name() {
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local random_suffix
    random_suffix=$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')
    TEMP_DB_NAME="${TEMP_DB_PREFIX}${timestamp}_${random_suffix}"
    log_info "Temporary database: $TEMP_DB_NAME"
}

# Create temporary database
create_temp_database() {
    log_info "Creating temporary database..."

    export PGPASSWORD

    if createdb \
        --host="$PGHOST" \
        --port="$PGPORT" \
        --username="$PGUSER" \
        "$TEMP_DB_NAME" 2>&1; then
        log_success "Temporary database created: $TEMP_DB_NAME"
        return 0
    else
        log_error "Failed to create temporary database"
        return 1
    fi
}

# Restore backup to temporary database
restore_backup() {
    log_section "Restoring Backup"

    local restore_errors=0
    local error_log
    error_log=$(mktemp)

    export PGPASSWORD

    log_info "Restoring backup to temporary database..."
    log_info "This may take a few minutes for large backups..."

    # Determine if backup is compressed
    local restore_cmd
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        restore_cmd="gunzip -c '$BACKUP_FILE'"
    else
        restore_cmd="cat '$BACKUP_FILE'"
    fi

    # Restore using psql
    # Capture both stdout and stderr, filter out benign messages
    if eval "$restore_cmd" | psql \
        --host="$PGHOST" \
        --port="$PGPORT" \
        --username="$PGUSER" \
        --dbname="$TEMP_DB_NAME" \
        --quiet \
        --no-psqlrc \
        --set ON_ERROR_STOP=off \
        2>&1 | tee "$error_log" | grep -iE "(error|fatal)" || true; then
        :
    fi

    # Check for critical errors (ignore common warnings)
    if grep -qiE "(FATAL|ERROR.*syntax|ERROR.*permission denied|ERROR.*does not exist)" "$error_log" 2>/dev/null; then
        log_error "Restore completed with errors"
        restore_errors=1
    fi

    rm -f "$error_log"

    if [[ $restore_errors -ne 0 ]]; then
        log_error "Backup restoration failed with critical errors"
        return 1
    fi

    log_success "Backup restored successfully"
    return 0
}

# Run a query and return result
run_query() {
    local query="$1"
    export PGPASSWORD

    psql \
        --host="$PGHOST" \
        --port="$PGPORT" \
        --username="$PGUSER" \
        --dbname="$TEMP_DB_NAME" \
        --tuples-only \
        --no-align \
        --quiet \
        --no-psqlrc \
        -c "$query" 2>/dev/null
}

# Get row count for a table
get_table_row_count() {
    local table="$1"
    local count
    count=$(run_query "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "-1")
    echo "${count// /}"
}

# Check if a table exists
table_exists() {
    local table="$1"
    local exists
    exists=$(run_query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" 2>/dev/null)
    [[ "$exists" == "t" ]]
}

# Verify schema exists
verify_schema() {
    log_section "Schema Verification"

    local schema_errors=0
    local tables_found=0
    local tables_missing=0

    log_info "Checking for key tables..."

    for table in "${KEY_TABLES[@]}"; do
        if table_exists "$table"; then
            log_success "  Found table: $table"
            ((tables_found++))
        else
            log_warning "  Missing table: $table"
            ((tables_missing++))
        fi
    done

    echo ""
    log_info "Tables found: $tables_found/${#KEY_TABLES[@]}"

    if [[ $tables_missing -gt 0 ]]; then
        log_warning "$tables_missing key tables are missing from backup"
        # Don't fail - some tables might legitimately be empty/missing
    fi

    # Check for any tables at all
    local total_tables
    total_tables=$(run_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

    log_info "Total tables in backup: $total_tables"

    if [[ "$total_tables" -eq 0 ]]; then
        log_error "No tables found in restored database - backup may be empty"
        return 1
    fi

    return 0
}

# Validate row counts
validate_row_counts() {
    log_section "Row Count Validation"

    local validation_errors=0
    local results=()

    log_info "Counting rows in key tables..."

    for table in "${KEY_TABLES[@]}"; do
        if table_exists "$table"; then
            local count
            count=$(get_table_row_count "$table")
            results+=("$table:$count")

            if [[ "$count" == "-1" ]]; then
                log_warning "  $table: ERROR reading count"
            else
                log_info "  $table: $count rows"
            fi
        fi
    done

    # Compare with expected counts if provided
    if [[ -n "$EXPECTED_COUNTS_FILE" ]]; then
        log_info ""
        log_info "Comparing against expected counts from: $EXPECTED_COUNTS_FILE"

        if [[ ! -f "$EXPECTED_COUNTS_FILE" ]]; then
            log_warning "Expected counts file not found - skipping comparison"
        else
            # Parse JSON and compare (using basic bash parsing for portability)
            while IFS=: read -r table count; do
                # Clean up values
                table="${table//\"/}"
                table="${table// /}"
                count="${count//\"/}"
                count="${count// /}"
                count="${count//,/}"
                count="${count//\}/}"

                # Skip empty lines or non-table entries
                [[ -z "$table" || "$table" == "{" || "$table" == "}" ]] && continue

                # Get actual count
                if table_exists "$table"; then
                    local actual_count
                    actual_count=$(get_table_row_count "$table")

                    if [[ "$actual_count" -lt "$count" ]]; then
                        log_error "  $table: $actual_count rows (expected minimum: $count)"
                        ((validation_errors++))
                    else
                        log_success "  $table: $actual_count rows (>= minimum $count)"
                    fi
                fi
            done < <(cat "$EXPECTED_COUNTS_FILE" | tr ',' '\n')
        fi
    fi

    # Store results for report
    ROW_COUNT_RESULTS=("${results[@]}")

    if [[ $validation_errors -gt 0 ]]; then
        return 1
    fi

    return 0
}

# Clean up temporary database
cleanup() {
    if [[ "$CLEANUP_DONE" == "true" ]]; then
        return 0
    fi

    if [[ -n "$TEMP_DB_NAME" ]]; then
        log_section "Cleanup"
        log_info "Dropping temporary database: $TEMP_DB_NAME"

        export PGPASSWORD

        # Terminate any connections to the temp database first
        psql \
            --host="$PGHOST" \
            --port="$PGPORT" \
            --username="$PGUSER" \
            --dbname="postgres" \
            --quiet \
            --no-psqlrc \
            -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TEMP_DB_NAME' AND pid <> pg_backend_pid();" \
            2>/dev/null || true

        if dropdb \
            --host="$PGHOST" \
            --port="$PGPORT" \
            --username="$PGUSER" \
            "$TEMP_DB_NAME" 2>&1; then
            log_success "Temporary database dropped"
        else
            log_warning "Failed to drop temporary database - manual cleanup may be required"
            log_warning "Run: dropdb $TEMP_DB_NAME"
        fi
    fi

    CLEANUP_DONE=true
}

# Set up trap for cleanup on exit
trap cleanup EXIT INT TERM

# Generate verification report
generate_report() {
    local status="$1"
    local start_time="$2"
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log_section "Verification Report"

    echo ""
    echo "========================================"
    echo "  BACKUP VERIFICATION REPORT"
    echo "========================================"
    echo ""
    echo "Backup File: $BACKUP_FILE"
    echo "Verification Time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Duration: ${duration}s"
    echo ""

    # File info
    local file_size
    file_size=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null)
    echo "File Size: $(numfmt --to=iec-i --suffix=B "$file_size" 2>/dev/null || echo "${file_size} bytes")"
    echo ""

    # Row counts
    echo "Table Row Counts:"
    echo "----------------------------------------"
    for result in "${ROW_COUNT_RESULTS[@]}"; do
        local table="${result%%:*}"
        local count="${result#*:}"
        printf "  %-25s %10s\n" "$table" "$count"
    done
    echo ""

    # Status
    echo "========================================"
    if [[ "$status" == "PASS" ]]; then
        echo -e "  Status: ${GREEN}${BOLD}PASS${NC}"
    else
        echo -e "  Status: ${RED}${BOLD}FAIL${NC}"
    fi
    echo "========================================"
    echo ""
}

# Main function
main() {
    local start_time
    start_time=$(date +%s)
    local verification_status="PASS"

    log_section "PostgreSQL Backup Verification"
    log_info "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

    parse_args "$@"
    check_dependencies
    validate_backup_file
    validate_config
    generate_temp_db_name

    # Create temp database
    if ! create_temp_database; then
        log_error "Failed to create temporary database"
        exit 1
    fi

    # Restore backup
    if ! restore_backup; then
        verification_status="FAIL"
        generate_report "$verification_status" "$start_time"
        exit 4
    fi

    # Verify schema
    if ! verify_schema; then
        verification_status="FAIL"
    fi

    # Validate row counts
    if ! validate_row_counts; then
        verification_status="FAIL"
    fi

    # Generate report
    generate_report "$verification_status" "$start_time"

    # Exit with appropriate code
    if [[ "$verification_status" == "PASS" ]]; then
        log_success "Backup verification completed successfully!"
        exit 0
    else
        log_error "Backup verification failed"
        exit 5
    fi
}

# Run main function
main "$@"
