#!/usr/bin/env bash
#
# PostgreSQL Database Backup Script
# ==================================
#
# Creates compressed PostgreSQL database backups with timestamped filenames.
#
# USAGE:
#   ./scripts/backup-database.sh [OPTIONS]
#
# OPTIONS:
#   -d, --dir DIR      Backup directory (default: ./backups)
#   -h, --help         Show this help message
#
# ENVIRONMENT VARIABLES:
#   The script uses DATABASE_URL if available, otherwise falls back to
#   individual PostgreSQL environment variables:
#
#   DATABASE_URL       Full connection string (e.g., postgresql://user:pass@host:port/db)
#   PGHOST             PostgreSQL host (default: localhost)
#   PGPORT             PostgreSQL port (default: 5432)
#   PGUSER             PostgreSQL user (required if DATABASE_URL not set)
#   PGPASSWORD         PostgreSQL password (required if DATABASE_URL not set)
#   PGDATABASE         PostgreSQL database name (required if DATABASE_URL not set)
#
# EXAMPLES:
#   # Using DATABASE_URL
#   DATABASE_URL="postgresql://fleet:password@localhost:54837/fleet" ./scripts/backup-database.sh
#
#   # Using individual variables
#   PGUSER=fleet PGPASSWORD=secret PGDATABASE=fleet ./scripts/backup-database.sh
#
#   # Custom backup directory
#   ./scripts/backup-database.sh --dir /path/to/backups
#
# EXIT CODES:
#   0 - Success
#   1 - General error
#   2 - Missing required configuration
#   3 - Backup creation failed
#   4 - Backup validation failed
#

set -euo pipefail

# Script constants
readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default configuration
BACKUP_DIR="${PROJECT_ROOT}/backups"

# Color output (if terminal supports it)
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    NC='\033[0m' # No Color
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
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

# Show usage information
show_help() {
    sed -n '2,42p' "$0" | sed 's/^# \?//'
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
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

# Validate configuration
validate_config() {
    log_info "Validating configuration..."

    # Check if DATABASE_URL is set
    if [[ -n "${DATABASE_URL:-}" ]]; then
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
    [[ -z "${PGDATABASE:-}" ]] && missing+=("PGDATABASE")

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required configuration: ${missing[*]}"
        log_error "Set DATABASE_URL or individual PG* environment variables"
        exit 2
    fi

    log_info "Configuration validated:"
    log_info "  Host: $PGHOST"
    log_info "  Port: $PGPORT"
    log_info "  User: $PGUSER"
    log_info "  Database: $PGDATABASE"
    log_info "  Backup directory: $BACKUP_DIR"
}

# Check if pg_dump is available
check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump is not installed or not in PATH"
        log_error "Install postgresql-client package to use this script"
        exit 1
    fi

    if ! command -v gzip &> /dev/null; then
        log_error "gzip is not installed or not in PATH"
        exit 1
    fi

    log_info "All dependencies available"
}

# Create backup directory if it doesn't exist
ensure_backup_dir() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

# Generate backup filename with timestamp
generate_backup_filename() {
    local timestamp
    timestamp=$(date +"%Y-%m-%d_%H-%M-%S")
    echo "backup_${timestamp}.sql.gz"
}

# Create the database backup
create_backup() {
    local backup_file="$1"
    local backup_path="${BACKUP_DIR}/${backup_file}"
    local temp_file="${backup_path}.tmp"

    log_info "Starting backup of database: $PGDATABASE" >&2
    log_info "Output file: $backup_path" >&2

    # Export password for pg_dump (avoid passing on command line)
    export PGPASSWORD

    # Create backup with pg_dump and compress with gzip
    # Using --no-password since we set PGPASSWORD environment variable
    # Only pipe stdout (SQL) to gzip, stderr goes to terminal
    if pg_dump \
        --host="$PGHOST" \
        --port="$PGPORT" \
        --username="$PGUSER" \
        --dbname="$PGDATABASE" \
        --no-password \
        --format=plain \
        | gzip > "$temp_file"; then

        # Move temp file to final location
        mv "$temp_file" "$backup_path"
        log_success "Backup created successfully" >&2
        # Only output the path to stdout for capture
        echo "$backup_path"
        return 0
    else
        log_error "pg_dump failed"
        rm -f "$temp_file"
        return 1
    fi
}

# Validate the backup file
validate_backup() {
    local backup_path="$1"

    log_info "Validating backup file..."

    # Check file exists
    if [[ ! -f "$backup_path" ]]; then
        log_error "Backup file does not exist: $backup_path"
        return 1
    fi

    # Check file is not empty
    local file_size
    file_size=$(stat -c%s "$backup_path" 2>/dev/null || stat -f%z "$backup_path" 2>/dev/null)

    if [[ "$file_size" -eq 0 ]]; then
        log_error "Backup file is empty"
        return 1
    fi

    # Check file is valid gzip
    if ! gzip -t "$backup_path" 2>/dev/null; then
        log_error "Backup file is not a valid gzip archive"
        return 1
    fi

    # Check file contains SQL content (pg_dump header comment)
    # Disable pipefail temporarily as head closing early causes SIGPIPE
    local content
    content=$(gunzip -c "$backup_path" 2>/dev/null | head -20)
    if ! echo "$content" | grep -qE "pg_dump|PostgreSQL"; then
        log_warning "Backup may not contain valid PostgreSQL dump"
    fi

    log_success "Backup validation passed"
    log_info "Backup size: $(numfmt --to=iec-i --suffix=B "$file_size" 2>/dev/null || echo "${file_size} bytes")"

    return 0
}

# Main function
main() {
    log_info "PostgreSQL Backup Script started"
    log_info "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

    parse_args "$@"
    check_dependencies
    validate_config
    ensure_backup_dir

    local backup_filename
    backup_filename=$(generate_backup_filename)

    local backup_path
    if backup_path=$(create_backup "$backup_filename"); then
        if validate_backup "$backup_path"; then
            log_success "Backup completed successfully!"
            log_info "Backup file: $backup_path"
            exit 0
        else
            log_error "Backup validation failed"
            exit 4
        fi
    else
        log_error "Backup creation failed"
        exit 3
    fi
}

# Run main function
main "$@"
