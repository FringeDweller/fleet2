# Fleet2 User Guide

A comprehensive guide for end users of the Fleet2 fleet management system.

## Table of Contents

- [Getting Started](#getting-started)
- [Dashboard Overview](#dashboard-overview)
- [Asset Management](#asset-management)
- [Work Order Management](#work-order-management)
- [Inspections](#inspections)
- [Inventory Management](#inventory-management)
- [Fleet Tracking](#fleet-tracking)
- [Fuel Management](#fuel-management)
- [Reporting](#reporting)
- [Mobile App](#mobile-app)

## Getting Started

### Logging In

1. Navigate to your Fleet2 instance URL
2. Enter your email address and password
3. Click **Login**

If you have forgotten your password:
1. Click **Forgot Password** on the login page
2. Enter your email address
3. Check your email for a password reset link
4. Follow the link to create a new password

### First-Time Setup

After logging in for the first time:

1. **Complete your profile** - Navigate to Settings to update your name and preferences
2. **Review notifications** - Configure which notifications you want to receive
3. **Explore the dashboard** - Familiarize yourself with the main dashboard layout

### Navigation

The main navigation is located in the left sidebar:

- **Home** - Dashboard with key metrics and alerts
- **Assets** - Vehicle and equipment management
- **Scan** - QR code and NFC scanning for quick access
- **Fleet** - Live tracking and route history
- **Inventory** - Parts and stock management
- **Inbox** - Messages and notifications
- **Customers** - Customer management
- **Settings** - System configuration

## Dashboard Overview

The dashboard provides a real-time overview of your fleet operations.

### Key Metrics

At the top of the dashboard, you will see:

- **Active Assets** - Number of assets currently in operation
- **Open Work Orders** - Pending maintenance tasks
- **Scheduled Inspections** - Upcoming inspection requirements
- **Low Stock Alerts** - Parts that need reordering

### Date Range Selection

Use the date picker at the top of the dashboard to filter data by:
- Custom date range
- Last 7 days
- Last 14 days
- Last 30 days

### Period Selection

Toggle between:
- **Daily** - Day-by-day breakdown
- **Weekly** - Week-by-week summary
- **Monthly** - Monthly aggregations

### Dashboard Widgets

#### Activity Chart
Shows trends in work orders, inspections, and maintenance activities over the selected period.

#### Low Stock Alerts
Displays parts that have fallen below their reorder threshold.

#### Fuel Anomalies
Highlights unusual fuel consumption patterns that may require investigation.

#### Recent Activity
Shows the latest actions taken in the system.

## Asset Management

### Viewing Assets

Navigate to **Assets** to see all vehicles and equipment in your fleet.

#### Asset List View
- Filter by status (Active, Inactive, Maintenance, Disposed)
- Search by asset number, VIN, or description
- Sort by any column
- Export to CSV

#### Asset Detail View
Click on any asset to see:
- Basic information (make, model, year, VIN)
- Current status and location
- Mileage and operational hours
- Attached documents
- Work order history
- Inspection history

### Adding a New Asset

1. Click **New Asset** button
2. Fill in required fields:
   - Asset Number (unique identifier)
   - Make and Model
   - Year
   - Category
3. Add optional information:
   - VIN
   - License Plate
   - Initial mileage/hours
   - Description
4. Click **Save**

### Asset Categories

Assets can be organized into categories (e.g., Trucks, Forklifts, Trailers).

To manage categories:
1. Go to **Settings > Asset Categories**
2. Create hierarchical category structures
3. Assign compatible parts to categories

### Asset Documents

Attach documents to assets such as:
- Registration papers
- Insurance certificates
- Service manuals
- Photos

To upload a document:
1. Open the asset detail page
2. Click the **Documents** tab
3. Click **Upload Document**
4. Select the file and add a description

### NFC/QR Enrollment

Assets can be tagged with NFC stickers or QR codes for quick identification:

1. Open the asset detail page
2. Click **Enroll NFC** or **Generate QR**
3. Follow the on-screen instructions
4. Test by scanning the tag

## Work Order Management

Work orders track all maintenance activities on your assets.

### Viewing Work Orders

Navigate to **Work Orders** to see:
- List view with filtering and sorting
- Kanban board view for visual workflow
- Calendar view for scheduling
- My Assignments for personal tasks

### Work Order Statuses

| Status | Description |
|--------|-------------|
| Draft | Work order created but not yet submitted |
| Pending Approval | Awaiting manager approval |
| Open | Approved and ready to be worked on |
| In Progress | Currently being worked on |
| Pending Parts | Waiting for parts to arrive |
| Completed | Work finished, pending closure |
| Closed | Work verified and closed |

### Creating a Work Order

1. Click **New Work Order**
2. Select the asset
3. Choose a task template (optional)
4. Fill in details:
   - Title
   - Description
   - Priority (Low, Medium, High, Critical)
   - Due date
   - Assigned technician
5. Add checklist items (optional)
6. Click **Save** (Draft) or **Submit** (for approval)

### Working on a Work Order

1. Open the work order
2. Click **Start Work** to begin
3. Complete checklist items
4. Add parts used (deducts from inventory)
5. Add notes and photos
6. Click **Complete** when finished
7. Add completion notes and signature if required

### Parts Usage

When completing a work order, record parts used:

1. Click **Add Part**
2. Search for the part
3. Enter quantity used
4. Part cost is automatically calculated
5. Inventory is automatically updated

### Approvals

High-value or critical work orders may require approval:

1. Work order creator submits for approval
2. Approvers receive notification
3. Approvers can approve or reject with comments
4. Creator is notified of decision

## Inspections

Inspections ensure assets meet safety and operational standards.

### Types of Inspections

- **Pre-trip** - Before operating an asset
- **Post-trip** - After completing operations
- **Periodic** - Scheduled maintenance inspections
- **Ad-hoc** - On-demand inspections

### Starting an Inspection

#### Via Scan
1. Navigate to **Scan**
2. Scan the asset's QR code or NFC tag
3. Select inspection type
4. Begin inspection

#### Via Asset Page
1. Open the asset detail page
2. Click **Start Inspection**
3. Select template
4. Begin inspection

#### Via Operator Session
1. Log on to an asset (Operator Log On)
2. Complete required pre-trip inspection
3. Proceed with operations

### Completing an Inspection

1. Answer each checkpoint question
2. Mark items as Pass, Fail, or N/A
3. Add photos for failed items
4. Record defects found
5. Add notes as needed
6. Sign off on the inspection
7. Submit

### Defects

When issues are found during inspection:

1. A defect is automatically created
2. Defect severity is assessed
3. Work order may be auto-generated
4. Asset may be blocked from operation (critical defects)

### Inspection History

View past inspections:
1. Go to **Inspections > History**
2. Filter by asset, date, or result
3. Click on any inspection to view details
4. Export inspection data

### Compliance Tracking

Monitor inspection compliance:
1. Go to **Inspections > Compliance**
2. View compliance rates by asset or category
3. Identify overdue inspections
4. Track trends over time

## Inventory Management

### Parts Catalog

Navigate to **Inventory > Parts** to manage your parts inventory.

#### Viewing Parts
- Search by SKU, name, or description
- Filter by category
- Sort by stock level
- View low stock items

#### Adding a Part
1. Click **New Part**
2. Fill in required fields:
   - SKU (unique identifier)
   - Name
   - Category
   - Unit of measure
   - Reorder threshold
3. Add optional information:
   - Description
   - Supplier
   - Unit cost
   - Storage location
4. Click **Save**

### Stock Management

#### Adjusting Stock
1. Open the part detail page
2. Click **Adjust Stock**
3. Enter the adjustment (positive or negative)
4. Select reason (Received, Damage, Count Adjustment, etc.)
5. Add notes
6. Click **Save**

#### Receiving Stock
1. Open the part detail page
2. Click **Receive Stock**
3. Enter quantity received
4. Add invoice/PO reference
5. Click **Receive**

### Reorder Alerts

When stock falls below the reorder threshold:
1. Alert appears on dashboard
2. Notification sent to configured users
3. View all alerts at **Inventory > Reorder Alerts**

### Stock Movements

Track all inventory changes:
1. Go to **Inventory > Stock Movements**
2. Filter by date, part, or type
3. View full audit trail of all stock changes

### Inventory Counts

Perform periodic stock counts:
1. Go to **Inventory > Count**
2. Click **New Count Session**
3. Select parts to count
4. Enter actual quantities
5. Review variances
6. Approve adjustments
7. Complete count

## Fleet Tracking

### Live Map

Navigate to **Fleet > Map** to see:
- Real-time asset positions
- Asset status indicators
- Click on asset for details

### Route History

View historical routes:
1. Go to **Fleet > Route History**
2. Select an asset
3. Choose date range
4. View route on map
5. See stops and waypoints

### Geofences

Create virtual boundaries:
1. Go to **Fleet > Geofences** (admin only)
2. Draw a geofence on the map
3. Configure alerts for entry/exit
4. Monitor violations

### Operator Sessions

Track who is operating each asset:
1. **Operator Log On** - Record operator taking control
2. **Operator Log Off** - Record operator returning asset
3. View session history with routes and activities

## Fuel Management

### Recording Fuel Transactions

1. Go to **Fuel > New**
2. Select the asset
3. Enter transaction details:
   - Date and time
   - Quantity
   - Cost
   - Odometer reading
   - Fuel station
4. Click **Save**

### Fuel Analytics

Navigate to **Fuel > Analytics** to view:
- Fuel consumption trends
- Cost analysis
- Efficiency comparisons
- Anomaly detection

### Fuel Anomalies

The system automatically detects:
- Unusual consumption patterns
- Large discrepancies from expected MPG
- Potential fuel theft indicators

Review and resolve anomalies:
1. View anomaly details
2. Investigate cause
3. Mark as resolved with notes

## Reporting

### Available Reports

Access reports through dashboard widgets or dedicated reporting sections:

- **Asset Utilization** - Usage patterns and downtime
- **Maintenance Costs** - Work order expenses by asset/category
- **Fuel Consumption** - Fuel usage and efficiency
- **Inspection Compliance** - Inspection completion rates
- **Inventory Value** - Stock levels and valuations

### Exporting Data

Most data views support export:
1. Apply desired filters
2. Click **Export** button
3. Choose format (CSV, Excel)
4. Download file

### Custom Forms and Reports

Create custom data collection forms:
1. Go to **Settings > Custom Forms**
2. Design form with required fields
3. Assign to assets or events
4. Collect responses
5. Export and analyze data

## Mobile App

Fleet2 is available as a mobile app for iOS and Android.

### Features
- QR/NFC scanning
- Offline inspection completion
- Work order management
- Fuel transaction entry
- Real-time notifications

### Offline Mode

The mobile app works offline:
1. Data syncs when online
2. Inspections can be completed offline
3. Changes queue until connectivity returns
4. Sync status indicator shows pending changes

### Installing the App

1. Download from App Store (iOS) or Play Store (Android)
2. Open the app
3. Enter your organization URL
4. Log in with your credentials

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| N | Open notifications |
| / | Open search |
| ? | Show help |

## Getting Help

### In-App Help
- Click **Help & Support** in the sidebar
- View contextual help on each page

### Support Contact
Contact your system administrator for assistance with:
- Account access issues
- Feature requests
- Bug reports
- Training requests

## Tips for Success

1. **Complete inspections regularly** - Stay compliant and catch issues early
2. **Keep inventory updated** - Accurate stock prevents work delays
3. **Use templates** - Task templates speed up work order creation
4. **Scan assets** - QR/NFC scanning is faster than manual lookup
5. **Check notifications** - Stay informed of urgent issues
6. **Export data regularly** - Keep backups of important reports
