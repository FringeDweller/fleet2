# Backup Storage Configuration

This document describes how to configure cloud backup storage for Fleet2 using S3-compatible services (AWS S3, Cloudflare R2, MinIO).

## Overview

Fleet2 supports automated backups to any S3-compatible storage provider. The backup system:

- Uploads database backups and document archives to cloud storage
- Supports daily, weekly, and monthly backup retention policies
- Works with AWS S3, Cloudflare R2, MinIO, and other S3-compatible services

## Required Environment Variables

Add these variables to your `.env` file or deployment configuration:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | Yes | Access key for S3-compatible storage | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Yes | Secret key for S3-compatible storage | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `BACKUP_BUCKET` | Yes | S3 bucket name for storing backups | `fleet2-backups` |
| `BACKUP_ENDPOINT` | No | S3-compatible endpoint URL (required for R2/MinIO) | `https://account.r2.cloudflarestorage.com` |
| `BACKUP_STORAGE_CLASS` | No | Storage class (default: STANDARD) | `STANDARD_IA` |
| `BACKUP_REGION` | No | AWS region (default: auto) | `us-east-1` |
| `BACKUP_PREFIX` | No | Prefix/folder for backups (default: fleet2) | `production/fleet2` |

## Retention Policy

The backup system maintains the following retention schedule:

| Backup Type | Retention Period | Lifecycle Transition |
|-------------|------------------|---------------------|
| Daily | 7 days | Delete after 7 days |
| Weekly | 4 weeks (28 days) | Delete after 28 days |
| Monthly | 12 months (365 days) | Delete after 365 days |

## Setup Instructions

### AWS S3

1. **Create an S3 Bucket**

   ```bash
   aws s3 mb s3://fleet2-backups --region us-east-1
   ```

2. **Create IAM User for Backups**

   Create a dedicated IAM user with limited permissions:

   ```bash
   aws iam create-user --user-name fleet2-backup-user
   aws iam create-access-key --user-name fleet2-backup-user
   ```

3. **Attach Bucket Policy**

   Create a file `backup-policy.json`:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowBackupOperations",
         "Effect": "Allow",
         "Principal": {
           "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/fleet2-backup-user"
         },
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::fleet2-backups",
           "arn:aws:s3:::fleet2-backups/*"
         ]
       }
     ]
   }
   ```

   Apply the policy:

   ```bash
   aws s3api put-bucket-policy --bucket fleet2-backups --policy file://backup-policy.json
   ```

4. **Configure Lifecycle Rules**

   Create `lifecycle-rules.json`:

   ```json
   {
     "Rules": [
       {
         "ID": "DailyBackupRetention",
         "Status": "Enabled",
         "Filter": {
           "Prefix": "fleet2/daily/"
         },
         "Expiration": {
           "Days": 7
         }
       },
       {
         "ID": "WeeklyBackupRetention",
         "Status": "Enabled",
         "Filter": {
           "Prefix": "fleet2/weekly/"
         },
         "Expiration": {
           "Days": 28
         }
       },
       {
         "ID": "MonthlyBackupRetention",
         "Status": "Enabled",
         "Filter": {
           "Prefix": "fleet2/monthly/"
         },
         "Expiration": {
           "Days": 365
         }
       },
       {
         "ID": "TransitionToInfrequentAccess",
         "Status": "Enabled",
         "Filter": {
           "Prefix": "fleet2/monthly/"
         },
         "Transitions": [
           {
             "Days": 30,
             "StorageClass": "STANDARD_IA"
           },
           {
             "Days": 90,
             "StorageClass": "GLACIER"
           }
         ]
       }
     ]
   }
   ```

   Apply lifecycle rules:

   ```bash
   aws s3api put-bucket-lifecycle-configuration \
     --bucket fleet2-backups \
     --lifecycle-configuration file://lifecycle-rules.json
   ```

5. **Configure Environment Variables**

   ```bash
   # .env
   AWS_ACCESS_KEY_ID=your_access_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_key_here
   BACKUP_BUCKET=fleet2-backups
   BACKUP_REGION=us-east-1
   ```

### Cloudflare R2

Cloudflare R2 is S3-compatible and offers zero egress fees, making it ideal for backup storage.

1. **Create an R2 Bucket**

   - Log in to Cloudflare Dashboard
   - Navigate to R2 > Create bucket
   - Name: `fleet2-backups`

2. **Generate API Token**

   - Go to R2 > Manage R2 API Tokens
   - Create a new token with:
     - Permission: Object Read & Write
     - Bucket: `fleet2-backups`
   - Save the Access Key ID and Secret Access Key

3. **Get Account ID and Endpoint**

   Your R2 endpoint URL format: `https://<account_id>.r2.cloudflarestorage.com`

   Find your account ID in the Cloudflare Dashboard URL or R2 settings.

4. **Configure Environment Variables**

   ```bash
   # .env
   AWS_ACCESS_KEY_ID=your_r2_access_key_here
   AWS_SECRET_ACCESS_KEY=your_r2_secret_key_here
   BACKUP_BUCKET=fleet2-backups
   BACKUP_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
   ```

5. **Configure Lifecycle Rules (via Dashboard or API)**

   R2 lifecycle rules can be configured via the Cloudflare Dashboard:

   - Navigate to R2 > fleet2-backups > Settings > Object lifecycle rules
   - Add rules for each backup type:

   | Rule Name | Prefix | Action | Days |
   |-----------|--------|--------|------|
   | Delete daily backups | fleet2/daily/ | Delete | 7 |
   | Delete weekly backups | fleet2/weekly/ | Delete | 28 |
   | Delete monthly backups | fleet2/monthly/ | Delete | 365 |

### MinIO (Self-Hosted)

MinIO is an open-source S3-compatible object storage for self-hosted deployments.

1. **Start MinIO Server**

   Using Docker:

   ```bash
   docker run -d \
     --name minio \
     -p 9000:9000 \
     -p 9001:9001 \
     -e MINIO_ROOT_USER=minioadmin \
     -e MINIO_ROOT_PASSWORD=minioadmin \
     -v /data/minio:/data \
     minio/minio server /data --console-address ":9001"
   ```

2. **Create Bucket and Access Keys**

   Using the MinIO Console (http://localhost:9001) or mc CLI:

   ```bash
   # Install mc (MinIO Client)
   brew install minio/stable/mc  # macOS
   # or download from https://min.io/download

   # Configure mc
   mc alias set myminio http://localhost:9000 minioadmin minioadmin

   # Create bucket
   mc mb myminio/fleet2-backups

   # Create access key (or use MinIO Console)
   mc admin user add myminio fleet2-backup fleet2-backup-secret
   mc admin policy attach myminio readwrite --user fleet2-backup
   ```

3. **Configure Lifecycle Rules**

   Create `lifecycle.json`:

   ```json
   {
     "Rules": [
       {
         "ID": "DailyExpiration",
         "Status": "Enabled",
         "Filter": {
           "Prefix": "fleet2/daily/"
         },
         "Expiration": {
           "Days": 7
         }
       },
       {
         "ID": "WeeklyExpiration",
         "Status": "Enabled",
         "Filter": {
           "Prefix": "fleet2/weekly/"
         },
         "Expiration": {
           "Days": 28
         }
       },
       {
         "ID": "MonthlyExpiration",
         "Status": "Enabled",
         "Filter": {
           "Prefix": "fleet2/monthly/"
         },
         "Expiration": {
           "Days": 365
         }
       }
     ]
   }
   ```

   Apply lifecycle rules:

   ```bash
   mc ilm import myminio/fleet2-backups < lifecycle.json
   ```

4. **Configure Environment Variables**

   ```bash
   # .env
   AWS_ACCESS_KEY_ID=fleet2-backup
   AWS_SECRET_ACCESS_KEY=fleet2-backup-secret
   BACKUP_BUCKET=fleet2-backups
   BACKUP_ENDPOINT=http://localhost:9000
   ```

## Using the Backup Script

Run backups using the provided script:

```bash
# Daily database backup
./scripts/backup-to-s3.sh /path/to/db_backup.sql.gz daily

# Weekly full backup
./scripts/backup-to-s3.sh /path/to/full_backup.tar.gz weekly

# Monthly archive
./scripts/backup-to-s3.sh /path/to/archive.tar.gz monthly
```

## Automating Backups

### Using Cron

Add to crontab (`crontab -e`):

```cron
# Daily database backup at 2:00 AM
0 2 * * * /path/to/fleet2/scripts/backup-to-s3.sh /backups/db_$(date +\%Y-\%m-\%d).sql.gz daily

# Weekly full backup on Sundays at 3:00 AM
0 3 * * 0 /path/to/fleet2/scripts/backup-to-s3.sh /backups/weekly_$(date +\%Y-\%m-\%d).tar.gz weekly

# Monthly backup on the 1st at 4:00 AM
0 4 1 * * /path/to/fleet2/scripts/backup-to-s3.sh /backups/monthly_$(date +\%Y-\%m).tar.gz monthly
```

### Using Docker/Kubernetes

For containerized deployments, create a backup job:

```yaml
# kubernetes-backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: fleet2-daily-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: amazon/aws-cli:latest
            env:
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: backup-credentials
                  key: access-key
            - name: AWS_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: backup-credentials
                  key: secret-key
            - name: BACKUP_BUCKET
              value: "fleet2-backups"
            - name: BACKUP_ENDPOINT
              value: "https://your-s3-endpoint.com"
            command:
            - /bin/bash
            - -c
            - |
              pg_dump $DATABASE_URL | gzip > /tmp/backup.sql.gz
              aws s3 cp /tmp/backup.sql.gz s3://$BACKUP_BUCKET/fleet2/daily/$(date +%Y/%m/%d)/db_backup.sql.gz --endpoint-url $BACKUP_ENDPOINT
          restartPolicy: OnFailure
```

## Backup Verification

It is critical to regularly verify that backups can be successfully restored. The verification script tests backup integrity by restoring to a temporary database and validating the data.

### Running Verification

```bash
# Basic verification
./scripts/verify-backup.sh backups/backup_2025-01-01_00-00-00.sql.gz

# With expected minimum row counts
./scripts/verify-backup.sh backups/backup.sql.gz --expected-counts expected-counts.json

# Using custom database connection
VERIFY_DB_URL="postgresql://admin:pass@localhost:54837/postgres" \
  ./scripts/verify-backup.sh backups/backup.sql.gz
```

### Environment Variables for Verification

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VERIFY_DB_URL` | No | Database connection for verification | `postgresql://admin:pass@localhost:54837/postgres` |
| `DATABASE_URL` | Fallback | Used if VERIFY_DB_URL not set | `postgresql://fleet:pass@localhost:54837/fleet` |
| `PGHOST` | Fallback | PostgreSQL host | `localhost` |
| `PGPORT` | Fallback | PostgreSQL port | `54837` |
| `PGUSER` | Fallback | PostgreSQL superuser (needs CREATE DATABASE permission) | `fleet` |
| `PGPASSWORD` | Fallback | PostgreSQL password | `secret` |

### Expected Counts File

Create a JSON file with minimum expected row counts for validation:

```json
{
  "organisations": 1,
  "users": 5,
  "assets": 10,
  "work_orders": 50,
  "inspections": 100,
  "parts": 25
}
```

Use with the `--expected-counts` option to validate row counts meet minimums.

### Verification Report

The script outputs a detailed report including:

- Backup file size
- Schema verification (checks for key tables)
- Row counts for all key tables
- Comparison against expected minimums (if provided)
- Overall PASS/FAIL status

Example output:

```
========================================
  BACKUP VERIFICATION REPORT
========================================

Backup File: backups/backup_2025-01-01_00-00-00.sql.gz
Verification Time: 2025-01-01 12:30:00
Duration: 45s

File Size: 125MiB

Table Row Counts:
----------------------------------------
  organisations                        5
  users                              127
  assets                             342
  work_orders                       1256
  inspections                       2891
  parts                              189
  maintenance_schedules               67
  defects                            234
  fuel_transactions                  891

========================================
  Status: PASS
========================================
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Verification passed |
| 1 | General error |
| 2 | Missing required arguments or configuration |
| 3 | Backup file not found or invalid |
| 4 | Restore failed |
| 5 | Validation failed (row count mismatch) |
| 6 | Cleanup failed (non-fatal warning) |

### Automating Verification

Add verification to your backup workflow:

```cron
# Run verification after daily backup at 3:00 AM
0 3 * * * /path/to/fleet2/scripts/verify-backup.sh /backups/latest.sql.gz --expected-counts /path/to/expected-counts.json >> /var/log/backup-verify.log 2>&1
```

### Docker-based Verification

For environments without PostgreSQL client tools installed:

```bash
# Run verification using Docker
docker run --rm \
  -v /path/to/backups:/backups \
  -v /path/to/fleet2/scripts:/scripts \
  -e VERIFY_DB_URL="postgresql://admin:pass@host.docker.internal:54837/postgres" \
  postgres:17-alpine \
  /scripts/verify-backup.sh /backups/backup.sql.gz
```

### Kubernetes CronJob for Verification

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: fleet2-backup-verify
spec:
  schedule: "0 4 * * *"  # 4:00 AM daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: verify
            image: postgres:17-alpine
            env:
            - name: VERIFY_DB_URL
              valueFrom:
                secretKeyRef:
                  name: backup-credentials
                  key: verify-db-url
            command:
            - /bin/bash
            - -c
            - |
              # Download latest backup from S3
              aws s3 cp s3://$BACKUP_BUCKET/fleet2/daily/latest.sql.gz /tmp/backup.sql.gz
              # Run verification
              /scripts/verify-backup.sh /tmp/backup.sql.gz --expected-counts /config/expected-counts.json
            volumeMounts:
            - name: scripts
              mountPath: /scripts
            - name: config
              mountPath: /config
          volumes:
          - name: scripts
            configMap:
              name: backup-scripts
          - name: config
            configMap:
              name: backup-config
          restartPolicy: OnFailure
```

## Security Best Practices

1. **Use dedicated backup credentials** - Create a separate IAM user/access key with minimal permissions
2. **Enable bucket versioning** - Protect against accidental deletions
3. **Enable server-side encryption** - Use SSE-S3 or SSE-KMS for encryption at rest
4. **Enable access logging** - Track who accesses your backups
5. **Use VPC endpoints** - For AWS deployments, use VPC endpoints to keep traffic private
6. **Rotate credentials regularly** - Set up credential rotation policies
7. **Test restores regularly** - Periodically verify backups can be restored
8. **Verify backups automatically** - Use the verification script in your backup pipeline

## Monitoring and Alerts

Consider setting up alerts for:

- Backup job failures
- Backup file size anomalies (significantly smaller/larger than expected)
- Storage usage approaching limits
- Failed upload attempts

## Troubleshooting

### Common Issues

**Error: Access Denied**
- Verify IAM permissions include s3:PutObject for the bucket
- Check bucket policy allows the IAM user
- Ensure credentials are correctly configured

**Error: Bucket Not Found**
- Verify BACKUP_BUCKET is set correctly
- Check region matches the bucket's region
- For R2/MinIO, ensure BACKUP_ENDPOINT is correct

**Error: Connection Refused (MinIO)**
- Verify MinIO server is running
- Check BACKUP_ENDPOINT URL is reachable
- Verify port is not blocked by firewall

**Slow Upload Performance**
- Consider using multipart uploads for large files (aws-cli handles this automatically for files >100MB)
- Check network bandwidth
- For R2, ensure you're using the closest endpoint

### Testing Configuration

Test your configuration with a small file:

```bash
echo "test backup" > /tmp/test-backup.txt
./scripts/backup-to-s3.sh /tmp/test-backup.txt daily
```

Verify the file was uploaded:

```bash
# AWS S3
aws s3 ls s3://fleet2-backups/fleet2/daily/ --recursive

# R2 (with endpoint)
aws s3 ls s3://fleet2-backups/fleet2/daily/ --recursive --endpoint-url https://your_account_id.r2.cloudflarestorage.com

# MinIO
mc ls myminio/fleet2-backups/fleet2/daily/ --recursive
```

## Backup Scheduler Setup

Fleet2 provides two methods for scheduling automated backups: traditional cron and modern systemd timers. Choose the method that best fits your infrastructure.

### Backup Cron Wrapper Script

The `scripts/backup-cron.sh` script orchestrates the complete backup workflow:

1. Creates a local database backup using `backup-database.sh`
2. Uploads the backup to S3-compatible storage using `backup-to-s3.sh`
3. Logs all operations with timestamps to a log file
4. Sends notifications on failure (via webhook or email)
5. Cleans up local backups after successful upload

#### Usage

```bash
# Run daily backup
./scripts/backup-cron.sh --type daily

# Run weekly backup with custom log file
./scripts/backup-cron.sh --type weekly --log /custom/path/backup.log

# Monthly backup to custom directory
./scripts/backup-cron.sh --type monthly --dir /data/backups

# Dry run (test without executing)
BACKUP_DRY_RUN=true ./scripts/backup-cron.sh --type daily
```

#### Notification Configuration

The backup wrapper supports failure notifications via webhook and/or email:

| Variable | Description | Example |
|----------|-------------|---------|
| `BACKUP_NOTIFY_WEBHOOK` | Slack/Teams/Discord webhook URL | `https://hooks.slack.com/...` |
| `BACKUP_NOTIFY_EMAIL` | Email address for notifications | `admin@example.com` |
| `BACKUP_NOTIFY_SMTP` | SMTP server for email (default: localhost) | `smtp.example.com` |
| `BACKUP_NOTIFY_FROM` | From address for email | `backup@fleet.example.com` |
| `BACKUP_KEEP_LOCAL` | Keep local backup after S3 upload | `true` or `false` |

### Method 1: Cron Scheduling

Traditional cron is widely supported and simple to configure.

#### Installation

1. **Copy the example cron file:**

   ```bash
   sudo cp deploy/backup-scheduler.cron /etc/cron.d/fleet2-backup
   sudo chmod 644 /etc/cron.d/fleet2-backup
   ```

2. **Configure environment variables:**

   Edit `/etc/cron.d/fleet2-backup` and set:
   - `FLEET2_HOME` - Path to your Fleet2 installation
   - `DATABASE_URL` - Database connection string
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BACKUP_BUCKET` - S3 credentials
   - Notification variables (optional)

3. **Or add to user crontab:**

   ```bash
   crontab -e
   ```

   Add entries:

   ```cron
   # Source environment and run daily backup at 2 AM
   0 2 * * * . /etc/fleet2/backup.env && /opt/fleet2/scripts/backup-cron.sh --type daily

   # Weekly backup on Sundays at 3 AM
   0 3 * * 0 . /etc/fleet2/backup.env && /opt/fleet2/scripts/backup-cron.sh --type weekly

   # Monthly backup on the 1st at 4 AM
   0 4 1 * * . /etc/fleet2/backup.env && /opt/fleet2/scripts/backup-cron.sh --type monthly
   ```

#### Default Schedule

| Backup Type | Schedule | Time | Retention |
|-------------|----------|------|-----------|
| Daily | Every day | 2:00 AM | 7 days |
| Weekly | Every Sunday | 3:00 AM | 28 days |
| Monthly | 1st of month | 4:00 AM | 365 days |

### Method 2: Systemd Timer Scheduling

Systemd timers offer advantages over cron:
- Persistent scheduling (catch up on missed runs)
- Better logging integration with journald
- Resource controls (memory/CPU limits)
- Dependency management
- Randomized delay to reduce load spikes

#### Installation

1. **Create the environment file:**

   ```bash
   sudo mkdir -p /etc/fleet2
   sudo tee /etc/fleet2/backup.env << 'EOF'
   DATABASE_URL=postgresql://user:pass@localhost:5432/fleet
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   BACKUP_BUCKET=fleet2-backups
   BACKUP_ENDPOINT=https://your-s3-endpoint.com
   BACKUP_TYPE=daily
   BACKUP_NOTIFY_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK
   EOF
   sudo chmod 600 /etc/fleet2/backup.env
   ```

2. **Copy service and timer files:**

   ```bash
   sudo cp deploy/backup.service /etc/systemd/system/fleet2-backup.service
   sudo cp deploy/backup.timer /etc/systemd/system/fleet2-backup.timer
   ```

3. **Create fleet2 user (if not exists):**

   ```bash
   sudo useradd --system --no-create-home fleet2
   sudo chown -R fleet2:fleet2 /opt/fleet2/backups
   ```

4. **Reload systemd and enable timer:**

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable fleet2-backup.timer
   sudo systemctl start fleet2-backup.timer
   ```

5. **Verify timer is active:**

   ```bash
   sudo systemctl list-timers fleet2-backup.timer
   ```

   Output:

   ```
   NEXT                        LEFT       LAST PASSED UNIT                  ACTIVATES
   Wed 2024-01-17 02:00:00 UTC 8h left    Tue 2024-01-16 02:00:15 UTC 16h ago fleet2-backup.timer fleet2-backup.service
   ```

#### Weekly and Monthly Timers

For weekly and monthly backups, create additional timer files:

**fleet2-backup-weekly.timer:**

```ini
[Unit]
Description=Fleet2 Weekly Database Backup Timer

[Timer]
OnCalendar=Sun 03:00:00
RandomizedDelaySec=900
Persistent=true

[Install]
WantedBy=timers.target
```

**fleet2-backup-monthly.timer:**

```ini
[Unit]
Description=Fleet2 Monthly Database Backup Timer

[Timer]
OnCalendar=*-*-01 04:00:00
RandomizedDelaySec=900
Persistent=true

[Install]
WantedBy=timers.target
```

Create corresponding service overrides:

```bash
# Weekly service override
sudo mkdir -p /etc/systemd/system/fleet2-backup-weekly.service.d
sudo tee /etc/systemd/system/fleet2-backup-weekly.service.d/override.conf << EOF
[Service]
Environment=BACKUP_TYPE=weekly
EOF

# Monthly service override
sudo mkdir -p /etc/systemd/system/fleet2-backup-monthly.service.d
sudo tee /etc/systemd/system/fleet2-backup-monthly.service.d/override.conf << EOF
[Service]
Environment=BACKUP_TYPE=monthly
EOF
```

### Managing Scheduled Backups

#### View Backup Logs

```bash
# Cron logs
tail -f /var/log/fleet-backup.log

# Systemd logs
journalctl -u fleet2-backup.service -f
journalctl -u fleet2-backup.service --since "1 hour ago"
```

#### Manual Backup Run

```bash
# Direct script execution
./scripts/backup-cron.sh --type daily

# Via systemd (respects service configuration)
sudo systemctl start fleet2-backup.service
```

#### Check Timer Status

```bash
# List all Fleet2 timers
sudo systemctl list-timers 'fleet2-*'

# Check specific timer
sudo systemctl status fleet2-backup.timer
```

#### Disable Scheduled Backups

```bash
# Cron
sudo rm /etc/cron.d/fleet2-backup

# Systemd
sudo systemctl stop fleet2-backup.timer
sudo systemctl disable fleet2-backup.timer
```

### Scheduler Troubleshooting

#### Cron Issues

**Cron not running:**
```bash
# Check cron service status
sudo systemctl status cron

# Check cron logs
grep CRON /var/log/syslog
journalctl -u cron.service -f
```

**Environment variables not available:**
- Cron runs with minimal environment
- Source environment file explicitly in crontab entry
- Check PATH includes required binaries

#### Systemd Timer Issues

**Timer not triggering:**
```bash
# Check timer status
sudo systemctl status fleet2-backup.timer

# Check if timer is enabled
sudo systemctl is-enabled fleet2-backup.timer

# Check next scheduled run
sudo systemctl list-timers fleet2-backup.timer
```

**Service failing:**
```bash
# Check service status and logs
sudo systemctl status fleet2-backup.service
journalctl -u fleet2-backup.service -n 50

# Check environment file permissions
ls -la /etc/fleet2/backup.env
```

### High Availability Considerations

For clustered deployments:

1. **Use leader election** - Only one node should run backups at a time
2. **Stagger schedules** - If running on multiple nodes, offset times by 30+ minutes
3. **Use shared storage** - Ensure backup directory is accessible if you need local copies
4. **Monitor backup success** - Set up alerts for failed backups across all nodes
