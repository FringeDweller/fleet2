# Fleet2 API Documentation

REST API reference for Fleet2 fleet management system.

## Overview

Fleet2 provides a RESTful API for integrating with external systems. All endpoints are prefixed with `/api/`.

### Base URL

```
https://your-fleet2-instance.com/api
```

### Content Type

All requests and responses use JSON:

```
Content-Type: application/json
```

## Authentication

### Session-Based Authentication

Fleet2 uses session-based authentication via cookies. Sessions are managed by `nuxt-auth-utils`.

#### Login

**POST** `/api/auth/login`

Authenticate a user and create a session.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "organisationId": "uuid",
    "roleId": "uuid",
    "roleName": "admin",
    "permissions": ["*"]
  }
}
```

**Error Response (401):**

```json
{
  "statusCode": 401,
  "statusMessage": "Invalid email or password",
  "data": {
    "isLocked": false,
    "remainingAttempts": 4
  }
}
```

**Account Locked Response (401):**

```json
{
  "statusCode": 401,
  "statusMessage": "Account is locked. Try again in 25 minutes",
  "data": {
    "isLocked": true
  }
}
```

#### Logout

**POST** `/api/auth/logout`

End the current session.

**Success Response (200):**

```json
{
  "success": true
}
```

#### Get Current Session

**GET** `/api/auth/session`

Retrieve the current user's session information.

**Success Response (200):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "organisationId": "uuid",
    "roleName": "admin",
    "permissions": ["*"]
  },
  "loggedInAt": "2024-01-15T10:30:00Z"
}
```

#### Password Reset Request

**POST** `/api/auth/forgot-password`

Request a password reset email.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "If an account exists, a reset email has been sent"
}
```

#### Reset Password

**POST** `/api/auth/reset-password`

Reset password using the token from the email.

**Request Body:**

```json
{
  "token": "reset-token-from-email",
  "password": "new-secure-password"
}
```

**Success Response (200):**

```json
{
  "success": true
}
```

## Common Endpoints

### Assets

#### List Assets

**GET** `/api/assets`

Retrieve a paginated list of assets.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `status` | string | Filter by status (active, inactive, maintenance, disposed) |
| `categoryId` | string | Filter by category UUID |
| `search` | string | Search by asset number, VIN, or description |
| `sortBy` | string | Sort field (createdAt, assetNumber, status) |
| `sortOrder` | string | Sort direction (asc, desc) |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "assetNumber": "VH-001",
      "vin": "1HGBH41JXMN109186",
      "make": "Toyota",
      "model": "Hilux",
      "year": 2022,
      "status": "active",
      "currentMileage": 45000,
      "currentHours": null,
      "categoryId": "uuid",
      "category": {
        "id": "uuid",
        "name": "Trucks"
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### Get Asset

**GET** `/api/assets/:id`

Retrieve a single asset by ID.

**Response:**

```json
{
  "id": "uuid",
  "assetNumber": "VH-001",
  "vin": "1HGBH41JXMN109186",
  "make": "Toyota",
  "model": "Hilux",
  "year": 2022,
  "licensePlate": "ABC-123",
  "status": "active",
  "currentMileage": 45000,
  "currentHours": null,
  "fuelType": "diesel",
  "tankCapacity": 80,
  "description": "Fleet truck for deliveries",
  "categoryId": "uuid",
  "category": {
    "id": "uuid",
    "name": "Trucks"
  },
  "documents": [],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

#### Create Asset

**POST** `/api/assets`

Create a new asset.

**Request Body:**

```json
{
  "assetNumber": "VH-002",
  "make": "Ford",
  "model": "Ranger",
  "year": 2023,
  "categoryId": "uuid",
  "vin": "1FMCU0F70NUA12345",
  "licensePlate": "XYZ-789",
  "status": "active",
  "currentMileage": 0,
  "fuelType": "diesel",
  "tankCapacity": 76,
  "description": "New fleet vehicle"
}
```

**Response (201):**

```json
{
  "id": "uuid",
  "assetNumber": "VH-002",
  ...
}
```

#### Update Asset

**PUT** `/api/assets/:id`

Update an existing asset.

**Request Body:**

```json
{
  "status": "maintenance",
  "currentMileage": 46500,
  "description": "Updated description"
}
```

**Response (200):**

```json
{
  "id": "uuid",
  "assetNumber": "VH-001",
  "status": "maintenance",
  ...
}
```

#### Delete Asset

**DELETE** `/api/assets/:id`

Delete an asset (soft delete).

**Response (204):** No content

---

### Work Orders

#### List Work Orders

**GET** `/api/work-orders`

Retrieve work orders with filtering.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `priority` | string | Filter by priority (low, medium, high, critical) |
| `assetId` | string | Filter by asset UUID |
| `assignedTo` | string | Filter by assigned technician UUID |
| `dueBefore` | string | Filter by due date (ISO 8601) |
| `dueAfter` | string | Filter by due date (ISO 8601) |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Oil Change",
      "description": "Routine oil change service",
      "status": "open",
      "priority": "medium",
      "assetId": "uuid",
      "asset": {
        "id": "uuid",
        "assetNumber": "VH-001"
      },
      "assignedToId": "uuid",
      "assignedTo": {
        "id": "uuid",
        "firstName": "Mike",
        "lastName": "Tech"
      },
      "dueDate": "2024-01-20T00:00:00Z",
      "estimatedHours": 2,
      "actualHours": null,
      "totalPartsCost": "0.00",
      "totalLaborCost": "0.00",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

#### Create Work Order

**POST** `/api/work-orders`

Create a new work order.

**Request Body:**

```json
{
  "title": "Brake Inspection",
  "description": "Full brake system inspection and service",
  "assetId": "uuid",
  "priority": "high",
  "dueDate": "2024-01-25T00:00:00Z",
  "assignedToId": "uuid",
  "estimatedHours": 3,
  "taskTemplateId": "uuid"
}
```

#### Update Work Order Status

**POST** `/api/work-orders/:id/status`

Update work order status.

**Request Body:**

```json
{
  "status": "in_progress",
  "notes": "Started work on the brake inspection"
}
```

**Valid Status Transitions:**

| From | To |
|------|-----|
| draft | pending_approval, open |
| pending_approval | open, draft |
| open | in_progress |
| in_progress | pending_parts, completed |
| pending_parts | in_progress |
| completed | closed |

#### Add Parts to Work Order

**POST** `/api/work-orders/:id/parts`

Record parts used on a work order.

**Request Body:**

```json
{
  "partId": "uuid",
  "quantity": 2,
  "notes": "Replaced both front brake pads"
}
```

---

### Parts / Inventory

#### List Parts

**GET** `/api/parts`

Retrieve parts inventory.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `categoryId` | string | Filter by category |
| `lowStock` | boolean | Filter to low stock items only |
| `search` | string | Search by SKU or name |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "sku": "BRK-PAD-001",
      "name": "Front Brake Pads",
      "description": "OEM front brake pads",
      "categoryId": "uuid",
      "quantity": 24,
      "unitCost": "45.00",
      "reorderThreshold": 10,
      "unitOfMeasure": "pair",
      "isLowStock": false
    }
  ]
}
```

#### Adjust Stock

**POST** `/api/parts/:id/adjust-stock`

Adjust part inventory quantity.

**Request Body:**

```json
{
  "adjustment": -5,
  "reason": "work_order_usage",
  "notes": "Used on WO-12345",
  "workOrderId": "uuid"
}
```

**Adjustment Reasons:**

- `received` - Stock received from supplier
- `work_order_usage` - Used on work order
- `damaged` - Damaged stock write-off
- `count_adjustment` - Inventory count correction
- `returned` - Returned to supplier
- `transferred` - Transferred to another location

#### Low Stock Alerts

**GET** `/api/parts/low-stock`

Get parts below reorder threshold.

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "sku": "OIL-5W30",
      "name": "5W-30 Motor Oil",
      "quantity": 3,
      "reorderThreshold": 10,
      "suggestedOrderQuantity": 20
    }
  ]
}
```

---

### Inspections

#### Create Inspection

**POST** `/api/inspections`

Start a new inspection.

**Request Body:**

```json
{
  "assetId": "uuid",
  "templateId": "uuid",
  "type": "pre_trip"
}
```

#### Complete Inspection

**PUT** `/api/inspections/:id/complete`

Submit completed inspection.

**Request Body:**

```json
{
  "items": [
    {
      "checkpointId": "uuid",
      "result": "pass",
      "notes": null
    },
    {
      "checkpointId": "uuid",
      "result": "fail",
      "notes": "Tire tread worn",
      "defectSeverity": "medium"
    }
  ],
  "signature": "base64-signature-data",
  "mileage": 45200
}
```

---

### Notifications

#### List Notifications

**GET** `/api/notifications`

Get user notifications.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `unreadOnly` | boolean | Filter to unread only |
| `type` | string | Filter by notification type |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "work_order_assigned",
      "title": "Work Order Assigned",
      "message": "You have been assigned WO-12345",
      "data": {
        "workOrderId": "uuid"
      },
      "read": false,
      "createdAt": "2024-01-15T14:30:00Z"
    }
  ]
}
```

#### Mark Notification Read

**PUT** `/api/notifications/:id`

Mark a notification as read.

**Request Body:**

```json
{
  "read": true
}
```

#### Mark All Read

**POST** `/api/notifications/mark-all-read`

Mark all notifications as read.

**Response:**

```json
{
  "success": true,
  "count": 5
}
```

---

### Fuel Transactions

#### Create Fuel Transaction

**POST** `/api/fuel-transactions`

Record a fuel transaction.

**Request Body:**

```json
{
  "assetId": "uuid",
  "transactionDate": "2024-01-15T08:30:00Z",
  "quantity": 65.5,
  "unitCost": "1.85",
  "totalCost": "121.18",
  "mileage": 45500,
  "fuelStation": "Shell Main Street",
  "notes": "Full tank"
}
```

---

## Request/Response Formats

### Pagination

Paginated endpoints return data in this format:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Dates

All dates are in ISO 8601 format with UTC timezone:

```
2024-01-15T10:30:00Z
```

### UUIDs

All entity IDs are UUIDs (v4):

```
550e8400-e29b-41d4-a716-446655440000
```

### Monetary Values

Monetary values are returned as strings to preserve precision:

```json
{
  "unitCost": "45.00",
  "totalCost": "121.18"
}
```

## Error Handling

### Error Response Format

All errors return a consistent format:

```json
{
  "statusCode": 400,
  "statusMessage": "Validation error",
  "data": {
    "fieldErrors": {
      "email": ["Invalid email format"]
    },
    "formErrors": []
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not logged in or invalid credentials) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate entry) |
| 422 | Unprocessable Entity (business logic error) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

### Validation Errors

Validation errors include field-specific messages:

```json
{
  "statusCode": 400,
  "statusMessage": "Validation error",
  "data": {
    "fieldErrors": {
      "email": ["Invalid email format"],
      "password": ["Password must be at least 8 characters"]
    },
    "formErrors": []
  }
}
```

## Rate Limiting

API endpoints are rate limited to prevent abuse:

| Endpoint Type | Limit |
|---------------|-------|
| Authentication | 5 requests per minute |
| General API | 100 requests per minute |
| Bulk operations | 10 requests per minute |

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705320000
```

When rate limited, you receive:

```json
{
  "statusCode": 429,
  "statusMessage": "Too many requests. Please try again later."
}
```

## Webhooks

Fleet2 can send webhook notifications for key events. Configure webhooks in **Settings > Integrations**.

### Webhook Payload

```json
{
  "event": "work_order.completed",
  "timestamp": "2024-01-15T14:30:00Z",
  "data": {
    "workOrderId": "uuid",
    "assetId": "uuid",
    "completedBy": "uuid",
    "completedAt": "2024-01-15T14:30:00Z"
  }
}
```

### Available Events

| Event | Description |
|-------|-------------|
| `work_order.created` | New work order created |
| `work_order.completed` | Work order completed |
| `work_order.status_changed` | Work order status changed |
| `inspection.completed` | Inspection completed |
| `inspection.failed` | Inspection completed with failures |
| `defect.created` | New defect reported |
| `asset.status_changed` | Asset status changed |
| `inventory.low_stock` | Part fell below reorder threshold |

### Webhook Security

Webhooks include a signature header for verification:

```
X-Fleet2-Signature: sha256=abc123...
```

Verify signatures using HMAC-SHA256 with your webhook secret.

## API Versioning

The API is currently at version 1. Future breaking changes will be versioned:

```
/api/v2/assets
```

The current API (v1) will remain available during transition periods.

## SDK and Client Libraries

### JavaScript/TypeScript

```typescript
// Using fetch
const response = await fetch('/api/assets', {
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Include session cookie
})

const data = await response.json()
```

### cURL Examples

```bash
# Login
curl -X POST https://fleet.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  -c cookies.txt

# List assets (with session cookie)
curl https://fleet.example.com/api/assets \
  -b cookies.txt

# Create work order
curl -X POST https://fleet.example.com/api/work-orders \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"Oil Change","assetId":"uuid","priority":"medium"}'
```
