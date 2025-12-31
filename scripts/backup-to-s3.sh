#!/bin/bash
#
# backup-to-s3.sh - Upload backup files to S3-compatible storage
#
# This script uploads database backups and other critical files to S3-compatible
# storage (AWS S3, Cloudflare R2, MinIO, etc.)
#
# Required environment variables:
#   AWS_ACCESS_KEY_ID     - Access key for S3-compatible storage
#   AWS_SECRET_ACCESS_KEY - Secret key for S3-compatible storage
#   BACKUP_BUCKET         - S3 bucket name for storing backups
#   BACKUP_ENDPOINT       - S3-compatible endpoint URL (optional for AWS S3)
#
# Optional environment variables:
#   BACKUP_STORAGE_CLASS  - Storage class (default: STANDARD)
#   BACKUP_REGION         - AWS region (default: auto)
#   BACKUP_PREFIX         - Prefix/folder for backups in bucket (default: fleet2)
#
# Usage:
#   ./backup-to-s3.sh <backup_file> [backup_type]
#
# Examples:
#   ./backup-to-s3.sh /path/to/db_backup.sql.gz daily
#   ./backup-to-s3.sh /path/to/documents.tar.gz weekly
#   ./backup-to-s3.sh /path/to/full_backup.tar.gz monthly

set -euo pipefail

# Script version
VERSION="1.0.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

# Display usage information
usage() {
    local exit_code="${1:-1}"
    echo "Usage: $0 <backup_file> [backup_type]"
    echo ""
    echo "Arguments:"
    echo "  backup_file   Path to the backup file to upload"
    echo "  backup_type   Type of backup: daily, weekly, monthly (default: daily)"
    echo ""
    echo "Options:"
    echo "  -h, --help    Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  AWS_ACCESS_KEY_ID      (required) Access key for S3-compatible storage"
    echo "  AWS_SECRET_ACCESS_KEY  (required) Secret key for S3-compatible storage"
    echo "  BACKUP_BUCKET          (required) S3 bucket name"
    echo "  BACKUP_ENDPOINT        (optional) S3-compatible endpoint URL"
    echo "  BACKUP_STORAGE_CLASS   (optional) Storage class (default: STANDARD)"
    echo "  BACKUP_REGION          (optional) AWS region (default: auto)"
    echo "  BACKUP_PREFIX          (optional) Prefix in bucket (default: fleet2)"
    echo ""
    echo "Examples:"
    echo "  $0 /backups/db_2024-01-15.sql.gz daily"
    echo "  $0 /backups/full_backup.tar.gz weekly"
    exit "$exit_code"
}

# Validate required environment variables
validate_env() {
    local missing_vars=()

    if [[ -z "${AWS_ACCESS_KEY_ID:-}" ]]; then
        missing_vars+=("AWS_ACCESS_KEY_ID")
    fi

    if [[ -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
        missing_vars+=("AWS_SECRET_ACCESS_KEY")
    fi

    if [[ -z "${BACKUP_BUCKET:-}" ]]; then
        missing_vars+=("BACKUP_BUCKET")
    fi

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            log_error "  - $var"
        done
        exit 1
    fi
}

# Check if required tools are installed
check_dependencies() {
    local missing_deps=()

    if ! command -v aws &> /dev/null; then
        missing_deps+=("aws-cli")
    fi

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies:"
        for dep in "${missing_deps[@]}"; do
            log_error "  - $dep"
        done
        log_error "Please install the AWS CLI: https://aws.amazon.com/cli/"
        exit 1
    fi
}

# Build AWS CLI endpoint arguments
build_endpoint_args() {
    local args=""

    if [[ -n "${BACKUP_ENDPOINT:-}" ]]; then
        args="--endpoint-url ${BACKUP_ENDPOINT}"
    fi

    if [[ -n "${BACKUP_REGION:-}" ]]; then
        args="${args} --region ${BACKUP_REGION}"
    fi

    echo "$args"
}

# Upload file to S3
upload_to_s3() {
    local backup_file="$1"
    local backup_type="${2:-daily}"
    local filename
    local timestamp
    local s3_key
    local storage_class
    local endpoint_args

    filename=$(basename "$backup_file")
    timestamp=$(date '+%Y/%m/%d')
    storage_class="${BACKUP_STORAGE_CLASS:-STANDARD}"
    prefix="${BACKUP_PREFIX:-fleet2}"

    # Construct S3 key with date-based hierarchy
    s3_key="${prefix}/${backup_type}/${timestamp}/${filename}"

    log_info "Starting upload of $filename to s3://${BACKUP_BUCKET}/${s3_key}"

    # Build endpoint arguments
    endpoint_args=$(build_endpoint_args)

    # Calculate file size for logging
    local file_size
    if [[ -f "$backup_file" ]]; then
        file_size=$(du -h "$backup_file" | cut -f1)
        log_info "File size: $file_size"
    fi

    # Perform the upload
    # shellcheck disable=SC2086
    if aws s3 cp "$backup_file" "s3://${BACKUP_BUCKET}/${s3_key}" \
        --storage-class "$storage_class" \
        $endpoint_args; then
        log_info "Successfully uploaded $filename"
        log_info "S3 location: s3://${BACKUP_BUCKET}/${s3_key}"
        return 0
    else
        log_error "Failed to upload $filename"
        return 1
    fi
}

# Verify upload by checking file exists in S3
verify_upload() {
    local s3_key="$1"
    local endpoint_args

    endpoint_args=$(build_endpoint_args)

    log_info "Verifying upload..."

    # shellcheck disable=SC2086
    if aws s3 ls "s3://${BACKUP_BUCKET}/${s3_key}" $endpoint_args &> /dev/null; then
        log_info "Upload verified successfully"
        return 0
    else
        log_error "Upload verification failed - file not found in S3"
        return 1
    fi
}

# Clean up old backups based on retention policy
cleanup_old_backups() {
    local backup_type="$1"
    local retention_days="$2"
    local prefix="${BACKUP_PREFIX:-fleet2}"
    local endpoint_args
    local cutoff_date

    endpoint_args=$(build_endpoint_args)
    cutoff_date=$(date -d "-${retention_days} days" '+%Y-%m-%d' 2>/dev/null || \
                  date -v "-${retention_days}d" '+%Y-%m-%d' 2>/dev/null)

    if [[ -z "$cutoff_date" ]]; then
        log_warn "Could not calculate cutoff date, skipping cleanup"
        return 0
    fi

    log_info "Cleaning up ${backup_type} backups older than ${retention_days} days (before ${cutoff_date})"

    # List and delete old files
    # This is a basic implementation - production use should consider
    # using S3 lifecycle policies instead for better reliability
    # shellcheck disable=SC2086
    aws s3 ls "s3://${BACKUP_BUCKET}/${prefix}/${backup_type}/" --recursive $endpoint_args 2>/dev/null | \
    while read -r line; do
        local file_date
        local file_path
        file_date=$(echo "$line" | awk '{print $1}')
        file_path=$(echo "$line" | awk '{print $4}')

        if [[ "$file_date" < "$cutoff_date" && -n "$file_path" ]]; then
            log_info "Deleting old backup: $file_path"
            # shellcheck disable=SC2086
            aws s3 rm "s3://${BACKUP_BUCKET}/${file_path}" $endpoint_args || true
        fi
    done
}

# Main function
main() {
    # Handle help flag
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
        usage 0
    fi

    log_info "Fleet2 S3 Backup Script v${VERSION}"

    # Check arguments
    if [[ $# -lt 1 ]]; then
        usage
    fi

    local backup_file="$1"
    local backup_type="${2:-daily}"

    # Validate backup type
    case "$backup_type" in
        daily|weekly|monthly)
            ;;
        *)
            log_error "Invalid backup type: $backup_type. Must be daily, weekly, or monthly."
            exit 1
            ;;
    esac

    # Validate backup file exists
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi

    # Pre-flight checks
    check_dependencies
    validate_env

    # Perform upload
    if upload_to_s3 "$backup_file" "$backup_type"; then
        log_info "Backup upload completed successfully"

        # Optional: Run cleanup based on backup type
        case "$backup_type" in
            daily)
                # Keep daily backups for 7 days
                cleanup_old_backups "daily" 7
                ;;
            weekly)
                # Keep weekly backups for 28 days (4 weeks)
                cleanup_old_backups "weekly" 28
                ;;
            monthly)
                # Keep monthly backups for 365 days (12 months)
                cleanup_old_backups "monthly" 365
                ;;
        esac

        exit 0
    else
        log_error "Backup upload failed"
        exit 1
    fi
}

# Run main function
main "$@"
