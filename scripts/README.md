# Scripts

This directory contains utility scripts for the Fleet2 application.

## backup-database.sh

Creates compressed PostgreSQL database backups with timestamped filenames.

### Usage

```bash
# Basic usage with DATABASE_URL
./scripts/backup-database.sh

# Specify custom backup directory
./scripts/backup-database.sh --dir /path/to/backups

# Show help
./scripts/backup-database.sh --help
```

### Environment Variables

The script uses `DATABASE_URL` (or `NUXT_DATABASE_URL`) if available, otherwise falls back to individual PostgreSQL environment variables.

Add these to your `.env.example`:

```bash
# Database Backup Configuration
# Option 1: Full connection string (recommended)
DATABASE_URL=postgresql://user:password@localhost:54837/fleet

# Option 2: Individual variables
PGHOST=localhost
PGPORT=54837
PGUSER=fleet
PGPASSWORD=your_password
PGDATABASE=fleet
```

### Output

Backups are created in the `./backups` directory (or custom directory if specified) with the naming format:

```
backup_YYYY-MM-DD_HH-MM-SS.sql.gz
```

Example: `backup_2025-12-31_14-30-00.sql.gz`

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Missing required configuration |
| 3 | Backup creation failed |
| 4 | Backup validation failed |

### Requirements

- `pg_dump` (PostgreSQL client tools)
- `gzip`

### Example with Docker

When using the Docker Compose setup:

```bash
# Set database URL for the Docker container
DATABASE_URL="postgresql://fleet:fleet_dev_password@localhost:54837/fleet" ./scripts/backup-database.sh
```

## backup-to-s3.sh

Uploads backup files to S3-compatible storage (AWS S3, Cloudflare R2, MinIO).

### Usage

```bash
# Upload daily backup to S3
./scripts/backup-to-s3.sh /path/to/backup.sql.gz daily

# Upload weekly backup
./scripts/backup-to-s3.sh /path/to/backup.tar.gz weekly

# Upload monthly backup
./scripts/backup-to-s3.sh /path/to/backup.tar.gz monthly
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_ACCESS_KEY_ID` | Yes | Access key for S3-compatible storage |
| `AWS_SECRET_ACCESS_KEY` | Yes | Secret key for S3-compatible storage |
| `BACKUP_BUCKET` | Yes | S3 bucket name |
| `BACKUP_ENDPOINT` | No | S3-compatible endpoint URL (required for R2/MinIO) |
| `BACKUP_STORAGE_CLASS` | No | Storage class (default: STANDARD) |
| `BACKUP_REGION` | No | AWS region (default: auto) |
| `BACKUP_PREFIX` | No | Prefix in bucket (default: fleet2) |

### Retention Policy

| Backup Type | Retention |
|-------------|-----------|
| Daily | 7 days |
| Weekly | 4 weeks |
| Monthly | 12 months |

### Example: Full Backup Workflow

```bash
# 1. Create database backup
./scripts/backup-database.sh --dir /tmp/backups

# 2. Upload to S3
./scripts/backup-to-s3.sh /tmp/backups/backup_*.sql.gz daily
```

### Requirements

- AWS CLI (`aws`)

For detailed setup instructions, see [docs/backup-configuration.md](../docs/backup-configuration.md).

## verify-backup.sh

Verifies backup integrity by restoring to a temporary database and running validation queries.

### Usage

```bash
# Basic verification
./scripts/verify-backup.sh backups/backup_2025-01-01_00-00-00.sql.gz

# With expected minimum row counts
./scripts/verify-backup.sh backups/backup.sql.gz --expected-counts expected-counts.json

# Show help
./scripts/verify-backup.sh --help
```

### Environment Variables

The script uses `VERIFY_DB_URL` or `DATABASE_URL` if available, otherwise falls back to individual PostgreSQL variables.

| Variable | Required | Description |
|----------|----------|-------------|
| `VERIFY_DB_URL` | No | Full connection string for verification database |
| `DATABASE_URL` | Fallback | Falls back to this if VERIFY_DB_URL not set |
| `PGHOST` | Fallback | PostgreSQL host (default: localhost) |
| `PGPORT` | Fallback | PostgreSQL port (default: 5432) |
| `PGUSER` | Fallback | PostgreSQL superuser (needs CREATE DATABASE permission) |
| `PGPASSWORD` | Fallback | PostgreSQL password |

### Expected Counts File

Create a JSON file to validate minimum row counts:

```json
{
  "organisations": 1,
  "users": 5,
  "assets": 10,
  "work_orders": 50
}
```

### What it Verifies

1. **Backup file validity** - Checks file exists and is valid gzip (if compressed)
2. **Restore success** - Restores backup to a temporary database
3. **Schema verification** - Checks that key tables exist
4. **Row counts** - Counts rows in key tables
5. **Expected minimums** - Compares counts against expected minimums (if provided)

### Key Tables Verified

- organisations
- users
- roles
- assets
- work_orders
- inspections
- parts
- maintenance_schedules
- defects
- fuel_transactions

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Verification passed |
| 1 | General error |
| 2 | Missing required arguments or configuration |
| 3 | Backup file not found or invalid |
| 4 | Restore failed |
| 5 | Validation failed (row count mismatch) |
| 6 | Cleanup failed (non-fatal warning) |

### Requirements

- `psql`, `createdb`, `dropdb` (PostgreSQL client tools)
- `gunzip`

### Example: Complete Backup and Verify Workflow

```bash
# 1. Create database backup
./scripts/backup-database.sh --dir /tmp/backups

# 2. Verify the backup
./scripts/verify-backup.sh /tmp/backups/backup_*.sql.gz

# 3. Upload verified backup to S3
./scripts/backup-to-s3.sh /tmp/backups/backup_*.sql.gz daily
```

For detailed setup instructions, see [docs/backup-configuration.md](../docs/backup-configuration.md).
