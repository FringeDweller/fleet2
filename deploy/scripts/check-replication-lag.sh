#!/bin/bash
# =============================================================================
# Fleet2 PostgreSQL Replication Lag Monitor
# =============================================================================
#
# This script monitors replication lag across the PostgreSQL cluster and can:
# - Display current replication status
# - Alert when lag exceeds thresholds
# - Output metrics for monitoring systems
# - Continuously monitor with configurable intervals
#
# Prerequisites:
# - curl for Patroni REST API access
# - jq for JSON parsing
# - psql for direct PostgreSQL queries (optional)
#
# Usage:
#   ./check-replication-lag.sh [OPTIONS]
#
# Options:
#   -w, --warning BYTES    Warning threshold in bytes (default: 1048576 = 1MB)
#   -c, --critical BYTES   Critical threshold in bytes (default: 10485760 = 10MB)
#   -m, --mode MODE        Output mode: text, json, prometheus, nagios
#   -l, --loop SECONDS     Continuously monitor with interval
#   -p, --patroni HOSTS    Patroni hosts (default: patroni1:8008,...)
#   -d, --database URL     Direct database URL for detailed stats
#   -q, --quiet            Only output on warning/critical
#   -h, --help             Show this help message
#
# Examples:
#   ./check-replication-lag.sh                      # One-time check
#   ./check-replication-lag.sh -l 30                # Monitor every 30 seconds
#   ./check-replication-lag.sh -m prometheus        # Prometheus metrics output
#   ./check-replication-lag.sh -w 500000 -c 5000000 # Custom thresholds
#
# Exit codes (Nagios compatible):
#   0 = OK (lag within limits)
#   1 = WARNING (lag exceeds warning threshold)
#   2 = CRITICAL (lag exceeds critical threshold)
#   3 = UNKNOWN (could not determine status)
#
# =============================================================================

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_NAME="$(basename "$0")"
PATRONI_HOSTS="${PATRONI_HOSTS:-patroni1:8008,patroni2:8008,patroni3:8008}"
DATABASE_URL="${DATABASE_URL:-}"

# Thresholds (in bytes)
WARNING_THRESHOLD=1048576      # 1MB
CRITICAL_THRESHOLD=10485760    # 10MB

# Output mode: text, json, prometheus, nagios
OUTPUT_MODE="text"

# Monitoring loop interval (0 = no loop)
LOOP_INTERVAL=0

# Quiet mode (only output on warning/critical)
QUIET=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# Functions
# =============================================================================

log_info() {
    if [[ "$OUTPUT_MODE" == "text" ]] && [[ "$QUIET" == false ]]; then
        echo -e "${BLUE}[INFO]${NC} $1"
    fi
}

log_ok() {
    if [[ "$OUTPUT_MODE" == "text" ]] && [[ "$QUIET" == false ]]; then
        echo -e "${GREEN}[OK]${NC} $1"
    fi
}

log_warning() {
    if [[ "$OUTPUT_MODE" == "text" ]]; then
        echo -e "${YELLOW}[WARNING]${NC} $1"
    fi
}

log_critical() {
    if [[ "$OUTPUT_MODE" == "text" ]]; then
        echo -e "${RED}[CRITICAL]${NC} $1"
    fi
}

show_help() {
    head -60 "$0" | grep -A 100 "^# Usage:" | grep "^#" | sed 's/^# //'
    exit 0
}

check_dependencies() {
    local missing=()

    if ! command -v curl &> /dev/null; then
        missing+=("curl")
    fi

    if ! command -v jq &> /dev/null; then
        missing+=("jq")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "Missing required tools: ${missing[*]}" >&2
        echo "Install with: apt-get install ${missing[*]} (Debian/Ubuntu)" >&2
        exit 3
    fi
}

format_bytes() {
    local bytes=$1
    if [[ $bytes -lt 1024 ]]; then
        echo "${bytes}B"
    elif [[ $bytes -lt 1048576 ]]; then
        echo "$((bytes / 1024))KB"
    elif [[ $bytes -lt 1073741824 ]]; then
        echo "$((bytes / 1048576))MB"
    else
        echo "$((bytes / 1073741824))GB"
    fi
}

get_cluster_status() {
    local host
    for host in ${PATRONI_HOSTS//,/ }; do
        local result
        result=$(curl -s --connect-timeout 5 "http://${host}/cluster" 2>/dev/null || echo "")
        if [[ -n "$result" ]] && echo "$result" | jq -e '.members' &>/dev/null; then
            echo "$result"
            return 0
        fi
    done
    return 1
}

get_replication_stats() {
    local status
    if ! status=$(get_cluster_status); then
        return 1
    fi

    # Parse cluster status into structured data
    echo "$status" | jq -r '
        .members | map({
            name: .name,
            role: .role,
            state: .state,
            lag: (.lag // 0),
            timeline: .timeline,
            host: .host
        })
    '
}

get_detailed_stats_from_db() {
    if [[ -z "$DATABASE_URL" ]]; then
        return 1
    fi

    # Query pg_stat_replication for detailed stats
    psql "$DATABASE_URL" -t -A -F'|' <<EOF
SELECT
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) as lag_bytes,
    EXTRACT(EPOCH FROM (now() - reply_time))::int as reply_lag_seconds
FROM pg_stat_replication
ORDER BY client_addr;
EOF
}

check_lag_status() {
    local lag=$1
    if [[ $lag -ge $CRITICAL_THRESHOLD ]]; then
        echo "CRITICAL"
        return 2
    elif [[ $lag -ge $WARNING_THRESHOLD ]]; then
        echo "WARNING"
        return 1
    else
        echo "OK"
        return 0
    fi
}

output_text() {
    local stats="$1"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo ""
    echo "=========================================="
    echo "Fleet2 PostgreSQL Replication Status"
    echo "Timestamp: $timestamp"
    echo "=========================================="
    echo ""

    local primary_name
    primary_name=$(echo "$stats" | jq -r '.[] | select(.role == "leader") | .name')
    echo "Primary: $primary_name"
    echo ""

    echo "Replica Status:"
    echo "---------------"

    local max_lag=0
    local exit_code=0

    while IFS= read -r line; do
        local name role state lag
        name=$(echo "$line" | jq -r '.name')
        role=$(echo "$line" | jq -r '.role')
        state=$(echo "$line" | jq -r '.state')
        lag=$(echo "$line" | jq -r '.lag')

        if [[ "$role" == "replica" ]]; then
            local lag_formatted
            lag_formatted=$(format_bytes "$lag")

            local status_symbol status_color
            if [[ $lag -ge $CRITICAL_THRESHOLD ]]; then
                status_symbol="[CRITICAL]"
                status_color=$RED
                [[ $exit_code -lt 2 ]] && exit_code=2
            elif [[ $lag -ge $WARNING_THRESHOLD ]]; then
                status_symbol="[WARNING]"
                status_color=$YELLOW
                [[ $exit_code -lt 1 ]] && exit_code=1
            else
                status_symbol="[OK]"
                status_color=$GREEN
            fi

            echo -e "  ${status_color}${status_symbol}${NC} $name: lag=$lag_formatted state=$state"

            [[ $lag -gt $max_lag ]] && max_lag=$lag
        fi
    done < <(echo "$stats" | jq -c '.[]')

    echo ""
    echo "Thresholds:"
    echo "  Warning:  $(format_bytes $WARNING_THRESHOLD)"
    echo "  Critical: $(format_bytes $CRITICAL_THRESHOLD)"
    echo ""
    echo "Maximum lag: $(format_bytes $max_lag)"

    return $exit_code
}

output_json() {
    local stats="$1"
    local timestamp
    timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    local max_lag=0
    local status="OK"

    # Calculate max lag and status
    while IFS= read -r line; do
        local lag
        lag=$(echo "$line" | jq -r '.lag // 0')
        [[ $lag -gt $max_lag ]] && max_lag=$lag
    done < <(echo "$stats" | jq -c '.[]')

    if [[ $max_lag -ge $CRITICAL_THRESHOLD ]]; then
        status="CRITICAL"
    elif [[ $max_lag -ge $WARNING_THRESHOLD ]]; then
        status="WARNING"
    fi

    jq -n \
        --arg timestamp "$timestamp" \
        --arg status "$status" \
        --argjson max_lag "$max_lag" \
        --argjson warning "$WARNING_THRESHOLD" \
        --argjson critical "$CRITICAL_THRESHOLD" \
        --argjson members "$stats" \
        '{
            timestamp: $timestamp,
            status: $status,
            max_lag_bytes: $max_lag,
            thresholds: {
                warning: $warning,
                critical: $critical
            },
            members: $members
        }'
}

output_prometheus() {
    local stats="$1"
    local timestamp
    timestamp=$(date +%s)000

    echo "# HELP pg_replication_lag_bytes PostgreSQL replication lag in bytes"
    echo "# TYPE pg_replication_lag_bytes gauge"

    while IFS= read -r line; do
        local name role state lag
        name=$(echo "$line" | jq -r '.name')
        role=$(echo "$line" | jq -r '.role')
        state=$(echo "$line" | jq -r '.state')
        lag=$(echo "$line" | jq -r '.lag // 0')

        echo "pg_replication_lag_bytes{node=\"$name\",role=\"$role\",state=\"$state\"} $lag"
    done < <(echo "$stats" | jq -c '.[]')

    echo ""
    echo "# HELP pg_replication_is_leader Whether node is the cluster leader"
    echo "# TYPE pg_replication_is_leader gauge"

    while IFS= read -r line; do
        local name role
        name=$(echo "$line" | jq -r '.name')
        role=$(echo "$line" | jq -r '.role')
        local is_leader=0
        [[ "$role" == "leader" ]] && is_leader=1
        echo "pg_replication_is_leader{node=\"$name\"} $is_leader"
    done < <(echo "$stats" | jq -c '.[]')

    echo ""
    echo "# HELP pg_replication_threshold_warning Warning threshold in bytes"
    echo "# TYPE pg_replication_threshold_warning gauge"
    echo "pg_replication_threshold_warning $WARNING_THRESHOLD"

    echo ""
    echo "# HELP pg_replication_threshold_critical Critical threshold in bytes"
    echo "# TYPE pg_replication_threshold_critical gauge"
    echo "pg_replication_threshold_critical $CRITICAL_THRESHOLD"
}

output_nagios() {
    local stats="$1"
    local max_lag=0
    local replica_count=0
    local critical_count=0
    local warning_count=0

    while IFS= read -r line; do
        local role lag
        role=$(echo "$line" | jq -r '.role')
        lag=$(echo "$line" | jq -r '.lag // 0')

        if [[ "$role" == "replica" ]]; then
            replica_count=$((replica_count + 1))
            [[ $lag -gt $max_lag ]] && max_lag=$lag
            [[ $lag -ge $CRITICAL_THRESHOLD ]] && critical_count=$((critical_count + 1))
            [[ $lag -ge $WARNING_THRESHOLD ]] && warning_count=$((warning_count + 1))
        fi
    done < <(echo "$stats" | jq -c '.[]')

    local status exit_code
    if [[ $critical_count -gt 0 ]]; then
        status="CRITICAL"
        exit_code=2
    elif [[ $warning_count -gt 0 ]]; then
        status="WARNING"
        exit_code=1
    else
        status="OK"
        exit_code=0
    fi

    local lag_formatted
    lag_formatted=$(format_bytes $max_lag)

    # Nagios format: STATUS - message | perfdata
    echo "${status} - Replication lag: ${lag_formatted} (${replica_count} replicas) | lag=${max_lag}B;${WARNING_THRESHOLD};${CRITICAL_THRESHOLD}"

    return $exit_code
}

run_check() {
    local stats
    if ! stats=$(get_replication_stats); then
        if [[ "$OUTPUT_MODE" == "nagios" ]]; then
            echo "UNKNOWN - Could not connect to Patroni cluster"
            return 3
        elif [[ "$OUTPUT_MODE" == "json" ]]; then
            echo '{"status": "UNKNOWN", "error": "Could not connect to Patroni cluster"}'
            return 3
        else
            log_critical "Could not connect to Patroni cluster"
            return 3
        fi
    fi

    case "$OUTPUT_MODE" in
        text)
            output_text "$stats"
            ;;
        json)
            output_json "$stats"
            ;;
        prometheus)
            output_prometheus "$stats"
            ;;
        nagios)
            output_nagios "$stats"
            ;;
        *)
            log_critical "Unknown output mode: $OUTPUT_MODE"
            return 3
            ;;
    esac
}

# =============================================================================
# Main
# =============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -w|--warning)
                WARNING_THRESHOLD="$2"
                shift 2
                ;;
            -c|--critical)
                CRITICAL_THRESHOLD="$2"
                shift 2
                ;;
            -m|--mode)
                OUTPUT_MODE="$2"
                shift 2
                ;;
            -l|--loop)
                LOOP_INTERVAL="$2"
                shift 2
                ;;
            -p|--patroni)
                PATRONI_HOSTS="$2"
                shift 2
                ;;
            -d|--database)
                DATABASE_URL="$2"
                shift 2
                ;;
            -q|--quiet)
                QUIET=true
                shift
                ;;
            -h|--help)
                show_help
                ;;
            *)
                echo "Unknown option: $1" >&2
                show_help
                ;;
        esac
    done

    # Validate mode
    case "$OUTPUT_MODE" in
        text|json|prometheus|nagios) ;;
        *)
            echo "Invalid output mode: $OUTPUT_MODE" >&2
            echo "Valid modes: text, json, prometheus, nagios" >&2
            exit 3
            ;;
    esac

    # Check dependencies
    check_dependencies

    # Run check (possibly in a loop)
    if [[ $LOOP_INTERVAL -gt 0 ]]; then
        log_info "Starting continuous monitoring (interval: ${LOOP_INTERVAL}s)"
        log_info "Press Ctrl+C to stop"
        echo ""

        while true; do
            run_check || true
            sleep "$LOOP_INTERVAL"
            [[ "$OUTPUT_MODE" == "text" ]] && echo ""
        done
    else
        run_check
    fi
}

main "$@"
