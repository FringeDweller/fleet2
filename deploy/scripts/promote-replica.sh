#!/bin/bash
# =============================================================================
# Fleet2 Manual PostgreSQL Failover Script
# =============================================================================
#
# This script performs a controlled failover of the PostgreSQL cluster
# managed by Patroni. Use this for:
# - Planned maintenance on the current primary
# - Testing failover procedures
# - Manual intervention when automatic failover is inappropriate
#
# Prerequisites:
# - patronictl installed (comes with Patroni)
# - Network access to Patroni REST API
# - Proper etcd cluster connectivity
#
# Usage:
#   ./promote-replica.sh [OPTIONS]
#
# Options:
#   -n, --node NAME     Target node to promote (e.g., patroni2)
#   -c, --cluster NAME  Cluster name (default: fleet-cluster)
#   -e, --etcd HOSTS    etcd hosts (default: etcd1:2379,etcd2:2379,etcd3:2379)
#   -f, --force         Force failover without confirmation
#   -s, --switchover    Graceful switchover (preferred, requires healthy primary)
#   -h, --help          Show this help message
#
# Examples:
#   ./promote-replica.sh -n patroni2 -s    # Graceful switchover to patroni2
#   ./promote-replica.sh -n patroni2 -f    # Force failover to patroni2
#   ./promote-replica.sh                   # Let Patroni choose the best candidate
#
# =============================================================================

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_NAME="$(basename "$0")"
CLUSTER_NAME="${PATRONI_CLUSTER:-fleet-cluster}"
ETCD_HOSTS="${ETCD_HOSTS:-etcd1:2379,etcd2:2379,etcd3:2379}"
PATRONI_HOSTS="${PATRONI_HOSTS:-patroni1:8008,patroni2:8008,patroni3:8008}"
TARGET_NODE=""
FORCE=false
SWITCHOVER=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

show_help() {
    head -50 "$0" | grep -A 100 "^# Usage:" | grep "^#" | sed 's/^# //'
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
        log_error "Missing required tools: ${missing[*]}"
        log_info "Install with: apt-get install ${missing[*]} (Debian/Ubuntu)"
        exit 1
    fi
}

get_cluster_status() {
    local host
    for host in ${PATRONI_HOSTS//,/ }; do
        local result
        result=$(curl -s "http://${host}/cluster" 2>/dev/null || echo "")
        if [[ -n "$result" ]]; then
            echo "$result"
            return 0
        fi
    done
    log_error "Could not connect to any Patroni node"
    exit 1
}

get_current_primary() {
    local status
    status=$(get_cluster_status)
    echo "$status" | jq -r '.members[] | select(.role == "leader") | .name'
}

get_healthy_replicas() {
    local status
    status=$(get_cluster_status)
    echo "$status" | jq -r '.members[] | select(.role == "replica" and .state == "running") | .name'
}

show_cluster_status() {
    log_info "Current cluster status:"
    echo ""

    local status
    status=$(get_cluster_status)

    echo "$status" | jq -r '
        .members[] |
        "  \(.name): \(.role) (\(.state)) - lag: \(.lag // "N/A")bytes"
    '
    echo ""

    local primary
    primary=$(echo "$status" | jq -r '.members[] | select(.role == "leader") | .name')
    log_info "Current primary: ${primary}"
}

validate_target_node() {
    if [[ -z "$TARGET_NODE" ]]; then
        return 0
    fi

    local status
    status=$(get_cluster_status)

    local node_exists
    node_exists=$(echo "$status" | jq -r ".members[] | select(.name == \"$TARGET_NODE\") | .name")

    if [[ -z "$node_exists" ]]; then
        log_error "Node '$TARGET_NODE' not found in cluster"
        log_info "Available nodes:"
        echo "$status" | jq -r '.members[] | "  - \(.name)"'
        exit 1
    fi

    local node_state
    node_state=$(echo "$status" | jq -r ".members[] | select(.name == \"$TARGET_NODE\") | .state")

    if [[ "$node_state" != "running" ]]; then
        log_error "Node '$TARGET_NODE' is not running (state: $node_state)"
        exit 1
    fi

    local node_role
    node_role=$(echo "$status" | jq -r ".members[] | select(.name == \"$TARGET_NODE\") | .role")

    if [[ "$node_role" == "leader" ]]; then
        log_warning "Node '$TARGET_NODE' is already the primary"
        exit 0
    fi
}

confirm_failover() {
    if [[ "$FORCE" == true ]]; then
        return 0
    fi

    local current_primary
    current_primary=$(get_current_primary)

    echo ""
    log_warning "You are about to trigger a failover!"
    echo ""
    echo "  Current primary: $current_primary"
    if [[ -n "$TARGET_NODE" ]]; then
        echo "  Target node: $TARGET_NODE"
    else
        echo "  Target node: (Patroni will choose)"
    fi
    echo "  Operation: $([[ "$SWITCHOVER" == true ]] && echo "Switchover (graceful)" || echo "Failover (forced)")"
    echo ""

    read -p "Are you sure you want to proceed? (yes/no): " -r response
    if [[ "$response" != "yes" ]]; then
        log_info "Failover cancelled"
        exit 0
    fi
}

perform_switchover() {
    local current_primary
    current_primary=$(get_current_primary)

    log_info "Performing graceful switchover..."

    local api_url="http://${current_primary}:8008/switchover"
    local data

    if [[ -n "$TARGET_NODE" ]]; then
        data="{\"leader\": \"$current_primary\", \"candidate\": \"$TARGET_NODE\"}"
    else
        data="{\"leader\": \"$current_primary\"}"
    fi

    log_info "Sending switchover request to $api_url"

    local response
    response=$(curl -s -w "\n%{http_code}" -X POST "$api_url" \
        -H "Content-Type: application/json" \
        -d "$data")

    local http_code
    http_code=$(echo "$response" | tail -n1)
    local body
    body=$(echo "$response" | head -n -1)

    if [[ "$http_code" == "200" ]] || [[ "$http_code" == "202" ]]; then
        log_success "Switchover initiated successfully"
        echo "Response: $body"
    else
        log_error "Switchover failed (HTTP $http_code)"
        echo "Response: $body"
        exit 1
    fi
}

perform_failover() {
    log_info "Performing forced failover..."

    # Find a responsive Patroni node for the failover request
    local patroni_host=""
    for host in ${PATRONI_HOSTS//,/ }; do
        if curl -s "http://${host}/health" &>/dev/null; then
            patroni_host="$host"
            break
        fi
    done

    if [[ -z "$patroni_host" ]]; then
        log_error "No responsive Patroni nodes found"
        exit 1
    fi

    local api_url="http://${patroni_host}/failover"
    local data

    if [[ -n "$TARGET_NODE" ]]; then
        data="{\"candidate\": \"$TARGET_NODE\"}"
    else
        data="{}"
    fi

    log_info "Sending failover request to $api_url"

    local response
    response=$(curl -s -w "\n%{http_code}" -X POST "$api_url" \
        -H "Content-Type: application/json" \
        -d "$data")

    local http_code
    http_code=$(echo "$response" | tail -n1)
    local body
    body=$(echo "$response" | head -n -1)

    if [[ "$http_code" == "200" ]] || [[ "$http_code" == "202" ]]; then
        log_success "Failover initiated successfully"
        echo "Response: $body"
    else
        log_error "Failover failed (HTTP $http_code)"
        echo "Response: $body"
        exit 1
    fi
}

wait_for_failover() {
    log_info "Waiting for failover to complete..."

    local max_attempts=60
    local attempt=0
    local target="${TARGET_NODE:-}"

    while [[ $attempt -lt $max_attempts ]]; do
        sleep 2
        attempt=$((attempt + 1))

        local new_primary
        new_primary=$(get_current_primary 2>/dev/null || echo "")

        if [[ -z "$new_primary" ]]; then
            echo -n "."
            continue
        fi

        if [[ -n "$target" ]] && [[ "$new_primary" == "$target" ]]; then
            echo ""
            log_success "Failover completed! New primary: $new_primary"
            return 0
        elif [[ -z "$target" ]] && [[ -n "$new_primary" ]]; then
            echo ""
            log_success "Failover completed! New primary: $new_primary"
            return 0
        fi

        echo -n "."
    done

    echo ""
    log_error "Failover timed out after $((max_attempts * 2)) seconds"
    show_cluster_status
    exit 1
}

# =============================================================================
# Main
# =============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -n|--node)
                TARGET_NODE="$2"
                shift 2
                ;;
            -c|--cluster)
                CLUSTER_NAME="$2"
                shift 2
                ;;
            -e|--etcd)
                ETCD_HOSTS="$2"
                shift 2
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -s|--switchover)
                SWITCHOVER=true
                shift
                ;;
            -h|--help)
                show_help
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                ;;
        esac
    done

    log_info "Fleet2 PostgreSQL Failover Script"
    echo ""

    # Check dependencies
    check_dependencies

    # Show current status
    show_cluster_status

    # Validate target node if specified
    validate_target_node

    # Confirm operation
    confirm_failover

    # Perform failover
    if [[ "$SWITCHOVER" == true ]]; then
        perform_switchover
    else
        perform_failover
    fi

    # Wait for completion
    wait_for_failover

    # Show final status
    echo ""
    log_info "Final cluster status:"
    show_cluster_status

    log_success "Failover operation completed"
}

main "$@"
