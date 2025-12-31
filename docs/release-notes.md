# Fleet2 Release Notes

This document contains release notes for Fleet2 fleet management system.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Feature development in progress

### Changed
- Ongoing improvements

### Fixed
- Bug fixes in progress

---

## [1.0.0] - 2024-XX-XX

Initial release of Fleet2 fleet management system.

### Features

#### Asset Management
- Complete vehicle and equipment lifecycle management
- Asset categorization with hierarchical categories
- QR code and NFC tag enrollment for quick identification
- Document management with version tracking
- Asset location tracking and history
- Compatible parts assignment per asset and category

#### Work Order Management
- Full work order lifecycle (Draft, Pending Approval, Open, In Progress, Completed, Closed)
- Priority levels (Low, Medium, High, Critical)
- Task templates for common maintenance procedures
- Checklist items with completion tracking
- Parts usage tracking with automatic inventory deduction
- Photo documentation support
- Status history and audit trail
- Approval workflow for high-value work orders
- Kanban board view for visual workflow management
- Calendar view for scheduling
- Assignment to technicians with workload visibility

#### Inspection System
- Pre-trip and post-trip inspections
- Customizable inspection templates
- Checkpoint-based inspection items
- Pass/Fail/N/A responses with notes
- Photo capture for failed items
- Digital signature capture
- Automatic defect creation from failed items
- Compliance tracking and reporting
- Inspection history per asset

#### Inventory Management
- Parts catalog with SKU management
- Stock quantity tracking
- Multiple storage locations
- Reorder threshold alerts
- Stock movement history
- Inventory count sessions
- Parts compatibility mapping
- Usage history tracking
- Low stock dashboard widget

#### Fleet Tracking
- Live map view with asset positions
- Route history playback
- Geofence management and alerts
- Operator session tracking (log on/log off)
- Job site visit logging

#### Fuel Management
- Fuel transaction recording
- Fuel consumption analytics
- MPG/L per 100km tracking
- Anomaly detection for unusual consumption
- Fuel cost tracking per asset

#### Custom Forms
- Drag-and-drop form builder
- Multiple field types (text, number, dropdown, date, signature, photo, etc.)
- Conditional logic (show/hide fields based on responses)
- Form versioning
- Form assignments to assets, work orders, or inspections
- Response analytics and export
- Calculated fields with formulas

#### Notifications
- In-app notification center
- Real-time notifications for:
  - Work order assignments
  - Approval requests
  - Inspection due reminders
  - Low stock alerts
  - Defect creation
  - Status changes
- Mark as read functionality
- Notification preferences per user

#### User Management
- Role-based access control (Admin, Manager, Technician, Operator, Viewer)
- Organisation/team management
- User invitation workflow
- Password reset functionality
- Account lockout protection

#### Mobile Support
- Responsive web design
- Capacitor-based native apps for iOS and Android
- Offline inspection completion
- QR/NFC scanning
- Data sync queue for offline changes

### Technical Features

- Nuxt 4 with Vue 3 framework
- PostgreSQL database with Drizzle ORM
- Type-safe API with Zod validation
- Session-based authentication with Argon2 password hashing
- Automated backup system with S3-compatible storage
- Real-time updates

---

## Version History Template

Use this template for future releases:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features added in this release

### Changed
- Changes to existing functionality

### Deprecated
- Features that will be removed in future versions

### Removed
- Features removed in this release

### Fixed
- Bug fixes

### Security
- Security-related changes

### Breaking Changes
- Changes that require migration or updates

### Migration Instructions
1. Step-by-step migration guide
2. Database migration commands
3. Configuration changes required
```

---

## Breaking Changes Policy

### Versioning

Fleet2 follows semantic versioning:

- **Major (X.0.0)**: Breaking changes that require migration
- **Minor (0.X.0)**: New features, backward compatible
- **Patch (0.0.X)**: Bug fixes, backward compatible

### Deprecation Process

1. Feature marked as deprecated in minor release
2. Deprecation warning displayed for at least one minor release cycle
3. Feature removed in next major release

### API Stability

- API endpoints may be added in minor releases
- API endpoints may be modified (backward compatible) in minor releases
- API endpoints may be removed only in major releases with prior deprecation

---

## Upgrade Instructions

### General Upgrade Process

1. **Backup your database**

   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
   ```

2. **Review release notes for breaking changes**

3. **Update the application**

   ```bash
   git pull origin main
   bun install
   ```

4. **Run database migrations**

   ```bash
   bun run db:migrate
   ```

5. **Restart the application**

   ```bash
   pm2 restart fleet2
   ```

6. **Verify the upgrade**

   - Check application logs for errors
   - Verify key functionality works
   - Monitor performance

### Rollback Procedure

If issues occur after upgrade:

1. **Stop the application**

   ```bash
   pm2 stop fleet2
   ```

2. **Restore the database backup**

   ```bash
   dropdb fleet
   createdb fleet
   psql fleet < backup_YYYYMMDD.sql
   ```

3. **Checkout previous version**

   ```bash
   git checkout v1.0.0  # Previous version tag
   bun install
   ```

4. **Restart the application**

   ```bash
   pm2 start fleet2
   ```

---

## Known Issues

### Current Known Issues

| Issue | Description | Workaround | Status |
|-------|-------------|------------|--------|
| - | No known issues at this time | - | - |

### Reporting Issues

To report a bug:

1. Check existing issues on GitHub
2. Create a new issue with:
   - Fleet2 version
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/logs if applicable
3. Use the bug report template

---

## Support Policy

### Supported Versions

| Version | Support Status | End of Support |
|---------|---------------|----------------|
| 1.0.x | Active | TBD |

### Long-Term Support (LTS)

- LTS versions receive security updates for 12 months after the next major release
- Bug fixes for 6 months after the next major release

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on:

- Reporting bugs
- Requesting features
- Submitting pull requests
- Code style and standards

---

## Acknowledgments

Fleet2 is built with:

- [Nuxt](https://nuxt.com) - Vue framework
- [Nuxt UI](https://ui.nuxt.com) - Component library
- [Drizzle ORM](https://orm.drizzle.team) - Database ORM
- [PostgreSQL](https://postgresql.org) - Database
- [Capacitor](https://capacitorjs.com) - Native mobile apps
- [Vitest](https://vitest.dev) - Testing framework
- [Biome](https://biomejs.dev) - Linting and formatting
