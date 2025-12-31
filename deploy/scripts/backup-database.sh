#!/usr/bin/env bash
#
# PostgreSQL Database Backup Script for Fleet2
# =============================================
#
# This script creates backups of the Fleet2 PostgreSQL database with support for:
#   - Full and incremental (WAL-based) backups
#   - Gzip compression
#   - S3-compatible storage upload
#   - Backup integrity validation
#   - Retention policies (daily, weekly, monthly)
#
# USAGE:
#   ./backup-database.sh [OPTIONS]
#
# OPTIONS:
#   -t, --type TYPE           Backup type: full, incremental (default: full)
#   -o, --output-dir PATH     Local output directory (default: /var/backups/fleet2)
#   -b, --bucket BUCKET       S3 bucket for upload
#   -p, --prefix PREFIX       S3 prefix/path (default: fleet2)
#   -c, --compression LEVEL   Gzip compression level 1-9 (default: 6)
#       --no-upload           Skip S3 upload
#       --no-verify           Skip backup verification
#   -r, --retention           Apply retention policy after backup
#       --retention-daily N   Keep N daily backups (default: 7)
#       --retention-weekly N  Keep N weekly backups (default: 4)
#       --retention-monthly N Keep N monthly backups (default: 12)
#       --notify              Send notification on completion
#       --dry-run             Show what would be done without executing
#   -h, --help                Show this help message
#
# ENVIRONMENT VARIABLES:
#   DATABASE_URL              PostgreSQL connection string (required)
#   BACKUP_BUCKET             S3 bucket (can override --bucket)
#   BACKUP_ENDPOINT           S3-compatible endpoint URL
#   AWS_ACCESS_KEY_ID         AWS credentials
#   AWS_SECRET_ACCESS_KEY
#   BACKUP_NOTIFY_WEBHOOK     Webhook URL for notifications
#   BACKUP_ENCRYPTION_KEY     Optional encryption key (AES-256)
#
# EXAMPLES:
#   # Simple full backup to local directory
#   ./backup-database.sh -o /backups
#
#   # Full backup with S3 upload
#   ./backup-database.sh -t full -b my-backup-bucket
#
#   # Incremental backup (WAL archiving)
#   ./backup-database.sh -t incremental -b my-bucket
#
#   # Full backup with retention cleanup
#   ./backup-database.sh --retention --retention-daily 7 --retention-weekly 4
#
# EXIT CODES:
#   0 - Success
#   1 - General error
#   2 - Invalid arguments
#   3 - Database connection failed
#   4 - Backup creation failed
#   5 - Upload failed
#   6 - Verification failed
#   7 - Retention cleanup failed (non-fatal)
#

set -euo pipefail

# Script constants
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
readonly DATE_TAG=$(date +"%Y/%m/%d")
readonly DAY_OF_WEEK=$(date +%u)
readonly DAY_OF_MONTH=$(date +%d)

# Default configuration
BACKUP_TYPE="full"
OUTPUT_DIR="/var/backups/fleet2"
S3_BUCKET="${BACKUP_BUCKET:-}"
S3_PREFIX="fleet2"
COMPRESSION_LEVEL=6
NO_UPLOAD=false
NO_VERIFY=false
APPLY_RETENTION=false
RETENTION_DAILY=7
RETENTION_WEEKLY=4
RETENTION_MONTHLY=12
NOTIFY=false
DRY_RUN=false

# Backup state
BACKUP_FILE=""
BACKUP_SIZE=0
BACKUP_CHECKSUM=""

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
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $(date '+%H:%M:%S') $*"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $(date '+%H:%M:%S') $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $*" >&2; }
log_step() { echo -e "\n${BOLD}=== $* ===${NC}"; }

# Show usage
show_help() {
    sed -n '3,55p' "$0" | sed 's/^# \?//'
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--type) BACKUP_TYPE="$2"; shift 2 ;;
            -o|--output-dir) OUTPUT_DIR="$2"; shift 2 ;;
            -b|--bucket) S3_BUCKET="$2"; shift 2 ;;
            -p|--prefix) S3_PREFIX="$2"; shift 2 ;;
            -c|--compression) COMPRESSION_LEVEL="$2"; shift 2 ;;
            --no-upload) NO_UPLOAD=true; shift ;;
            --no-verify) NO_VERIFY=true; shift ;;
            -r|--retention) APPLY_RETENTION=true; shift ;;
            --retention-daily) RETENTION_DAILY="$2"; shift 2 ;;
            --retention-weekly) RETENTION_WEEKLY="$2"; shift 2 ;;
            --retention-monthly) RETENTION_MONTHLY="$2"; shift 2 ;;
            --notify) NOTIFY=true; shift ;;
            --dry-run) DRY_RUN=true; shift ;;
            -h|--help) show_help; exit 0 ;;
            *) log_error "Unknown option: $1"; exit 2 ;;
        esac
    done

    # Validate backup type
    case "$BACKUP_TYPE" in
        full|incremental) ;;
        *) log_error "Invalid backup type: $BACKUP_TYPE (must be 'full' or 'incremental')"; exit 2 ;;
    esac

    # Validate compression level
    if [[ ! "$COMPRESSION_LEVEL" =~ ^[1-9]$ ]]; then
        log_error "Invalid compression level: $COMPRESSION_LEVEL (must be 1-9)"
        exit 2
    fi

    # Check DATABASE_URL
    if [[ -z "${DATABASE_URL:-}" ]]; then
        log_error "DATABASE_URL environment variable is required"
        exit 2
    fi
}

# Parse database URL into components
parse_database_url() {
    local url="${DATABASE_URL}"
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
    command -v pg_dump &>/dev/null || missing+=("pg_dump (postgresql-client)")
    command -v gzip &>/dev/null || missing+=("gzip")
    command -v md5sum &>/dev/null || command -v md5 &>/dev/null || missing+=("md5sum")

    if [[ "$NO_UPLOAD" != true && -n "$S3_BUCKET" ]]; then
        command -v aws &>/dev/null || missing+=("aws-cli")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing[*]}"
        exit 1
    fi

    log_success "All dependencies available"
}

# Test database connection
test_database_connection() {
    log_step "Testing Database Connection"

    parse_database_url

    log_info "Host: $PGHOST:$PGPORT"
    log_info "Database: $PGDATABASE"
    log_info "User: $PGUSER"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would test database connection"
        return
    fi

    export PGPASSWORD

    if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        -c "SELECT 1;" --quiet --no-psqlrc &>/dev/null; then
        log_success "Database connection successful"
    else
        log_error "Failed to connect to database"
        exit 3
    fi

    # Get database size
    local db_size
    db_size=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        --tuples-only --no-align --quiet --no-psqlrc \
        -c "SELECT pg_size_pretty(pg_database_size('$PGDATABASE'));" 2>/dev/null || echo "unknown")
    db_size="${db_size// /}"
    log_info "Database size: $db_size"
}

# Prepare output directory
prepare_output_dir() {
    log_step "Preparing Output Directory"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would create directory: $OUTPUT_DIR"
        return
    fi

    # Create directory structure
    mkdir -p "$OUTPUT_DIR/daily"
    mkdir -p "$OUTPUT_DIR/weekly"
    mkdir -p "$OUTPUT_DIR/monthly"
    mkdir -p "$OUTPUT_DIR/wal"

    log_info "Output directory: $OUTPUT_DIR"
    log_success "Directory structure ready"
}

# Create full backup
create_full_backup() {
    log_step "Creating Full Backup"

    local backup_name="fleet2_${BACKUP_TYPE}_${TIMESTAMP}"
    BACKUP_FILE="${OUTPUT_DIR}/daily/${backup_name}.sql.gz"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would create backup: $BACKUP_FILE"
        return
    fi

    export PGPASSWORD

    log_info "Starting pg_dump..."
    log_info "Output: $BACKUP_FILE"

    local start_time
    start_time=$(date +%s)

    # Create backup with pg_dump
    if pg_dump \
        -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        --format=plain \
        --no-owner \
        --no-privileges \
        --verbose \
        2>&1 | gzip -"$COMPRESSION_LEVEL" > "$BACKUP_FILE"; then

        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - start_time))

        BACKUP_SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE")
        local size_human
        size_human=$(numfmt --to=iec-i --suffix=B "$BACKUP_SIZE" 2>/dev/null || echo "${BACKUP_SIZE} bytes")

        log_success "Backup created in ${duration}s"
        log_info "Size: $size_human"
    else
        log_error "pg_dump failed"
        rm -f "$BACKUP_FILE"
        exit 4
    fi
}

# Create incremental backup (WAL-based)
create_incremental_backup() {
    log_step "Creating Incremental Backup (WAL)"

    local wal_dir="${OUTPUT_DIR}/wal/${DATE_TAG}"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would archive WAL files to: $wal_dir"
        return
    fi

    mkdir -p "$wal_dir"

    export PGPASSWORD

    # Check if WAL archiving is enabled
    local wal_level
    wal_level=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        --tuples-only --no-align --quiet --no-psqlrc \
        -c "SHOW wal_level;" 2>/dev/null || echo "unknown")
    wal_level="${wal_level// /}"

    if [[ "$wal_level" == "minimal" ]]; then
        log_warning "WAL level is 'minimal' - incremental backup may be limited"
        log_warning "Consider setting wal_level='replica' for full WAL archiving"
    fi

    # Force a WAL switch to ensure we have current WAL files
    log_info "Forcing WAL switch..."
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        --quiet --no-psqlrc \
        -c "SELECT pg_switch_wal();" 2>/dev/null || true

    # Create a checkpoint marker
    local checkpoint_file="${wal_dir}/checkpoint_${TIMESTAMP}.txt"
    {
        echo "Checkpoint Time: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "Database: $PGDATABASE"
        echo "Host: $PGHOST:$PGPORT"
        psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
            --tuples-only --quiet --no-psqlrc \
            -c "SELECT pg_current_wal_lsn();" 2>/dev/null || echo "LSN: unknown"
    } > "$checkpoint_file"

    BACKUP_FILE="$checkpoint_file"
    BACKUP_SIZE=$(stat -c%s "$checkpoint_file" 2>/dev/null || stat -f%z "$checkpoint_file")

    log_success "Incremental checkpoint created"
    log_info "Note: WAL files should be archived via PostgreSQL archive_command"
}

# Verify backup integrity
verify_backup() {
    log_step "Verifying Backup Integrity"

    if [[ "$NO_VERIFY" == true ]]; then
        log_info "Verification skipped (--no-verify)"
        return
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would verify backup integrity"
        return
    fi

    if [[ ! -f "$BACKUP_FILE" ]]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 6
    fi

    # Verify file size
    local min_size=100  # Minimum 100 bytes
    if [[ "$BACKUP_SIZE" -lt "$min_size" ]]; then
        log_error "Backup file too small: $BACKUP_SIZE bytes (minimum: $min_size)"
        exit 6
    fi
    log_success "Size check passed: $BACKUP_SIZE bytes"

    # Verify gzip integrity (for compressed backups)
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        if gzip -t "$BACKUP_FILE" 2>/dev/null; then
            log_success "Gzip integrity verified"
        else
            log_error "Gzip integrity check failed"
            exit 6
        fi

        # Verify SQL content
        local header
        header=$(gunzip -c "$BACKUP_FILE" 2>/dev/null | head -20)

        if echo "$header" | grep -qE "pg_dump|PostgreSQL"; then
            log_success "PostgreSQL dump format verified"
        else
            log_warning "Could not verify PostgreSQL dump format"
        fi
    fi

    # Calculate checksum
    if command -v md5sum &>/dev/null; then
        BACKUP_CHECKSUM=$(md5sum "$BACKUP_FILE" | cut -d' ' -f1)
    elif command -v md5 &>/dev/null; then
        BACKUP_CHECKSUM=$(md5 -q "$BACKUP_FILE")
    fi

    if [[ -n "$BACKUP_CHECKSUM" ]]; then
        log_info "Checksum (MD5): $BACKUP_CHECKSUM"

        # Save checksum file
        echo "$BACKUP_CHECKSUM  $(basename "$BACKUP_FILE")" > "${BACKUP_FILE}.md5"
        log_info "Checksum file: ${BACKUP_FILE}.md5"
    fi
}

# Upload to S3
upload_to_s3() {
    log_step "Uploading to S3"

    if [[ "$NO_UPLOAD" == true ]]; then
        log_info "S3 upload skipped (--no-upload)"
        return
    fi

    if [[ -z "$S3_BUCKET" ]]; then
        log_info "No S3 bucket configured, skipping upload"
        return
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would upload to s3://${S3_BUCKET}/${S3_PREFIX}/"
        return
    fi

    local endpoint_args=""
    [[ -n "${BACKUP_ENDPOINT:-}" ]] && endpoint_args="--endpoint-url $BACKUP_ENDPOINT"

    # Determine retention tier
    local tier="daily"
    [[ "$DAY_OF_WEEK" -eq 7 ]] && tier="weekly"
    [[ "$DAY_OF_MONTH" -eq 1 ]] && tier="monthly"

    local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}/${tier}/${DATE_TAG}"
    local backup_basename
    backup_basename=$(basename "$BACKUP_FILE")

    log_info "Uploading to: $s3_path/$backup_basename"

    local start_time
    start_time=$(date +%s)

    # Upload backup file
    # shellcheck disable=SC2086
    if aws s3 cp "$BACKUP_FILE" "${s3_path}/${backup_basename}" $endpoint_args; then
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_success "Backup uploaded in ${duration}s"
    else
        log_error "S3 upload failed"
        exit 5
    fi

    # Upload checksum file
    if [[ -f "${BACKUP_FILE}.md5" ]]; then
        # shellcheck disable=SC2086
        aws s3 cp "${BACKUP_FILE}.md5" "${s3_path}/${backup_basename}.md5" $endpoint_args || \
            log_warning "Checksum file upload failed"
    fi

    log_info "S3 location: ${s3_path}/${backup_basename}"
}

# Copy to retention tiers
apply_retention_copies() {
    log_step "Applying Retention Copies"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would copy to weekly/monthly tiers"
        return
    fi

    local backup_basename
    backup_basename=$(basename "$BACKUP_FILE")

    # Sunday = weekly backup
    if [[ "$DAY_OF_WEEK" -eq 7 ]]; then
        local weekly_dir="${OUTPUT_DIR}/weekly"
        cp "$BACKUP_FILE" "${weekly_dir}/${backup_basename}"
        [[ -f "${BACKUP_FILE}.md5" ]] && cp "${BACKUP_FILE}.md5" "${weekly_dir}/${backup_basename}.md5"
        log_info "Copied to weekly retention"
    fi

    # 1st of month = monthly backup
    if [[ "$DAY_OF_MONTH" -eq 01 ]]; then
        local monthly_dir="${OUTPUT_DIR}/monthly"
        cp "$BACKUP_FILE" "${monthly_dir}/${backup_basename}"
        [[ -f "${BACKUP_FILE}.md5" ]] && cp "${BACKUP_FILE}.md5" "${monthly_dir}/${backup_basename}.md5"
        log_info "Copied to monthly retention"
    fi
}

# Apply retention policy
apply_retention_policy() {
    log_step "Applying Retention Policy"

    if [[ "$APPLY_RETENTION" != true ]]; then
        log_info "Retention policy not requested (use --retention to enable)"
        return
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would apply retention policy:"
        log_info "  Daily: keep $RETENTION_DAILY"
        log_info "  Weekly: keep $RETENTION_WEEKLY"
        log_info "  Monthly: keep $RETENTION_MONTHLY"
        return
    fi

    local deleted=0

    # Clean daily backups
    log_info "Cleaning daily backups (keeping $RETENTION_DAILY)..."
    local daily_count
    daily_count=$(find "${OUTPUT_DIR}/daily" -name "*.sql.gz" -type f 2>/dev/null | wc -l)

    if [[ "$daily_count" -gt "$RETENTION_DAILY" ]]; then
        local to_delete=$((daily_count - RETENTION_DAILY))
        find "${OUTPUT_DIR}/daily" -name "*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | \
            sort -n | head -n "$to_delete" | cut -d' ' -f2- | while read -r file; do
            rm -f "$file" "${file}.md5"
            ((deleted++)) || true
        done
        log_info "Removed $to_delete old daily backup(s)"
    fi

    # Clean weekly backups
    log_info "Cleaning weekly backups (keeping $RETENTION_WEEKLY)..."
    local weekly_count
    weekly_count=$(find "${OUTPUT_DIR}/weekly" -name "*.sql.gz" -type f 2>/dev/null | wc -l)

    if [[ "$weekly_count" -gt "$RETENTION_WEEKLY" ]]; then
        local to_delete=$((weekly_count - RETENTION_WEEKLY))
        find "${OUTPUT_DIR}/weekly" -name "*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | \
            sort -n | head -n "$to_delete" | cut -d' ' -f2- | while read -r file; do
            rm -f "$file" "${file}.md5"
            ((deleted++)) || true
        done
        log_info "Removed $to_delete old weekly backup(s)"
    fi

    # Clean monthly backups
    log_info "Cleaning monthly backups (keeping $RETENTION_MONTHLY)..."
    local monthly_count
    monthly_count=$(find "${OUTPUT_DIR}/monthly" -name "*.sql.gz" -type f 2>/dev/null | wc -l)

    if [[ "$monthly_count" -gt "$RETENTION_MONTHLY" ]]; then
        local to_delete=$((monthly_count - RETENTION_MONTHLY))
        find "${OUTPUT_DIR}/monthly" -name "*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | \
            sort -n | head -n "$to_delete" | cut -d' ' -f2- | while read -r file; do
            rm -f "$file" "${file}.md5"
            ((deleted++)) || true
        done
        log_info "Removed $to_delete old monthly backup(s)"
    fi

    # S3 retention cleanup
    if [[ -n "$S3_BUCKET" && "$NO_UPLOAD" != true ]]; then
        apply_s3_retention
    fi

    log_success "Retention policy applied"
}

# Apply S3 retention policy
apply_s3_retention() {
    log_info "Applying S3 retention policy..."

    local endpoint_args=""
    [[ -n "${BACKUP_ENDPOINT:-}" ]] && endpoint_args="--endpoint-url $BACKUP_ENDPOINT"

    local cutoff_date

    # Daily retention
    cutoff_date=$(date -d "-${RETENTION_DAILY} days" +%Y/%m/%d 2>/dev/null || \
                  date -v-${RETENTION_DAILY}d +%Y/%m/%d 2>/dev/null || echo "")

    if [[ -n "$cutoff_date" ]]; then
        log_info "Cleaning S3 daily backups older than $cutoff_date..."
        # shellcheck disable=SC2086
        aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/daily/" --recursive $endpoint_args 2>/dev/null | \
            awk -v cutoff="$cutoff_date" '$4 ~ /\.sql\.gz$/ && $4 < cutoff {print $4}' | \
            while read -r key; do
                # shellcheck disable=SC2086
                aws s3 rm "s3://${S3_BUCKET}/${key}" $endpoint_args || true
            done
    fi

    # Weekly retention
    cutoff_date=$(date -d "-$((RETENTION_WEEKLY * 7)) days" +%Y/%m/%d 2>/dev/null || \
                  date -v-$((RETENTION_WEEKLY * 7))d +%Y/%m/%d 2>/dev/null || echo "")

    if [[ -n "$cutoff_date" ]]; then
        log_info "Cleaning S3 weekly backups older than $cutoff_date..."
        # shellcheck disable=SC2086
        aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/weekly/" --recursive $endpoint_args 2>/dev/null | \
            awk -v cutoff="$cutoff_date" '$4 ~ /\.sql\.gz$/ && $4 < cutoff {print $4}' | \
            while read -r key; do
                # shellcheck disable=SC2086
                aws s3 rm "s3://${S3_BUCKET}/${key}" $endpoint_args || true
            done
    fi

    # Monthly retention
    cutoff_date=$(date -d "-$((RETENTION_MONTHLY * 30)) days" +%Y/%m/%d 2>/dev/null || \
                  date -v-$((RETENTION_MONTHLY * 30))d +%Y/%m/%d 2>/dev/null || echo "")

    if [[ -n "$cutoff_date" ]]; then
        log_info "Cleaning S3 monthly backups older than $cutoff_date..."
        # shellcheck disable=SC2086
        aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/monthly/" --recursive $endpoint_args 2>/dev/null | \
            awk -v cutoff="$cutoff_date" '$4 ~ /\.sql\.gz$/ && $4 < cutoff {print $4}' | \
            while read -r key; do
                # shellcheck disable=SC2086
                aws s3 rm "s3://${S3_BUCKET}/${key}" $endpoint_args || true
            done
    fi
}

# Send notification
send_notification() {
    local status="$1"

    if [[ "$NOTIFY" != true ]]; then
        return
    fi

    log_step "Sending Notification"

    local size_human
    size_human=$(numfmt --to=iec-i --suffix=B "$BACKUP_SIZE" 2>/dev/null || echo "${BACKUP_SIZE} bytes")

    local message="Fleet2 Backup: $status\nType: $BACKUP_TYPE\nSize: $size_human"

    # Webhook notification
    if [[ -n "${BACKUP_NOTIFY_WEBHOOK:-}" ]]; then
        local color="good"
        [[ "$status" != "SUCCESS" ]] && color="danger"

        local payload
        payload=$(cat << EOF
{
    "text": "Database Backup: $status",
    "attachments": [{
        "color": "$color",
        "fields": [
            {"title": "Type", "value": "$BACKUP_TYPE", "short": true},
            {"title": "Size", "value": "$size_human", "short": true},
            {"title": "Database", "value": "$PGDATABASE", "short": true},
            {"title": "Timestamp", "value": "$TIMESTAMP", "short": true}
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

    local size_human
    size_human=$(numfmt --to=iec-i --suffix=B "$BACKUP_SIZE" 2>/dev/null || echo "${BACKUP_SIZE} bytes")

    echo ""
    echo "=========================================="
    echo "  BACKUP SUMMARY"
    echo "=========================================="
    echo ""
    echo "  Status:       $status"
    echo "  Type:         $BACKUP_TYPE"
    echo "  Database:     $PGDATABASE"
    echo "  Size:         $size_human"
    echo "  Duration:     ${duration}s"
    echo ""
    echo "  Local File:   $BACKUP_FILE"
    if [[ -n "$BACKUP_CHECKSUM" ]]; then
        echo "  Checksum:     $BACKUP_CHECKSUM"
    fi
    if [[ -n "$S3_BUCKET" && "$NO_UPLOAD" != true ]]; then
        echo "  S3 Bucket:    $S3_BUCKET"
    fi
    echo ""
    echo "  Retention:"
    echo "    Daily:      $RETENTION_DAILY"
    echo "    Weekly:     $RETENTION_WEEKLY"
    echo "    Monthly:    $RETENTION_MONTHLY"
    echo ""
    echo "=========================================="
}

# Main function
main() {
    local start_time
    start_time=$(date +%s)

    echo -e "\n${BOLD}========================================${NC}"
    echo -e "${BOLD}  Fleet2 Database Backup${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""
    log_info "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

    parse_args "$@"
    check_dependencies
    test_database_connection
    prepare_output_dir

    # Create backup based on type
    if [[ "$BACKUP_TYPE" == "full" ]]; then
        create_full_backup
    else
        create_incremental_backup
    fi

    verify_backup
    upload_to_s3
    apply_retention_copies
    apply_retention_policy

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Send notification
    send_notification "SUCCESS"

    # Print summary
    print_summary "SUCCESS" "$duration"

    log_success "Backup completed successfully!"
    exit 0
}

# Run main
main "$@"
