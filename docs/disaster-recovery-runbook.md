# Fleet2 Disaster Recovery Runbook

This document provides comprehensive procedures for disaster recovery scenarios affecting the Fleet2 platform. It covers recovery procedures, escalation paths, and operational guidelines to minimize downtime and data loss.

## Table of Contents

1. [Overview](#overview)
2. [Recovery Objectives](#recovery-objectives)
3. [Contact and Escalation Matrix](#contact-and-escalation-matrix)
4. [Failure Scenarios](#failure-scenarios)
5. [Recovery Procedures](#recovery-procedures)
6. [Post-Recovery Validation](#post-recovery-validation)
7. [Testing and Maintenance](#testing-and-maintenance)
8. [Appendices](#appendices)

---

## Overview

### Purpose

This runbook provides step-by-step procedures for recovering the Fleet2 platform from various disaster scenarios. All team members with on-call responsibilities should be familiar with this document.

### Scope

This runbook covers:
- Database failures and recovery
- Application server failures
- Complete infrastructure failures
- Data corruption incidents
- Security incidents requiring recovery
- Cloud provider outages

### Prerequisites

Before executing any recovery procedure:

1. **Verify the incident** - Confirm the failure is real, not a monitoring false positive
2. **Communicate** - Notify stakeholders via the escalation matrix
3. **Document** - Start an incident timeline in the incident management system
4. **Access** - Ensure you have necessary credentials and access rights

### Key Components

| Component | Description | Criticality |
|-----------|-------------|-------------|
| PostgreSQL Database | Primary data store | Critical |
| Application Servers | Nuxt.js + Node.js | Critical |
| Redis Cache | Session store, caching | High |
| Object Storage (S3) | Documents, backups | High |
| Load Balancer | Traffic distribution | High |
| CDN | Static assets | Medium |

---

## Recovery Objectives

### Recovery Time Objective (RTO)

| Scenario | RTO Target | Maximum Acceptable |
|----------|------------|-------------------|
| Single component failure | 15 minutes | 30 minutes |
| Database failover | 5 minutes | 15 minutes |
| Full database restore | 1 hour | 4 hours |
| Complete infrastructure rebuild | 4 hours | 8 hours |
| Major data corruption (PITR) | 2 hours | 6 hours |

### Recovery Point Objective (RPO)

| Backup Type | RPO | Data Loss Window |
|-------------|-----|------------------|
| Continuous WAL archiving | Near-zero | < 5 minutes |
| Daily backups | 24 hours | Up to 24 hours |
| Weekly backups | 7 days | Up to 7 days |
| Monthly backups | 30 days | Up to 30 days |

### Backup Schedule

| Type | Schedule | Retention | Storage |
|------|----------|-----------|---------|
| WAL Archive | Continuous | 7 days | S3 |
| Daily Full | 02:00 UTC | 7 days | S3 |
| Weekly Full | Sunday 03:00 UTC | 28 days | S3 |
| Monthly Full | 1st of month 04:00 UTC | 365 days | S3/Glacier |

---

## Contact and Escalation Matrix

### Primary Contacts

| Role | Name | Phone | Email | Availability |
|------|------|-------|-------|--------------|
| On-Call Engineer | Rotating | +1-XXX-XXX-XXXX | oncall@company.com | 24/7 |
| Database Admin | [Name] | +1-XXX-XXX-XXXX | dba@company.com | Business hours |
| Infrastructure Lead | [Name] | +1-XXX-XXX-XXXX | infra@company.com | Business hours |
| Security Lead | [Name] | +1-XXX-XXX-XXXX | security@company.com | Business hours |
| VP Engineering | [Name] | +1-XXX-XXX-XXXX | vpe@company.com | Escalation only |

### Escalation Timeline

| Duration | Action | Notify |
|----------|--------|--------|
| 0 min | Incident detected | On-call engineer |
| 5 min | Initial assessment | On-call + relevant team lead |
| 15 min | If not resolved | Infrastructure Lead |
| 30 min | If customer-impacting | VP Engineering |
| 1 hour | Major incident declared | Executive team |

### External Contacts

| Service | Contact | Support Level |
|---------|---------|---------------|
| Cloud Provider (AWS/GCP) | Support portal | Premium |
| Database Support (if applicable) | Support portal | Standard |
| CDN Provider | Support portal | Standard |
| DNS Provider | Support portal | Standard |

---

## Failure Scenarios

### Scenario 1: Database Server Failure

**Symptoms:**
- Application errors: "Connection refused" or "Connection timed out"
- Monitoring alerts for database connectivity
- Health check failures

**Impact:** Critical - All application functionality affected

**Recovery Path:** [Database Recovery Procedure](#procedure-1-database-server-recovery)

---

### Scenario 2: Data Corruption

**Symptoms:**
- Application errors: constraint violations, data inconsistencies
- User reports of missing or incorrect data
- Audit log anomalies

**Impact:** Critical - Data integrity compromised

**Recovery Path:** [Point-in-Time Recovery](#procedure-2-point-in-time-recovery-pitr)

---

### Scenario 3: Accidental Data Deletion

**Symptoms:**
- User or admin reports of missing data
- Audit logs show DELETE operations
- Table row counts significantly reduced

**Impact:** High to Critical - Depends on data affected

**Recovery Path:** [Point-in-Time Recovery](#procedure-2-point-in-time-recovery-pitr)

---

### Scenario 4: Application Server Failure

**Symptoms:**
- Load balancer health checks failing
- 502/503 errors from frontend
- Process monitoring alerts

**Impact:** High - Partial or complete service unavailability

**Recovery Path:** [Application Recovery Procedure](#procedure-3-application-server-recovery)

---

### Scenario 5: Complete Infrastructure Failure

**Symptoms:**
- All services unreachable
- Cloud provider status page showing issues
- Multiple simultaneous alerts

**Impact:** Critical - Complete service outage

**Recovery Path:** [Full Infrastructure Recovery](#procedure-4-full-infrastructure-recovery)

---

### Scenario 6: Security Incident

**Symptoms:**
- Unusual access patterns in logs
- Unauthorized data access alerts
- External security reports

**Impact:** Variable - Depends on breach scope

**Recovery Path:** [Security Incident Recovery](#procedure-5-security-incident-recovery)

---

### Scenario 7: Ransomware/Encryption Attack

**Symptoms:**
- Files inaccessible or encrypted
- Ransom notes found
- Unusual CPU/disk activity

**Impact:** Critical - Complete data loss risk

**Recovery Path:** [Ransomware Recovery](#procedure-6-ransomware-recovery)

---

## Recovery Procedures

### Procedure 1: Database Server Recovery

**Estimated Time:** 15-60 minutes
**Required Access:** Database admin credentials, SSH access

#### Step 1: Assess the Situation

```bash
# Check if PostgreSQL process is running
ssh db-server "systemctl status postgresql"

# Check database logs
ssh db-server "tail -100 /var/log/postgresql/postgresql-17-main.log"

# Check disk space
ssh db-server "df -h"

# Check memory
ssh db-server "free -h"
```

#### Step 2: Attempt Service Restart (if process crashed)

```bash
# Restart PostgreSQL
ssh db-server "sudo systemctl restart postgresql"

# Verify it's running
ssh db-server "sudo systemctl status postgresql"

# Test connection
psql -h db-server -U fleet -d fleet -c "SELECT 1;"
```

#### Step 3: If Restart Fails - Check for Corruption

```bash
# Check for PostgreSQL crash recovery in logs
ssh db-server "grep -i 'crash\|corrupt\|error' /var/log/postgresql/postgresql-17-main.log | tail -50"

# Check data directory integrity
ssh db-server "sudo -u postgres pg_controldata /var/lib/postgresql/17/main"
```

#### Step 4: If Server is Unrecoverable - Restore from Backup

```bash
# Download latest backup from S3
./deploy/scripts/test-backup-restore.sh --s3-latest -t daily --keep-db

# Or use PITR for point-in-time recovery
./deploy/scripts/pitr-restore.sh \
    -b /backups/latest-base.tar.gz \
    -s fleet2-backups \
    --target-latest
```

#### Step 5: Verify Recovery

```bash
# Run verification script
./scripts/verify-backup.sh /backups/restored.sql.gz

# Check key table counts
psql -h db-server -U fleet -d fleet << 'SQL'
SELECT 'organisations', count(*) FROM organisations
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'assets', count(*) FROM assets;
SQL
```

---

### Procedure 2: Point-in-Time Recovery (PITR)

**Estimated Time:** 30 minutes - 2 hours
**Required Access:** Database admin, S3 access

Use this procedure when you need to recover to a specific point in time, such as before accidental deletion or corruption.

#### Step 1: Identify Recovery Target

```bash
# Determine the timestamp before the incident
# Check application logs for the last known good state
grep -i "incident_indicator" /var/log/fleet2/app.log | head -5

# Check database logs for the issue timestamp
grep -i "error\|delete\|drop" /var/log/postgresql/postgresql-17-main.log | tail -20
```

#### Step 2: Stop Application Traffic

```bash
# Put application in maintenance mode
./scripts/maintenance-mode.sh enable

# Or update load balancer to return maintenance page
# This prevents new writes during recovery
```

#### Step 3: Prepare for Recovery

```bash
# Stop PostgreSQL on the target server
sudo systemctl stop postgresql

# Backup current (corrupted) data directory just in case
sudo mv /var/lib/postgresql/17/main /var/lib/postgresql/17/main.corrupted

# Create new data directory
sudo mkdir -p /var/lib/postgresql/17/main
sudo chown postgres:postgres /var/lib/postgresql/17/main
```

#### Step 4: Execute PITR Recovery

```bash
# Download base backup
aws s3 cp s3://fleet2-backups/fleet2/daily/latest/base.tar.gz /tmp/base.tar.gz

# Run PITR restore script
./deploy/scripts/pitr-restore.sh \
    -b /tmp/base.tar.gz \
    -s fleet2-backups \
    --target-time "2025-01-15 14:30:00+00" \
    --data-dir /var/lib/postgresql/17/main
```

#### Step 5: Verify and Promote

```bash
# Check recovery progress
sudo -u postgres psql -c "SELECT pg_is_in_recovery();"

# When recovery is complete, verify data
psql -U fleet -d fleet << 'SQL'
-- Check recent records exist
SELECT MAX(created_at) FROM work_orders;
SELECT COUNT(*) FROM organisations;
SQL

# If paused, promote to primary
sudo -u postgres pg_ctl -D /var/lib/postgresql/17/main promote
```

#### Step 6: Resume Operations

```bash
# Verify database is accepting writes
psql -U fleet -d fleet -c "INSERT INTO audit_log (action) VALUES ('recovery_test');"
psql -U fleet -d fleet -c "DELETE FROM audit_log WHERE action = 'recovery_test';"

# Disable maintenance mode
./scripts/maintenance-mode.sh disable

# Monitor for any issues
tail -f /var/log/fleet2/app.log
```

---

### Procedure 3: Application Server Recovery

**Estimated Time:** 5-15 minutes
**Required Access:** SSH access, container orchestration

#### Step 1: Identify Failed Servers

```bash
# Check load balancer backend status
curl -s http://lb-internal/health-check-status

# Check container status
docker ps -a | grep fleet2

# Check systemd service status
systemctl status fleet2-app
```

#### Step 2: Restart Failed Services

```bash
# Docker restart
docker compose -f docker-compose.prod.yml restart app

# Or systemd restart
sudo systemctl restart fleet2-app

# Or Kubernetes restart
kubectl rollout restart deployment/fleet2-app -n production
```

#### Step 3: If Container Image is Corrupted

```bash
# Pull fresh image
docker pull ghcr.io/your-org/fleet2:latest

# Recreate containers
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

#### Step 4: If Server is Unrecoverable

```bash
# Provision new server using infrastructure as code
terraform apply -target=module.app_server

# Or spin up replacement in cloud console
# Then deploy application
./deploy/scripts/deploy-app.sh production
```

---

### Procedure 4: Full Infrastructure Recovery

**Estimated Time:** 2-4 hours
**Required Access:** Full admin access, infrastructure credentials

This is the nuclear option - complete rebuild of all infrastructure.

#### Step 1: Assess Damage and Communicate

```bash
# Activate incident response team
# Post status to status page
# Notify customers via email

# Document current state
date > /tmp/incident-log.txt
echo "Full infrastructure failure - beginning recovery" >> /tmp/incident-log.txt
```

#### Step 2: Set Up Temporary Communication

- Use backup communication channels (different provider)
- Establish war room (virtual or physical)
- Assign roles: Incident Commander, Technical Lead, Communications Lead

#### Step 3: Deploy Core Infrastructure

```bash
# Apply infrastructure as code
cd infrastructure/terraform
terraform init
terraform apply -target=module.networking
terraform apply -target=module.database
terraform apply -target=module.app_servers
terraform apply -target=module.load_balancer
```

#### Step 4: Restore Database

```bash
# Download latest backup
aws s3 cp s3://fleet2-backups/fleet2/daily/latest/db_backup.sql.gz /tmp/

# Restore to new database server
./deploy/scripts/pitr-restore.sh \
    -b /tmp/db_backup.sql.gz \
    -s fleet2-backups \
    --target-latest \
    --data-dir /var/lib/postgresql/17/main
```

#### Step 5: Deploy Application

```bash
# Deploy application to new servers
./deploy/scripts/deploy-app.sh production

# Configure load balancer
./deploy/scripts/configure-lb.sh production
```

#### Step 6: Validate and Restore Traffic

```bash
# Run smoke tests
./scripts/smoke-test.sh production

# Verify key functionality
curl -s https://app.fleet2.com/api/health | jq .

# Gradually restore traffic
./deploy/scripts/traffic-shift.sh 10  # 10% traffic
./deploy/scripts/traffic-shift.sh 50  # 50% traffic
./deploy/scripts/traffic-shift.sh 100 # 100% traffic
```

---

### Procedure 5: Security Incident Recovery

**Estimated Time:** Variable (hours to days)
**Required Access:** Security team, legal, all admin access

#### Step 1: Contain the Incident

```bash
# Isolate affected systems (do NOT shut down - preserve evidence)
# Block suspicious IPs at firewall
iptables -A INPUT -s SUSPICIOUS_IP -j DROP

# Revoke compromised credentials immediately
./scripts/revoke-credentials.sh --user affected_user

# Rotate all secrets
./scripts/rotate-secrets.sh --all
```

#### Step 2: Preserve Evidence

```bash
# Snapshot affected systems
aws ec2 create-snapshot --volume-id vol-xxx --description "Incident evidence"

# Copy logs to secure location
aws s3 cp /var/log/ s3://fleet2-incident-evidence/$(date +%Y%m%d)/ --recursive

# Document timeline
# Keep detailed notes of all actions taken
```

#### Step 3: Assess Impact

- Identify affected data and systems
- Determine if data was exfiltrated
- Review audit logs for unauthorized access
- Identify attack vector

#### Step 4: Eradicate Threat

```bash
# Remove malicious access
# Patch vulnerabilities
# Update security groups
# Deploy fresh instances from known-good images

# Rebuild from clean images
./deploy/scripts/rebuild-infrastructure.sh --clean
```

#### Step 5: Recover Operations

```bash
# Restore from backup taken before compromise
# Use a backup from BEFORE the earliest sign of intrusion
./deploy/scripts/pitr-restore.sh \
    -b /backups/pre-incident-backup.tar.gz \
    -s fleet2-backups \
    --target-time "TIMESTAMP_BEFORE_INCIDENT"
```

#### Step 6: Post-Incident Activities

- Complete incident report
- Notify affected customers (if required)
- Report to regulatory bodies (if required)
- Conduct lessons learned session
- Update security procedures

---

### Procedure 6: Ransomware Recovery

**Estimated Time:** 4-24 hours
**Required Access:** Offline backups, clean infrastructure

**CRITICAL:** Do NOT pay the ransom. Do NOT use any affected systems.

#### Step 1: Isolate All Systems

```bash
# Disconnect affected systems from network immediately
# Do NOT shut down - this may trigger data destruction
# Block all outbound traffic at network level
```

#### Step 2: Assess Scope

- Identify all affected systems
- Determine encryption status of backups
- Verify offline backups are unaffected
- Document all encrypted systems

#### Step 3: Prepare Clean Environment

```bash
# Set up completely new infrastructure
# Use different credentials everywhere
# Verify backup integrity BEFORE restoring

# From a CLEAN machine, verify backup
./deploy/scripts/test-backup-restore.sh \
    --s3-latest \
    --backup-type monthly  # Use older backup if recent ones may be compromised
```

#### Step 4: Restore from Clean Backup

```bash
# Only use backups verified to be unencrypted
# Restore to completely new infrastructure

# Deploy new infrastructure
terraform apply -var="environment=recovery"

# Restore database
./deploy/scripts/pitr-restore.sh \
    -b /offline-backups/verified-clean-backup.tar.gz \
    -w /offline-backups/wal-archive \
    --target-time "LAST_KNOWN_GOOD_TIMESTAMP"
```

#### Step 5: Harden Before Reconnecting

- Patch all systems
- Update all credentials
- Enable enhanced monitoring
- Deploy additional security controls
- Review and restrict network access

#### Step 6: Gradual Restoration

```bash
# Bring services online gradually
# Monitor closely for any signs of re-infection
# Keep old (infected) systems isolated for forensics
```

---

## Post-Recovery Validation

### Checklist

After any recovery, complete this validation checklist:

#### Database Validation

- [ ] All tables present and accessible
- [ ] Row counts match expected values (within RPO)
- [ ] Foreign key relationships intact
- [ ] Indexes present and functional
- [ ] Sequences at correct values
- [ ] No orphaned records

```bash
# Run validation script
./scripts/verify-backup.sh --expected-counts config/expected-counts.json
```

#### Application Validation

- [ ] All services starting correctly
- [ ] API endpoints responding
- [ ] Authentication working
- [ ] Key workflows functional
- [ ] Integrations connected

```bash
# Run smoke tests
./scripts/smoke-test.sh production
```

#### Infrastructure Validation

- [ ] Load balancer health checks passing
- [ ] SSL certificates valid
- [ ] DNS resolving correctly
- [ ] Monitoring and alerting functional
- [ ] Backup jobs scheduled

#### Security Validation

- [ ] Firewall rules applied
- [ ] Secrets rotated (if security incident)
- [ ] Access logs being collected
- [ ] Intrusion detection active

---

## Testing and Maintenance

### Regular Testing Schedule

| Test Type | Frequency | Owner | Duration |
|-----------|-----------|-------|----------|
| Backup verification | Daily (automated) | DevOps | 30 min |
| Database restore drill | Weekly | DBA | 2 hours |
| Failover test | Monthly | Infrastructure | 4 hours |
| Full DR exercise | Quarterly | All teams | 1 day |
| Tabletop exercise | Bi-annually | Leadership | 2 hours |

### Automated Backup Testing

```bash
# Configure automated backup testing via cron or systemd timer
# See deploy/scripts/test-backup-restore.sh

# Example cron entry for weekly testing
0 4 * * 0 /opt/fleet2/deploy/scripts/test-backup-restore.sh --s3-latest --notify
```

### Runbook Maintenance

This runbook should be reviewed and updated:

- After any significant infrastructure change
- After any DR incident or drill
- Quarterly, at minimum
- When team members change

### Training Requirements

| Role | Training | Frequency |
|------|----------|-----------|
| All Engineers | Runbook overview | Quarterly |
| On-Call Engineers | Hands-on DR drill | Monthly |
| DBAs | Full restore practice | Monthly |
| Incident Commanders | Tabletop exercise | Quarterly |

---

## Appendices

### Appendix A: Recovery Scripts Location

| Script | Location | Purpose |
|--------|----------|---------|
| Backup to S3 | `scripts/backup-to-s3.sh` | Upload backups to S3 |
| Database Backup | `scripts/backup-database.sh` | Create database dump |
| Verify Backup | `scripts/verify-backup.sh` | Validate backup integrity |
| PITR Restore | `deploy/scripts/pitr-restore.sh` | Point-in-time recovery |
| Test Restore | `deploy/scripts/test-backup-restore.sh` | Automated backup testing |

### Appendix B: Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| WAL Archive Config | `deploy/backup/wal-archive.conf` | PostgreSQL WAL settings |
| Recovery Template | `deploy/backup/recovery.conf.template` | Recovery configuration |
| Expected Counts | `config/expected-counts.json` | Validation thresholds |

### Appendix C: External Documentation

- [PostgreSQL Backup and Restore](https://www.postgresql.org/docs/current/backup.html)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Docker Compose Reference](https://docs.docker.com/compose/)

### Appendix D: Glossary

| Term | Definition |
|------|------------|
| RTO | Recovery Time Objective - Maximum acceptable downtime |
| RPO | Recovery Point Objective - Maximum acceptable data loss |
| PITR | Point-in-Time Recovery - Restore to specific timestamp |
| WAL | Write-Ahead Log - Transaction log for recovery |
| Base Backup | Full backup of database files |
| Failover | Switch to standby system |

### Appendix E: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-01 | DevOps | Initial version |

---

**Document Owner:** DevOps Team
**Last Review:** 2025-01-01
**Next Review:** 2025-04-01

*This document is critical for operational continuity. Keep it up to date and accessible to all relevant team members.*
