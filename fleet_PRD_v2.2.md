# Fleet

## Product Requirements Document (PRD)

**Version:** 2.2
**Date:** December 2025
**Status:** Production Ready

---

## Executive Summary

Fleet is a comprehensive enterprise platform designed to optimize asset lifecycle management, streamline maintenance operations, and maximize fleet efficiency. Built on modern full-stack TypeScript architecture with Nuxt 4 and Vue 3, the system provides complete fleet visibility from asset acquisition through disposal.

**Business Value:**

- **Cost Reduction**: 30-40% reduction in maintenance costs through predictive analytics and optimized scheduling
- **Operational Efficiency**: 50% improvement in work order completion times via mobile PWA capabilities
- **Asset Optimization**: 20-25% increase in asset utilization through data-driven decision making
- **Compliance Assurance**: 100% audit trail compliance with comprehensive documentation and reporting

**Key Capabilities:**

- Complete asset lifecycle management with custom forms assignable to modules
- Configurable maintenance tasks with grouping and asset-specific parts
- Predictive maintenance scheduling based on time, usage, and analytics
- Offline-capable Progressive Web App (PWA) for field technicians
- Native mobile apps via Capacitor with NFC, QR scanning, camera, and device APIs
- Dedicated fleet tablets with Microsoft Intune MDM management
- Operator logging and pre-start inspections via NFC tap or QR code scan
- Bluetooth OBD-II integration for vehicle diagnostics
- Fuel bowser authentication and refueling data capture
- Real-time inventory management with automated reorder points
- Asset-part compatibility mapping with task-based parts requirements
- Custom forms builder with 16+ field types and conditional logic
- Advanced analytics and reporting with visual report designer
- PostgreSQL-based document management for technical documentation
- Fuel management system integration

**Target Market:**

- Transportation and logistics companies (50-5000+ vehicles)
- Construction and heavy equipment operators
- Municipal and government fleet operations
- Service and maintenance organizations
- Enterprise organizations with mixed asset portfolios

---

## Product Vision & Mission

### Vision

To become the leading enterprise fleet management platform that transforms how organizations track, maintain, and optimize their valuable assets through intelligent automation and data-driven insights.

### Mission

We empower fleet operators and maintenance teams with cutting-edge technology to achieve maximum asset uptime, minimize total cost of ownership, and ensure regulatory compliance while providing seamless mobile experiences for field technicians.

### Strategic Pillars

1. **Innovation**: Leverage AI and machine learning for predictive maintenance and failure prevention
2. **User Experience**: Intuitive interfaces for all user types, from executives to field technicians
3. **Integration**: Open API architecture enabling seamless ecosystem connectivity
4. **Reliability**: 99.9% uptime with robust offline-first mobile capabilities
5. **Security**: Enterprise-grade security with comprehensive audit trails and compliance

---

## Strategic Objectives

### Primary Objectives (Year 1)

1. **Reduce Maintenance Costs by 35%**
   - Implement predictive maintenance algorithms
   - Optimize maintenance schedules to prevent costly emergency repairs
   - Track and analyze cost patterns by asset type and operation

2. **Increase Asset Uptime to 95%**
   - Minimize unplanned downtime through proactive maintenance
   - Improve first-time fix rates with better technician information access
   - Reduce parts procurement delays through inventory optimization

3. **Achieve 100% Compliance Rate**
   - Automated compliance tracking and reporting
   - Complete audit trails for all maintenance activities
   - Regulatory deadline monitoring and alerts

4. **Improve Technician Productivity by 50%**
   - Offline-capable PWA for field operations
   - Simplified data entry with custom forms and auto-save
   - Faster asset identification with NFC tags and QR code scanning

### Secondary Objectives (Year 2-3)

1. **Expand to 10+ Industry Verticals**
   - Transportation, construction, municipal, utilities, manufacturing
   - Vertical-specific features and templates
   - Industry benchmark comparisons

2. **Achieve Market Leadership Position**
   - 25% market share in mid-market segment
   - Industry analyst recognition
   - Customer success stories and case studies

---

## Business Requirements

### Organizational Needs

- **Fleet Visibility**: Real-time location and status tracking for all assets
- **Maintenance Optimization**: Automated scheduling to minimize downtime and costs
- **Compliance Management**: Regulatory compliance tracking and automated reporting
- **Mobile Operations**: Field technicians need offline-capable tools for accurate documentation
- **Decision Support**: Analytics and reporting for strategic fleet management decisions
- **Fuel System Integration**: Connect with existing fuel management backend
- **Scalability**: Support growth from 50 to 5000+ assets without performance degradation

### Business Constraints

- **Budget Limitations**: Mid-market pricing with enterprise capabilities
- **Implementation Timeline**: Phased rollout over 6-9 months
- **Change Management**: Minimize disruption to existing workflows during transition
- **Data Security**: GDPR, SOX, and industry-specific compliance requirements
- **User Adoption**: Intuitive interfaces to reduce training requirements
- **Technology Stack**: Must use Nuxt 4/Vue 3/Capacitor/PostgreSQL/Redis architecture

### Success Criteria

- **System Adoption**: 95% user adoption rate within 3 months post-deployment
- **ROI Achievement**: Positive ROI within 18 months through cost savings and efficiency gains
- **Performance Metrics**: Sub-second response times for 95% of queries
- **Data Quality**: 99% accuracy in asset and maintenance data
- **Mobile Usage**: 80% of field work orders completed via mobile app
- **Compliance Score**: 100% audit trail completeness for regulatory inspections

---

## Market Analysis

### Market Size and Growth

- **Global Fleet Management Market**: $28.5 billion in 2024, projected to reach $48.9 billion by 2030
- **CAGR**: 9.4% (2024-2030)
- **Key Growth Drivers**:
  - Increasing demand for predictive maintenance solutions
  - Growing adoption of IoT and telematics in fleet operations
  - Rising focus on regulatory compliance and cost optimization
  - Mobile workforce transformation with PWA adoption

### Target Market Segments

1. **Mid-Market Transportation** (50-500 vehicles)
   - Annual revenue: $5M-$500M
   - Growth potential: High
   - Pain points: Manual maintenance tracking, compliance complexity

2. **Construction & Heavy Equipment** (20-200 assets)
   - Annual revenue: $10M-$1B
   - Growth potential: High
   - Pain points: Asset downtime costs, parts management, mobile access

3. **Municipal & Government** (100-1000 vehicles)
   - Annual revenue: N/A
   - Growth potential: Medium
   - Pain points: Budget constraints, compliance reporting, public accountability

### Competitive Landscape

**Direct Competitors:**

- **Fleetio**: Strong in asset tracking, weaker in predictive analytics
- **MaintainX**: Mobile-focused, limited reporting capabilities
- **UpKeep**: Good maintenance management, lacks advanced analytics
- **Fiix (Rockwell Automation)**: Enterprise-focused, expensive, complex implementation

**Competitive Advantages:**

1. **Cross-Platform Native App**: Single codebase via Capacitor for Android and iOS with full native device access
2. **Custom Forms Builder**: Visual form designer with 16+ field types vs. static forms
3. **Predictive Analytics**: AI-powered failure prediction vs. basic time-based scheduling
4. **PostgreSQL Document Management**: Integrated blob storage vs. external document systems
5. **Full-Stack TypeScript**: Unified codebase vs. multi-language architectures
6. **NFC/QR Asset Tagging**: Native NFC and QR code support for instant asset identification
7. **Integrated Operator Workflows**: NFC/QR tap-on/tap-off, pre-starts, and fuel capture in one app
8. **Bluetooth OBD Integration**: Automatic vehicle diagnostics without separate telematics

**Market Positioning:**
"Enterprise-grade fleet management with consumer-grade user experience, delivered through modern web technologies and offline-first mobile capabilities."

---

## Success Metrics & KPIs

### Operational KPIs

| Metric                            | Current Baseline | Target (6 months) | Target (12 months) |
| --------------------------------- | ---------------- | ----------------- | ------------------ |
| Asset Uptime                      | 85%              | 92%               | 95%                |
| Mean Time Between Failures (MTBF) | 120 hours        | 180 hours         | 240 hours          |
| Mean Time To Repair (MTTR)        | 4.5 hours        | 3.0 hours         | 2.0 hours          |
| First-Time Fix Rate               | 65%              | 80%               | 90%                |
| Work Order Completion On-Time     | 70%              | 85%               | 95%                |
| Parts Inventory Accuracy          | 75%              | 90%               | 98%                |

### Financial KPIs

| Metric                            | Current Baseline       | Target (6 months)      | Target (12 months)    |
| --------------------------------- | ---------------------- | ---------------------- | --------------------- |
| Maintenance Cost per Asset/Month  | $450                   | $350                   | $300                  |
| Total Cost of Ownership Reduction | N/A                    | 25%                    | 35%                   |
| Emergency Repair Costs            | 25% of total           | 15% of total           | 10% of total          |
| Parts Carrying Costs              | 15% of inventory value | 10% of inventory value | 8% of inventory value |
| Labor Utilization Rate            | 65%                    | 75%                    | 85%                   |
| ROI                               | N/A                    | 150%                   | 200%                  |

### User Adoption KPIs

| Metric                   | Target (3 months) | Target (6 months) |
| ------------------------ | ----------------- | ----------------- |
| User Adoption Rate       | 80%               | 95%               |
| Mobile App Usage         | 70%               | 90%               |
| Operator Log-On Rate     | 85%               | 98%               |
| Pre-Start Completion     | 80%               | 95%               |
| Daily Active Users (DAU) | 70%               | 85%               |
| User Satisfaction Score  | 4.0/5.0           | 4.5/5.0           |
| Support Ticket Volume    | <50/month         | <30/month         |
| Training Completion Rate | 90%               | 100%              |

### Compliance & Quality KPIs

| Metric                          | Target |
| ------------------------------- | ------ |
| Audit Trail Completeness        | 100%   |
| Compliance Violations           | 0      |
| Data Accuracy Rate              | 99%    |
| Security Incidents              | 0      |
| Scheduled Maintenance Adherence | 95%    |
| Document Management Accuracy    | 99%    |

---

## User Personas

### 1. Fleet Manager (Decision Maker)

**Role:** Strategic oversight and operational management
**Goals:** Reduce costs, ensure compliance, optimize asset utilization
**Pain Points:** Manual processes, lack of visibility, reactive maintenance
**Key Features:** Dashboard analytics, cost reporting, compliance tracking, predictive insights

### 2. Maintenance Supervisor (Power User)

**Role:** Maintenance planning and work order management
**Goals:** Optimize maintenance schedules, manage inventory, track performance
**Pain Points:** Scheduling conflicts, parts availability, technician utilization
**Key Features:** Maintenance calendar, work order management, parts inventory, performance metrics

### 3. Field Technician (Mobile User)

**Role:** Hands-on maintenance and inspections
**Goals:** Complete work efficiently, accurate documentation, minimize downtime
**Pain Points:** Offline access, complex forms, photo documentation
**Key Features:** Native mobile app with offline capability, NFC/QR scanning, photo capture, simplified workflows
**Device:** Fleet tablet (primary) or phone (secondary)

### 4. Vehicle Operator (Mobile User)

**Role:** Daily vehicle operation and pre-start compliance
**Goals:** Quick log-on/log-off, complete pre-starts efficiently, record refueling
**Pain Points:** Slow paper-based processes, forgotten log books, manual data entry
**Key Features:** NFC/QR tap-on/tap-off, guided pre-start inspections, fuel capture, OBD integration
**Device:** Vehicle-mounted tablet (primary) or phone (secondary)

### 5. System Administrator (Technical User)

**Role:** System configuration and user management
**Goals:** Maintain system performance, manage users, ensure security
**Pain Points:** Complex configuration, integration challenges, security management
**Key Features:** Admin interface, user management, system settings, audit trails

---

## Core Features (Must-Have)

### 1. Asset Management

#### Asset Registry

- **Unique Asset Identification**
  - Asset numbers with configurable formatting patterns
- **Comprehensive Asset Data**
  - VIN, make, model, year, license plate, operational hours, mileage
- **Asset Hierarchy**
  - Support for asset groupings and categories
- **Custom Forms Integration**
  - Extend asset data via assignable custom forms
- **Warranty Tracking**
  - Warranty status and expiry date management
- **Document Attachments**
  - File storage for manuals, certificates, and documentation
- **Asset Status Management**
  - Active, inactive, disposed, maintenance status tracking
- **Location Tracking**
  - Current and historical location data

#### Asset Search & Filtering

- **Global Search**
  - Multi-field search across assets, work orders, and parts
- **Advanced Filtering**
  - Filter by make, model, status, location, custom form fields
- **Saved Searches**
  - Persistent search configurations for common queries
- **Bulk Operations**
  - Mass updates and operations on multiple assets

### 2. Maintenance Management

#### Maintenance Tasks

- **Task Templates**
  - Configurable maintenance task definitions
  - Reusable templates for common maintenance activities
  - Default labor hours and estimated costs per task
- **Task Grouping**
  - Group tasks by service type (e.g., Engine, Brakes, Electrical, HVAC)
  - Hierarchical task categories for organization
  - Filter and search tasks by group
- **Task-Part Requirements**
  - Define required parts for each task template
  - Specify part quantities needed per task
  - Link to asset-compatible parts automatically
- **Asset-Specific Task Configuration**
  - Override default parts based on asset or asset category
  - Asset-specific labor time estimates
  - Custom task checklists per asset type

#### Task-Asset Parts Matrix

- **Parts Mapping**
  - Map task templates to required parts
  - Automatic part substitution based on asset compatibility
  - View all required parts before starting work order
- **Category Inheritance**
  - Define task-parts at asset category level
  - Override at individual asset level when needed
  - Bulk update parts requirements across categories
- **Field Technician Access**
  - View task-specific parts list on work order
  - See which compatible parts are in stock
  - Pre-populated parts list based on task + asset combination

#### Maintenance Scheduling

- **Time-Based Schedules**
  - Calendar-based maintenance intervals
- **Usage-Based Schedules**
  - Hour or mileage-based maintenance triggers
- **Combined Scheduling**
  - Hybrid schedules using multiple trigger types
- **Task-Based Scheduling**
  - Assign maintenance tasks to schedules
  - Auto-populate work orders with task details and parts
- **Automatic Work Order Generation**
  - Background task creation based on schedules
  - Pre-filled parts requirements from task template
- **Schedule Optimization**
  - Intelligent scheduling to minimize downtime
- **Maintenance Calendar**
  - Interactive calendar view with color-coded events

#### Work Order Management

- **Comprehensive Work Orders**
  - Description, priority, due dates, status tracking
- **Task Integration**
  - Link work orders to maintenance task templates
  - Auto-populate checklist items from task definition
- **Parts Integration**
  - Link work orders to required parts with quantity tracking
  - Pre-filled from task-asset parts matrix
  - Easy substitution with compatible alternatives
- **Technician Assignment**
  - User assignment and workload management
- **Progress Tracking**
  - Real-time status updates and completion tracking
- **Cost Tracking**
  - Labor and parts cost calculations
- **Approval Workflows**
  - Multi-stage approval processes for high-value work

### 3. Inventory Management

#### Parts Management

- **Parts Catalog**
  - SKU, description, quantity, reorder thresholds
- **Supplier Management**
  - Vendor information and pricing
- **Automatic Deduction**
  - Parts usage tracking through work order completion
- **Reorder Alerts**
  - Notifications when parts reach minimum levels
- **Cost Tracking**
  - Purchase price and inventory valuation
- **Parts Assignment**
  - Bulk assignment of compatible parts to assets
  - Asset-to-part compatibility mapping
  - Category-based part assignment (assign parts to asset categories)
  - Compatible parts list visible on asset detail view
  - Field technician access to compatible parts for each asset

#### Asset-Part Compatibility

- **Compatibility Management**
  - Define which parts are compatible with specific assets
  - Inherit compatibility from asset categories
  - Override category defaults at individual asset level
- **Field Technician View**
  - View compatible parts when working on an asset
  - See real-time stock availability for compatible parts
  - Request parts directly from asset context
- **Smart Suggestions**
  - Suggest commonly used parts based on work order type
  - Historical parts usage for similar maintenance tasks

#### Inventory Operations

- **Stock Movements**
  - In/out tracking with audit trails
- **Physical Counts**
  - Inventory reconciliation processes
- **Reserved Quantities**
  - Parts reserved for pending work orders
- **Expiry Management**
  - Tracking of perishable parts and materials

### 4. Mobile Field Operations (PWA)

#### PWA Offline-First Architecture

- **Complete PWA Offline Functionality**
  - Full PWA operation without internet using Service Workers
  - App cache strategies for optimal performance
- **Hybrid Logical Clock (HLC) Synchronization**
  - Advanced conflict resolution for offline changes
- **Automatic Sync**
  - Background sync when connectivity is restored
  - Periodic and connectivity-based synchronization
- **Conflict Resolution**
  - Timestamp-based resolution with manual override
  - Visual indicators for sync status and pending operations
- **Install Prompt**
  - App-like installation on mobile devices
  - Add to home screen capability

#### Mobile Inspection Capabilities

- **NFC/QR Scanning**
  - Asset identification via NFC tap or QR code scan
  - Operator logging tap-on/tap-off (NFC card or QR badge)
  - Walk-around checkpoint verification (NFC tags or QR stickers)
- **Barcode/QR Scanning**
  - Fast scanning via @capacitor-mlkit/barcode-scanning
  - Asset lookup and parts identification
- **Photo Capture**
  - Native camera via @capacitor/camera
  - Configurable quality and compression
  - Storage via @capacitor/filesystem
- **Dynamic Forms**
  - Offline-capable custom form rendering
  - Auto-save to IndexedDB
- **Digital Signatures**
  - Canvas-based signature capture for technician sign-off
- **Voice Notes**
  - Audio recording via Capacitor
  - Voice-to-text transcription capabilities

#### PWA Field Operations

- **Asset Information Access**
  - Full asset details available offline
  - View compatible parts list for current asset
  - Real-time stock levels when online
- **Parts Requests**
  - Request parts directly from work order context
  - View compatible parts with availability status
  - Queue parts requests when offline
- **Work Order Execution**
  - View task-specific parts list pre-populated from task template
  - See asset-specific part requirements and overrides
  - Record parts used during maintenance
  - Automatic inventory deduction on completion
  - Parts substitution tracking with compatible alternatives

### 5. Operator Workflows & Vehicle Integration

#### Vehicle Operator Logging

- **NFC/QR Tap-On/Tap-Off**
  - Operator taps NFC card or scans QR badge on vehicle tablet
  - Logs operator onto vehicle with timestamp and GPS location
  - Automatically retrieves operator certifications and licence status
  - Tap-off (NFC) or scan-off (QR) logs end of shift with final odometer/hours reading
- **Operator Assignment Tracking**
  - Full audit trail of who operated each vehicle and when
  - Supports multiple operators per shift (driver handover)
  - Links operator to any incidents, inspections, or refueling during session
- **Certification Verification**
  - Validates operator has required certifications for vehicle class
  - Alerts if certifications expired or not present
  - Configurable enforcement (warn or block operation)

#### Pre-Start Inspections

- **NFC/QR-Initiated Inspections**
  - Tap vehicle NFC tag or scan vehicle QR code to initiate pre-start inspection
  - Confirms physical presence at vehicle before inspection
  - Timestamps and geolocates inspection start
- **Walk-Around Verification**
  - Multiple NFC tags or QR stickers on vehicle (front, rear, sides, engine bay)
  - Ensures physical inspection of each zone before sign-off
  - Configurable checkpoint requirements per vehicle type
- **Inspection Checklists**
  - Dynamic checklists based on vehicle type and custom forms
  - Pass/Fail/NA status with mandatory photo on failure
  - Digital signature capture for operator sign-off
  - Defect escalation workflow for failed items
- **Pre-Start Results**
  - Block vehicle operation if critical defects found (configurable)
  - Automatic work order generation for inspection failures
  - Historical inspection trends and compliance reporting

#### Bluetooth OBD-II Integration

- **Vehicle Diagnostics**
  - Connect to vehicle via Bluetooth OBD-II dongle
  - Read diagnostic trouble codes (DTCs)
  - Clear codes after repair (with authorisation)
  - Live data streaming (RPM, coolant temp, fuel level, etc.)
- **Automatic Data Capture**
  - Odometer/engine hours reading on operator log-on
  - Fuel level capture for consumption tracking
  - Trip data logging (distance, duration, idle time)
- **Fault Monitoring**
  - Automatic work order creation when DTC detected
  - Severity classification based on code type
  - Integration with maintenance task templates
- **Supported Protocols**
  - OBD-II (ISO 9141, ISO 14230, ISO 15765, SAE J1850)
  - Extensible for J1939 heavy vehicle support (future)

#### Fuel Management Integration

- **Fuel Bowser Authentication**
  - NFC tap or QR scan to authenticate operator at fuel bowser
  - Validates operator is logged onto an approved vehicle
  - Captures fuel transaction with timestamp and location
- **Refueling Data Capture**
  - Fuel quantity (manual entry or bowser integration)
  - Odometer/hours reading at fill
  - Cost per litre (if available from fuel system)
  - Receipt photo capture
- **Fuel System Integration Options**
  - API integration with fuel management backend
  - Automatic transaction reconciliation
  - Real-time fuel level and consumption data
- **Fuel Analytics**
  - Consumption tracking per vehicle
  - Cost per kilometre/hour calculations
  - Anomaly detection (unusual consumption patterns)
  - Fuel theft indicators

#### GPS Location Tracking

- **Background Location Services**
  - Continuous GPS tracking via Capacitor geolocation plugin
  - Configurable tracking interval (1-60 minutes)
  - Battery-optimised background operation
- **Location Data**
  - Current vehicle location (when tablet in vehicle)
  - Route history and playback
  - Geofence entry/exit logging
- **Geofencing**
  - Define depot, job site, and restricted zone boundaries
  - Automatic time logging for job site presence
  - Alerts for unauthorised location or after-hours movement

---

## UI Patterns & Page Structures

This section defines consistent UI patterns for complex pages. Detail pages with multiple related data types use tabbed interfaces to organise information without overwhelming users.

### General Principles

- **Progressive Disclosure**: Show summary information first, details on demand
- **Consistent Tab Order**: Similar tabs appear in the same position across pages
- **Mobile Adaptation**: Tabs convert to accordion or segmented control on mobile
- **Tab Badges**: Show counts for related items (e.g., "Work Orders (3)")
- **Lazy Loading**: Tab content loads when first accessed, not on page load
- **Deep Linking**: URLs include tab identifier for direct navigation (e.g., `/assets/123?tab=parts`)

### Asset Detail Page

Primary page for viewing and managing individual assets.

| Tab                    | Content                                                             | Badge                 |
| ---------------------- | ------------------------------------------------------------------- | --------------------- |
| **Overview** (default) | Core asset details, status, specs, custom form fields, location map | —                     |
| **Work Orders**        | Work order history, open/completed/scheduled                        | Count of open         |
| **Maintenance**        | Scheduled maintenance, service history, next due dates              | Count of overdue      |
| **Parts**              | Compatible parts list, stock availability, usage history            | Count of compatible   |
| **Inspections**        | Pre-start inspection history, defect trends, compliance rate        | Count of open defects |
| **Fuel**               | Fuel transaction history, consumption analytics, cost per km        | —                     |
| **OBD**                | DTC history, live data (if connected), odometer/hours log           | Count of active DTCs  |
| **Documents**          | Attached documents, certificates, expiry tracking                   | Count of expiring     |
| **Location**           | Location history, route playback, geofence events                   | —                     |
| **Operators**          | Operator session history, assignments                               | —                     |

**Mobile Layout**: Segmented control for top 4 tabs (Overview, Work Orders, Inspections, Parts), "More" menu for remaining tabs.

### Work Order Detail Page

Primary page for viewing and executing work orders.

| Tab                   | Content                                                              | Badge            |
| --------------------- | -------------------------------------------------------------------- | ---------------- |
| **Details** (default) | Work order info, asset summary, assignment, status, priority, dates  | —                |
| **Checklist**         | Task checklist items, pass/fail status, completion progress          | Incomplete count |
| **Parts**             | Required parts, actual parts used, stock availability, substitutions | —                |
| **Photos**            | Attached photos, before/after documentation                          | Photo count      |
| **Time & Cost**       | Labor hours, parts cost, total cost breakdown                        | —                |
| **History**           | Status changes, comments, audit trail                                | —                |

**Mobile Layout**: Checklist tab promoted to primary view during execution. Swipe navigation between Details → Checklist → Parts.

### Vehicle/Asset Card (Operator View)

Simplified view for operators on vehicle tablets.

| Tab                  | Content                                                           |
| -------------------- | ----------------------------------------------------------------- |
| **Status** (default) | Vehicle status, current operator, OBD connection, last inspection |
| **Pre-Start**        | Start inspection button, last inspection summary, open defects    |
| **Fuel**             | Record refueling button, recent transactions, consumption stats   |
| **Issues**           | Report issue button, open defects, pending work orders            |

**Mobile Layout**: Large tap targets, single-column layout, prominent action buttons.

### Operator Detail Page

View operator profile and activity history.

| Tab                   | Content                                                      | Badge                |
| --------------------- | ------------------------------------------------------------ | -------------------- |
| **Profile** (default) | Operator details, certifications, licence info, expiry dates | Expiring certs count |
| **Sessions**          | Log-on/log-off history, vehicles operated, hours/distance    | —                    |
| **Inspections**       | Pre-start inspections completed, compliance rate             | —                    |
| **Fuel**              | Fuel transactions recorded                                   | —                    |
| **Training**          | Training records, certifications earned                      | —                    |

### Part Detail Page

View part information and usage.

| Tab                   | Content                                               | Badge       |
| --------------------- | ----------------------------------------------------- | ----------- |
| **Details** (default) | Part info, SKU, pricing, stock levels, reorder status | —           |
| **Compatibility**     | Compatible assets and categories                      | Asset count |
| **Stock**             | Stock movements, locations, transaction history       | —           |
| **Usage**             | Work orders where part was used, consumption trends   | —           |
| **Suppliers**         | Supplier info, pricing tiers, lead times              | —           |

### Inspection Detail Page

View completed inspection details.

| Tab                   | Content                                                   |
| --------------------- | --------------------------------------------------------- |
| **Summary** (default) | Pass/fail result, operator, vehicle, timestamp, signature |
| **Checklist**         | All checklist items with status, photos, comments         |
| **Checkpoints**       | Walk-around checkpoint scan times and sequence            |
| **Defects**           | Failed items, linked work orders, resolution status       |

### Report/Dashboard Page

Analytics and reporting interface.

| Tab                     | Content                                                |
| ----------------------- | ------------------------------------------------------ |
| **Dashboard** (default) | KPI cards, charts, configurable widgets                |
| **Assets**              | Asset utilisation, status breakdown, cost analysis     |
| **Maintenance**         | Work order metrics, compliance, technician performance |
| **Fuel**                | Consumption trends, cost analysis, anomalies           |
| **Operators**           | Session summaries, inspection compliance               |

### List Page Patterns

All list pages follow consistent patterns:

| Element            | Behaviour                                                       |
| ------------------ | --------------------------------------------------------------- |
| **Search Bar**     | Global search across visible columns                            |
| **Filters**        | Collapsible filter panel, saved filter presets                  |
| **Column Sorting** | Click header to sort, shift-click for multi-sort                |
| **Bulk Actions**   | Checkbox selection, action toolbar appears                      |
| **Pagination**     | Configurable page size (25/50/100), cursor-based for large sets |
| **Export**         | Export filtered results to CSV/Excel                            |

### Mobile Navigation Patterns

| Pattern                    | Usage                                                       |
| -------------------------- | ----------------------------------------------------------- |
| **Bottom Navigation**      | Primary sections (Dashboard, Assets, Work Orders, More)     |
| **Tab Bar**                | Page-level tabs (converts from desktop tabs)                |
| **Segmented Control**      | 2-4 options within a tab                                    |
| **Accordion**              | 5+ sections that don't need simultaneous visibility         |
| **Pull to Refresh**        | All list views                                              |
| **Floating Action Button** | Primary action (e.g., "New Work Order", "Start Inspection") |

### Form Patterns

| Pattern            | Usage                                               |
| ------------------ | --------------------------------------------------- |
| **Stepped Form**   | Complex multi-section forms (e.g., asset creation)  |
| **Inline Edit**    | Quick field updates on detail pages                 |
| **Modal Form**     | Simple create/edit (e.g., add comment, assign user) |
| **Full Page Form** | Complex creation with many fields                   |
| **Auto-Save**      | Draft saving for long forms, offline forms          |

---

## Technical Requirements

### Hardware Requirements

#### Server Infrastructure

- **Production Environment**
  - Application Servers: 4+ vCPU, 16GB RAM per instance (minimum 2 instances for HA)
  - Database Server: 8+ vCPU, 32GB RAM, SSD storage (PostgreSQL with replication)
  - Redis Cache: 2+ vCPU, 8GB RAM (for session management and caching)
  - Load Balancer: SSL termination, health checks, sticky sessions

- **Storage Requirements**
  - Database Storage: 1TB+ SSD with auto-scaling
  - Document Storage: PostgreSQL blob storage with compression
  - Backup Storage: 2x primary storage size for automated backups
  - Logs: 100GB+ retention with log rotation

- **Scalability**
  - Horizontal scaling to 10+ application servers
  - Database read replicas for reporting workloads
  - CDN integration for static assets and PWA caching
  - Auto-scaling based on CPU/memory metrics

#### Client Requirements

- **Desktop Browsers**
  - Chrome 120+, Firefox 120+, Safari 16+, Edge 120+
  - Minimum resolution: 1366x768
  - Recommended: 1920x1080 or higher

- **Mobile Devices (PWA)**
  - iOS 14+ (Safari)
  - Android 10+ (Chrome)
  - Minimum 4GB RAM for optimal offline performance
  - 2GB+ available storage for PWA installation and caching

### Device Strategy & Fleet Hardware

#### Supported Devices

Fleet's native app runs on Android and iOS phones and tablets. The recommended deployment model uses dedicated tablets in vehicles, with phones as a secondary option for supervisors, managers, or situations where a tablet isn't practical.

| Device Type                      | Primary Use Case              | NFC | OBD | GPS |
| -------------------------------- | ----------------------------- | --- | --- | --- |
| Android tablet (vehicle-mounted) | Operators, field technicians  | ✓   | ✓   | ✓   |
| iPad (vehicle-mounted)           | Operators, field technicians  | ✓   | ✓   | ✓   |
| Android phone                    | Supervisors, managers, backup | ✓   | ✓   | ✓   |
| iPhone                           | Supervisors, managers, backup | ✓\* | ✓   | ✓   |

\*iPhone NFC: Read-only for asset tags via Core NFC. Cannot write NFC tags.

**NFC/QR Strategy:** All NFC-based operations support QR code scanning as an alternative. QR codes work on all devices and provide a fallback when NFC tags are damaged, unavailable, or for iPhone users. Assets, checkpoints, and operator badges can use either NFC tags, QR stickers, or both.

#### Minimum Mobile Requirements

| Specification | Android                             | iOS                                        |
| ------------- | ----------------------------------- | ------------------------------------------ |
| OS Version    | Android 10+                         | iOS 14+                                    |
| NFC           | Recommended (QR fallback available) | Optional (Core NFC read-only, QR fallback) |
| Bluetooth     | BLE 4.0+ for OBD                    | BLE 4.0+ for OBD                           |
| Storage       | 2GB+ available                      | 2GB+ available                             |
| RAM           | 4GB+                                | 4GB+                                       |

#### Dedicated Fleet Tablets (Recommended for Vehicles)

For vehicle-mounted installations, dedicated tablets provide operational advantages over personal phones.

**Advantages of Dedicated Tablets:**

| Factor                    | Benefit                                                  |
| ------------------------- | -------------------------------------------------------- |
| Consistent hardware       | Standardised NFC and Bluetooth across fleet              |
| Permanent OBD pairing     | Bluetooth OBD dongle stays paired, no daily reconnection |
| Larger screen             | Forms, checklists, and photos easier on 8-10" display    |
| No personal device issues | No privacy concerns, flat batteries, or forgotten phones |
| Asset tracking            | Tablet doubles as vehicle tracker when mounted           |
| Shared business device    | Run Fleet alongside other business apps                  |

**Recommended Tablet Specifications:**

| Specification       | Requirement               | Notes                                                                  |
| ------------------- | ------------------------- | ---------------------------------------------------------------------- |
| Platform            | Android 12+ or iPadOS 16+ | Android Enterprise Recommended preferred for Android                   |
| Display             | 8-10"                     | Sunlight readable preferred                                            |
| NFC                 | Recommended               | For asset tagging, operator logging, fuel auth (QR fallback available) |
| Cellular            | 4G LTE                    | Independent connectivity, not reliant on phone hotspot                 |
| Storage             | 64GB+                     | Offline data, photos, queued sync operations                           |
| RAM                 | 4GB+                      | Smooth operation with background services                              |
| Rugged rating       | IP65+ recommended         | Cab environments are harsh                                             |
| Mount compatibility | VESA or RAM Mount         | Standard mounting options                                              |

**Recommended Devices:**

Android:

- Samsung Galaxy Tab Active4 Pro / Active5 (rugged, Knox integration)
- Samsung Galaxy Tab A9+ (budget option, good NFC)
- Panasonic Toughbook FZ-A3 (enterprise rugged)
- Zebra ET4x Series (enterprise/industrial)

iPad:

- iPad (10th gen) with rugged case
- iPad Air with rugged case
- iPad Pro for demanding environments

#### In-Cab Installation

**Power Requirements:**

- 12V USB charging via ignition-switched circuit
- Prevents battery drain when vehicle is off
- Consider USB-C PD for faster charging during short trips
- Hardwired installation preferred over cigarette lighter adapters

**Mounting:**

- RAM Mount X-Grip or similar with anti-theft hardware
- Position for easy reach without obstructing visibility
- Consider articulating arms for removal during inspections
- Lockable mounts reduce theft risk

#### Bluetooth OBD-II Dongles

**Recommended OBD Hardware:**

| Device                | Price Range | Notes                                                       |
| --------------------- | ----------- | ----------------------------------------------------------- |
| OBDLink MX+           | $100-120    | Professional grade, excellent Bluetooth, wide compatibility |
| OBDLink CX            | $70-90      | Designed for always-connected fleet use                     |
| Veepeak OBDCheck BLE+ | $30-40      | Budget option, good for basic diagnostics                   |
| BAFX Products 34t5    | $20-25      | Entry level, Android only                                   |

**Installation:**

- Dongle plugs into vehicle OBD-II port (standard on all vehicles since 1996)
- One-time Bluetooth pairing with dedicated tablet
- Stays paired as tablet remains with vehicle
- Consider low-profile dongles for tight OBD port locations

### Software Requirements

#### Runtime & Meta-Framework

- **Runtime**: Bun 1.3+ (JavaScript runtime and package manager)
- **Meta-Framework**: Nuxt 4.x (full-stack Vue framework)
- **UI Framework**: Nuxt UI v4 (100+ components, includes Tailwind CSS v4)

#### Backend Stack

- **Server**: Nitro (Nuxt's server engine)
- **Database**: PostgreSQL 18+ (primary data store)
- **Cache**: Redis 8.x+ (session management, caching, queues)
- **ORM**: Drizzle ORM 1.0+
- **Background Jobs**: BullMQ 5.34+ for Redis-based job processing

#### Frontend Stack

- **Reactive Framework**: Vue 3.5+ with `<script setup>` syntax
- **State Management**: Pinia 3.0+
- **Forms**: VeeValidate 4.15+ with Zod schemas
- **Build Tool**: Vite 6+ (via Nuxt)

#### Mobile PWA Stack

- **PWA Module**: @vite-pwa/nuxt for Service Worker management and offline caching
- **Offline Storage**: IndexedDB via idb library
- **Push Notifications**: Web Push Protocol (desktop), FCM/APNs via Capacitor (tablet)
- **Installation**: PWA install prompt for desktop; native app distribution for tablets

#### Mobile Native Stack (Capacitor)

All device features on mobile devices use Capacitor plugins exclusively:

- **Camera**: @capacitor/camera (photo capture, compression)
- **Filesystem**: @capacitor/filesystem (photo storage, offline files)
- **Geolocation**: @capacitor/geolocation (background GPS tracking)
- **NFC**: @capawesome/capacitor-nfc (asset tags, operator logging, fuel auth)
  - Android: Full read/write support
  - iOS: Read-only via Core NFC (cannot write tags)
- **QR/Barcode**: @capacitor-mlkit/barcode-scanning (asset identification, operator badges, checkpoints)
- **Bluetooth**: @capacitor-community/bluetooth-le (OBD-II dongles)
- **Push**: @capacitor/push-notifications (FCM for Android, APNs for iOS)

#### Package Version Summary

| Category           | Package         | Minimum Version |
| ------------------ | --------------- | --------------- |
| Runtime            | Bun             | 1.3+            |
| Meta-Framework     | Nuxt            | 4.x             |
| UI Framework       | Nuxt UI         | 4.0+            |
| Reactive Framework | Vue             | 3.5+            |
| Database           | PostgreSQL      | 18+             |
| Cache              | Redis           | 8.x+            |
| ORM                | Drizzle ORM     | 1.0+            |
| State              | Pinia           | 3.0+            |
| Forms              | VeeValidate     | 4.15+           |
| Validation         | Zod             | 3.24+           |
| Auth               | nuxt-auth-utils | Latest          |
| Password           | argon2          | 0.41+           |
| Jobs               | BullMQ          | 5.34+           |

### Performance Requirements

#### Response Time

- **API Endpoints**: <200ms for 95th percentile
- **Page Load Time**: <2 seconds for initial load
- **Offline Sync**: <5 seconds for data synchronization
- **Database Queries**: <100ms for standard queries

#### Throughput

- **Concurrent Users**: Support 500+ concurrent users
- **API Requests**: 10,000+ requests per minute
- **Database Connections**: 100+ concurrent connections
- **Background Jobs**: 1,000+ jobs per hour

#### Availability

- **Uptime**: 99.9% availability SLA
- **Planned Maintenance**: <4 hours per month
- **Disaster Recovery**: RTO <4 hours, RPO <15 minutes
- **Backup Frequency**: Daily automated backups with point-in-time recovery

---

## System Architecture

### Architecture Overview

Fleet follows a modern full-stack TypeScript architecture with clear separation of concerns and scalable design patterns.

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
├─────────────────────────────────────────────────────────────┤
│  Desktop Web (Vue 3)        │  Mobile App (Capacitor)       │
│  - Admin Interface          │  - Android phones & tablets   │
│  - Dashboards               │  - iPhones & iPads            │
│  - Reporting                │  - Field & operator workflows │
│  - No native device access  │  - All device features native │
├─────────────────────────────────────────────────────────────┤
│         Capacitor Native Layer (All Mobile Devices)         │
│  - NFC Tag Reading/Writing  │  - Background Geolocation     │
│  - QR/Barcode Scanning      │  - Push Notifications         │
│  - Native Camera + Storage  │  - Bluetooth LE (OBD-II)      │
├─────────────────────────────────────────────────────────────┤
│              Vehicle Integration Layer                       │
│  - Bluetooth OBD-II Dongle  │  - GPS Location Services      │
│  - Operator NFC/QR Logging  │  - Fuel Bowser Auth (NFC/QR)  │
│  - Pre-Start Inspections    │  - Walk-Around Checkpoints    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/WSS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               Load Balancer & CDN                            │
├─────────────────────────────────────────────────────────────┤
│  - SSL Termination          │  - Static Asset Delivery      │
│  - Health Checks            │  - PWA Cache                  │
│  - Sticky Sessions          │  - Global Distribution        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Application Layer (Nuxt 4 / Nitro)              │
├─────────────────────────────────────────────────────────────┤
│  - Server API Routes        │  - File-based Routing         │
│  - Authentication           │  - Business Logic             │
│  - Validation               │  - Authorization              │
│  - Middleware               │  - Error Handling             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│             Service Layer (Server Services)                  │
├─────────────────────────────────────────────────────────────┤
│  - Asset Service            │  - Report Service             │
│  - Maintenance Service      │  - Integration Service        │
│  - Inventory Service        │  - Notification Service       │
│  - Document Service         │  - Audit Service              │
│  - Operator Service         │  - Fuel Service               │
│  - OBD Service              │  - Geofence Service           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               Data Layer                                     │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL 18+             │  Redis 8.x+                   │
│  - Asset Data               │  - Session Storage            │
│  - Work Orders              │  - Cache                      │
│  - Inventory                │  - Queue Management           │
│  - Documents (Blob)         │  - Background Jobs (BullMQ)   │
│  - Audit Logs               │  - Rate Limiting              │
│  - Operator Sessions        │  - Geofence Cache             │
│  - Fuel Transactions        │  - Location Buffer            │
│  - OBD Readings             │                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            Fuel System Integration                           │
├─────────────────────────────────────────────────────────────┤
│  - Fuel Management Backend API                               │
│  - Transaction Reconciliation                                │
│  - Consumption Data Sync                                     │
└─────────────────────────────────────────────────────────────┘
```

### Architectural Patterns

#### 1. Full-Stack TypeScript

- **Unified Codebase**: Single language across frontend and backend
- **Type Safety**: End-to-end type safety with shared type definitions
- **Developer Productivity**: Hot reload, intelligent IDE support
- **Reduced Complexity**: No need for multi-language debugging

#### 2. Vue 3 Composition API

- **Composables**: Reusable logic with `use*` pattern
- **Reactive State**: Fine-grained reactivity with `ref` and `reactive`
- **Script Setup**: Concise component syntax with `<script setup>`
- **Type Safety**: Strong TypeScript integration

#### 3. API-First Design

- **Server API Routes**: Nuxt server routes in `server/api/`
- **RESTful APIs**: Standard HTTP methods for CRUD operations
- **WebSocket**: Real-time updates for live dashboards via Socket.io
- **OpenAPI Documentation**: Automated API documentation generation

#### 4. Offline-First PWA + Capacitor Native

- **Service Workers**: Intelligent caching strategies via @vite-pwa/nuxt
- **Hybrid Logical Clock**: Conflict-free replicated data types (CRDTs)
- **IndexedDB Storage**: Client-side data persistence
- **Background Sync**: Automatic synchronization when online
- **Capacitor-First Device Access**: All native device features (camera, GPS, NFC, Bluetooth, filesystem) via Capacitor plugins on tablet app
- **Platform Separation**: Tablet app uses Capacitor for device features; desktop web app requires no native access

#### 5. Modular Architecture

- **Nuxt Modules**: Pluggable functionality
- **Composables**: Shared business logic
- **Server Utils**: Reusable server-side utilities
- **Queue-Based Processing**: Asynchronous background job processing with BullMQ

### Data Flow Architecture

#### Write Operations

```
Client → Nuxt Server API → Validation (Zod) → Service Layer → Drizzle ORM → PostgreSQL
         ↓
         Redis Queue (BullMQ for async processing)
         ↓
         Background Workers
```

#### Read Operations

```
Client → Nuxt Server API → Cache Check (Redis)
         ↓
         PostgreSQL (if cache miss) via Drizzle
         ↓
         Cache Update (Redis)
```

#### PWA Sync Operations

```
PWA → IndexedDB (local) → Service Worker → Background Sync
      ↓
      Network Available → Sync Queue → Nuxt Server API
      ↓
      Conflict Resolution (HLC) → PostgreSQL
```

#### Capacitor Native Operations

```
Native App (iOS/Android)
      ↓
Capacitor Plugin Bridge
      ↓
┌─────────────────────────────────────────────────┐
│ Native Device APIs                              │
│ - NFC: Read asset tags → Asset lookup           │
│ - Camera: Capture photos → Attach to work order │
│ - Geolocation: Track location → Update asset    │
│ - Biometrics: Auth → Session validation         │
│ - Push: FCM/APNs → Notification service         │
└─────────────────────────────────────────────────┘
      ↓
Vue Component → Same PWA/IndexedDB flow
```

---

## Project Structure

```
fleet/
├── server/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login.post.ts
│   │   │   ├── logout.post.ts
│   │   │   └── me.get.ts
│   │   ├── assets/
│   │   │   ├── index.get.ts
│   │   │   ├── index.post.ts
│   │   │   ├── [id].get.ts
│   │   │   ├── [id].put.ts
│   │   │   └── [id]/
│   │   │       ├── work-orders.get.ts
│   │   │       └── compatible-parts.get.ts  # Parts compatible with asset
│   │   ├── work-orders/
│   │   │   └── [id]/
│   │   │       └── task-parts.get.ts        # Parts for work order task + asset
│   │   ├── maintenance-tasks/
│   │   │   ├── index.get.ts
│   │   │   ├── index.post.ts
│   │   │   ├── [id].get.ts
│   │   │   ├── [id].put.ts
│   │   │   ├── groups.get.ts                # Task groups/categories
│   │   │   └── [id]/
│   │   │       └── parts.get.ts             # Parts required for task
│   │   ├── inventory/
│   │   ├── inspections/
│   │   ├── documents/
│   │   ├── reports/
│   │   ├── operators/
│   │   │   ├── sessions/
│   │   │   │   ├── index.post.ts        # Log operator onto vehicle
│   │   │   │   ├── [id].put.ts          # Update session (log off)
│   │   │   │   └── active.get.ts        # Get active sessions
│   │   │   └── certifications.get.ts    # Operator certification status
│   │   ├── fuel/
│   │   │   ├── transactions/
│   │   │   │   ├── index.get.ts         # List fuel transactions
│   │   │   │   └── index.post.ts        # Record refueling
│   │   │   └── analytics.get.ts         # Fuel consumption analytics
│   │   ├── obd/
│   │   │   ├── readings/
│   │   │   │   └── index.post.ts        # Submit OBD readings
│   │   │   └── dtc/
│   │   │       ├── index.get.ts         # List DTCs for asset
│   │   │       └── [id].put.ts          # Clear/acknowledge DTC
│   │   ├── locations/
│   │   │   ├── index.post.ts            # Submit location update
│   │   │   ├── history.get.ts           # Location history for asset
│   │   │   └── geofences/
│   │   │       ├── index.get.ts
│   │   │       └── index.post.ts
│   │   └── sync/
│   │       └── index.post.ts           # PWA sync endpoint
│   ├── database/
│   │   ├── schema/
│   │   │   ├── organizations.ts
│   │   │   ├── users.ts
│   │   │   ├── assets.ts
│   │   │   ├── asset-parts.ts            # Asset-part compatibility
│   │   │   ├── maintenance-tasks.ts      # Task templates and groups
│   │   │   ├── task-parts.ts             # Task-part requirements
│   │   │   ├── work-orders.ts
│   │   │   ├── inventory.ts
│   │   │   ├── inspections.ts
│   │   │   ├── documents.ts
│   │   │   ├── operator-sessions.ts      # Operator log-on/log-off records
│   │   │   ├── fuel-transactions.ts      # Refueling records
│   │   │   ├── obd-readings.ts           # OBD data and DTCs
│   │   │   ├── location-history.ts       # GPS tracking records
│   │   │   └── geofences.ts              # Geofence definitions
│   │   ├── migrations/
│   │   └── index.ts
│   ├── services/
│   │   ├── asset.service.ts
│   │   ├── maintenance.service.ts
│   │   ├── task.service.ts               # Maintenance task management
│   │   ├── inventory.service.ts
│   │   ├── sync.service.ts              # PWA sync handling
│   │   ├── notification.service.ts
│   │   ├── operator.service.ts          # Operator sessions and logging
│   │   ├── fuel.service.ts              # Fuel transactions and analytics
│   │   ├── obd.service.ts               # OBD data processing and DTC handling
│   │   └── geofence.service.ts          # Geofence management and alerts
│   ├── jobs/
│   │   ├── queue.ts                     # BullMQ setup
│   │   ├── maintenance-scheduler.ts
│   │   ├── report-generator.ts
│   │   └── sync-processor.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── audit.ts
│   └── utils/
│       ├── db.ts
│       ├── redis.ts
│       └── hlc.ts                       # Hybrid Logical Clock
├── pages/
│   ├── index.vue                        # Dashboard
│   ├── login.vue
│   ├── assets/
│   │   ├── index.vue
│   │   └── [id].vue
│   ├── work-orders/
│   │   ├── index.vue
│   │   └── [id].vue
│   ├── maintenance-tasks/
│   │   ├── index.vue                    # Task templates list
│   │   ├── [id].vue                     # Task template detail
│   │   └── groups.vue                   # Task groups management
│   ├── inventory/
│   ├── inspections/
│   ├── reports/
│   ├── documents/
│   └── admin/
├── components/
│   ├── dashboard/
│   │   ├── KpiCard.vue
│   │   ├── AssetMap.vue
│   │   └── MaintenanceCalendar.vue
│   ├── assets/
│   │   ├── AssetCard.vue
│   │   ├── AssetDetails.vue
│   │   └── CompatiblePartsList.vue      # Parts compatible with asset
│   ├── inventory/
│   │   ├── PartCard.vue
│   │   ├── StockLevel.vue
│   │   └── PartRequestForm.vue
│   ├── work-orders/
│   │   ├── WorkOrderCard.vue
│   │   ├── WorkOrderDetails.vue
│   │   ├── TaskPartsList.vue            # Parts required for task + asset
│   │   └── PartsUsedForm.vue
│   ├── maintenance-tasks/
│   │   ├── TaskTemplateCard.vue
│   │   ├── TaskGroupTree.vue            # Hierarchical task groups
│   │   ├── TaskPartsConfig.vue          # Configure parts per task
│   │   └── AssetTaskOverrides.vue       # Asset-specific overrides
│   ├── forms/
│   │   ├── FormBuilder.vue              # Custom form builder
│   │   ├── FieldRenderer.vue
│   │   └── fields/                      # 16+ field types
│   ├── pwa/
│   │   ├── SyncStatus.vue
│   │   ├── OfflineIndicator.vue
│   │   └── InstallPrompt.vue
│   └── native/
│       ├── NfcScanner.vue               # NFC tag reading component
│       ├── QrScanner.vue                # QR/barcode scanning component
│       ├── NativeCamera.vue             # Photo capture and storage
│       ├── OperatorLogon.vue            # Operator tap-on/tap-off UI (NFC/QR)
│       ├── PreStartInspection.vue       # Walk-around inspection workflow
│       ├── CheckpointScanner.vue        # NFC/QR checkpoint scanning
│       ├── ObdConnection.vue            # Bluetooth OBD pairing and status
│       ├── ObdLiveData.vue              # Real-time vehicle data display
│       └── FuelCapture.vue              # Refueling data entry
├── composables/
│   ├── useOfflineSync.ts                # IndexedDB + sync logic
│   ├── useHLC.ts                        # Hybrid Logical Clock
│   ├── useAssets.ts
│   ├── useWorkOrders.ts
│   ├── useMaintenanceTasks.ts           # Task templates and groups
│   ├── useTaskParts.ts                  # Task-asset parts matrix
│   ├── useInventory.ts
│   ├── useCompatibleParts.ts            # Asset-part compatibility
│   ├── useAuth.ts
│   ├── useNfc.ts                        # NFC plugin wrapper
│   ├── useQrScanner.ts                  # QR/barcode scanning wrapper
│   ├── useNativeCamera.ts               # Capacitor camera
│   ├── useGeolocation.ts                # Background location
│   ├── useCapacitor.ts                  # Platform detection utilities
│   ├── useBluetoothObd.ts               # OBD-II dongle communication
│   ├── useOperatorSession.ts            # Operator log-on/log-off
│   ├── useFuelCapture.ts                # Refueling data capture
│   └── usePreStartInspection.ts         # Walk-around inspection workflow
├── stores/
│   ├── user.ts
│   ├── offline-queue.ts                 # Pending sync operations
│   └── app.ts
├── types/
│   └── index.ts
├── public/
│   ├── icons/
│   └── manifest.webmanifest
├── android/                             # Capacitor Android project
│   ├── app/
│   │   └── src/
│   │       └── main/
│   │           └── AndroidManifest.xml  # NFC, Bluetooth, location permissions
│   └── build.gradle
├── ios/                                 # Capacitor iOS project
│   └── App/
│       └── App/
│           └── Info.plist               # NFC, Bluetooth, location entitlements
├── capacitor.config.ts                  # Capacitor configuration
├── nuxt.config.ts
├── drizzle.config.ts
├── app.config.ts
└── package.json
```

---

## Configuration

### Project Initialization

**Recommended Template**: Use the Nuxt UI **dashboard** template for project initialization:

```bash
# IMPORTANT: Use direct GitHub template reference for non-interactive setup
# Do NOT use `--template ui` which requires interactive prompt selection
bunx nuxi@latest init fleet --template gh:nuxt-ui-templates/dashboard --packageManager bun
```

**Available Nuxt UI Templates** (non-interactive GitHub references):

- `gh:nuxt-ui-templates/dashboard` - Admin dashboard with sidebar, auth scaffolding, data tables
- `gh:nuxt-ui-templates/starter` - Minimal starter with header/footer
- `gh:nuxt-ui-templates/landing` - Marketing landing page template
- `gh:nuxt-ui-templates/docs` - Documentation site template

The dashboard template provides:

- Pre-configured Nuxt UI v4 with 100+ components
- Dashboard layout with sidebar navigation
- Authentication scaffolding (login page, session handling)
- Data table and KPI card patterns
- Dark/light mode theming
- Responsive mobile-first design

This significantly accelerates development of the Fleet admin interface and provides consistent UI patterns aligned with enterprise dashboard requirements.

### nuxt.config.ts

```typescript
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@vite-pwa/nuxt',
    '@nuxt/image',
    '@pinia/nuxt',
    '@vee-validate/nuxt',
    'nuxt-auth-utils'
  ],

  ui: {
    global: true
  },

  colorMode: {
    preference: 'system'
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Fleet Management System',
      short_name: 'Fleet',
      theme_color: '#0066cc',
      display: 'standalone',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /^\/api\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            networkTimeoutSeconds: 10,
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 // 24 hours
            }
          }
        }
      ]
    }
  },

  runtimeConfig: {
    sessionPassword: process.env.NUXT_SESSION_PASSWORD,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    public: {
      appName: 'Fleet'
    }
  },

  nitro: {
    preset: 'bun',
    experimental: {
      tasks: true
    }
  },

  devtools: { enabled: true }
})
```

### drizzle.config.ts

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/database/schema/*.ts',
  out: './server/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
})
```

### capacitor.config.ts

```typescript
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.fleet.app',
  appName: 'Fleet',
  webDir: '.output/public',
  server: {
    // For development: connect to local dev server
    // url: 'http://192.168.1.x:3000',
    // cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0066cc',
      showSpinner: false
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  },
  ios: {
    contentInset: 'automatic'
  },
  android: {
    allowMixedContent: false
  }
}

export default config
```

### Capacitor Plugin Dependencies

```bash
# Core Capacitor packages
bun add @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# Official plugins
bun add @capacitor/camera @capacitor/filesystem @capacitor/geolocation
bun add @capacitor/push-notifications @capacitor/local-notifications
bun add @capacitor/network @capacitor/device @capacitor/haptics
bun add @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard
bun add @capacitor/app @capacitor/preferences

# Community plugins
bun add @capawesome/capacitor-nfc          # NFC tag reading/writing
bun add @capacitor-mlkit/barcode-scanning  # QR/barcode scanning
bun add @capacitor-community/bluetooth-le  # Bluetooth Low Energy for OBD dongles
```

### package.json Scripts

```json
{
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "build:static": "nuxt generate",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "jobs:worker": "bun run server/jobs/worker.ts",
    "cap:init": "cap init Fleet com.fleet.app --web-dir .output/public",
    "cap:add:android": "cap add android",
    "cap:add:ios": "cap add ios",
    "cap:sync": "nuxt generate && cap sync",
    "cap:open:android": "cap open android",
    "cap:open:ios": "cap open ios",
    "cap:run:android": "cap run android",
    "cap:run:ios": "cap run ios",
    "cap:build:android": "nuxt generate && cap sync android && cd android && ./gradlew assembleRelease",
    "cap:build:ios": "nuxt generate && cap sync ios"
  }
}
```

---

## Feature-Based Implementation Plan

Each feature includes user stories, acceptance criteria, implementation tasks, and test requirements. Features can be developed and tested independently, enabling continuous delivery.

---

### Feature 1: Foundation & Infrastructure

**Priority:** Critical (Required for all other features)
**Estimated Effort:** 3-4 weeks

#### User Stories

**US-1.1: Developer Project Setup**
As a developer, I want a fully configured Nuxt 4 project with TypeScript, linting, and testing infrastructure so that I can begin development with consistent tooling.

_Acceptance Criteria:_

- **REQ-101-AC-01**: Nuxt 4 project initialised with TypeScript strict mode
- **REQ-101-AC-02**: ESLint and Prettier configured with shared rules
- **REQ-101-AC-03**: Vitest configured for unit testing
- **REQ-101-AC-04**: Playwright configured for E2E testing
- **REQ-101-AC-05**: GitHub Actions CI pipeline runs lint, type-check, and tests on PR
- **REQ-101-AC-06**: Development environment starts with `bun dev`

**US-1.2: Database Infrastructure**
As a developer, I want a PostgreSQL database with Drizzle ORM so that I can define type-safe schemas and run migrations.

_Acceptance Criteria:_

- **REQ-102-AC-01**: PostgreSQL 18+ connection established
- **REQ-102-AC-02**: Drizzle ORM configured with migrations
- **REQ-102-AC-03**: Base schemas created (organisations, users)
- **REQ-102-AC-04**: Database seeding script for development
- **REQ-102-AC-05**: Connection pooling configured

**US-1.3: Caching Infrastructure**
As a developer, I want Redis configured for caching and session management so that the application performs efficiently.

_Acceptance Criteria:_

- **REQ-103-AC-01**: Redis 8.x+ connection established
- **REQ-103-AC-02**: Session storage using Redis
- **REQ-103-AC-03**: Cache utilities available for API routes
- **REQ-103-AC-04**: BullMQ configured for background jobs

**US-1.4: User Authentication**
As a user, I want to log in with email and password so that I can access the system securely.

_Acceptance Criteria:_

- **REQ-104-AC-01**: Login page with email/password form
- **REQ-104-AC-02**: Password hashing with Argon2
- **REQ-104-AC-03**: Session-based authentication with JWT
- **REQ-104-AC-04**: Logout functionality clears session
- **REQ-104-AC-05**: Password reset via email flow
- **REQ-104-AC-06**: Account lockout after 5 failed attempts
- **REQ-104-AC-07**: Session timeout after 8 hours of inactivity

**US-1.5: Role-Based Access Control**
As an administrator, I want to assign roles to users so that they can only access features appropriate to their role.

_Acceptance Criteria:_

- **REQ-105-AC-01**: Predefined roles: Admin, Fleet Manager, Supervisor, Technician, Operator
- **REQ-105-AC-02**: Role assignment on user creation/edit
- **REQ-105-AC-03**: API middleware validates role permissions
- **REQ-105-AC-04**: UI hides/disables features based on role
- **REQ-105-AC-05**: Audit log records permission denied events

**US-1.6: Multi-Tenant Organisation Support**
As a system administrator, I want to support multiple organisations so that each customer's data is isolated.

_Acceptance Criteria:_

- **REQ-106-AC-01**: Organisation table with tenant isolation
- **REQ-106-AC-02**: All queries filtered by organisation_id
- **REQ-106-AC-03**: Users belong to one organisation
- **REQ-106-AC-04**: Organisation settings and branding
- **REQ-106-AC-05**: Super-admin can access all organisations

#### Implementation Tasks

- [ ] Nuxt 4 project setup with dashboard template
- [ ] TypeScript configuration with strict mode
- [ ] ESLint, Prettier, and Husky setup
- [ ] Vitest and Playwright configuration
- [ ] GitHub Actions CI/CD pipeline
- [ ] PostgreSQL database setup with Drizzle ORM
- [ ] Redis setup for caching and sessions
- [ ] BullMQ job queue configuration
- [ ] Authentication system (nuxt-auth-utils)
- [ ] RBAC middleware and composables
- [ ] Organisation/tenant data model
- [ ] Error handling and logging infrastructure
- [ ] Environment configuration management

#### Test Criteria

- [ ] All authentication flows tested (login, logout, reset, lockout)
- [ ] Role permissions validated for each API endpoint
- [ ] Multi-tenant data isolation verified
- [ ] Session timeout and refresh working correctly
- [ ] CI pipeline passes all checks

---

### Feature 2: Asset Management

**Priority:** Critical
**Dependencies:** Feature 1 (Foundation)
**Estimated Effort:** 2-3 weeks

#### User Stories

**US-2.1: Asset Registry**
As a fleet manager, I want to register assets with comprehensive details so that I have a complete record of all fleet vehicles and equipment.

_Acceptance Criteria:_

- **REQ-201-AC-01**: Create asset with: asset number, VIN, make, model, year, license plate
- **REQ-201-AC-02**: Asset number auto-generates with configurable format (e.g., FLT-0001)
- **REQ-201-AC-03**: Record operational hours and mileage
- **REQ-201-AC-04**: Set asset status (active, inactive, maintenance, disposed)
- **REQ-201-AC-05**: Assign asset to category/type
- **REQ-201-AC-06**: View asset detail page with all information
- **REQ-201-AC-07**: Edit asset details with audit trail
- **REQ-201-AC-08**: Soft delete (archive) assets

**US-2.2: Asset Search and Filtering**
As a fleet manager, I want to search and filter assets so that I can quickly find specific vehicles or equipment.

_Acceptance Criteria:_

- **REQ-202-AC-01**: Global search bar searches asset number, VIN, make, model, license plate
- **REQ-202-AC-02**: Advanced filters: status, category, make, model, year, location
- **REQ-202-AC-03**: Filter results update in real-time
- **REQ-202-AC-04**: Save filter combinations as named searches
- **REQ-202-AC-05**: Export filtered results to CSV

**US-2.3: Asset Categories and Hierarchy**
As a fleet manager, I want to organise assets into categories so that I can manage them by type and apply bulk settings.

_Acceptance Criteria:_

- **REQ-203-AC-01**: Create/edit/delete asset categories
- **REQ-203-AC-02**: Categories support hierarchy (e.g., Vehicles > Trucks > Semi-Trailers)
- **REQ-203-AC-03**: Assign default maintenance schedules to categories
- **REQ-203-AC-04**: Assign default compatible parts to categories
- **REQ-203-AC-05**: Assets inherit category settings but can override

**US-2.4: Asset Location Tracking**
As a fleet manager, I want to see where assets are located so that I can manage fleet distribution.

_Acceptance Criteria:_

- **REQ-204-AC-01**: Current location displayed on asset detail
- **REQ-204-AC-02**: Location history with timestamps
- **REQ-204-AC-03**: Map view showing all asset locations
- **REQ-204-AC-04**: Filter map by asset status or category

**US-2.5: Asset Documents**
As a fleet manager, I want to attach documents to assets so that I can store registrations, manuals, and certificates.

_Acceptance Criteria:_

- **REQ-205-AC-01**: Upload documents (PDF, images) to asset
- **REQ-205-AC-02**: Document metadata: name, type, expiry date
- **REQ-205-AC-03**: Expiring document alerts (30, 14, 7 days)
- **REQ-205-AC-04**: View/download attached documents
- **REQ-205-AC-05**: Delete documents with audit trail

**US-2.6: Asset Import/Export**
As a fleet manager, I want to import assets from a spreadsheet so that I can migrate existing fleet data.

_Acceptance Criteria:_

- **REQ-206-AC-01**: Download CSV/Excel template with all fields
- **REQ-206-AC-02**: Upload file and preview import data
- **REQ-206-AC-03**: Validation errors shown before import
- **REQ-206-AC-04**: Import creates assets with audit trail
- **REQ-206-AC-05**: Export all assets to CSV/Excel

**US-2.7: Asset Identification (NFC/QR)**
As a field technician, I want to scan an NFC tag or QR code to identify an asset so that I can quickly access asset information.

_Acceptance Criteria:_

- **REQ-207-AC-01**: Tap NFC tag or scan QR code opens asset detail page
- **REQ-207-AC-02**: Works offline with cached asset data
- **REQ-207-AC-03**: NFC tag stores asset UUID; QR code encodes asset UUID
- **REQ-207-AC-04**: Both methods supported on all devices
- **REQ-207-AC-05**: QR scanning uses device camera via Capacitor

**US-2.8: Asset Tag/QR Enrollment**
As an administrator, I want to write asset IDs to NFC tags and generate QR codes so that I can set up assets for identification.

_Acceptance Criteria:_

- **REQ-208-AC-01**: Select asset and tap "Write NFC Tag" (Android only)
- **REQ-208-AC-02**: Hold tag to device to write asset UUID
- **REQ-208-AC-03**: Generate printable QR code for asset
- **REQ-208-AC-04**: QR code downloads as image or PDF for printing
- **REQ-208-AC-05**: Confirmation message on successful NFC write

#### Implementation Tasks

- [ ] Asset database schema (Drizzle)
- [ ] Asset CRUD API endpoints
- [ ] Asset list page with data table
- [ ] Asset detail page
- [ ] Asset create/edit forms
- [ ] Asset search and filtering
- [ ] Asset category management
- [ ] Location tracking storage and display
- [ ] Document attachment system
- [ ] Import/export functionality
- [ ] NFC reading composable and component
- [ ] NFC writing (Android only)
- [ ] QR code scanning component
- [ ] QR code generation for assets

#### Test Criteria

- [ ] Create, read, update, delete assets
- [ ] Search returns correct results
- [ ] Filters work independently and combined
- [ ] Category inheritance works correctly
- [ ] Document upload/download functional
- [ ] Import validates and creates assets correctly
- [ ] NFC read identifies correct asset
- [ ] QR scan identifies correct asset
- [ ] NFC write persists to tag
- [ ] QR code generates and scans correctly

---

### Feature 3: Maintenance Tasks & Templates

**Priority:** High
**Dependencies:** Feature 2 (Assets)
**Estimated Effort:** 2 weeks

#### User Stories

**US-3.1: Task Template Management**
As a maintenance supervisor, I want to create maintenance task templates so that common jobs have consistent procedures and parts lists.

_Acceptance Criteria:_

- **REQ-301-AC-01**: Create task template with: name, description, estimated hours, estimated cost
- **REQ-301-AC-02**: Assign task to group/category (Engine, Brakes, Electrical, etc.)
- **REQ-301-AC-03**: Define checklist items for the task
- **REQ-301-AC-04**: Specify required parts with quantities
- **REQ-301-AC-05**: Set skill level required
- **REQ-301-AC-06**: Edit and version task templates
- **REQ-301-AC-07**: Archive unused templates

**US-3.2: Task Grouping**
As a maintenance supervisor, I want to organise tasks into groups so that I can find and manage related tasks easily.

_Acceptance Criteria:_

- **REQ-302-AC-01**: Create/edit/delete task groups
- **REQ-302-AC-02**: Hierarchical groups (e.g., Engine > Oil System > Oil Change)
- **REQ-302-AC-03**: Filter task list by group
- **REQ-302-AC-04**: Drag-and-drop reordering within groups

**US-3.3: Task-Part Requirements**
As a maintenance supervisor, I want to specify which parts are needed for each task so that technicians know what to prepare.

_Acceptance Criteria:_

- **REQ-303-AC-01**: Add parts to task template with quantity
- **REQ-303-AC-02**: Parts linked to inventory catalog
- **REQ-303-AC-03**: View total estimated parts cost
- **REQ-303-AC-04**: Parts list copied to work order when task assigned

**US-3.4: Asset-Specific Task Overrides**
As a maintenance supervisor, I want to override task details for specific assets so that I can account for variations between vehicles.

_Acceptance Criteria:_

- **REQ-304-AC-01**: Override parts list for specific asset or category
- **REQ-304-AC-02**: Override estimated hours for specific asset
- **REQ-304-AC-03**: Override checklist items for specific asset
- **REQ-304-AC-04**: View which assets have overrides

#### Implementation Tasks

- [ ] Maintenance task schema
- [ ] Task group schema with hierarchy
- [ ] Task-part requirements schema
- [ ] Task template CRUD API
- [ ] Task group management UI
- [ ] Task template builder UI
- [ ] Parts assignment to tasks
- [ ] Asset-specific override system
- [ ] Task template versioning

#### Test Criteria

- [ ] Create task with all fields
- [ ] Assign parts to task
- [ ] Group hierarchy displays correctly
- [ ] Asset override takes precedence over template
- [ ] Archived templates hidden from active list

---

### Feature 4: Work Order Management

**Priority:** Critical
**Dependencies:** Feature 2 (Assets), Feature 3 (Tasks)
**Estimated Effort:** 3 weeks

#### User Stories

**US-4.1: Work Order Creation**
As a maintenance supervisor, I want to create work orders so that I can assign maintenance jobs to technicians.

_Acceptance Criteria:_

- **REQ-401-AC-01**: Create work order for specific asset
- **REQ-401-AC-02**: Select maintenance task template (optional)
- **REQ-401-AC-03**: Task selection pre-fills: description, checklist, parts, estimated hours
- **REQ-401-AC-04**: Set priority (low, medium, high, urgent)
- **REQ-401-AC-05**: Set due date
- **REQ-401-AC-06**: Assign to technician
- **REQ-401-AC-07**: Add notes and instructions
- **REQ-401-AC-08**: Work order number auto-generates

**US-4.2: Work Order Assignment**
As a maintenance supervisor, I want to assign work orders to technicians so that work is distributed appropriately.

_Acceptance Criteria:_

- **REQ-402-AC-01**: View technician workload (assigned hours this week)
- **REQ-402-AC-02**: Assign work order to one or more technicians
- **REQ-402-AC-03**: Reassign work order to different technician
- **REQ-402-AC-04**: Technician receives notification on assignment
- **REQ-402-AC-05**: Filter work orders by assigned technician

**US-4.3: Work Order Status Tracking**
As a maintenance supervisor, I want to track work order status so that I know the progress of all maintenance jobs.

_Acceptance Criteria:_

- **REQ-403-AC-01**: Status workflow: Draft → Open → In Progress → Pending Parts → Completed → Closed
- **REQ-403-AC-02**: Status change recorded with timestamp and user
- **REQ-403-AC-03**: Kanban board view by status
- **REQ-403-AC-04**: List view with status filters
- **REQ-403-AC-05**: Overdue work orders highlighted

**US-4.4: Work Order Execution (Mobile)**
As a field technician, I want to view and complete work orders on my mobile device so that I can work efficiently in the field.

_Acceptance Criteria:_

- **REQ-404-AC-01**: View assigned work orders list
- **REQ-404-AC-02**: Open work order shows: asset details, task checklist, required parts
- **REQ-404-AC-03**: Mark checklist items complete
- **REQ-404-AC-04**: Record parts used (deducts from inventory)
- **REQ-404-AC-05**: Add photos to work order
- **REQ-404-AC-06**: Add notes
- **REQ-404-AC-07**: Capture digital signature on completion
- **REQ-404-AC-08**: Submit completed work order
- **REQ-404-AC-09**: Works offline with sync when connected

**US-4.5: Work Order Parts Management**
As a field technician, I want to see which parts I need and record which parts I used so that inventory stays accurate.

_Acceptance Criteria:_

- **REQ-405-AC-01**: View required parts with quantities
- **REQ-405-AC-02**: See compatible alternative parts
- **REQ-405-AC-03**: Check stock availability (online)
- **REQ-405-AC-04**: Record actual parts used
- **REQ-405-AC-05**: Add unplanned parts to work order
- **REQ-405-AC-06**: Parts deducted from inventory on completion

**US-4.6: Work Order Cost Tracking**
As a fleet manager, I want to see the cost of each work order so that I can track maintenance expenses.

_Acceptance Criteria:_

- **REQ-406-AC-01**: Calculate labor cost (hours × rate)
- **REQ-406-AC-02**: Calculate parts cost (actual parts used)
- **REQ-406-AC-03**: Display total work order cost
- **REQ-406-AC-04**: Cost summary on asset detail page
- **REQ-406-AC-05**: Cost reporting by asset, category, time period

**US-4.7: Work Order Approval Workflow**
As a fleet manager, I want to approve high-value work orders so that I can control maintenance spending.

_Acceptance Criteria:_

- **REQ-407-AC-01**: Configure approval threshold (e.g., >$500)
- **REQ-407-AC-02**: Work orders above threshold require approval before starting
- **REQ-407-AC-03**: Approver receives notification
- **REQ-407-AC-04**: Approve/reject with comments
- **REQ-407-AC-05**: Approval recorded in audit trail

**US-4.8: Work Order from Defect**
As a maintenance supervisor, I want work orders automatically created from inspection defects so that issues are addressed promptly.

_Acceptance Criteria:_

- **REQ-408-AC-01**: Inspection failure creates work order automatically
- **REQ-408-AC-02**: Work order links to inspection record
- **REQ-408-AC-03**: Priority set based on defect severity
- **REQ-408-AC-04**: Supervisor notified of new defect work order

#### Implementation Tasks

- [ ] Work order database schema
- [ ] Work order CRUD API
- [ ] Work order list with filters
- [ ] Kanban board view
- [ ] Work order detail page
- [ ] Work order create/edit form
- [ ] Task template integration
- [ ] Technician assignment
- [ ] Parts requirement display
- [ ] Parts usage recording
- [ ] Photo attachment
- [ ] Digital signature capture
- [ ] Offline work order execution
- [ ] Cost calculation
- [ ] Approval workflow
- [ ] Defect-to-work-order automation

#### Test Criteria

- [ ] Create work order with and without template
- [ ] Status transitions work correctly
- [ ] Parts pre-fill from task template
- [ ] Parts deduct from inventory on completion
- [ ] Offline completion syncs correctly
- [ ] Cost calculations accurate
- [ ] Approval workflow triggers correctly
- [ ] Defect creates work order automatically

---

### Feature 5: Maintenance Scheduling

**Priority:** High
**Dependencies:** Feature 4 (Work Orders)
**Estimated Effort:** 2 weeks

#### User Stories

**US-5.1: Time-Based Maintenance Schedules**
As a maintenance supervisor, I want to schedule maintenance at regular time intervals so that preventive maintenance happens on schedule.

_Acceptance Criteria:_

- **REQ-501-AC-01**: Create schedule: daily, weekly, monthly, quarterly, annually
- **REQ-501-AC-02**: Assign schedule to asset or asset category
- **REQ-501-AC-03**: Assign maintenance task to schedule
- **REQ-501-AC-04**: Set start date and optional end date
- **REQ-501-AC-05**: Preview upcoming scheduled dates

**US-5.2: Usage-Based Maintenance Schedules**
As a maintenance supervisor, I want to schedule maintenance based on usage so that services happen at correct mileage or hours.

_Acceptance Criteria:_

- **REQ-502-AC-01**: Create schedule based on kilometers or hours
- **REQ-502-AC-02**: Set interval (e.g., every 10,000 km)
- **REQ-502-AC-03**: Assign to asset or category
- **REQ-502-AC-04**: System tracks current vs. next service threshold
- **REQ-502-AC-05**: Alert when approaching service due (configurable threshold)

**US-5.3: Combined Scheduling**
As a maintenance supervisor, I want to combine time and usage schedules so that maintenance happens at whichever comes first.

_Acceptance Criteria:_

- **REQ-503-AC-01**: Schedule triggers on time OR usage, whichever first
- **REQ-503-AC-02**: Example: Oil change every 3 months or 5,000 km
- **REQ-503-AC-03**: Clear display of "next due" by both criteria

**US-5.4: Automatic Work Order Generation**
As a maintenance supervisor, I want work orders created automatically from schedules so that nothing is missed.

_Acceptance Criteria:_

- **REQ-504-AC-01**: Background job checks schedules daily
- **REQ-504-AC-02**: Creates work order when schedule triggers
- **REQ-504-AC-03**: Work order pre-filled from task template
- **REQ-504-AC-04**: Notification sent to supervisor
- **REQ-504-AC-05**: Configurable lead time (create X days before due)

**US-5.5: Maintenance Calendar**
As a maintenance supervisor, I want to view scheduled maintenance on a calendar so that I can plan resources.

_Acceptance Criteria:_

- **REQ-505-AC-01**: Calendar view shows scheduled and open work orders
- **REQ-505-AC-02**: Color-coded by priority or status
- **REQ-505-AC-03**: Click event to view work order details
- **REQ-505-AC-04**: Filter by asset, category, technician
- **REQ-505-AC-05**: Week and month views

#### Implementation Tasks

- [ ] Schedule database schema
- [ ] Schedule CRUD API
- [ ] Time-based schedule logic
- [ ] Usage-based schedule logic
- [ ] Combined schedule logic
- [ ] BullMQ job for schedule checking
- [ ] Auto work order generation
- [ ] Calendar view component
- [ ] Schedule management UI

#### Test Criteria

- [ ] Time-based schedule creates work order on correct date
- [ ] Usage-based schedule triggers at correct threshold
- [ ] Combined schedule triggers on first condition met
- [ ] Calendar displays correct events
- [ ] Lead time configuration works

---

### Feature 6: Inventory Management

**Priority:** High
**Dependencies:** Feature 1 (Foundation)
**Estimated Effort:** 2-3 weeks

#### User Stories

**US-6.1: Parts Catalog**
As a maintenance supervisor, I want to maintain a parts catalog so that I can track what parts are available.

_Acceptance Criteria:_

- **REQ-601-AC-01**: Create part with: SKU, name, description, unit of measure
- **REQ-601-AC-02**: Set reorder threshold and reorder quantity
- **REQ-601-AC-03**: Track current quantity on hand
- **REQ-601-AC-04**: Set unit cost
- **REQ-601-AC-05**: Assign part categories
- **REQ-601-AC-06**: View parts list with search and filters
- **REQ-601-AC-07**: Part detail page shows usage history

**US-6.2: Stock Management**
As an inventory manager, I want to track stock movements so that I know what's in inventory.

_Acceptance Criteria:_

- **REQ-602-AC-01**: Record stock received (purchase order or manual)
- **REQ-602-AC-02**: Record stock issued (work order or manual)
- **REQ-602-AC-03**: All movements recorded with timestamp, user, reason
- **REQ-602-AC-04**: View movement history for any part
- **REQ-602-AC-05**: Current stock level always accurate

**US-6.3: Reorder Alerts**
As an inventory manager, I want alerts when stock is low so that I can reorder before running out.

_Acceptance Criteria:_

- **REQ-603-AC-01**: Alert when quantity falls below reorder threshold
- **REQ-603-AC-02**: Dashboard widget shows parts needing reorder
- **REQ-603-AC-03**: Email notification option
- **REQ-603-AC-04**: Mark parts as "on order" to suppress alerts

**US-6.4: Asset-Part Compatibility**
As a maintenance supervisor, I want to define which parts fit which assets so that technicians use correct parts.

_Acceptance Criteria:_

- **REQ-604-AC-01**: Assign parts as compatible with specific assets
- **REQ-604-AC-02**: Assign parts as compatible with asset categories (inherited)
- **REQ-604-AC-03**: Override category compatibility at asset level
- **REQ-604-AC-04**: View compatible parts on asset detail page
- **REQ-604-AC-05**: Filter parts by compatible asset

**US-6.5: Parts Usage from Work Orders**
As a field technician, I want parts automatically deducted when I complete a work order so that inventory stays accurate.

_Acceptance Criteria:_

- **REQ-605-AC-01**: Parts used recorded on work order completion
- **REQ-605-AC-02**: Stock deducted automatically
- **REQ-605-AC-03**: If stock insufficient, warning displayed
- **REQ-605-AC-04**: Negative stock prevented (configurable)
- **REQ-605-AC-05**: Usage linked to work order for history

**US-6.6: Inventory Count**
As an inventory manager, I want to perform physical counts so that I can reconcile actual vs. system quantities.

_Acceptance Criteria:_

- **REQ-606-AC-01**: Start inventory count session
- **REQ-606-AC-02**: Enter counted quantities
- **REQ-606-AC-03**: View discrepancies (system vs. counted)
- **REQ-606-AC-04**: Approve adjustments
- **REQ-606-AC-05**: Adjustments recorded with reason

**US-6.7: Multi-Location Inventory**
As an inventory manager, I want to track stock at multiple locations so that I know where parts are stored.

_Acceptance Criteria:_

- **REQ-607-AC-01**: Define storage locations (warehouses, trucks, depots)
- **REQ-607-AC-02**: Stock quantities tracked per location
- **REQ-607-AC-03**: Transfer stock between locations
- **REQ-607-AC-04**: Work orders draw from specified location

#### Implementation Tasks

- [ ] Parts database schema
- [ ] Stock movement schema
- [ ] Parts CRUD API
- [ ] Parts list and detail pages
- [ ] Stock movement recording
- [ ] Reorder alert logic and notifications
- [ ] Asset-part compatibility management
- [ ] Work order parts deduction
- [ ] Inventory count workflow
- [ ] Multi-location support

#### Test Criteria

- [ ] Part CRUD operations work
- [ ] Stock increases on receipt
- [ ] Stock decreases on work order completion
- [ ] Reorder alert triggers at threshold
- [ ] Compatibility filters work correctly
- [ ] Inventory count adjusts stock accurately

---

### Feature 7: Mobile App Core

**Priority:** Critical
**Dependencies:** Feature 1 (Foundation)
**Estimated Effort:** 3 weeks

#### User Stories

**US-7.1: Native App Shell**
As a mobile user, I want to install the Fleet app from the app store so that I can access it like any other app.

_Acceptance Criteria:_

- **REQ-701-AC-01**: Android app available on Google Play Store
- **REQ-701-AC-02**: iOS app available on Apple App Store
- **REQ-701-AC-03**: App icon and splash screen with Fleet branding
- **REQ-701-AC-04**: App opens to login screen or dashboard if authenticated

**US-7.2: Offline Data Access**
As a field technician, I want to access asset and work order data offline so that I can work without internet.

_Acceptance Criteria:_

- **REQ-702-AC-01**: Assets, work orders, parts cached in IndexedDB
- **REQ-702-AC-02**: Data syncs when app opens (if online)
- **REQ-702-AC-03**: Offline indicator shown when disconnected
- **REQ-702-AC-04**: All read operations work offline
- **REQ-702-AC-05**: Cached data refreshed periodically

**US-7.3: Offline Data Entry**
As a field technician, I want to complete work orders offline so that poor connectivity doesn't stop my work.

_Acceptance Criteria:_

- **REQ-703-AC-01**: Create/edit work orders offline
- **REQ-703-AC-02**: Complete inspections offline
- **REQ-703-AC-03**: Record fuel transactions offline
- **REQ-703-AC-04**: Changes queued in local storage
- **REQ-703-AC-05**: Sync queue indicator shows pending count

**US-7.4: Background Sync**
As a field technician, I want my offline changes to sync automatically so that I don't have to remember to upload.

_Acceptance Criteria:_

- **REQ-704-AC-01**: Sync triggers when connectivity restored
- **REQ-704-AC-02**: Sync runs in background
- **REQ-704-AC-03**: Conflicts resolved using Hybrid Logical Clock
- **REQ-704-AC-04**: User notified of sync success/failure
- **REQ-704-AC-05**: Manual sync button available

**US-7.5: Conflict Resolution**
As a field technician, I want conflicts handled gracefully so that no data is lost when multiple people edit the same record.

_Acceptance Criteria:_

- **REQ-705-AC-01**: Hybrid Logical Clock timestamps all changes
- **REQ-705-AC-02**: Last-write-wins for simple fields
- **REQ-705-AC-03**: Merge for list fields (e.g., photos)
- **REQ-705-AC-04**: User notified if their change was superseded
- **REQ-705-AC-05**: Conflict log available for review

**US-7.6: Photo Capture**
As a field technician, I want to take photos with my device camera so that I can document work and defects.

_Acceptance Criteria:_

- **REQ-706-AC-01**: Camera opens from within app (Capacitor)
- **REQ-706-AC-02**: Photo quality configurable (to manage storage)
- **REQ-706-AC-03**: Photos stored locally until synced
- **REQ-706-AC-04**: Photos attached to work orders, inspections, assets
- **REQ-706-AC-05**: View attached photos in gallery

**US-7.7: Push Notifications**
As a mobile user, I want to receive notifications so that I'm alerted to new assignments and urgent issues.

_Acceptance Criteria:_

- **REQ-707-AC-01**: Push notifications via FCM (Android) and APNs (iOS)
- **REQ-707-AC-02**: Notification when work order assigned
- **REQ-707-AC-03**: Notification for urgent alerts
- **REQ-707-AC-04**: Tap notification opens relevant screen
- **REQ-707-AC-05**: Notification preferences configurable

#### Implementation Tasks

- [ ] Capacitor project setup (Android + iOS)
- [ ] App icon and splash screen
- [ ] IndexedDB schema for offline storage
- [ ] Offline sync composable (useOfflineSync)
- [ ] Hybrid Logical Clock implementation
- [ ] Sync queue management
- [ ] Background sync service worker
- [ ] Conflict resolution logic
- [ ] Capacitor camera integration
- [ ] Photo storage and sync
- [ ] Push notification setup (FCM/APNs)
- [ ] Google Play Store submission
- [ ] Apple App Store submission

#### Test Criteria

- [ ] App installs from both app stores
- [ ] Data available offline after initial sync
- [ ] Offline edits sync when reconnected
- [ ] Conflicts resolved without data loss
- [ ] Photos captured and synced
- [ ] Push notifications received

---

### Feature 8: Operator Logging

**Priority:** High
**Dependencies:** Feature 7 (Mobile Core), Feature 2 (Assets)
**Estimated Effort:** 2 weeks

#### User Stories

**US-8.1: Operator Log-On**
As a vehicle operator, I want to log onto a vehicle by tapping my NFC card or scanning my QR badge so that my shift is recorded.

_Acceptance Criteria:_

- **REQ-801-AC-01**: Tap NFC card/tag or scan QR badge on vehicle tablet
- **REQ-801-AC-02**: System identifies operator from NFC ID or QR code
- **REQ-801-AC-03**: Session created with: operator, vehicle, timestamp, GPS location
- **REQ-801-AC-04**: OBD odometer/hours captured automatically (if connected)
- **REQ-801-AC-05**: Operator name displayed on screen as confirmation
- **REQ-801-AC-06**: Works offline (syncs when connected)
- **REQ-801-AC-07**: Both NFC and QR methods work on all devices

**US-8.2: Operator Log-Off**
As a vehicle operator, I want to log off the vehicle by tapping my NFC card or scanning my QR badge so that my shift end is recorded.

_Acceptance Criteria:_

- **REQ-802-AC-01**: Tap NFC card or scan QR badge to log off
- **REQ-802-AC-02**: Session end timestamp recorded
- **REQ-802-AC-03**: Final odometer/hours captured
- **REQ-802-AC-04**: Trip distance/duration calculated
- **REQ-802-AC-05**: Session closed and synced

**US-8.3: Certification Verification**
As a fleet manager, I want the system to verify operator certifications so that only qualified operators use vehicles.

_Acceptance Criteria:_

- **REQ-803-AC-01**: Operator profile stores certification records
- **REQ-803-AC-02**: Vehicle types require specific certifications
- **REQ-803-AC-03**: On log-on, certifications validated
- **REQ-803-AC-04**: Warning if certification expired or missing
- **REQ-803-AC-05**: Configurable: warn only or block operation
- **REQ-803-AC-06**: Certification expiry alerts for managers

**US-8.4: Operator Session History**
As a fleet manager, I want to see who operated each vehicle and when so that I have a complete audit trail.

_Acceptance Criteria:_

- **REQ-804-AC-01**: View all sessions for a vehicle
- **REQ-804-AC-02**: View all sessions for an operator
- **REQ-804-AC-03**: Filter by date range
- **REQ-804-AC-04**: Session details: start/end time, start/end readings, distance
- **REQ-804-AC-05**: Export session history to CSV

**US-8.5: Shift Handover**
As a vehicle operator, I want to hand over to another operator mid-shift so that we can share vehicles.

_Acceptance Criteria:_

- **REQ-805-AC-01**: Current operator logs off
- **REQ-805-AC-02**: New operator logs on
- **REQ-805-AC-03**: Both sessions linked to same shift if within threshold
- **REQ-805-AC-04**: Clear audit trail of handover

#### Implementation Tasks

- [ ] Operator session database schema
- [ ] Operator log-on API endpoint
- [ ] Operator log-off API endpoint
- [ ] NFC card/tag reading for operator ID
- [ ] QR badge scanning for operator ID
- [ ] Operator QR badge generation
- [ ] Certification schema and validation
- [ ] Certification check on log-on
- [ ] Session history views
- [ ] Offline log-on/log-off with sync
- [ ] OBD odometer capture integration

#### Test Criteria

- [ ] NFC tap creates session
- [ ] QR scan creates session
- [ ] Operator identified correctly via both methods
- [ ] Certification warning displays
- [ ] Session history accurate
- [ ] Offline sessions sync correctly
- [ ] Handover creates linked sessions

---

### Feature 9: Pre-Start Inspections

**Priority:** High
**Dependencies:** Feature 8 (Operator Logging)
**Estimated Effort:** 2-3 weeks

#### User Stories

**US-9.1: Initiate Pre-Start Inspection**
As a vehicle operator, I want to start a pre-start inspection by tapping the vehicle NFC tag or scanning its QR code so that the inspection is linked to the correct vehicle.

_Acceptance Criteria:_

- **REQ-901-AC-01**: Tap vehicle NFC tag or scan vehicle QR code to start inspection
- **REQ-901-AC-02**: Inspection linked to current operator session
- **REQ-901-AC-03**: Correct checklist loaded for vehicle type
- **REQ-901-AC-04**: Timestamp and GPS location recorded
- **REQ-901-AC-05**: Works offline
- **REQ-901-AC-06**: Both NFC and QR methods supported

**US-9.2: Complete Inspection Checklist**
As a vehicle operator, I want to complete the inspection checklist so that I document the vehicle condition.

_Acceptance Criteria:_

- **REQ-902-AC-01**: Checklist items displayed in order
- **REQ-902-AC-02**: Mark each item: Pass, Fail, or N/A
- **REQ-902-AC-03**: Failed items require photo
- **REQ-902-AC-04**: Failed items require comment
- **REQ-902-AC-05**: Progress indicator shows completion
- **REQ-902-AC-06**: Can navigate back to previous items

**US-9.3: Walk-Around NFC/QR Checkpoints**
As a fleet manager, I want operators to scan NFC or QR checkpoints around the vehicle so that I know they physically inspected each area.

_Acceptance Criteria:_

- **REQ-903-AC-01**: Vehicle has multiple NFC tags or QR stickers (front, rear, left, right, engine bay)
- **REQ-903-AC-02**: Inspection requires scanning each checkpoint (NFC tap or QR scan)
- **REQ-903-AC-03**: Checkpoint scan recorded with timestamp
- **REQ-903-AC-04**: Cannot complete inspection without all checkpoints
- **REQ-903-AC-05**: Configurable checkpoints per vehicle type
- **REQ-903-AC-06**: Mix of NFC and QR checkpoints supported on same vehicle

**US-9.4: Inspection Sign-Off**
As a vehicle operator, I want to sign off on my inspection so that I confirm its accuracy.

_Acceptance Criteria:_

- **REQ-904-AC-01**: Digital signature capture
- **REQ-904-AC-02**: Declaration text displayed before signing
- **REQ-904-AC-03**: Signature stored with inspection record
- **REQ-904-AC-04**: Inspection submitted and synced

**US-9.5: Defect Escalation**
As a maintenance supervisor, I want failed inspection items to create work orders so that defects are addressed.

_Acceptance Criteria:_

- **REQ-905-AC-01**: Failed item creates defect record
- **REQ-905-AC-02**: Defect auto-creates work order (configurable)
- **REQ-905-AC-03**: Work order priority based on defect severity
- **REQ-905-AC-04**: Supervisor notified of new defects
- **REQ-905-AC-05**: Defect linked to inspection for traceability

**US-9.6: Vehicle Operation Blocking**
As a fleet manager, I want to block vehicle operation if critical defects are found so that unsafe vehicles aren't used.

_Acceptance Criteria:_

- **REQ-906-AC-01**: Defect severity configurable (minor, major, critical)
- **REQ-906-AC-02**: Critical defects block vehicle operation
- **REQ-906-AC-03**: Operator shown "vehicle not safe" message
- **REQ-906-AC-04**: Block recorded in audit log
- **REQ-906-AC-05**: Supervisor can override block with authorisation

**US-9.7: Inspection History and Compliance**
As a fleet manager, I want to view inspection history and compliance rates so that I can ensure safety standards.

_Acceptance Criteria:_

- **REQ-907-AC-01**: View all inspections for a vehicle
- **REQ-907-AC-02**: View all inspections by an operator
- **REQ-907-AC-03**: Compliance dashboard: % completed on time
- **REQ-907-AC-04**: Defect trends over time
- **REQ-907-AC-05**: Export inspection records

#### Implementation Tasks

- [ ] Inspection database schema
- [ ] Inspection checklist templates
- [ ] Inspection CRUD API
- [ ] NFC-initiated inspection flow
- [ ] QR-initiated inspection flow
- [ ] Checklist UI with pass/fail/NA
- [ ] Photo capture for failures
- [ ] Walk-around checkpoint scanning (NFC and QR)
- [ ] Checkpoint QR code generation
- [ ] Digital signature component
- [ ] Defect creation and escalation
- [ ] Vehicle blocking logic
- [ ] Inspection history views
- [ ] Compliance reporting

#### Test Criteria

- [ ] NFC tap starts inspection for correct vehicle
- [ ] QR scan starts inspection for correct vehicle
- [ ] Checklist items save correctly
- [ ] Failed items require photo
- [ ] Checkpoints work via NFC and QR
- [ ] Signature saves with inspection
- [ ] Defects create work orders
- [ ] Critical defect blocks vehicle

---

### Feature 10: Bluetooth OBD-II Integration

**Priority:** Medium
**Dependencies:** Feature 7 (Mobile Core)
**Estimated Effort:** 3 weeks

#### User Stories

**US-10.1: OBD Dongle Pairing**
As a fleet administrator, I want to pair OBD dongles with tablets so that vehicles can report diagnostics.

_Acceptance Criteria:_

- **REQ-1001-AC-01**: Bluetooth scan discovers nearby OBD dongles
- **REQ-1001-AC-02**: Select dongle to pair
- **REQ-1001-AC-03**: Pairing persists across app restarts
- **REQ-1001-AC-04**: Connection status indicator
- **REQ-1001-AC-05**: Manual disconnect option

**US-10.2: Automatic OBD Connection**
As a vehicle operator, I want the app to connect to the OBD dongle automatically so that I don't have to do it manually.

_Acceptance Criteria:_

- **REQ-1002-AC-01**: App attempts connection to paired dongle on launch
- **REQ-1002-AC-02**: Reconnects automatically if connection lost
- **REQ-1002-AC-03**: Connection status shown in UI
- **REQ-1002-AC-04**: Works with ELM327-compatible dongles

**US-10.3: Read Diagnostic Trouble Codes**
As a field technician, I want to read DTCs from the vehicle so that I can diagnose issues.

_Acceptance Criteria:_

- **REQ-1003-AC-01**: "Read Codes" button fetches current DTCs
- **REQ-1003-AC-02**: DTCs displayed with code and description
- **REQ-1003-AC-03**: Severity indicated (warning, critical)
- **REQ-1003-AC-04**: Codes stored in asset history
- **REQ-1003-AC-05**: Works offline (stored and synced)

**US-10.4: Clear Diagnostic Codes**
As a field technician, I want to clear DTCs after repair so that the warning lights reset.

_Acceptance Criteria:_

- **REQ-1004-AC-01**: "Clear Codes" button available
- **REQ-1004-AC-02**: Requires confirmation
- **REQ-1004-AC-03**: Requires work order reference (for audit)
- **REQ-1004-AC-04**: Clearing logged in asset history

**US-10.5: Live Vehicle Data**
As a field technician, I want to view live vehicle data so that I can diagnose running issues.

_Acceptance Criteria:_

- **REQ-1005-AC-01**: Display: RPM, coolant temp, fuel level, speed, throttle position
- **REQ-1005-AC-02**: Data refreshes in real-time (1-2 second intervals)
- **REQ-1005-AC-03**: Gauges or numeric display
- **REQ-1005-AC-04**: Works while vehicle running

**US-10.6: Automatic Odometer Capture**
As a fleet manager, I want odometer readings captured automatically so that I have accurate usage data.

_Acceptance Criteria:_

- **REQ-1006-AC-01**: Odometer read on operator log-on
- **REQ-1006-AC-02**: Odometer read on operator log-off
- **REQ-1006-AC-03**: Stored with operator session
- **REQ-1006-AC-04**: Used for usage-based maintenance scheduling

**US-10.7: Automatic Work Order from DTC**
As a maintenance supervisor, I want work orders created automatically when a DTC is detected so that issues are addressed promptly.

_Acceptance Criteria:_

- **REQ-1007-AC-01**: DTC detection triggers work order creation (configurable)
- **REQ-1007-AC-02**: Work order includes DTC code and description
- **REQ-1007-AC-03**: Priority based on DTC severity
- **REQ-1007-AC-04**: Duplicate prevention (don't create multiple for same code)

#### Implementation Tasks

- [ ] Bluetooth LE composable (useBluetoothObd)
- [ ] OBD dongle scanning and pairing
- [ ] ELM327 protocol implementation
- [ ] DTC reading and parsing
- [ ] DTC code database (lookup descriptions)
- [ ] DTC clearing
- [ ] Live data PIDs implementation
- [ ] Live data UI component
- [ ] Odometer capture on session start/end
- [ ] DTC-to-work-order automation

#### Test Criteria

- [ ] Dongle discovered and paired
- [ ] Connection persists across restarts
- [ ] DTCs read and displayed correctly
- [ ] Codes cleared successfully
- [ ] Live data displays in real-time
- [ ] Odometer captured accurately
- [ ] Work order created from DTC

---

### Feature 11: Fuel Management

**Priority:** Medium
**Dependencies:** Feature 8 (Operator Logging)
**Estimated Effort:** 2 weeks

#### User Stories

**US-11.1: Record Fuel Transaction**
As a vehicle operator, I want to record when I refuel so that fuel consumption is tracked.

_Acceptance Criteria:_

- **REQ-1101-AC-01**: Enter fuel quantity (litres)
- **REQ-1101-AC-02**: Enter current odometer/hours
- **REQ-1101-AC-03**: Enter cost (optional)
- **REQ-1101-AC-04**: Attach receipt photo
- **REQ-1101-AC-05**: GPS location captured automatically
- **REQ-1101-AC-06**: Timestamp recorded
- **REQ-1101-AC-07**: Transaction linked to current operator session
- **REQ-1101-AC-08**: Works offline

**US-11.2: NFC/QR Fuel Authentication**
As a vehicle operator, I want to authenticate at the fuel bowser with NFC tap or QR scan so that fuel is authorised.

_Acceptance Criteria:_

- **REQ-1102-AC-01**: Tap NFC or scan QR at bowser terminal
- **REQ-1102-AC-02**: System validates operator is logged onto a vehicle
- **REQ-1102-AC-03**: Transaction pre-authorised
- **REQ-1102-AC-04**: Fuel dispensed amount captured (if integrated)
- **REQ-1102-AC-05**: Transaction completed and recorded
- **REQ-1102-AC-06**: Both NFC and QR methods supported

**US-11.3: Fuel Backend Integration**
As a fleet manager, I want fuel transactions synced with our fuel management system so that data is consistent.

_Acceptance Criteria:_

- **REQ-1103-AC-01**: API integration with fuel backend
- **REQ-1103-AC-02**: Transactions synced automatically
- **REQ-1103-AC-03**: Discrepancies flagged for review
- **REQ-1103-AC-04**: Integration health monitoring

**US-11.4: Fuel Consumption Analytics**
As a fleet manager, I want to see fuel consumption per vehicle so that I can identify inefficient vehicles.

_Acceptance Criteria:_

- **REQ-1104-AC-01**: Litres per 100km calculated
- **REQ-1104-AC-02**: Cost per km calculated
- **REQ-1104-AC-03**: Consumption trends over time
- **REQ-1104-AC-04**: Comparison across fleet
- **REQ-1104-AC-05**: Anomaly detection (unusual consumption)

**US-11.5: Fuel Anomaly Alerts**
As a fleet manager, I want alerts for unusual fuel consumption so that I can investigate potential issues.

_Acceptance Criteria:_

- **REQ-1105-AC-01**: Alert if consumption significantly above average
- **REQ-1105-AC-02**: Alert if refuel without corresponding distance
- **REQ-1105-AC-03**: Configurable thresholds
- **REQ-1105-AC-04**: Dashboard widget for anomalies

#### Implementation Tasks

- [ ] Fuel transaction database schema
- [ ] Fuel transaction API
- [ ] Fuel capture form UI
- [ ] NFC bowser authentication flow
- [ ] QR bowser authentication flow
- [ ] Receipt photo attachment
- [ ] Fuel backend API client
- [ ] Consumption calculations
- [ ] Analytics dashboard
- [ ] Anomaly detection logic
- [ ] Alert notifications

#### Test Criteria

- [ ] Transaction recorded with all fields
- [ ] NFC auth validates operator session
- [ ] QR auth validates operator session
- [ ] Offline transactions sync correctly
- [ ] Consumption calculated accurately
- [ ] Anomalies detected and alerted

---

### Feature 12: GPS & Geofencing

**Priority:** Medium
**Dependencies:** Feature 7 (Mobile Core)
**Estimated Effort:** 2 weeks

#### User Stories

**US-12.1: Background Location Tracking**
As a fleet manager, I want vehicle locations tracked continuously so that I know where the fleet is.

_Acceptance Criteria:_

- **REQ-1201-AC-01**: GPS captured at configurable interval (1-60 minutes)
- **REQ-1201-AC-02**: Tracking runs in background when app minimised
- **REQ-1201-AC-03**: Battery-optimised (not constant GPS)
- **REQ-1201-AC-04**: Location stored locally and synced
- **REQ-1201-AC-05**: Tracking only when operator logged on

**US-12.2: Live Fleet Map**
As a fleet manager, I want to see all vehicles on a map so that I can monitor fleet distribution.

_Acceptance Criteria:_

- **REQ-1202-AC-01**: Map shows all vehicles with recent location
- **REQ-1202-AC-02**: Vehicle icon shows status (active, idle, maintenance)
- **REQ-1202-AC-03**: Click vehicle to see details
- **REQ-1202-AC-04**: Filter by status, category
- **REQ-1202-AC-05**: Auto-refresh location data

**US-12.3: Vehicle Route History**
As a fleet manager, I want to view the route history for a vehicle so that I can review where it travelled.

_Acceptance Criteria:_

- **REQ-1203-AC-01**: Select vehicle and date range
- **REQ-1203-AC-02**: Route displayed on map
- **REQ-1203-AC-03**: Timeline shows stops and duration
- **REQ-1203-AC-04**: Playback route animation
- **REQ-1203-AC-05**: Export route data

**US-12.4: Geofence Management**
As a fleet manager, I want to define geofences so that I can monitor when vehicles enter or leave areas.

_Acceptance Criteria:_

- **REQ-1204-AC-01**: Draw geofence on map (polygon or circle)
- **REQ-1204-AC-02**: Name and categorise geofence (depot, job site, restricted)
- **REQ-1204-AC-03**: Set active hours (optional)
- **REQ-1204-AC-04**: Edit and delete geofences
- **REQ-1204-AC-05**: Geofences visible on fleet map

**US-12.5: Geofence Alerts**
As a fleet manager, I want alerts when vehicles enter or leave geofences so that I can monitor compliance.

_Acceptance Criteria:_

- **REQ-1205-AC-01**: Alert on entry (configurable)
- **REQ-1205-AC-02**: Alert on exit (configurable)
- **REQ-1205-AC-03**: Alert for after-hours presence in restricted zone
- **REQ-1205-AC-04**: Notification via push and/or email
- **REQ-1205-AC-05**: Alert history log

**US-12.6: Job Site Time Logging**
As a fleet manager, I want time at job sites logged automatically so that I can track job durations.

_Acceptance Criteria:_

- **REQ-1206-AC-01**: Define job site geofences
- **REQ-1206-AC-02**: Entry/exit times logged automatically
- **REQ-1206-AC-03**: Duration calculated
- **REQ-1206-AC-04**: Report of time at each job site

#### Implementation Tasks

- [ ] Geolocation composable with background tracking
- [ ] Location history database schema
- [ ] Location capture at intervals
- [ ] Fleet map component
- [ ] Route history display
- [ ] Geofence database schema
- [ ] Geofence drawing UI
- [ ] Geofence entry/exit detection
- [ ] Alert generation and notifications
- [ ] Job site time calculation

#### Test Criteria

- [ ] Location captured at correct intervals
- [ ] Background tracking works
- [ ] Map displays vehicle locations
- [ ] Route history accurate
- [ ] Geofence entry/exit detected
- [ ] Alerts generated correctly

---

### Feature 13: Custom Forms

**Priority:** Medium
**Dependencies:** Feature 1 (Foundation)
**Estimated Effort:** 3-4 weeks

#### User Stories

**US-13.1: Form Builder**
As an administrator, I want to create custom forms visually so that I can capture additional data without coding.

_Acceptance Criteria:_

- **REQ-1301-AC-01**: Drag-and-drop form builder
- **REQ-1301-AC-02**: Add/remove/reorder fields
- **REQ-1301-AC-03**: Field types: text, number, date, time, dropdown, multi-select, checkbox, radio, file, photo, signature, location, barcode, calculated, lookup, section header
- **REQ-1301-AC-04**: Configure field: label, placeholder, help text, required
- **REQ-1301-AC-05**: Preview form before publishing

**US-13.2: Form Assignment**
As an administrator, I want to assign forms to modules so that custom data is captured in context.

_Acceptance Criteria:_

- **REQ-1302-AC-01**: Assign form to: assets, work orders, inspections, operators
- **REQ-1302-AC-02**: Multiple forms assignable to one module
- **REQ-1302-AC-03**: Form appears on relevant detail/edit pages
- **REQ-1302-AC-04**: Conditional assignment (e.g., form only for certain asset categories)

**US-13.3: Conditional Logic**
As an administrator, I want to show/hide fields based on answers so that forms are dynamic.

_Acceptance Criteria:_

- **REQ-1303-AC-01**: Define condition: if field X equals Y, show field Z
- **REQ-1303-AC-02**: Multiple conditions supported
- **REQ-1303-AC-03**: Conditions can hide fields or make required
- **REQ-1303-AC-04**: Logic previews in builder

**US-13.4: Form Completion**
As a user, I want to fill out custom forms so that I can provide required information.

_Acceptance Criteria:_

- **REQ-1304-AC-01**: Form renders within parent page
- **REQ-1304-AC-02**: All field types work correctly
- **REQ-1304-AC-03**: Validation on required fields
- **REQ-1304-AC-04**: Auto-save as user types
- **REQ-1304-AC-05**: Works offline (Capacitor)

**US-13.5: Form Data Reporting**
As a fleet manager, I want to report on custom form data so that I can analyse collected information.

_Acceptance Criteria:_

- **REQ-1305-AC-01**: Custom form fields available in report builder
- **REQ-1305-AC-02**: Filter by form field values
- **REQ-1305-AC-03**: Export form responses
- **REQ-1305-AC-04**: Form completion rate metrics

**US-13.6: Form Versioning**
As an administrator, I want to version forms so that changes don't affect historical data.

_Acceptance Criteria:_

- **REQ-1306-AC-01**: New version created on publish
- **REQ-1306-AC-02**: Historical responses linked to version used
- **REQ-1306-AC-03**: View responses by form version
- **REQ-1306-AC-04**: Rollback to previous version

#### Implementation Tasks

- [ ] Form schema database model
- [ ] Form builder Vue component
- [ ] 16+ field type components
- [ ] Field configuration panel
- [ ] Conditional logic engine
- [ ] Form renderer component
- [ ] Form response storage
- [ ] Offline form rendering
- [ ] Form assignment system
- [ ] Form versioning
- [ ] Form analytics

#### Test Criteria

- [ ] All field types render and save correctly
- [ ] Conditional logic shows/hides fields
- [ ] Forms work offline
- [ ] Versioning preserves historical data
- [ ] Form data appears in reports

---

### Feature 14: Reporting & Analytics

**Priority:** Medium
**Dependencies:** Features 2-6 (Core data features)
**Estimated Effort:** 3 weeks

#### User Stories

**US-14.1: Dashboard KPIs**
As a fleet manager, I want to see key metrics on a dashboard so that I have quick visibility into fleet health.

_Acceptance Criteria:_

- **REQ-1401-AC-01**: KPI cards: total assets, active work orders, overdue maintenance, compliance rate
- **REQ-1401-AC-02**: Metrics refresh automatically
- **REQ-1401-AC-03**: Trend indicators (up/down vs. previous period)
- **REQ-1401-AC-04**: Click KPI to drill into details

**US-14.2: Configurable Dashboard**
As a fleet manager, I want to customise my dashboard so that I see the metrics most relevant to me.

_Acceptance Criteria:_

- **REQ-1402-AC-01**: Add/remove dashboard widgets
- **REQ-1402-AC-02**: Drag-and-drop widget arrangement
- **REQ-1402-AC-03**: Widget options (date range, filters)
- **REQ-1402-AC-04**: Save dashboard layout per user

**US-14.3: Asset Utilisation Report**
As a fleet manager, I want to see asset utilisation so that I can identify underused vehicles.

_Acceptance Criteria:_

- **REQ-1403-AC-01**: Usage hours/km per asset
- **REQ-1403-AC-02**: Comparison to fleet average
- **REQ-1403-AC-03**: Filter by category, time period
- **REQ-1403-AC-04**: Identify underutilised assets

**US-14.4: Maintenance Cost Report**
As a fleet manager, I want to see maintenance costs so that I can control expenses.

_Acceptance Criteria:_

- **REQ-1404-AC-01**: Total cost by asset
- **REQ-1404-AC-02**: Cost breakdown: labor vs. parts
- **REQ-1404-AC-03**: Cost trends over time
- **REQ-1404-AC-04**: Cost per km/hour
- **REQ-1404-AC-05**: Comparison to budget

**US-14.5: Technician Performance Report**
As a maintenance supervisor, I want to see technician performance so that I can manage workloads.

_Acceptance Criteria:_

- **REQ-1405-AC-01**: Work orders completed per technician
- **REQ-1405-AC-02**: Average completion time
- **REQ-1405-AC-03**: First-time fix rate
- **REQ-1405-AC-04**: Work order quality score (rework rate)

**US-14.6: Compliance Report**
As a fleet manager, I want to see compliance metrics so that I can ensure regulations are met.

_Acceptance Criteria:_

- **REQ-1406-AC-01**: Pre-start inspection completion rate
- **REQ-1406-AC-02**: Scheduled maintenance compliance
- **REQ-1406-AC-03**: Certification expiry status
- **REQ-1406-AC-04**: Overdue items highlighted

**US-14.7: Custom Report Builder**
As a fleet manager, I want to build custom reports so that I can analyse specific data.

_Acceptance Criteria:_

- **REQ-1407-AC-01**: Select data source (assets, work orders, inspections, etc.)
- **REQ-1407-AC-02**: Choose columns to include
- **REQ-1407-AC-03**: Apply filters
- **REQ-1407-AC-04**: Group and aggregate data
- **REQ-1407-AC-05**: Save report definition
- **REQ-1407-AC-06**: Schedule report email delivery

**US-14.8: Report Export**
As a fleet manager, I want to export reports so that I can share them externally.

_Acceptance Criteria:_

- **REQ-1408-AC-01**: Export to PDF
- **REQ-1408-AC-02**: Export to Excel
- **REQ-1408-AC-03**: Export to CSV
- **REQ-1408-AC-04**: Include charts in PDF export

#### Implementation Tasks

- [ ] Dashboard framework with widget system
- [ ] KPI calculation services
- [ ] Dashboard customisation and persistence
- [ ] Asset utilisation report
- [ ] Maintenance cost report
- [ ] Technician performance report
- [ ] Compliance report
- [ ] Report builder UI
- [ ] Report scheduling (BullMQ)
- [ ] PDF/Excel/CSV export

#### Test Criteria

- [ ] KPIs calculate correctly
- [ ] Dashboard customisation persists
- [ ] Reports display accurate data
- [ ] Custom reports save and run
- [ ] Exports generate correctly

---

### Feature 15: Document Management

**Priority:** Low
**Dependencies:** Feature 2 (Assets)
**Estimated Effort:** 2 weeks

#### User Stories

**US-15.1: Document Upload**
As a fleet manager, I want to upload documents so that I can store important files centrally.

_Acceptance Criteria:_

- **REQ-1501-AC-01**: Upload files up to 50MB
- **REQ-1501-AC-02**: Supported formats: PDF, images, Office documents
- **REQ-1501-AC-03**: Chunked upload for large files
- **REQ-1501-AC-04**: Progress indicator during upload
- **REQ-1501-AC-05**: Drag-and-drop upload

**US-15.2: Document Organisation**
As a fleet manager, I want to organise documents in folders so that I can find them easily.

_Acceptance Criteria:_

- **REQ-1502-AC-01**: Create folders and subfolders
- **REQ-1502-AC-02**: Move documents between folders
- **REQ-1502-AC-03**: Rename documents and folders
- **REQ-1502-AC-04**: Delete documents (with confirmation)

**US-15.3: Document Linking**
As a fleet manager, I want to link documents to assets and work orders so that they're accessible in context.

_Acceptance Criteria:_

- **REQ-1503-AC-01**: Link document to one or more assets
- **REQ-1503-AC-02**: Link document to work orders
- **REQ-1503-AC-03**: Link document to parts
- **REQ-1503-AC-04**: View linked documents on entity detail page

**US-15.4: Document Search**
As a fleet manager, I want to search for documents so that I can find specific files.

_Acceptance Criteria:_

- **REQ-1504-AC-01**: Search by filename
- **REQ-1504-AC-02**: Search by tag/metadata
- **REQ-1504-AC-03**: Full-text search within documents (PDF)
- **REQ-1504-AC-04**: Filter by type, date, linked entity

**US-15.5: Document Versioning**
As a fleet manager, I want to upload new versions of documents so that I keep history while showing current version.

_Acceptance Criteria:_

- **REQ-1505-AC-01**: Upload new version of existing document
- **REQ-1505-AC-02**: Previous versions accessible
- **REQ-1505-AC-03**: Version history with timestamps
- **REQ-1505-AC-04**: Revert to previous version

**US-15.6: Document Expiry**
As a fleet manager, I want to track document expiry dates so that I can renew certifications on time.

_Acceptance Criteria:_

- **REQ-1506-AC-01**: Set expiry date on document
- **REQ-1506-AC-02**: Expiry alerts (30, 14, 7 days before)
- **REQ-1506-AC-03**: Dashboard widget for expiring documents
- **REQ-1506-AC-04**: Expired documents highlighted

#### Implementation Tasks

- [ ] Document database schema
- [ ] PostgreSQL blob storage
- [ ] Chunked upload API
- [ ] Folder structure management
- [ ] Document linking system
- [ ] Search and filtering
- [ ] Document versioning
- [ ] Expiry tracking and alerts
- [ ] Document preview (PDF, images)

#### Test Criteria

- [ ] Large files upload successfully
- [ ] Folder operations work
- [ ] Links display correctly on entities
- [ ] Search returns relevant results
- [ ] Versions maintained correctly
- [ ] Expiry alerts generated

---

### Feature 16: Notifications & Alerts

**Priority:** Medium
**Dependencies:** Feature 1 (Foundation), Feature 7 (Mobile Core)
**Estimated Effort:** 2 weeks

#### User Stories

**US-16.1: In-App Notifications**
As a user, I want to see notifications in the app so that I'm aware of important events.

_Acceptance Criteria:_

- **REQ-1601-AC-01**: Notification bell with unread count
- **REQ-1601-AC-02**: Notification dropdown/panel
- **REQ-1601-AC-03**: Mark notifications as read
- **REQ-1601-AC-04**: Mark all as read
- **REQ-1601-AC-05**: Click notification to navigate to relevant item

**US-16.2: Push Notifications (Mobile)**
As a mobile user, I want push notifications so that I'm alerted even when app is closed.

_Acceptance Criteria:_

- **REQ-1602-AC-01**: Notifications delivered via FCM/APNs
- **REQ-1602-AC-02**: Notification appears in device notification center
- **REQ-1602-AC-03**: Tap notification opens app to relevant screen
- **REQ-1602-AC-04**: Badge count shows unread notifications

**US-16.3: Email Notifications**
As a user, I want email notifications for important events so that I don't miss critical information.

_Acceptance Criteria:_

- **REQ-1603-AC-01**: Email sent for configured events
- **REQ-1603-AC-02**: Email contains relevant details and link
- **REQ-1603-AC-03**: HTML formatted email with branding
- **REQ-1603-AC-04**: Unsubscribe option in email

**US-16.4: Notification Preferences**
As a user, I want to control which notifications I receive so that I'm not overwhelmed.

_Acceptance Criteria:_

- **REQ-1604-AC-01**: Configure notifications per event type
- **REQ-1604-AC-02**: Choose channel: in-app, push, email, or none
- **REQ-1604-AC-03**: Quiet hours setting (no push during X hours)
- **REQ-1604-AC-04**: Preferences saved per user

**US-16.5: Alert Rules**
As a fleet manager, I want to configure custom alert rules so that I'm notified of specific conditions.

_Acceptance Criteria:_

- **REQ-1605-AC-01**: Define condition (e.g., "asset odometer > X")
- **REQ-1605-AC-02**: Define recipients
- **REQ-1605-AC-03**: Define channels (in-app, push, email)
- **REQ-1605-AC-04**: Enable/disable rules
- **REQ-1605-AC-05**: View alert history

#### Implementation Tasks

- [ ] Notification database schema
- [ ] Notification service
- [ ] In-app notification component
- [ ] Push notification integration (FCM/APNs)
- [ ] Email service (SMTP or provider)
- [ ] Email templates
- [ ] Notification preferences UI
- [ ] Alert rules engine
- [ ] Alert rule configuration UI

#### Test Criteria

- [ ] In-app notifications display
- [ ] Push notifications received on mobile
- [ ] Emails delivered correctly
- [ ] Preferences respected
- [ ] Alert rules trigger correctly

---

### Feature 17: Administration

**Priority:** High
**Dependencies:** Feature 1 (Foundation)
**Estimated Effort:** 2 weeks

#### User Stories

**US-17.1: User Management**
As an administrator, I want to manage user accounts so that I control who has access.

_Acceptance Criteria:_

- **REQ-1701-AC-01**: Create users with email, name, role
- **REQ-1701-AC-02**: Edit user details
- **REQ-1701-AC-03**: Deactivate/reactivate users
- **REQ-1701-AC-04**: Reset user password
- **REQ-1701-AC-05**: View user list with search and filters
- **REQ-1701-AC-06**: Last login timestamp displayed

**US-17.2: Role Management**
As an administrator, I want to configure roles and permissions so that access is appropriate.

_Acceptance Criteria:_

- **REQ-1702-AC-01**: View predefined roles
- **REQ-1702-AC-02**: Create custom roles
- **REQ-1702-AC-03**: Assign permissions to roles
- **REQ-1702-AC-04**: Permission matrix UI
- **REQ-1702-AC-05**: Assign multiple roles to user

**US-17.3: Organisation Settings**
As an administrator, I want to configure organisation settings so that the system matches our needs.

_Acceptance Criteria:_

- **REQ-1703-AC-01**: Organisation name and logo
- **REQ-1703-AC-02**: Default timezone
- **REQ-1703-AC-03**: Date/time format preferences
- **REQ-1703-AC-04**: Currency settings
- **REQ-1703-AC-05**: Asset number format configuration

**US-17.4: System Configuration**
As an administrator, I want to configure system settings so that features behave correctly.

_Acceptance Criteria:_

- **REQ-1704-AC-01**: Maintenance scheduling defaults
- **REQ-1704-AC-02**: Approval thresholds
- **REQ-1704-AC-03**: Certification requirements per vehicle type
- **REQ-1704-AC-04**: Pre-start inspection settings
- **REQ-1704-AC-05**: Fuel anomaly thresholds

**US-17.5: Audit Log**
As an administrator, I want to view an audit log so that I can track who changed what.

_Acceptance Criteria:_

- **REQ-1705-AC-01**: All create/update/delete operations logged
- **REQ-1705-AC-02**: Log entry: timestamp, user, action, entity, old/new values
- **REQ-1705-AC-03**: Search and filter audit log
- **REQ-1705-AC-04**: Export audit log
- **REQ-1705-AC-05**: Retention period configurable

**US-17.6: Data Import**
As an administrator, I want to import data from spreadsheets so that I can migrate existing information.

_Acceptance Criteria:_

- **REQ-1706-AC-01**: Download import template
- **REQ-1706-AC-02**: Upload file and preview data
- **REQ-1706-AC-03**: Map columns to fields
- **REQ-1706-AC-04**: Validate data before import
- **REQ-1706-AC-05**: Import with error report

**US-17.7: Data Export**
As an administrator, I want to export data so that I can use it in other systems.

_Acceptance Criteria:_

- **REQ-1707-AC-01**: Export entities to CSV/Excel
- **REQ-1707-AC-02**: Select columns to include
- **REQ-1707-AC-03**: Apply filters before export
- **REQ-1707-AC-04**: Schedule recurring exports

#### Implementation Tasks

- [ ] User management UI
- [ ] Role and permission management
- [ ] Organisation settings UI
- [ ] System configuration UI
- [ ] Audit log schema and service
- [ ] Audit log viewer
- [ ] Import wizard
- [ ] Export functionality

#### Test Criteria

- [ ] User CRUD operations work
- [ ] Role permissions enforced
- [ ] Settings changes take effect
- [ ] Audit log captures all changes
- [ ] Import validates and creates records
- [ ] Export generates correct files

---

### Feature 18: Production Readiness

**Priority:** Critical (Final)
**Dependencies:** All previous features
**Estimated Effort:** 3-4 weeks

#### User Stories

**US-18.1: Performance Optimisation**
As a user, I want the system to respond quickly so that I can work efficiently.

_Acceptance Criteria:_

- **REQ-1801-AC-01**: API responses <200ms (95th percentile)
- **REQ-1801-AC-02**: Page load <2 seconds
- **REQ-1801-AC-03**: Database queries <100ms
- **REQ-1801-AC-04**: No memory leaks after extended use

**US-18.2: Security Hardening**
As an administrator, I want the system to be secure so that data is protected.

_Acceptance Criteria:_

- **REQ-1802-AC-01**: Penetration test completed with no critical findings
- **REQ-1802-AC-02**: All data encrypted in transit (TLS 1.3)
- **REQ-1802-AC-03**: Sensitive data encrypted at rest
- **REQ-1802-AC-04**: SQL injection prevention verified
- **REQ-1802-AC-05**: XSS prevention verified
- **REQ-1802-AC-06**: CSRF protection enabled
- **REQ-1802-AC-07**: Rate limiting configured

**US-18.3: High Availability**
As a user, I want the system to be available 99.9% of the time so that I can rely on it.

_Acceptance Criteria:_

- **REQ-1803-AC-01**: Multiple application instances behind load balancer
- **REQ-1803-AC-02**: Database replication configured
- **REQ-1803-AC-03**: Automatic failover tested
- **REQ-1803-AC-04**: Health checks and auto-restart

**US-18.4: Disaster Recovery**
As an administrator, I want backup and recovery procedures so that data can be restored.

_Acceptance Criteria:_

- **REQ-1804-AC-01**: Daily automated backups
- **REQ-1804-AC-02**: Point-in-time recovery capability
- **REQ-1804-AC-03**: Backup restoration tested
- **REQ-1804-AC-04**: RTO <4 hours, RPO <15 minutes
- **REQ-1804-AC-05**: Disaster recovery runbook documented

**US-18.5: Monitoring and Alerting**
As an administrator, I want system monitoring so that I'm alerted to issues.

_Acceptance Criteria:_

- **REQ-1805-AC-01**: Application performance monitoring (APM)
- **REQ-1805-AC-02**: Error tracking and alerting
- **REQ-1805-AC-03**: Infrastructure monitoring (CPU, memory, disk)
- **REQ-1805-AC-04**: Log aggregation and search
- **REQ-1805-AC-05**: Alert escalation procedures

**US-18.6: Documentation**
As a user, I want documentation so that I can learn how to use the system.

_Acceptance Criteria:_

- **REQ-1806-AC-01**: User guide covering all features
- **REQ-1806-AC-02**: Administrator guide
- **REQ-1806-AC-03**: API documentation
- **REQ-1806-AC-04**: Training videos for key workflows
- **REQ-1806-AC-05**: Release notes for each version

#### Implementation Tasks

- [ ] Database query optimisation and indexing
- [ ] Caching strategy refinement
- [ ] Frontend bundle optimisation
- [ ] Security code review
- [ ] Penetration testing
- [ ] Load testing (500+ concurrent users)
- [ ] High availability configuration
- [ ] Database replication setup
- [ ] Backup and restore procedures
- [ ] Monitoring and alerting setup
- [ ] Log aggregation
- [ ] User documentation
- [ ] Admin documentation
- [ ] API documentation
- [ ] Training materials

#### Test Criteria

- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Failover tested successfully
- [ ] Backup restoration verified
- [ ] Documentation reviewed and complete

---

## Implementation Sequence

Features can be developed in parallel by separate teams where dependencies allow. Recommended sequence:

```
Week 1-4:   Feature 1 (Foundation) ─────────────────────────────────────────►
Week 3-6:   Feature 2 (Assets) ──────────────────────────►
Week 5-7:   Feature 3 (Tasks) ────────────►
Week 5-8:   Feature 6 (Inventory) ─────────────────►
Week 7-10:  Feature 4 (Work Orders) ─────────────────────►
Week 9-11:  Feature 5 (Scheduling) ────────────►
Week 4-7:   Feature 7 (Mobile Core) ─────────────────────►
Week 7-9:   Feature 8 (Operator Logging) ────────────►
Week 9-12:  Feature 9 (Pre-Start) ─────────────────►
Week 10-13: Feature 10 (OBD) ─────────────────────►
Week 11-13: Feature 11 (Fuel) ────────────►
Week 11-13: Feature 12 (GPS) ────────────►
Week 8-12:  Feature 13 (Custom Forms) ─────────────────────►
Week 12-15: Feature 14 (Reporting) ─────────────────►
Week 13-15: Feature 15 (Documents) ────────────►
Week 10-12: Feature 16 (Notifications) ────────────►
Week 6-8:   Feature 17 (Administration) ────────────►
Week 15-19: Feature 18 (Production Readiness) ─────────────────────►
```

**Total Duration:** ~19 weeks (approximately 5 months)

Each feature includes its own test criteria and can be released incrementally as features complete.

---

## Assumptions & Constraints

### Technical Assumptions

1. **Nuxt 4 Maturity**: Nuxt 4 and Vue 3 ecosystem is mature and stable for enterprise use
2. **Bun Compatibility**: Bun runtime is compatible with all required dependencies
3. **Browser Support**: Modern browsers will maintain PWA support and web APIs
4. **Network Infrastructure**: Customer internet connectivity is adequate for PWA sync (minimum 3G)
5. **PostgreSQL Scalability**: PostgreSQL can handle projected data volumes (up to 10,000 assets per customer)

### Project Constraints

#### Technical Constraints

1. **Technology Stack Mandate**: Must use Nuxt 4, Vue 3, Nuxt UI v4, Capacitor, PostgreSQL, and Redis
2. **Browser Compatibility**: Desktop web app supports Chrome, Firefox, Safari, Edge (latest 2 versions)
3. **Mobile Platforms**: Android 10+ and iOS 14+ via Capacitor native app
4. **Database**: PostgreSQL required for all data storage, including documents
5. **Authentication**: Session-based authentication with JWT tokens
6. **App Distribution**: Google Play Store and Apple App Store

#### Resource Constraints

1. **Budget Limit**: Maximum $1.7M development budget (excluding contingency)
2. **Timeline**: Must launch within 12 months
3. **Team Size**: Maximum 16 concurrent developers
4. **Infrastructure**: Cloud-first deployment (AWS/Azure/GCP)

#### Design Constraints

1. **Mobile-First**: PWA must work excellently on mobile devices
2. **Offline-First**: PWA must function completely offline
3. **Accessibility**: Must meet WCAG 2.1 AA standards
4. **Performance**: Page load times under 2 seconds, API responses under 200ms
5. **Security**: Must implement enterprise-grade security (encryption, audit logs, RBAC)

---

## Glossary

**API (Application Programming Interface)**: A set of protocols and tools that allow different software applications to communicate with each other.

**Asset**: Any item of value owned by an organization, typically vehicles, equipment, or machinery in the context of fleet management.

**Bluetooth LE (Low Energy)**: A wireless technology designed for short-range communication with low power consumption, used for connecting to OBD-II dongles and other peripheral devices.

**Bun**: A fast JavaScript runtime, bundler, test runner, and package manager designed as a drop-in replacement for Node.js.

**BullMQ**: A Redis-based queue system for handling background jobs and message processing in Node.js/Bun applications.

**Capacitor**: A cross-platform native runtime that allows web apps to run natively on iOS, Android, and web. Provides access to native device APIs through a plugin system while preserving the web codebase.

**Composable**: A function that leverages Vue 3's Composition API to encapsulate and reuse stateful logic across components.

**Drizzle ORM**: A TypeScript ORM that provides type-safe database access with a SQL-like query builder.

**DTC (Diagnostic Trouble Code)**: Standardised codes generated by a vehicle's on-board diagnostics system to indicate specific faults or malfunctions.

**ELM327**: A microcontroller chip that translates the OBD-II interface to a standard serial interface (RS-232, Bluetooth, WiFi), commonly used in OBD-II scan tools and dongles.

**Geofence**: A virtual perimeter defined around a geographic area, used to trigger alerts or actions when a device enters or exits the boundary.

**HLC (Hybrid Logical Clock)**: A logical clock implementation that combines physical time with logical counters to provide a total ordering of events in distributed systems.

**IndexedDB**: Low-level API for client-side storage of large amounts of structured data, including files and blobs.

**NFC (Near Field Communication)**: Short-range wireless technology enabling contactless data exchange between devices. Used in Fleet for instant asset identification via NFC tags attached to equipment.

**Nitro**: The server engine that powers Nuxt, providing a universal deployment target for various hosting platforms.

**Nuxt 4**: A Vue.js meta-framework that provides server-side rendering, file-based routing, and full-stack capabilities.

**Nuxt UI**: A comprehensive UI library providing 100+ Vue components built with Tailwind CSS for Nuxt applications.

**OBD-II (On-Board Diagnostics II)**: A standardised vehicle diagnostic system that provides access to vehicle health data, fault codes, and real-time parameters through a standard connector.

**Operator Session**: A logged period during which an operator is assigned to and operating a specific vehicle, tracked from log-on to log-off.

**Pinia**: The official state management solution for Vue 3, providing a simple and type-safe store pattern.

**Pre-Start Inspection**: A systematic check of a vehicle's condition performed by the operator before commencing work, typically required for compliance and safety.

**PWA (Progressive Web App)**: Web applications that use modern web capabilities to deliver an app-like experience to users, including offline functionality.

**Redis**: An in-memory data store used for caching, session management, and message queuing.

**Service Worker**: Script that runs in the background of a web browser, enabling features like offline functionality and push notifications.

**VeeValidate**: A form validation library for Vue.js that integrates with validation schemas like Zod.

**Vue 3**: A progressive JavaScript framework for building user interfaces with a reactive and composable architecture.

**Walk-Around Inspection**: A physical inspection requiring the operator to move around the vehicle and check multiple points, verified via NFC tags or QR code checkpoints.

**Zod**: A TypeScript-first schema validation library used for runtime type checking and form validation.

---

**Document Information**

- **Source**: Fleet PRD (Refactored for Nuxt Stack with Capacitor and Operator Workflows)
- **Version**: 2.2
- **Last Updated**: December 2025
- **Technology Stack**: Nuxt 4, Vue 3, Nuxt UI v4, Capacitor, Bun, PostgreSQL, Redis, Drizzle ORM
