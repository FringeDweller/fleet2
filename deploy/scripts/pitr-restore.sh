#!/usr/bin/env bash
#
# PostgreSQL Point-in-Time Recovery Script for Fleet2
# ====================================================
#
# This script automates Point-in-Time Recovery (PITR) for PostgreSQL databases.
# It can recover to a specific timestamp, transaction ID, or restore point.
#
# USAGE:
#   ./pitr-restore.sh [OPTIONS]
#
# OPTIONS:
#   -b, --base-backup PATH    Path to base backup file (required)
#   -w, --wal-archive PATH    Path to WAL archive directory
#   -s, --wal-s3 BUCKET       S3 bucket for WAL archive
#   -t, --target-time TIME    Recover to specific time (YYYY-MM-DD HH:MM:SS)
#   -x, --target-xid XID      Recover to specific transaction ID
#   -n, --target-name NAME    Recover to named restore point
#   -l, --target-lsn LSN      Recover to specific LSN
#       --target-latest       Recover to latest available point (default)
#   -d, --data-dir PATH       PostgreSQL data directory (default: /var/lib/postgresql/data)
#   -o, --output-dir PATH     Output directory for recovered database
#       --dry-run             Show what would be done without executing
#       --no-promote          Don't promote to primary after recovery
#   -h, --help                Show this help message
#
# ENVIRONMENT VARIABLES:
#   PGDATA              PostgreSQL data directory
#   AWS_ACCESS_KEY_ID   AWS credentials for S3 WAL archive
#   AWS_SECRET_ACCESS_KEY
#   BACKUP_ENDPOINT     S3-compatible endpoint URL
#   BACKUP_BUCKET       S3 bucket for WAL archive
#
# EXAMPLES:
#   # Recover to specific time from local backup and WAL
#   ./pitr-restore.sh -b /backups/base.tar.gz -w /wal_archive -t "2025-01-15 14:30:00"
#
#   # Recover to latest from S3-stored WAL
#   ./pitr-restore.sh -b base.tar.gz -s fleet2-backups --target-latest
#
#   # Recover to restore point
#   ./pitr-restore.sh -b base.tar.gz -w /wal -n "before_migration"
#
# EXIT CODES:
#   0 - Success
#   1 - General error
#   2 - Invalid arguments
#   3 - Base backup not found
#   4 - WAL archive not accessible
#   5 - Recovery failed
#   6 - Promotion failed
#

set -euo pipefail

# Script constants
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Default configuration
DATA_DIR="${PGDATA:-/var/lib/postgresql/data}"
OUTPUT_DIR=""
BASE_BACKUP=""
WAL_ARCHIVE=""
WAL_S3_BUCKET=""
TARGET_TIME=""
TARGET_XID=""
TARGET_NAME=""
TARGET_LSN=""
TARGET_LATEST=false
DRY_RUN=false
NO_PROMOTE=false

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
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_step() { echo -e "\n${BOLD}=== $* ===${NC}"; }

# Show usage
show_help() {
    sed -n '3,50p' "$0" | sed 's/^# \?//'
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -b|--base-backup) BASE_BACKUP="$2"; shift 2 ;;
            -w|--wal-archive) WAL_ARCHIVE="$2"; shift 2 ;;
            -s|--wal-s3) WAL_S3_BUCKET="$2"; shift 2 ;;
            -t|--target-time) TARGET_TIME="$2"; shift 2 ;;
            -x|--target-xid) TARGET_XID="$2"; shift 2 ;;
            -n|--target-name) TARGET_NAME="$2"; shift 2 ;;
            -l|--target-lsn) TARGET_LSN="$2"; shift 2 ;;
            --target-latest) TARGET_LATEST=true; shift ;;
            -d|--data-dir) DATA_DIR="$2"; shift 2 ;;
            -o|--output-dir) OUTPUT_DIR="$2"; shift 2 ;;
            --dry-run) DRY_RUN=true; shift ;;
            --no-promote) NO_PROMOTE=true; shift ;;
            -h|--help) show_help; exit 0 ;;
            *) log_error "Unknown option: $1"; exit 2 ;;
        esac
    done

    # Validate required arguments
    if [[ -z "$BASE_BACKUP" ]]; then
        log_error "Base backup path is required (-b/--base-backup)"
        echo "Use --help for usage information"
        exit 2
    fi

    # Validate WAL source
    if [[ -z "$WAL_ARCHIVE" && -z "$WAL_S3_BUCKET" ]]; then
        log_error "WAL archive source is required (-w/--wal-archive or -s/--wal-s3)"
        exit 2
    fi

    # Set output directory default
    if [[ -z "$OUTPUT_DIR" ]]; then
        OUTPUT_DIR="${DATA_DIR}_recovered_${TIMESTAMP}"
    fi

    # Default to target latest if no target specified
    if [[ -z "$TARGET_TIME" && -z "$TARGET_XID" && -z "$TARGET_NAME" && -z "$TARGET_LSN" ]]; then
        TARGET_LATEST=true
    fi
}

# Check dependencies
check_dependencies() {
    log_step "Checking Dependencies"

    local missing=()
    command -v pg_ctl &>/dev/null || missing+=("postgresql (pg_ctl)")
    command -v tar &>/dev/null || missing+=("tar")
    command -v gzip &>/dev/null || missing+=("gzip")

    if [[ -n "$WAL_S3_BUCKET" ]]; then
        command -v aws &>/dev/null || missing+=("aws-cli")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing[*]}"
        exit 1
    fi

    log_success "All dependencies available"
}

# Validate base backup
validate_base_backup() {
    log_step "Validating Base Backup"

    if [[ ! -f "$BASE_BACKUP" ]]; then
        log_error "Base backup not found: $BASE_BACKUP"
        exit 3
    fi

    local file_size
    file_size=$(stat -c%s "$BASE_BACKUP" 2>/dev/null || stat -f%z "$BASE_BACKUP")
    log_info "Base backup: $BASE_BACKUP"
    log_info "Size: $(numfmt --to=iec-i --suffix=B "$file_size" 2>/dev/null || echo "${file_size} bytes")"

    # Validate archive format
    if [[ "$BASE_BACKUP" == *.tar.gz || "$BASE_BACKUP" == *.tgz ]]; then
        if ! gzip -t "$BASE_BACKUP" 2>/dev/null; then
            log_error "Base backup is not a valid gzip archive"
            exit 3
        fi
        log_info "Format: gzip-compressed tar"
    elif [[ "$BASE_BACKUP" == *.tar ]]; then
        log_info "Format: tar archive"
    else
        log_warning "Unknown archive format, assuming tar"
    fi

    log_success "Base backup validated"
}

# Validate WAL archive
validate_wal_archive() {
    log_step "Validating WAL Archive"

    if [[ -n "$WAL_ARCHIVE" ]]; then
        if [[ ! -d "$WAL_ARCHIVE" ]]; then
            log_error "WAL archive directory not found: $WAL_ARCHIVE"
            exit 4
        fi

        local wal_count
        wal_count=$(find "$WAL_ARCHIVE" -name "0*" -type f 2>/dev/null | wc -l)
        log_info "WAL archive: $WAL_ARCHIVE"
        log_info "WAL files found: $wal_count"

        if [[ $wal_count -eq 0 ]]; then
            log_warning "No WAL files found in archive - recovery may be limited"
        fi
    fi

    if [[ -n "$WAL_S3_BUCKET" ]]; then
        log_info "WAL S3 bucket: $WAL_S3_BUCKET"

        local endpoint_args=""
        [[ -n "${BACKUP_ENDPOINT:-}" ]] && endpoint_args="--endpoint-url $BACKUP_ENDPOINT"

        # Check S3 access
        if ! aws s3 ls "s3://${WAL_S3_BUCKET}/wal-archive/" $endpoint_args &>/dev/null; then
            log_warning "Cannot list WAL archive in S3 - check credentials and bucket"
        else
            log_success "S3 WAL archive accessible"
        fi
    fi
}

# Prepare output directory
prepare_output_dir() {
    log_step "Preparing Output Directory"

    if [[ -d "$OUTPUT_DIR" ]]; then
        log_error "Output directory already exists: $OUTPUT_DIR"
        log_error "Remove it or specify a different directory with -o"
        exit 1
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would create directory: $OUTPUT_DIR"
        return
    fi

    mkdir -p "$OUTPUT_DIR"
    log_info "Created output directory: $OUTPUT_DIR"
}

# Extract base backup
extract_base_backup() {
    log_step "Extracting Base Backup"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would extract $BASE_BACKUP to $OUTPUT_DIR"
        return
    fi

    log_info "Extracting backup to $OUTPUT_DIR..."

    local tar_opts=""
    if [[ "$BASE_BACKUP" == *.gz || "$BASE_BACKUP" == *.tgz ]]; then
        tar_opts="-xzf"
    else
        tar_opts="-xf"
    fi

    if tar $tar_opts "$BASE_BACKUP" -C "$OUTPUT_DIR"; then
        log_success "Base backup extracted"
    else
        log_error "Failed to extract base backup"
        exit 5
    fi

    # Check for nested directory (common in pg_basebackup)
    if [[ -d "$OUTPUT_DIR/base" ]]; then
        log_info "Moving files from base/ subdirectory"
        mv "$OUTPUT_DIR/base"/* "$OUTPUT_DIR/" 2>/dev/null || true
        rmdir "$OUTPUT_DIR/base" 2>/dev/null || true
    fi
}

# Create restore command script
create_restore_command() {
    log_step "Creating Restore Command"

    local restore_script="$OUTPUT_DIR/restore_wal.sh"

    if [[ -n "$WAL_ARCHIVE" ]]; then
        cat > "$restore_script" << 'SCRIPT'
#!/bin/bash
WAL_NAME="$1"
DEST_PATH="$2"
WAL_ARCHIVE="__WAL_ARCHIVE__"

# Try compressed first
if [[ -f "${WAL_ARCHIVE}/${WAL_NAME}.gz" ]]; then
    gunzip < "${WAL_ARCHIVE}/${WAL_NAME}.gz" > "$DEST_PATH"
    exit 0
fi

# Try uncompressed
if [[ -f "${WAL_ARCHIVE}/${WAL_NAME}" ]]; then
    cp "${WAL_ARCHIVE}/${WAL_NAME}" "$DEST_PATH"
    exit 0
fi

exit 1
SCRIPT
        sed -i "s|__WAL_ARCHIVE__|$WAL_ARCHIVE|g" "$restore_script"
    elif [[ -n "$WAL_S3_BUCKET" ]]; then
        cat > "$restore_script" << 'SCRIPT'
#!/bin/bash
set -e
WAL_NAME="$1"
DEST_PATH="$2"
BUCKET="__WAL_S3_BUCKET__"
ENDPOINT="__BACKUP_ENDPOINT__"

ENDPOINT_ARG=""
[[ -n "$ENDPOINT" ]] && ENDPOINT_ARG="--endpoint-url $ENDPOINT"

# Try date-organized paths
for days_ago in 0 1 2 3 4 5 6 7 14 30; do
    DATE=$(date -d "-${days_ago} days" +%Y/%m/%d 2>/dev/null || date -v-${days_ago}d +%Y/%m/%d 2>/dev/null || continue)

    # Compressed
    if aws s3 cp "s3://${BUCKET}/wal-archive/${DATE}/${WAL_NAME}.gz" - $ENDPOINT_ARG 2>/dev/null | gunzip > "$DEST_PATH" 2>/dev/null; then
        exit 0
    fi

    # Uncompressed
    if aws s3 cp "s3://${BUCKET}/wal-archive/${DATE}/${WAL_NAME}" "$DEST_PATH" $ENDPOINT_ARG 2>/dev/null; then
        exit 0
    fi
done

# Try flat path
if aws s3 cp "s3://${BUCKET}/wal-archive/${WAL_NAME}.gz" - $ENDPOINT_ARG 2>/dev/null | gunzip > "$DEST_PATH" 2>/dev/null; then
    exit 0
fi
if aws s3 cp "s3://${BUCKET}/wal-archive/${WAL_NAME}" "$DEST_PATH" $ENDPOINT_ARG 2>/dev/null; then
    exit 0
fi

exit 1
SCRIPT
        sed -i "s|__WAL_S3_BUCKET__|$WAL_S3_BUCKET|g" "$restore_script"
        sed -i "s|__BACKUP_ENDPOINT__|${BACKUP_ENDPOINT:-}|g" "$restore_script"
    fi

    chmod +x "$restore_script"
    log_info "Created restore script: $restore_script"
}

# Configure recovery settings
configure_recovery() {
    log_step "Configuring Recovery Settings"

    local recovery_conf="$OUTPUT_DIR/postgresql.auto.conf"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would configure recovery settings"
        return
    fi

    # Backup existing postgresql.auto.conf
    if [[ -f "$recovery_conf" ]]; then
        cp "$recovery_conf" "${recovery_conf}.backup"
    fi

    # Add recovery settings
    cat >> "$recovery_conf" << EOF

# PITR Recovery Settings - Added by $SCRIPT_NAME at $(date)
restore_command = '$OUTPUT_DIR/restore_wal.sh %f %p'
recovery_target_timeline = 'latest'
EOF

    # Add target specification
    if [[ -n "$TARGET_TIME" ]]; then
        echo "recovery_target_time = '$TARGET_TIME'" >> "$recovery_conf"
        log_info "Recovery target: time = $TARGET_TIME"
    elif [[ -n "$TARGET_XID" ]]; then
        echo "recovery_target_xid = '$TARGET_XID'" >> "$recovery_conf"
        log_info "Recovery target: xid = $TARGET_XID"
    elif [[ -n "$TARGET_NAME" ]]; then
        echo "recovery_target_name = '$TARGET_NAME'" >> "$recovery_conf"
        log_info "Recovery target: name = $TARGET_NAME"
    elif [[ -n "$TARGET_LSN" ]]; then
        echo "recovery_target_lsn = '$TARGET_LSN'" >> "$recovery_conf"
        log_info "Recovery target: lsn = $TARGET_LSN"
    else
        log_info "Recovery target: latest available"
    fi

    # Set recovery action
    if [[ "$NO_PROMOTE" == true ]]; then
        echo "recovery_target_action = 'pause'" >> "$recovery_conf"
        log_info "Recovery action: pause (manual promotion required)"
    else
        echo "recovery_target_action = 'promote'" >> "$recovery_conf"
        log_info "Recovery action: promote"
    fi

    # Create recovery signal file
    touch "$OUTPUT_DIR/recovery.signal"
    log_info "Created recovery.signal"

    log_success "Recovery configured"
}

# Start PostgreSQL recovery
start_recovery() {
    log_step "Starting Recovery"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would start PostgreSQL in recovery mode"
        log_info "[DRY RUN] Data directory: $OUTPUT_DIR"
        return
    fi

    # Ensure proper permissions
    if [[ -n "${PGUSER:-}" ]]; then
        chown -R "$PGUSER:$PGUSER" "$OUTPUT_DIR" 2>/dev/null || log_warning "Could not change ownership"
    fi
    chmod 700 "$OUTPUT_DIR"

    log_info "Starting PostgreSQL in recovery mode..."
    log_info "This may take a while depending on WAL to replay..."

    # Start PostgreSQL
    if pg_ctl -D "$OUTPUT_DIR" -l "$OUTPUT_DIR/recovery.log" start; then
        log_success "PostgreSQL started in recovery mode"
    else
        log_error "Failed to start PostgreSQL"
        log_error "Check $OUTPUT_DIR/recovery.log for details"
        exit 5
    fi

    # Wait for recovery to complete
    log_info "Waiting for recovery to complete..."
    local max_wait=3600  # 1 hour max
    local waited=0

    while [[ -f "$OUTPUT_DIR/recovery.signal" && $waited -lt $max_wait ]]; do
        sleep 5
        ((waited += 5))

        # Check if still running
        if ! pg_ctl -D "$OUTPUT_DIR" status &>/dev/null; then
            log_error "PostgreSQL stopped unexpectedly during recovery"
            log_error "Check $OUTPUT_DIR/recovery.log for details"
            exit 5
        fi

        if (( waited % 60 == 0 )); then
            log_info "Recovery in progress... (${waited}s elapsed)"
        fi
    done

    if [[ -f "$OUTPUT_DIR/recovery.signal" ]]; then
        log_warning "Recovery signal still present after ${max_wait}s"
        log_warning "Recovery may be paused or still in progress"
    else
        log_success "Recovery completed"
    fi
}

# Verify recovery
verify_recovery() {
    log_step "Verifying Recovery"

    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would verify recovered database"
        return
    fi

    # Check PostgreSQL is running
    if ! pg_ctl -D "$OUTPUT_DIR" status &>/dev/null; then
        log_error "PostgreSQL is not running"
        exit 5
    fi

    # Try to connect and run basic query
    local socket_dir="$OUTPUT_DIR"
    if psql -h "$socket_dir" -d postgres -c "SELECT 1;" &>/dev/null; then
        log_success "Database connection verified"
    else
        log_warning "Could not verify database connection"
    fi

    # Check if in recovery mode
    local in_recovery
    in_recovery=$(psql -h "$socket_dir" -d postgres -t -c "SELECT pg_is_in_recovery();" 2>/dev/null || echo "unknown")
    in_recovery="${in_recovery// /}"

    if [[ "$in_recovery" == "t" ]]; then
        log_info "Database is in recovery mode (standby)"
        if [[ "$NO_PROMOTE" != true ]]; then
            log_warning "Expected promotion but still in recovery"
        fi
    elif [[ "$in_recovery" == "f" ]]; then
        log_success "Database promoted to primary"
    else
        log_warning "Could not determine recovery status"
    fi
}

# Print summary
print_summary() {
    log_step "Recovery Summary"

    echo ""
    echo "=========================================="
    echo "  POINT-IN-TIME RECOVERY COMPLETE"
    echo "=========================================="
    echo ""
    echo "Recovered Database Location:"
    echo "  $OUTPUT_DIR"
    echo ""
    echo "Recovery Target:"
    if [[ -n "$TARGET_TIME" ]]; then
        echo "  Time: $TARGET_TIME"
    elif [[ -n "$TARGET_XID" ]]; then
        echo "  Transaction ID: $TARGET_XID"
    elif [[ -n "$TARGET_NAME" ]]; then
        echo "  Restore Point: $TARGET_NAME"
    elif [[ -n "$TARGET_LSN" ]]; then
        echo "  LSN: $TARGET_LSN"
    else
        echo "  Latest available"
    fi
    echo ""
    echo "Next Steps:"
    echo "  1. Verify data integrity:"
    echo "     psql -h $OUTPUT_DIR -d postgres -c 'SELECT count(*) FROM organisations;'"
    echo ""
    echo "  2. Check recovery log:"
    echo "     tail -f $OUTPUT_DIR/recovery.log"
    echo ""
    if [[ -f "$OUTPUT_DIR/recovery.signal" ]]; then
        echo "  3. Promote to primary (if paused):"
        echo "     pg_ctl -D $OUTPUT_DIR promote"
        echo ""
    fi
    echo "  4. Update application connection strings"
    echo ""
    echo "  5. Stop recovered database:"
    echo "     pg_ctl -D $OUTPUT_DIR stop"
    echo ""
    echo "=========================================="
}

# Main function
main() {
    log_step "Fleet2 Point-in-Time Recovery"
    log_info "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

    parse_args "$@"
    check_dependencies
    validate_base_backup
    validate_wal_archive
    prepare_output_dir
    extract_base_backup
    create_restore_command
    configure_recovery

    if [[ "$DRY_RUN" != true ]]; then
        start_recovery
        verify_recovery
    fi

    print_summary

    log_success "Point-in-Time Recovery completed!"
}

# Run main function
main "$@"
