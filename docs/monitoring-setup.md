# Fleet2 Monitoring and Alerting Guide

This guide covers monitoring and alerting configuration for the Fleet2 application, including APM setup, error tracking, infrastructure monitoring, log aggregation, and alert escalation procedures.

## Table of Contents

- [Overview](#overview)
- [APM Setup](#apm-setup)
- [Error Tracking](#error-tracking)
- [Infrastructure Monitoring](#infrastructure-monitoring)
- [Log Aggregation](#log-aggregation)
- [Metrics Endpoint](#metrics-endpoint)
- [Alert Configuration](#alert-configuration)
- [Alert Escalation Procedures](#alert-escalation-procedures)
- [Dashboards](#dashboards)

## Overview

Fleet2 uses a multi-layered monitoring approach:

| Layer | Tool | Purpose |
|-------|------|---------|
| Application Performance | Sentry / New Relic / Datadog | Request tracing, performance profiling |
| Error Tracking | Sentry | Exception tracking, release tracking |
| Infrastructure | Prometheus + Grafana | Metrics collection and visualization |
| Alerting | Alertmanager / PagerDuty | Alert routing and escalation |
| Logging | Loki / ELK Stack | Centralized log aggregation |

## APM Setup

### Option 1: Sentry (Recommended for Node.js)

Sentry provides excellent Node.js and Vue.js integration with minimal configuration.

#### Installation

```bash
bun add @sentry/node @sentry/vue
```

#### Server Configuration

Create `server/plugins/sentry.ts`:

```typescript
import * as Sentry from '@sentry/node'

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      release: process.env.APP_VERSION || 'unknown',

      // Performance Monitoring
      tracesSampleRate: 0.2, // Sample 20% of transactions

      // Profiling
      profilesSampleRate: 0.1, // Sample 10% of transactions for profiling

      integrations: [
        Sentry.httpIntegration(),
        Sentry.postgresIntegration(),
      ],

      // Filter sensitive data
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers['authorization']
          delete event.request.headers['cookie']
        }
        return event
      },
    })
  }
})
```

#### Client Configuration

Add to `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: ['@sentry/nuxt/module'],

  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
  },
})
```

### Option 2: New Relic

New Relic provides comprehensive APM with automatic instrumentation.

#### Installation

```bash
bun add newrelic
```

#### Configuration

Create `newrelic.js` in the project root:

```javascript
exports.config = {
  app_name: ['Fleet2'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  distributed_tracing: {
    enabled: true,
  },
  logging: {
    level: 'info',
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*',
    ],
  },
}
```

Add to server entry point:

```typescript
if (process.env.NODE_ENV === 'production') {
  require('newrelic')
}
```

### Option 3: Datadog

Datadog offers unified observability with APM, logs, and infrastructure.

#### Installation

```bash
bun add dd-trace
```

#### Configuration

Create `server/plugins/datadog.ts`:

```typescript
import tracer from 'dd-trace'

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV === 'production') {
    tracer.init({
      service: 'fleet2',
      env: process.env.NODE_ENV,
      version: process.env.APP_VERSION,
      logInjection: true,
    })
  }
})
```

## Error Tracking

### Sentry Error Tracking

Configure error boundaries and capture exceptions:

```typescript
// Capture custom errors
import * as Sentry from '@sentry/node'

try {
  await riskyOperation()
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: 'work-orders',
      action: 'create',
    },
    extra: {
      workOrderId: id,
      userId: user.id,
    },
  })
  throw error
}
```

### Error Categorization

Tag errors by severity for proper routing:

| Severity | Examples | Response |
|----------|----------|----------|
| Critical | Database down, Auth service failure | Page immediately |
| High | Payment processing error | Alert on-call |
| Medium | External API timeout | Log and monitor |
| Low | Validation error, 404 | Log only |

## Infrastructure Monitoring

### Prometheus Metrics

Fleet2 exposes a `/api/metrics` endpoint for Prometheus scraping.

#### Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method, path, status |
| `http_request_duration_seconds` | Histogram | Request latency distribution |
| `db_connections_active` | Gauge | Active database connections |
| `db_connections_idle` | Gauge | Idle database connections |
| `db_query_duration_seconds` | Histogram | Database query latency |
| `nodejs_heap_size_bytes` | Gauge | Node.js heap memory usage |
| `nodejs_external_memory_bytes` | Gauge | External memory usage |
| `process_cpu_seconds_total` | Counter | CPU time consumed |

#### Prometheus Scrape Configuration

See `deploy/monitoring/prometheus.yml` for the complete configuration.

### Infrastructure Dashboards

Key infrastructure metrics to monitor:

1. **CPU Usage**
   - Per-container CPU utilization
   - Host CPU usage
   - CPU throttling events

2. **Memory Usage**
   - Container memory limits and usage
   - Node.js heap size
   - Memory swap usage

3. **Disk I/O**
   - PostgreSQL data volume usage
   - Log volume growth
   - I/O wait times

4. **Network**
   - Request rate per instance
   - Response times (p50, p95, p99)
   - Error rate percentage

## Log Aggregation

### Option 1: Loki + Grafana (Recommended)

Lightweight log aggregation that integrates with Prometheus and Grafana.

#### Docker Compose Configuration

See `deploy/docker-compose.monitoring.yml` for the Loki stack setup.

#### Log Labels

Structure logs with consistent labels:

```typescript
// Structured logging
console.log(JSON.stringify({
  level: 'info',
  message: 'Work order created',
  service: 'fleet2',
  instance: process.env.INSTANCE_ID,
  traceId: request.headers['x-trace-id'],
  userId: user.id,
  workOrderId: workOrder.id,
  timestamp: new Date().toISOString(),
}))
```

### Option 2: ELK Stack

For larger deployments requiring advanced search capabilities.

#### Components

- **Elasticsearch**: Log storage and indexing
- **Logstash**: Log processing and transformation
- **Kibana**: Visualization and search UI

#### Logstash Configuration

```conf
input {
  tcp {
    port => 5000
    codec => json
  }
}

filter {
  if [level] == "error" {
    mutate {
      add_tag => ["error"]
    }
  }

  grok {
    match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:log_message}" }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "fleet2-logs-%{+YYYY.MM.dd}"
  }
}
```

## Metrics Endpoint

Fleet2 exposes a Prometheus-compatible metrics endpoint at `/api/metrics`.

### Implementation Pattern

The endpoint uses the prom-client library pattern (documented in `server/api/metrics.get.ts`):

```typescript
// Example metrics collection
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
})

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
})
```

### Access Control

The metrics endpoint is protected and only accessible from internal networks:

- Prometheus scraper IP whitelist
- Internal network only (no public exposure)
- Optional: Basic authentication

## Alert Configuration

### Alert Rules

See `deploy/monitoring/prometheus.yml` for complete alert rules.

#### Critical Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| InstanceDown | Instance unreachable for 2m | critical |
| HighErrorRate | Error rate > 10% for 5m | critical |
| DatabaseDown | Database unreachable for 1m | critical |
| HighMemoryUsage | Memory > 90% for 5m | critical |

#### Warning Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| HighLatency | p95 latency > 2s for 5m | warning |
| HighCPUUsage | CPU > 80% for 10m | warning |
| DiskSpaceLow | Disk < 20% free | warning |
| QueueBacklog | Queue depth > 1000 for 5m | warning |

### Alertmanager Configuration

See `deploy/monitoring/alertmanager.yml` for routing and notification configuration.

## Alert Escalation Procedures

### Severity Levels

| Level | Response Time | Examples |
|-------|---------------|----------|
| P1 - Critical | Immediate | Production down, data breach |
| P2 - High | 30 minutes | Major feature broken, performance degraded |
| P3 - Medium | 4 hours | Minor feature broken, non-critical bug |
| P4 - Low | Next business day | Cosmetic issues, documentation |

### Escalation Matrix

#### P1 - Critical Incidents

1. **0-5 minutes**: Alert fires, PagerDuty notifies on-call engineer
2. **5-15 minutes**: On-call acknowledges and begins investigation
3. **15-30 minutes**: If unresolved, escalate to senior engineer
4. **30-60 minutes**: If unresolved, escalate to engineering lead
5. **60+ minutes**: If unresolved, notify CTO and initiate incident bridge

#### P2 - High Priority

1. **0-15 minutes**: Alert fires, Slack notification to #alerts
2. **15-30 minutes**: On-call engineer investigates
3. **30-60 minutes**: If unresolved, escalate to senior engineer
4. **60-120 minutes**: If unresolved, escalate to engineering lead

#### Incident Response Runbook

1. **Acknowledge** - Acknowledge the alert in PagerDuty/Alertmanager
2. **Assess** - Determine scope and impact of the incident
3. **Communicate** - Post status in #incidents Slack channel
4. **Investigate** - Use logs, metrics, and traces to identify root cause
5. **Mitigate** - Apply fix or workaround to restore service
6. **Resolve** - Confirm service restored and alert cleared
7. **Postmortem** - Document incident and follow-up actions

### On-Call Rotation

Configure on-call rotation in PagerDuty:

- Primary on-call: 7-day rotation
- Secondary on-call: Backup for primary
- Escalation timeout: 5 minutes
- Coverage: 24/7

## Dashboards

### Recommended Grafana Dashboards

1. **Fleet2 Overview**
   - Request rate and error rate
   - Response time percentiles
   - Active users
   - Key business metrics

2. **Infrastructure**
   - CPU, memory, disk per container
   - Network I/O
   - Container health status

3. **Database Performance**
   - Connection pool usage
   - Query latency histogram
   - Slow query log
   - Replication lag (if applicable)

4. **Application Performance**
   - Endpoint latency breakdown
   - Error rate by endpoint
   - Cache hit ratio
   - Background job queue depth

### Dashboard JSON Templates

Import community dashboards from Grafana Labs:

- Node.js Application: ID 11159
- PostgreSQL: ID 9628
- Nginx: ID 12708
- Docker Containers: ID 893

## Environment Variables

Required environment variables for monitoring:

```bash
# Sentry
SENTRY_DSN=https://xxx@sentry.io/xxx

# New Relic (if used)
NEW_RELIC_LICENSE_KEY=xxx
NEW_RELIC_APP_NAME=Fleet2

# Datadog (if used)
DD_API_KEY=xxx
DD_SITE=datadoghq.com

# Alertmanager
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
PAGERDUTY_SERVICE_KEY=xxx
SMTP_HOST=smtp.example.com
SMTP_FROM=alerts@fleet2.example.com

# Metrics
METRICS_AUTH_TOKEN=xxx
```

## Quick Start

1. **Deploy monitoring stack**:
   ```bash
   docker compose -f docker-compose.yml -f deploy/docker-compose.monitoring.yml up -d
   ```

2. **Access dashboards**:
   - Grafana: http://localhost:3847
   - Prometheus: http://localhost:9190
   - Alertmanager: http://localhost:9193

3. **Configure alerts**:
   - Edit `deploy/monitoring/alertmanager.yml` with your notification channels
   - Restart Alertmanager to apply changes

4. **Import dashboards**:
   - Log into Grafana
   - Import dashboards from `deploy/monitoring/dashboards/`
