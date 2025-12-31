#!/usr/bin/env bash
#
# Backup Cron Wrapper Script
# ===========================
#
# This script orchestrates the complete backup workflow:
# 1. Creates a local database backup using backup-database.sh
# 2. Uploads the backup to S3-compatible storage using backup-to-s3.sh
# 3. Logs all operations with timestamps
# 4. Sends notifications on failure (via webhook, email, or both)
#
# USAGE:
#   ./scripts/backup-cron.sh [OPTIONS]
#
# OPTIONS:
#   -t, --type TYPE       Backup type: daily, weekly, monthly (default: daily)
#   -d, --dir DIR         Backup directory (default: ./backups)
#   -l, --log FILE        Log file path (default: /var/log/fleet-backup.log)
#   -h, --help            Show this help message
#
# ENVIRONMENT VARIABLES:
#   Required for database backup (inherited from backup-database.sh):
#     DATABASE_URL        Full database connection string
#     -or-
#     PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
#
#   Required for S3 upload (inherited from backup-to-s3.sh):
#     AWS_ACCESS_KEY_ID     Access key for S3-compatible storage
#     AWS_SECRET_ACCESS_KEY Secret key for S3-compatible storage
#     BACKUP_BUCKET         S3 bucket name for storing backups
#     BACKUP_ENDPOINT       S3-compatible endpoint URL (optional for AWS S3)
#
#   Optional for notifications:
#     BACKUP_NOTIFY_WEBHOOK   Webhook URL for failure notifications
#     BACKUP_NOTIFY_EMAIL     Email address for failure notifications
#     BACKUP_NOTIFY_SMTP      SMTP server for email (default: localhost)
#     BACKUP_NOTIFY_FROM      From address for email notifications
#
#   Optional configuration:
#     BACKUP_KEEP_LOCAL       Keep local backup after S3 upload (default: false)
#     BACKUP_DRY_RUN          If "true", skip actual backup operations
#
# EXIT CODES:
#   0 - Success
#   1 - General error
#   2 - Database backup failed
#   3 - S3 upload failed
#   4 - Notification failed (non-blocking)
#
# EXAMPLES:
#   # Run daily backup
#   ./scripts/backup-cron.sh
#
#   # Run weekly backup with custom log file
#   ./scripts/backup-cron.sh --type weekly --log /custom/path/backup.log
#
#   # Monthly backup to custom directory
#   ./scripts/backup-cron.sh --type monthly --dir /data/backups
#

set -euo pipefail

# Script constants
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly VERSION="1.0.0"

# Default configuration
BACKUP_TYPE="daily"
BACKUP_DIR="${PROJECT_ROOT}/backups"
LOG_FILE="/var/log/fleet-backup.log"
KEEP_LOCAL="${BACKUP_KEEP_LOCAL:-false}"
DRY_RUN="${BACKUP_DRY_RUN:-false}"

# Track if any errors occurred
BACKUP_SUCCESS=true
ERROR_MESSAGE=""

# Logging functions with timestamps
log() {
    local level="$1"
    shift
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local message="[$timestamp] [$level] $*"

    # Log to file
    echo "$message" >> "$LOG_FILE"

    # Also log to stdout/stderr
    if [[ "$level" == "ERROR" ]]; then
        echo "$message" >&2
    else
        echo "$message"
    fi
}

log_info() {
    log "INFO" "$@"
}

log_success() {
    log "SUCCESS" "$@"
}

log_warning() {
    log "WARNING" "$@"
}

log_error() {
    log "ERROR" "$@"
    BACKUP_SUCCESS=false
    ERROR_MESSAGE="$*"
}

# Show usage information
show_help() {
    sed -n '2,57p' "$0" | sed 's/^# \?//'
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--type)
                BACKUP_TYPE="$2"
                if [[ ! "$BACKUP_TYPE" =~ ^(daily|weekly|monthly)$ ]]; then
                    echo "Error: Invalid backup type '$BACKUP_TYPE'. Must be daily, weekly, or monthly."
                    exit 1
                fi
                shift 2
                ;;
            -d|--dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            -l|--log)
                LOG_FILE="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "Error: Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Ensure log directory exists
ensure_log_dir() {
    local log_dir
    log_dir=$(dirname "$LOG_FILE")

    if [[ ! -d "$log_dir" ]]; then
        if ! mkdir -p "$log_dir" 2>/dev/null; then
            # Fall back to a location we can write to
            LOG_FILE="${PROJECT_ROOT}/logs/fleet-backup.log"
            mkdir -p "$(dirname "$LOG_FILE")"
        fi
    fi

    # Ensure log file is writable
    if ! touch "$LOG_FILE" 2>/dev/null; then
        LOG_FILE="${PROJECT_ROOT}/logs/fleet-backup.log"
        mkdir -p "$(dirname "$LOG_FILE")"
        touch "$LOG_FILE"
    fi
}

# Send webhook notification
send_webhook_notification() {
    local message="$1"
    local webhook_url="${BACKUP_NOTIFY_WEBHOOK:-}"

    if [[ -z "$webhook_url" ]]; then
        return 0
    fi

    log_info "Sending webhook notification..."

    local payload
    payload=$(cat <<EOF
{
  "text": "Fleet2 Backup Alert",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "Fleet2 Backup Failed"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Backup Type:*\n${BACKUP_TYPE}"
        },
        {
          "type": "mrkdwn",
          "text": "*Timestamp:*\n$(date '+%Y-%m-%d %H:%M:%S %Z')"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Error Message:*\n${message}"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Host:*\n$(hostname)"
      }
    }
  ]
}
EOF
)

    if command -v curl &> /dev/null; then
        if curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "$payload" \
            "$webhook_url" > /dev/null; then
            log_info "Webhook notification sent successfully"
        else
            log_warning "Failed to send webhook notification"
        fi
    else
        log_warning "curl not available, cannot send webhook notification"
    fi
}

# Send email notification
send_email_notification() {
    local message="$1"
    local email="${BACKUP_NOTIFY_EMAIL:-}"
    local smtp_server="${BACKUP_NOTIFY_SMTP:-localhost}"
    local from_address="${BACKUP_NOTIFY_FROM:-backup@$(hostname)}"

    if [[ -z "$email" ]]; then
        return 0
    fi

    log_info "Sending email notification to $email..."

    local subject="[Fleet2] Backup Failed - $(date '+%Y-%m-%d')"
    local body
    body=$(cat <<EOF
Fleet2 Backup Failure Report
============================

Backup Type:  ${BACKUP_TYPE}
Timestamp:    $(date '+%Y-%m-%d %H:%M:%S %Z')
Host:         $(hostname)

Error Message:
${message}

Log File:     ${LOG_FILE}

Please check the server logs for more details.
EOF
)

    if command -v mail &> /dev/null; then
        if echo "$body" | mail -s "$subject" -r "$from_address" "$email"; then
            log_info "Email notification sent successfully"
        else
            log_warning "Failed to send email notification"
        fi
    elif command -v sendmail &> /dev/null; then
        if printf "To: %s\nFrom: %s\nSubject: %s\n\n%s" \
            "$email" "$from_address" "$subject" "$body" | sendmail -t; then
            log_info "Email notification sent successfully"
        else
            log_warning "Failed to send email notification"
        fi
    else
        log_warning "No mail command available, cannot send email notification"
    fi
}

# Send failure notifications
send_failure_notifications() {
    local message="$1"

    send_webhook_notification "$message"
    send_email_notification "$message"
}

# Run database backup
run_database_backup() {
    local backup_script="${SCRIPT_DIR}/backup-database.sh"

    if [[ ! -x "$backup_script" ]]; then
        log_error "Database backup script not found or not executable: $backup_script"
        return 2
    fi

    log_info "Starting database backup..."
    log_info "Backup directory: $BACKUP_DIR"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would run: $backup_script --dir $BACKUP_DIR"
        echo "${BACKUP_DIR}/backup_$(date +%Y-%m-%d_%H-%M-%S).sql.gz"
        return 0
    fi

    local backup_path
    if backup_path=$("$backup_script" --dir "$BACKUP_DIR" 2>&1 | tail -1); then
        if [[ -f "$backup_path" ]]; then
            log_success "Database backup created: $backup_path"
            echo "$backup_path"
            return 0
        else
            log_error "Database backup script completed but no file found"
            return 2
        fi
    else
        log_error "Database backup failed: $backup_path"
        return 2
    fi
}

# Run S3 upload
run_s3_upload() {
    local backup_path="$1"
    local s3_script="${SCRIPT_DIR}/backup-to-s3.sh"

    if [[ ! -x "$s3_script" ]]; then
        log_error "S3 upload script not found or not executable: $s3_script"
        return 3
    fi

    log_info "Starting S3 upload..."
    log_info "Backup file: $backup_path"
    log_info "Backup type: $BACKUP_TYPE"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would run: $s3_script $backup_path $BACKUP_TYPE"
        return 0
    fi

    if "$s3_script" "$backup_path" "$BACKUP_TYPE" >> "$LOG_FILE" 2>&1; then
        log_success "S3 upload completed successfully"
        return 0
    else
        log_error "S3 upload failed"
        return 3
    fi
}

# Clean up local backup
cleanup_local_backup() {
    local backup_path="$1"

    if [[ "$KEEP_LOCAL" == "true" ]]; then
        log_info "Keeping local backup: $backup_path"
        return 0
    fi

    if [[ -f "$backup_path" ]]; then
        log_info "Removing local backup: $backup_path"
        if rm "$backup_path"; then
            log_info "Local backup removed"
        else
            log_warning "Failed to remove local backup"
        fi
    fi
}

# Main function
main() {
    parse_args "$@"
    ensure_log_dir

    log_info "========================================"
    log_info "Fleet2 Backup Cron v${VERSION}"
    log_info "========================================"
    log_info "Backup type: $BACKUP_TYPE"
    log_info "Backup directory: $BACKUP_DIR"
    log_info "Log file: $LOG_FILE"
    log_info "Keep local: $KEEP_LOCAL"
    log_info "Dry run: $DRY_RUN"
    log_info "----------------------------------------"

    local backup_path=""
    local exit_code=0

    # Step 1: Create database backup
    if backup_path=$(run_database_backup); then
        log_info "Database backup path: $backup_path"
    else
        exit_code=$?
        send_failure_notifications "Database backup failed"
        log_error "Backup workflow aborted due to database backup failure"
        exit $exit_code
    fi

    # Step 2: Upload to S3
    if run_s3_upload "$backup_path"; then
        log_info "S3 upload completed"
    else
        exit_code=$?
        send_failure_notifications "S3 upload failed for backup: $backup_path"
        log_error "Backup workflow completed with S3 upload failure"
        # Don't clean up local backup if S3 upload failed
        exit $exit_code
    fi

    # Step 3: Clean up local backup
    cleanup_local_backup "$backup_path"

    log_info "----------------------------------------"
    log_success "Backup workflow completed successfully!"
    log_info "========================================"

    exit 0
}

# Run main function
main "$@"
