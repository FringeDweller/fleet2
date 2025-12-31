# Fleet2 Security Configuration Guide

This document describes the security hardening measures implemented in Fleet2 and provides configuration guidance for production deployments.

## Table of Contents

1. [TLS 1.3 Configuration](#tls-13-configuration)
2. [Data at Rest Encryption](#data-at-rest-encryption)
3. [SQL Injection Prevention](#sql-injection-prevention)
4. [XSS Prevention](#xss-prevention)
5. [CSRF Protection](#csrf-protection)
6. [Rate Limiting](#rate-limiting)
7. [Security Headers](#security-headers)
8. [Environment Variables](#environment-variables)

---

## TLS 1.3 Configuration

Fleet2 is designed to run behind a reverse proxy (nginx, Caddy, or cloud load balancer) that handles TLS termination.

### Nginx Configuration

Create `/etc/nginx/sites-available/fleet2`:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name fleet.example.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name fleet.example.com;

    # SSL certificate paths
    ssl_certificate /etc/letsencrypt/live/fleet.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fleet.example.com/privkey.pem;

    # TLS 1.3 only (TLS 1.2 as fallback for older clients)
    ssl_protocols TLSv1.2 TLSv1.3;

    # Strong cipher suites
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/fleet.example.com/chain.pem;

    # Session settings
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # DH parameters (generate with: openssl dhparam -out /etc/nginx/dhparam.pem 4096)
    ssl_dhparam /etc/nginx/dhparam.pem;

    # Proxy to Fleet2
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Generate DH Parameters

```bash
openssl dhparam -out /etc/nginx/dhparam.pem 4096
```

### Obtain SSL Certificate (Let's Encrypt)

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Obtain certificate
certbot --nginx -d fleet.example.com

# Auto-renewal (already configured by certbot)
certbot renew --dry-run
```

### Caddy Configuration (Alternative)

Caddy automatically handles TLS with Let's Encrypt:

```caddyfile
fleet.example.com {
    reverse_proxy localhost:3000

    # TLS configuration is automatic with Let's Encrypt
    # To customize:
    tls {
        protocols tls1.2 tls1.3
        ciphers TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256 TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384 TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256 TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
    }
}
```

---

## Data at Rest Encryption

### PostgreSQL Encryption (Transparent Data Encryption)

For PostgreSQL, data at rest encryption should be configured at the database/storage level.

#### AWS RDS

Enable encryption when creating the RDS instance:

```bash
aws rds create-db-instance \
    --db-instance-identifier fleet2-prod \
    --db-instance-class db.t3.medium \
    --engine postgres \
    --master-username admin \
    --master-user-password <password> \
    --allocated-storage 100 \
    --storage-encrypted \
    --kms-key-id alias/fleet2-db-key
```

#### Self-Hosted PostgreSQL with LUKS

```bash
# Create encrypted volume
cryptsetup luksFormat /dev/sdb
cryptsetup open /dev/sdb pg-encrypted

# Create filesystem
mkfs.ext4 /dev/mapper/pg-encrypted
mount /dev/mapper/pg-encrypted /var/lib/postgresql/data

# Configure auto-mount in /etc/crypttab
echo "pg-encrypted /dev/sdb none luks" >> /etc/crypttab
```

### Application-Level Field Encryption

For highly sensitive fields (SSN, tax IDs, etc.), use the encryption utilities:

```typescript
import { encrypt, decrypt, maskSensitiveData } from '~/server/utils/encryption'

// Encrypt before storing
const encryptedSsn = encrypt(ssn)
await db.update(employees).set({ ssn: encryptedSsn })

// Decrypt when needed
const decryptedSsn = decrypt(employee.ssn)

// Mask for display
const maskedSsn = maskSensitiveData(decryptedSsn, 4) // "****1234"
```

### Environment Variable for Encryption Key

Generate and set the encryption key:

```bash
# Generate a 32-byte random key
openssl rand -base64 32

# Add to .env
NUXT_ENCRYPTION_KEY=<generated-key>
```

---

## SQL Injection Prevention

Fleet2 uses Drizzle ORM which automatically parameterizes all queries. The following practices are enforced:

### Parameterized Queries

All database operations use Drizzle ORM:

```typescript
// Correct - Drizzle parameterizes automatically
const user = await db.query.users.findFirst({
  where: eq(schema.users.email, email.toLowerCase())
})

// Correct - Parameters are escaped
const assets = await db.select()
  .from(schema.assets)
  .where(ilike(schema.assets.assetNumber, `%${search}%`))
```

### SQL Template Literal Protection

When using `sql` template literals, values are still parameterized:

```typescript
import { sql } from 'drizzle-orm'

// Safe - values are parameterized
const result = await db.select()
  .from(schema.inspections)
  .where(sql`${schema.inspections.assetId} = ANY(${assetIds})`)
```

### Input Validation

All inputs are validated with Zod schemas:

```typescript
import { z } from 'zod'
import { validateBody, uuidSchema, safeStringSchema } from '~/server/utils/input-validation'

const createAssetSchema = z.object({
  assetNumber: safeStringSchema.min(1).max(50),
  make: safeStringSchema.max(100),
  model: safeStringSchema.max(100),
  categoryId: uuidSchema,
})

export default defineEventHandler(async (event) => {
  const data = await validateBody(event, createAssetSchema)
  // data is validated and sanitized
})
```

---

## XSS Prevention

### Content Security Policy (CSP)

The security middleware (`server/middleware/security.ts`) sets comprehensive CSP headers:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data:;
  connect-src 'self' ws: wss:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
```

### Vue v-html Usage

The codebase has been audited and contains no `v-html` directives. All user content is rendered using Vue's automatic escaping:

```vue
<!-- Safe - Vue escapes content automatically -->
<span>{{ user.name }}</span>

<!-- Avoid - v-html is dangerous with user content -->
<!-- <div v-html="userContent"></div> -->
```

### Output Encoding Utilities

Use encoding functions when needed:

```typescript
import { encodeHtml, encodeAttribute, sanitizeUrl } from '~/server/utils/input-validation'

// Encode for HTML context
const safeHtml = encodeHtml(userInput)

// Encode for attributes
const safeAttr = encodeAttribute(userInput)

// Validate URLs
const safeUrl = sanitizeUrl(userInput)
```

---

## CSRF Protection

Fleet2 implements CSRF protection using the Double Submit Cookie pattern.

### How It Works

1. Server sets a CSRF cookie on first request
2. Client reads the cookie and includes it in `X-CSRF-Token` header
3. Server validates that cookie and header match

### Client-Side Usage

Use the `useCsrfToken` composable for API calls:

```vue
<script setup>
const { $fetchWithCsrf } = useCsrfToken()

async function createAsset(data) {
  const result = await $fetchWithCsrf('/api/assets', {
    method: 'POST',
    body: data,
  })
  return result
}
</script>
```

### Excluded Endpoints

Some endpoints are excluded from CSRF protection:
- `/api/webhooks/*` - External webhook callbacks
- `/api/health` - Health checks
- `/api/metrics` - Metrics endpoint

---

## Rate Limiting

The rate limiting middleware (`server/middleware/rate-limit.ts`) implements tiered rate limits:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Authentication (`/api/auth/*`) | 5 requests | 1 minute |
| Write operations (POST/PUT/DELETE) | 60 requests | 1 minute |
| Read operations (GET) | 120 requests | 1 minute |
| Static assets | 300 requests | 1 minute |

### Rate Limit Headers

All API responses include rate limit headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 55
X-RateLimit-Reset: 1703980800
```

### Production Configuration

For distributed deployments, configure Redis for rate limiting:

```typescript
// In server/utils/rate-limit-store.ts (future enhancement)
import { Redis } from 'ioredis'

const redis = new Redis(process.env.NUXT_REDIS_URL)

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  const current = await redis.incr(key)
  if (current === 1) {
    await redis.pexpire(key, windowMs)
  }
  return current <= limit
}
```

---

## Security Headers

The security middleware sets the following headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS |
| `Content-Security-Policy` | See above | Prevent XSS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer |
| `Permissions-Policy` | See middleware | Restrict browser features |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolate browsing context |
| `Cross-Origin-Resource-Policy` | `same-origin` | Restrict resource access |

---

## Environment Variables

Security-related environment variables:

```bash
# Required for production
NODE_ENV=production

# Database connection (use SSL)
NUXT_DATABASE_URL=postgresql://user:pass@host:5432/fleet2?sslmode=require

# Encryption key for sensitive fields
NUXT_ENCRYPTION_KEY=<base64-encoded-32-byte-key>

# Session secret (generated by nuxt-auth-utils if not set)
NUXT_SESSION_SECRET=<random-string>

# Redis URL (for distributed rate limiting)
NUXT_REDIS_URL=redis://localhost:6379

# Application URL (for CSRF validation)
NUXT_PUBLIC_APP_URL=https://fleet.example.com
```

### Generating Secrets

```bash
# Generate encryption key
openssl rand -base64 32

# Generate session secret
openssl rand -hex 32
```

---

## Security Checklist

Before deploying to production:

- [ ] TLS 1.3 configured on reverse proxy
- [ ] SSL certificate installed and auto-renewal configured
- [ ] Database encryption enabled (AWS RDS or LUKS)
- [ ] `NUXT_ENCRYPTION_KEY` set for field encryption
- [ ] `NUXT_SESSION_SECRET` set (or auto-generated)
- [ ] `NODE_ENV=production` set
- [ ] Database connection uses SSL (`sslmode=require`)
- [ ] Redis configured for distributed rate limiting (if multi-instance)
- [ ] Security headers verified (use securityheaders.com)
- [ ] CSP headers tested and not blocking legitimate resources
- [ ] Rate limits tested and appropriate for expected traffic
- [ ] Audit logging enabled and monitored
- [ ] Backup encryption configured
- [ ] Firewall rules restrict database access
