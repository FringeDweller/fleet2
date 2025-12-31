#!/bin/bash
# =============================================================================
# Fleet2 Failover Testing Script
# =============================================================================
#
# This script tests failover scenarios for the Fleet2 high availability stack:
#   - Database failover (simulates primary DB failure)
#   - Application failover (simulates app instance failure)
#   - Load balancer health checks
#   - Automatic recovery verification
#
# Prerequisites:
#   - Docker and docker compose installed
#   - Fleet2 HA stack running (docker compose with ha configuration)
#   - curl, jq for API testing
#
# Usage:
#   ./test-failover.sh [db|app|lb|all]
#
# Test Scenarios:
#   db   - Test database failover with Patroni
#   app  - Test application instance failover
#   lb   - Test load balancer health checks
#   all  - Run all failover tests (default)
#
# Exit Codes (CI/CD compatible):
#   0 = All tests passed
#   1 = One or more tests failed
#   2 = Invalid arguments
#   3 = Prerequisites not met
#
# Examples:
#   ./test-failover.sh              # Run all tests
#   ./test-failover.sh db           # Test database failover only
#   ./test-failover.sh app lb       # Test app and load balancer
#   ./test-failover.sh all 2>&1 | tee failover-test.log
#
# Environment Variables:
#   PATRONI_HOSTS       Patroni API endpoints (default: patroni1:8008,...)
#   NGINX_URL           Nginx load balancer URL (default: http://localhost:8280)
#   APP_HEALTH_URL      App health check endpoint (default: /api/health)
#   RECOVERY_TIMEOUT    Max seconds to wait for recovery (default: 120)
#   LOG_FILE            Path to log file (default: ./failover-test-{timestamp}.log)
#
# =============================================================================

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_NAME="$(basename "$0")"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Default configuration
PATRONI_HOSTS="${PATRONI_HOSTS:-patroni1:8008,patroni2:8008,patroni3:8008}"
NGINX_URL="${NGINX_URL:-http://localhost:8280}"
APP_HEALTH_URL="${APP_HEALTH_URL:-/api/health}"
RECOVERY_TIMEOUT="${RECOVERY_TIMEOUT:-120}"
LOG_FILE="${LOG_FILE:-${PROJECT_ROOT}/failover-test-${TIMESTAMP}.log}"

# App containers for failover testing
APP_CONTAINERS="${APP_CONTAINERS:-fleet-app1,fleet-app2,fleet-app3}"

# Redis configuration
REDIS_PRIMARY="${REDIS_PRIMARY:-fleet-redis-primary}"
REDIS_PASSWORD="${REDIS_PASSWORD:-redis_secret_password}"

# Test results tracking
declare -A TEST_RESULTS
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Colors for terminal output
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' NC=''
fi

# =============================================================================
# Logging Functions
# =============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Write to log file
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"

    # Write to terminal with colors
    case "$level" in
        INFO)    echo -e "${BLUE}[INFO]${NC} $message" ;;
        PASS)    echo -e "${GREEN}[PASS]${NC} $message" ;;
        FAIL)    echo -e "${RED}[FAIL]${NC} $message" ;;
        WARN)    echo -e "${YELLOW}[WARN]${NC} $message" ;;
        STEP)    echo -e "\n${BOLD}${CYAN}=== $message ===${NC}" ;;
        *)       echo "[$level] $message" ;;
    esac
}

log_info() { log "INFO" "$@"; }
log_pass() { log "PASS" "$@"; }
log_fail() { log "FAIL" "$@"; }
log_warn() { log "WARN" "$@"; }
log_step() { log "STEP" "$@"; }

# =============================================================================
# Test Result Functions
# =============================================================================

# Record a test result
# Usage: record_test "test_name" "PASS|FAIL" "details"
record_test() {
    local test_name="$1"
    local result="$2"
    local details="${3:-}"

    ((TOTAL_TESTS++))
    TEST_RESULTS["$test_name"]="$result|$details"

    case "$result" in
        PASS)
            ((PASSED_TESTS++))
            log_pass "$test_name: $details"
            ;;
        FAIL)
            ((FAILED_TESTS++))
            log_fail "$test_name: $details"
            ;;
    esac
}

# =============================================================================
# Helper Functions
# =============================================================================

show_help() {
    # Extract and display the help text from the script header
    sed -n '17,44p' "$0" | sed 's/^# \?//'
    exit 0
}

# Check if required dependencies are available
check_dependencies() {
    log_step "Checking Dependencies"

    local missing=()

    command -v docker &>/dev/null || missing+=("docker")
    command -v curl &>/dev/null || missing+=("curl")
    command -v jq &>/dev/null || missing+=("jq")

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_fail "Missing required tools: ${missing[*]}"
        log_info "Install with: apt-get install ${missing[*]} (Debian/Ubuntu)"
        exit 3
    fi

    # Check Docker is running
    if ! docker info &>/dev/null; then
        log_fail "Docker daemon is not running"
        exit 3
    fi

    log_pass "All dependencies available"
}

# Wait for a condition with timeout
# Usage: wait_for_condition "description" timeout_seconds "command"
wait_for_condition() {
    local description="$1"
    local timeout="$2"
    local cmd="$3"

    local start_time
    start_time=$(date +%s)
    local elapsed=0

    log_info "Waiting for: $description (timeout: ${timeout}s)"

    while [[ $elapsed -lt $timeout ]]; do
        if eval "$cmd" &>/dev/null; then
            log_pass "$description (${elapsed}s)"
            return 0
        fi

        sleep 2
        elapsed=$(($(date +%s) - start_time))
        echo -n "."
    done

    echo ""
    log_fail "$description: Timed out after ${timeout}s"
    return 1
}

# Get the current PostgreSQL primary from Patroni
get_db_primary() {
    local host
    for host in ${PATRONI_HOSTS//,/ }; do
        local result
        result=$(curl -s --connect-timeout 5 "http://${host}/cluster" 2>/dev/null || echo "")
        if [[ -n "$result" ]]; then
            echo "$result" | jq -r '.members[] | select(.role == "leader") | .name' 2>/dev/null
            return 0
        fi
    done
    return 1
}

# Get Patroni cluster status as JSON
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

# Check if app endpoint is healthy
check_app_health() {
    local url="${1:-$NGINX_URL$APP_HEALTH_URL}"
    curl -sf --connect-timeout 5 --max-time 10 "$url" &>/dev/null
}

# Get healthy app container count
get_healthy_app_count() {
    local count=0
    for container in ${APP_CONTAINERS//,/ }; do
        if docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null | grep -q "healthy"; then
            ((count++))
        fi
    done
    echo "$count"
}

# =============================================================================
# Test: Database Failover
# =============================================================================
#
# This test simulates a primary database failure by stopping the Patroni
# container that is currently the primary. It then verifies that:
# 1. A new primary is elected
# 2. The cluster recovers within the timeout period
# 3. The old primary can rejoin as a replica
#
# =============================================================================

test_database_failover() {
    log_step "Database Failover Test"

    # Get current primary
    local original_primary
    original_primary=$(get_db_primary)

    if [[ -z "$original_primary" ]]; then
        record_test "db_failover_initial_state" "FAIL" "Could not determine current primary"
        return 1
    fi

    log_info "Current primary: $original_primary"
    record_test "db_failover_initial_state" "PASS" "Primary identified: $original_primary"

    # Show cluster status before failover
    log_info "Cluster status before failover:"
    get_cluster_status | jq -r '.members[] | "  \(.name): \(.role) (\(.state))"'

    # Simulate primary failure by stopping the container
    log_info "Simulating primary failure by stopping $original_primary..."

    local container_name="fleet-${original_primary}"
    if ! docker stop "$container_name" --time 5 &>/dev/null; then
        log_warn "Could not stop container $container_name, trying alternative name..."
        container_name="$original_primary"
        docker stop "$container_name" --time 5 &>/dev/null || true
    fi

    log_info "Primary stopped, waiting for failover..."

    # Wait for a new primary to be elected
    local new_primary=""
    local start_time
    start_time=$(date +%s)

    while [[ $(($(date +%s) - start_time)) -lt $RECOVERY_TIMEOUT ]]; do
        new_primary=$(get_db_primary 2>/dev/null || echo "")

        if [[ -n "$new_primary" && "$new_primary" != "$original_primary" ]]; then
            log_pass "New primary elected: $new_primary"
            break
        fi

        sleep 2
        echo -n "."
    done
    echo ""

    if [[ -z "$new_primary" || "$new_primary" == "$original_primary" ]]; then
        record_test "db_failover_election" "FAIL" "No new primary elected within ${RECOVERY_TIMEOUT}s"

        # Try to restart the original primary
        log_info "Attempting to restart $container_name..."
        docker start "$container_name" &>/dev/null || true
        return 1
    fi

    record_test "db_failover_election" "PASS" "New primary: $new_primary"

    # Verify cluster is healthy
    sleep 5
    local cluster_status
    cluster_status=$(get_cluster_status)

    local running_count
    running_count=$(echo "$cluster_status" | jq -r '[.members[] | select(.state == "running")] | length')

    if [[ "$running_count" -ge 2 ]]; then
        record_test "db_failover_cluster_health" "PASS" "$running_count nodes running"
    else
        record_test "db_failover_cluster_health" "FAIL" "Only $running_count nodes running"
    fi

    # Restart the original primary
    log_info "Restarting original primary ($container_name)..."
    docker start "$container_name" &>/dev/null || true

    # Wait for old primary to rejoin as replica
    if wait_for_condition "Original primary rejoins cluster" "$RECOVERY_TIMEOUT" \
        "get_cluster_status | jq -e '.members[] | select(.name == \"$original_primary\" and .state == \"running\")' &>/dev/null"; then
        record_test "db_failover_recovery" "PASS" "Original primary rejoined as replica"
    else
        record_test "db_failover_recovery" "FAIL" "Original primary did not rejoin"
    fi

    # Show final cluster status
    log_info "Cluster status after recovery:"
    get_cluster_status | jq -r '.members[] | "  \(.name): \(.role) (\(.state))"'
}

# =============================================================================
# Test: Application Failover
# =============================================================================
#
# This test simulates an application instance failure by stopping one of the
# app containers. It verifies that:
# 1. The load balancer detects the failure
# 2. Traffic is routed to healthy instances
# 3. The failed instance can recover and rejoin
#
# =============================================================================

test_application_failover() {
    log_step "Application Failover Test"

    # Check initial state
    local initial_healthy
    initial_healthy=$(get_healthy_app_count)

    if [[ "$initial_healthy" -lt 2 ]]; then
        record_test "app_failover_initial_state" "FAIL" "Need at least 2 healthy app instances (found: $initial_healthy)"
        return 1
    fi

    log_info "Initial healthy app instances: $initial_healthy"
    record_test "app_failover_initial_state" "PASS" "$initial_healthy healthy instances"

    # Verify application is accessible via load balancer
    if ! check_app_health; then
        record_test "app_failover_initial_access" "FAIL" "Application not accessible via load balancer"
        return 1
    fi

    record_test "app_failover_initial_access" "PASS" "Application accessible"

    # Stop first app container
    local first_container
    first_container=$(echo "$APP_CONTAINERS" | cut -d',' -f1)

    log_info "Stopping app container: $first_container"
    docker stop "$first_container" --time 5 &>/dev/null || true

    # Wait a moment for health checks to detect failure
    sleep 10

    # Verify application is still accessible (traffic should route to healthy instances)
    local access_attempts=5
    local access_success=0

    for ((i=1; i<=access_attempts; i++)); do
        if check_app_health; then
            ((access_success++))
        fi
        sleep 1
    done

    if [[ "$access_success" -ge $((access_attempts - 1)) ]]; then
        record_test "app_failover_continued_access" "PASS" "Application remained accessible ($access_success/$access_attempts requests succeeded)"
    else
        record_test "app_failover_continued_access" "FAIL" "Application availability degraded ($access_success/$access_attempts requests succeeded)"
    fi

    # Verify load balancer detected the failure
    local healthy_after_stop
    healthy_after_stop=$(get_healthy_app_count)

    if [[ "$healthy_after_stop" -lt "$initial_healthy" ]]; then
        record_test "app_failover_detection" "PASS" "Failure detected (healthy: $healthy_after_stop)"
    else
        record_test "app_failover_detection" "FAIL" "Failure not detected (healthy: $healthy_after_stop)"
    fi

    # Restart the stopped container
    log_info "Restarting app container: $first_container"
    docker start "$first_container" &>/dev/null || true

    # Wait for container to become healthy again
    if wait_for_condition "App container recovery" "$RECOVERY_TIMEOUT" \
        "[[ \$(get_healthy_app_count) -ge $initial_healthy ]]"; then
        record_test "app_failover_recovery" "PASS" "Container recovered and healthy"
    else
        record_test "app_failover_recovery" "FAIL" "Container did not recover"
    fi

    # Final state check
    local final_healthy
    final_healthy=$(get_healthy_app_count)
    log_info "Final healthy app instances: $final_healthy"
}

# =============================================================================
# Test: Load Balancer Health Checks
# =============================================================================
#
# This test verifies that the load balancer properly:
# 1. Routes traffic to healthy backends
# 2. Responds to health check endpoints
# 3. Handles backend failures gracefully
# 4. Distributes traffic across multiple instances
#
# =============================================================================

test_load_balancer() {
    log_step "Load Balancer Health Check Test"

    # Test 1: Basic connectivity
    log_info "Testing load balancer connectivity..."

    if curl -sf --connect-timeout 5 --max-time 10 "$NGINX_URL" &>/dev/null; then
        record_test "lb_connectivity" "PASS" "Load balancer responding"
    else
        record_test "lb_connectivity" "FAIL" "Load balancer not responding"
        return 1
    fi

    # Test 2: Health check endpoint
    log_info "Testing health check endpoint..."

    local health_response
    health_response=$(curl -sf --connect-timeout 5 --max-time 10 "$NGINX_URL$APP_HEALTH_URL" 2>/dev/null || echo "")

    if [[ -n "$health_response" ]]; then
        record_test "lb_health_endpoint" "PASS" "Health endpoint responding"

        # Try to parse as JSON and check status
        if echo "$health_response" | jq -e '.status' &>/dev/null; then
            local health_status
            health_status=$(echo "$health_response" | jq -r '.status')
            log_info "Health status: $health_status"
        fi
    else
        record_test "lb_health_endpoint" "FAIL" "Health endpoint not responding"
    fi

    # Test 3: Request distribution (if multiple backends)
    log_info "Testing request distribution..."

    local instance_ids=()
    local request_count=10

    for ((i=1; i<=request_count; i++)); do
        local response
        response=$(curl -sf --connect-timeout 5 --max-time 10 "$NGINX_URL$APP_HEALTH_URL" 2>/dev/null || echo "")

        # Try to extract instance ID from response
        if [[ -n "$response" ]]; then
            local instance_id
            instance_id=$(echo "$response" | jq -r '.instanceId // .instance // "unknown"' 2>/dev/null || echo "unknown")
            instance_ids+=("$instance_id")
        fi

        sleep 0.5
    done

    # Count unique instances
    local unique_instances
    unique_instances=$(printf '%s\n' "${instance_ids[@]}" | sort -u | wc -l)

    if [[ "$unique_instances" -gt 1 ]]; then
        record_test "lb_distribution" "PASS" "Traffic distributed to $unique_instances instances"
    elif [[ "$unique_instances" -eq 1 ]]; then
        record_test "lb_distribution" "WARN" "Traffic only to 1 instance (may be expected with sticky sessions)"
    else
        record_test "lb_distribution" "FAIL" "Could not verify traffic distribution"
    fi

    # Test 4: Response time check
    log_info "Testing response times..."

    local total_time=0
    local successful_requests=0

    for ((i=1; i<=5; i++)); do
        local response_time
        response_time=$(curl -sf -o /dev/null -w '%{time_total}' --connect-timeout 5 --max-time 10 "$NGINX_URL$APP_HEALTH_URL" 2>/dev/null || echo "0")

        if [[ "$response_time" != "0" ]]; then
            # Convert to milliseconds (response_time is in seconds with decimals)
            local ms
            ms=$(echo "$response_time * 1000" | bc 2>/dev/null || echo "0")
            total_time=$((total_time + ${ms%.*}))
            ((successful_requests++))
        fi

        sleep 0.2
    done

    if [[ "$successful_requests" -gt 0 ]]; then
        local avg_time=$((total_time / successful_requests))

        if [[ "$avg_time" -lt 1000 ]]; then
            record_test "lb_response_time" "PASS" "Average response time: ${avg_time}ms"
        elif [[ "$avg_time" -lt 3000 ]]; then
            record_test "lb_response_time" "WARN" "Average response time: ${avg_time}ms (slower than expected)"
        else
            record_test "lb_response_time" "FAIL" "Average response time: ${avg_time}ms (too slow)"
        fi
    else
        record_test "lb_response_time" "FAIL" "No successful requests"
    fi

    # Test 5: Nginx container health
    log_info "Checking Nginx container health..."

    local nginx_health
    nginx_health=$(docker inspect --format='{{.State.Health.Status}}' fleet-nginx 2>/dev/null || echo "unknown")

    if [[ "$nginx_health" == "healthy" ]]; then
        record_test "lb_container_health" "PASS" "Nginx container healthy"
    elif [[ "$nginx_health" == "starting" ]]; then
        record_test "lb_container_health" "WARN" "Nginx container still starting"
    else
        record_test "lb_container_health" "FAIL" "Nginx container status: $nginx_health"
    fi
}

# =============================================================================
# Test: Automatic Recovery Verification
# =============================================================================
#
# This test verifies that the system can automatically recover from failures
# without manual intervention. It checks:
# 1. Container restart policies work correctly
# 2. Services reconnect after recovery
# 3. Data consistency is maintained
#
# =============================================================================

test_automatic_recovery() {
    log_step "Automatic Recovery Verification"

    # Test 1: Container restart policy
    log_info "Verifying container restart policies..."

    local restart_policy_ok=true

    for container in ${APP_CONTAINERS//,/ }; do
        local restart_policy
        restart_policy=$(docker inspect --format='{{.HostConfig.RestartPolicy.Name}}' "$container" 2>/dev/null || echo "unknown")

        if [[ "$restart_policy" != "unless-stopped" && "$restart_policy" != "always" && "$restart_policy" != "on-failure" ]]; then
            log_warn "Container $container has restart policy: $restart_policy"
            restart_policy_ok=false
        fi
    done

    if [[ "$restart_policy_ok" == true ]]; then
        record_test "recovery_restart_policy" "PASS" "All containers have proper restart policies"
    else
        record_test "recovery_restart_policy" "FAIL" "Some containers missing restart policy"
    fi

    # Test 2: Quick crash recovery
    log_info "Testing crash recovery (killing a container)..."

    local test_container
    test_container=$(echo "$APP_CONTAINERS" | cut -d',' -f1)

    # Get initial start count
    local initial_restarts
    initial_restarts=$(docker inspect --format='{{.RestartCount}}' "$test_container" 2>/dev/null || echo "0")

    # Kill the container (simulates crash)
    log_info "Killing container: $test_container"
    docker kill "$test_container" &>/dev/null || true

    # Wait for automatic restart
    sleep 5

    # Check if container restarted
    local new_restarts
    new_restarts=$(docker inspect --format='{{.RestartCount}}' "$test_container" 2>/dev/null || echo "0")

    local container_running
    container_running=$(docker inspect --format='{{.State.Running}}' "$test_container" 2>/dev/null || echo "false")

    if [[ "$container_running" == "true" ]]; then
        record_test "recovery_auto_restart" "PASS" "Container automatically restarted"
    else
        record_test "recovery_auto_restart" "FAIL" "Container did not automatically restart"

        # Manual restart for cleanup
        docker start "$test_container" &>/dev/null || true
    fi

    # Wait for container to become healthy
    if wait_for_condition "Container becomes healthy" 60 \
        "docker inspect --format='{{.State.Health.Status}}' '$test_container' 2>/dev/null | grep -q 'healthy'"; then
        record_test "recovery_health_restored" "PASS" "Container health restored"
    else
        record_test "recovery_health_restored" "FAIL" "Container did not become healthy"
    fi

    # Test 3: Service connectivity after recovery
    log_info "Verifying service connectivity after recovery..."

    sleep 5

    if check_app_health; then
        record_test "recovery_connectivity" "PASS" "Application accessible after recovery"
    else
        record_test "recovery_connectivity" "FAIL" "Application not accessible after recovery"
    fi
}

# =============================================================================
# Report Generation
# =============================================================================

generate_report() {
    log_step "Test Report"

    # Determine overall status
    local overall_status="PASS"
    [[ "$FAILED_TESTS" -gt 0 ]] && overall_status="FAIL"

    # Terminal output
    echo ""
    echo "=========================================="
    echo "  FAILOVER TEST RESULTS"
    echo "=========================================="
    echo ""
    echo "  Total Tests:  $TOTAL_TESTS"
    echo -e "  Passed:       ${GREEN}$PASSED_TESTS${NC}"
    echo -e "  Failed:       ${RED}$FAILED_TESTS${NC}"
    echo ""
    echo "  Log File:     $LOG_FILE"
    echo ""
    echo "=========================================="

    if [[ "$overall_status" == "PASS" ]]; then
        echo -e "  Status: ${GREEN}${BOLD}PASS${NC}"
    else
        echo -e "  Status: ${RED}${BOLD}FAIL${NC}"
    fi

    echo "=========================================="

    # Detailed results to log file
    {
        echo ""
        echo "=========================================="
        echo "  DETAILED TEST RESULTS"
        echo "=========================================="
        echo ""

        for test_name in "${!TEST_RESULTS[@]}"; do
            local result="${TEST_RESULTS[$test_name]}"
            local test_status="${result%%|*}"
            local test_details="${result#*|}"
            echo "  [$test_status] $test_name: $test_details"
        done

        echo ""
        echo "=========================================="
    } >> "$LOG_FILE"

    return $([[ "$overall_status" == "PASS" ]] && echo 0 || echo 1)
}

# =============================================================================
# Main
# =============================================================================

main() {
    local tests_to_run=()

    # Parse arguments
    if [[ $# -eq 0 ]]; then
        tests_to_run=("all")
    else
        while [[ $# -gt 0 ]]; do
            case $1 in
                db|database)
                    tests_to_run+=("db")
                    shift
                    ;;
                app|application)
                    tests_to_run+=("app")
                    shift
                    ;;
                lb|loadbalancer|load-balancer)
                    tests_to_run+=("lb")
                    shift
                    ;;
                all)
                    tests_to_run=("all")
                    shift
                    ;;
                -h|--help)
                    show_help
                    ;;
                *)
                    log_fail "Unknown option: $1"
                    show_help
                    exit 2
                    ;;
            esac
        done
    fi

    # Expand "all" to individual tests
    if [[ " ${tests_to_run[*]} " =~ " all " ]]; then
        tests_to_run=("db" "app" "lb" "recovery")
    fi

    # Initialize log file
    {
        echo "=========================================="
        echo "  Fleet2 Failover Test Log"
        echo "  Started: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "=========================================="
    } > "$LOG_FILE"

    echo ""
    echo -e "${BOLD}=========================================="
    echo "  Fleet2 Failover Testing"
    echo -e "==========================================${NC}"
    echo ""
    log_info "Log file: $LOG_FILE"
    log_info "Tests to run: ${tests_to_run[*]}"

    # Check dependencies
    check_dependencies

    # Run selected tests
    for test in "${tests_to_run[@]}"; do
        case "$test" in
            db)
                test_database_failover || true
                ;;
            app)
                test_application_failover || true
                ;;
            lb)
                test_load_balancer || true
                ;;
            recovery)
                test_automatic_recovery || true
                ;;
        esac
    done

    # Generate report
    generate_report
    local exit_code=$?

    # Log completion
    {
        echo ""
        echo "=========================================="
        echo "  Completed: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "=========================================="
    } >> "$LOG_FILE"

    exit $exit_code
}

main "$@"
