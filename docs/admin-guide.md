# Fleet2 Administrator Guide

A comprehensive guide for system administrators and IT staff responsible for deploying, configuring, and maintaining Fleet2.

## Table of Contents

- [System Requirements](#system-requirements)
- [Installation and Deployment](#installation-and-deployment)
- [Configuration Options](#configuration-options)
- [User Management](#user-management)
- [Security Configuration](#security-configuration)
- [Backup and Recovery](#backup-and-recovery)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)

## System Requirements

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 20 GB SSD | 100+ GB SSD |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements

| Software | Version | Notes |
|----------|---------|-------|
| Node.js | 20+ | LTS recommended |
| Bun | 1.0+ | Package manager and runtime |
| PostgreSQL | 15+ | Primary database |
| Redis | 7+ | Optional, for job queues |

### Supported Browsers

- Chrome 100+
- Firefox 100+
- Safari 15+
- Edge 100+

### Mobile App Requirements

- Android 5.1+ (API level 22)
- iOS 13.0+

## Installation and Deployment

### Local Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/fleet2.git
   cd fleet2
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**

   ```bash
   # Create database
   createdb fleet

   # Run migrations
   bun run db:migrate

   # Seed initial data (optional)
   bun run db:seed
   ```

5. **Start the development server**

   ```bash
   bun run dev
   ```

### Production Deployment

#### Using Docker

1. **Build the Docker image**

   ```bash
   docker build -t fleet2:latest .
   ```

2. **Run with Docker Compose**

   ```yaml
   # docker-compose.yml
   services:
     app:
       image: fleet2:latest
       ports:
         - "3000:3000"
       environment:
         - NUXT_DATABASE_URL=postgresql://user:pass@db:5432/fleet
         - NUXT_SESSION_SECRET=your-secure-secret
       depends_on:
         - db
         - redis

     db:
       image: postgres:17-alpine
       volumes:
         - postgres_data:/var/lib/postgresql/data
       environment:
         - POSTGRES_DB=fleet
         - POSTGRES_USER=fleet
         - POSTGRES_PASSWORD=secure_password

     redis:
       image: redis:7-alpine
       volumes:
         - redis_data:/data

   volumes:
     postgres_data:
     redis_data:
   ```

3. **Start services**

   ```bash
   docker compose up -d
   ```

#### Manual Deployment

1. **Build the application**

   ```bash
   bun run build
   ```

2. **Configure process manager (PM2)**

   ```javascript
   // ecosystem.config.js
   module.exports = {
     apps: [{
       name: 'fleet2',
       script: '.output/server/index.mjs',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 3000
       }
     }]
   }
   ```

3. **Start with PM2**

   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

#### Reverse Proxy Configuration (Nginx)

```nginx
server {
    listen 80;
    server_name fleet.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name fleet.example.com;

    ssl_certificate /etc/letsencrypt/live/fleet.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fleet.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Increase max upload size for document uploads
    client_max_body_size 50M;
}
```

## Configuration Options

### Environment Variables

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NUXT_DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/fleet` |
| `NUXT_SESSION_SECRET` | Secret for session encryption (32+ chars) | `your-very-long-random-secret-key-here` |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NUXT_REDIS_URL` | Redis connection for job queues | `redis://localhost:6379` |
| `NUXT_PUBLIC_APP_NAME` | Application display name | `Fleet` |
| `PORT` | HTTP server port | `3000` |
| `NODE_ENV` | Runtime environment | `production` |

#### Backup Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | S3 access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key | `wJal...` |
| `BACKUP_BUCKET` | S3 bucket for backups | `fleet2-backups` |
| `BACKUP_ENDPOINT` | S3-compatible endpoint (for R2/MinIO) | `https://account.r2.cloudflarestorage.com` |

See [backup-configuration.md](./backup-configuration.md) for detailed backup setup.

### Database Configuration

#### Connection Pooling

For production deployments, configure connection pooling:

```typescript
// drizzle.config.ts
export default defineConfig({
  schema: './server/db/schema/index.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL,
    // Pool settings
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
})
```

#### Running Migrations

```bash
# Generate new migration from schema changes
bun run db:generate

# Apply pending migrations
bun run db:migrate

# Push schema changes directly (development only)
bun run db:push

# Open database studio for inspection
bun run db:studio
```

### Session Configuration

Sessions are managed by `nuxt-auth-utils`. Configure session behavior in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  runtimeConfig: {
    session: {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      cookie: {
        sameSite: 'lax',
        secure: true, // HTTPS only in production
      },
    },
  },
})
```

## User Management

### Roles and Permissions

Fleet2 includes a role-based access control (RBAC) system with the following default roles:

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| Admin | Full system access | All permissions |
| Manager | Department management | View all, approve work orders, manage members |
| Technician | Maintenance staff | Work orders, inspections, parts usage |
| Operator | Vehicle operators | Log on/off, inspections, defect reporting |
| Viewer | Read-only access | View assets, work orders, reports |

### Managing Users

#### Creating a User

1. Navigate to **Settings > Members**
2. Click **Add Member**
3. Fill in user details:
   - Email address
   - First and last name
   - Role assignment
4. Click **Save**
5. User receives email invitation

#### Assigning Roles

1. Navigate to **Settings > Members**
2. Click on the user
3. Select the new role from the dropdown
4. Save changes

#### Deactivating a User

1. Navigate to **Settings > Members**
2. Click on the user
3. Toggle **Active** status off
4. Confirm deactivation

Deactivated users cannot log in but their historical data is preserved.

### Organisation Settings

Configure organisation-wide settings:

1. Navigate to **Settings > Organisation**
2. Configure:
   - Organisation name and logo
   - Default time zone
   - Date and number formats
   - Default inspection templates
   - Notification preferences

## Security Configuration

### Password Policy

Fleet2 enforces the following password requirements:

- Minimum 8 characters
- Passwords are hashed using Argon2id (OWASP recommended)
- Account lockout after 5 failed attempts (30 minutes)

### Account Lockout

| Setting | Value |
|---------|-------|
| Max failed attempts | 5 |
| Lockout duration | 30 minutes |
| Auto-unlock | Yes |

To manually unlock a user account:

```sql
UPDATE users
SET failed_login_attempts = 0, locked_until = NULL
WHERE email = 'user@example.com';
```

### Session Security

- Sessions expire after 7 days of inactivity
- Session cookies are HTTP-only and secure
- CSRF protection is enabled by default
- SameSite cookie attribute set to 'lax'

### API Security

- All API endpoints require authentication (except `/api/auth/login`)
- Rate limiting is configured for sensitive endpoints
- Input validation using Zod schemas
- SQL injection protection via Drizzle ORM

### HTTPS Configuration

Always use HTTPS in production. Configure your reverse proxy (Nginx/Caddy) to:

1. Redirect HTTP to HTTPS
2. Use strong TLS configuration
3. Enable HSTS headers

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
```

## Backup and Recovery

### Automated Backups

See [backup-configuration.md](./backup-configuration.md) for detailed setup of automated backups to S3-compatible storage.

#### Quick Setup

1. Configure environment variables:

   ```bash
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   BACKUP_BUCKET=fleet2-backups
   ```

2. Set up scheduled backups:

   ```bash
   # Copy cron configuration
   sudo cp deploy/backup-scheduler.cron /etc/cron.d/fleet2-backup
   ```

3. Verify backups are running:

   ```bash
   tail -f /var/log/fleet-backup.log
   ```

### Manual Backup

```bash
# Database backup
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d).sql.gz

# Upload to S3
./scripts/backup-to-s3.sh backup_$(date +%Y%m%d).sql.gz daily
```

### Disaster Recovery

#### Restoring from Backup

1. **Download the backup**

   ```bash
   aws s3 cp s3://fleet2-backups/fleet2/daily/latest.sql.gz ./restore.sql.gz
   ```

2. **Create a new database**

   ```bash
   createdb fleet_restore
   ```

3. **Restore the backup**

   ```bash
   gunzip -c restore.sql.gz | psql fleet_restore
   ```

4. **Update application configuration**

   ```bash
   # Update NUXT_DATABASE_URL to point to restored database
   export NUXT_DATABASE_URL=postgresql://user:pass@localhost:5432/fleet_restore
   ```

5. **Restart the application**

   ```bash
   pm2 restart fleet2
   ```

#### Backup Verification

Regularly verify backups can be restored:

```bash
./scripts/verify-backup.sh backups/latest.sql.gz --expected-counts expected-counts.json
```

### Retention Policy

| Backup Type | Retention | Storage Class |
|-------------|-----------|---------------|
| Daily | 7 days | Standard |
| Weekly | 4 weeks | Standard |
| Monthly | 12 months | Infrequent Access |

## Monitoring and Maintenance

### Health Checks

Fleet2 provides health check endpoints:

| Endpoint | Description |
|----------|-------------|
| `/api/_health` | Basic health check |
| `/api/_health/ready` | Readiness check (includes database) |

Configure your load balancer or monitoring system to poll these endpoints.

### Log Management

#### Application Logs

Logs are output to stdout/stderr and can be captured by your process manager:

```bash
# View PM2 logs
pm2 logs fleet2

# View last 100 lines
pm2 logs fleet2 --lines 100
```

#### Database Logs

Enable PostgreSQL logging for debugging:

```sql
-- In postgresql.conf
log_statement = 'all'
log_duration = on
log_min_duration_statement = 1000  -- Log queries taking > 1s
```

### Performance Monitoring

#### Database Performance

```sql
-- Check slow queries
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check index usage
SELECT relname, seq_scan, idx_scan, seq_tup_read, idx_tup_fetch
FROM pg_stat_user_tables
ORDER BY seq_scan DESC;
```

#### Application Metrics

Consider integrating monitoring tools:

- **Prometheus** - Metrics collection
- **Grafana** - Visualization
- **Sentry** - Error tracking

### Maintenance Tasks

#### Database Maintenance

```bash
# Vacuum and analyze (run weekly)
vacuumdb --analyze --all

# Reindex (run monthly)
reindexdb --all
```

#### Clearing Old Data

```sql
-- Archive old audit logs (older than 1 year)
DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '1 year';

-- Archive old notifications (older than 90 days)
DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days';
```

## Troubleshooting

### Common Issues

#### Application Won't Start

1. **Check environment variables**

   ```bash
   # Verify required variables are set
   env | grep NUXT
   ```

2. **Check database connection**

   ```bash
   psql $NUXT_DATABASE_URL -c "SELECT 1"
   ```

3. **Check port availability**

   ```bash
   lsof -i :3000
   ```

4. **Review logs**

   ```bash
   pm2 logs fleet2 --err --lines 50
   ```

#### Database Connection Issues

1. **Verify connection string**

   ```bash
   psql "postgresql://user:pass@host:5432/fleet" -c "SELECT 1"
   ```

2. **Check PostgreSQL is running**

   ```bash
   systemctl status postgresql
   ```

3. **Check firewall rules**

   ```bash
   sudo ufw status
   ```

4. **Check max connections**

   ```sql
   SHOW max_connections;
   SELECT count(*) FROM pg_stat_activity;
   ```

#### Performance Issues

1. **Check database query performance**

   ```sql
   -- Enable query logging
   SET log_min_duration_statement = 100;

   -- Check for missing indexes
   SELECT * FROM pg_stat_user_tables WHERE seq_scan > idx_scan;
   ```

2. **Check memory usage**

   ```bash
   free -h
   pm2 monit
   ```

3. **Check disk space**

   ```bash
   df -h
   ```

#### Authentication Issues

1. **Reset user password**

   ```bash
   # Generate new password hash
   node -e "const { hash } = require('@node-rs/argon2'); hash('newpassword').then(console.log)"

   # Update in database
   psql $DATABASE_URL -c "UPDATE users SET password_hash='$hash' WHERE email='user@example.com'"
   ```

2. **Unlock account**

   ```sql
   UPDATE users
   SET failed_login_attempts = 0,
       locked_until = NULL
   WHERE email = 'user@example.com';
   ```

3. **Check session configuration**

   ```bash
   # Verify session secret is set
   echo $NUXT_SESSION_SECRET
   ```

### Getting Support

For additional support:

1. Check the [FAQ](https://github.com/your-org/fleet2/wiki/FAQ)
2. Search existing [Issues](https://github.com/your-org/fleet2/issues)
3. Open a new issue with:
   - Fleet2 version
   - Environment (OS, Node version)
   - Steps to reproduce
   - Error logs

### Useful Commands Reference

```bash
# Application
bun run dev          # Start development server
bun run build        # Build for production
bun run preview      # Preview production build

# Database
bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations
bun run db:push      # Push schema (dev only)
bun run db:studio    # Open Drizzle Studio
bun run db:seed      # Seed database

# Testing
bun run test         # Run tests
bun run test:watch   # Watch mode
bun run test:e2e     # End-to-end tests

# Code Quality
bun run lint         # Run linter
bun run lint:fix     # Fix lint issues
bun run typecheck    # TypeScript check

# Mobile App
bun run cap:sync     # Sync web to native
bun run cap:android  # Open Android Studio
bun run cap:ios      # Open Xcode
```
