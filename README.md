# Fleet2

A comprehensive fleet management system for tracking vehicles, equipment, maintenance, and operations.

## Features

- **Asset Management** - Track vehicles and equipment with full lifecycle management
- **Work Orders** - Create, assign, and track maintenance tasks with approval workflows
- **Inspections** - Pre-trip, post-trip, and periodic inspections with defect tracking
- **Inventory** - Parts management with stock tracking and reorder alerts
- **Fleet Tracking** - Real-time location tracking with route history
- **Fuel Management** - Track fuel consumption with anomaly detection
- **Custom Forms** - Build custom data collection forms with conditional logic
- **Mobile Apps** - iOS and Android apps with offline support

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) 1.0+
- [PostgreSQL](https://postgresql.org) 15+
- [Node.js](https://nodejs.org) 20+ (for some tooling)

### Installation

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
   # Edit .env with your database URL and secrets
   ```

4. **Set up database**

   ```bash
   # Create database
   createdb fleet

   # Run migrations
   bun run db:migrate

   # Seed initial data (optional)
   bun run db:seed
   ```

5. **Start development server**

   ```bash
   bun run dev
   ```

6. **Open in browser**

   Navigate to `http://localhost:3000`

## Project Structure

```
fleet2/
├── app/                    # Nuxt application
│   ├── components/         # Vue components
│   ├── composables/        # Vue composables
│   ├── layouts/            # Page layouts
│   ├── pages/              # File-based routing
│   └── assets/             # CSS and static assets
├── server/                 # Server-side code
│   ├── api/                # API routes
│   ├── db/                 # Database schema and migrations
│   └── utils/              # Server utilities
├── docs/                   # Documentation
├── tests/                  # Test files
└── public/                 # Static files
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run preview` | Preview production build |
| `bun run test` | Run unit tests |
| `bun run test:e2e` | Run end-to-end tests |
| `bun run lint` | Run linter |
| `bun run lint:fix` | Fix lint issues |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run db:generate` | Generate database migrations |
| `bun run db:migrate` | Run database migrations |
| `bun run db:studio` | Open Drizzle Studio |

## Tech Stack

- **Framework**: [Nuxt 4](https://nuxt.com) with Vue 3
- **Database**: [PostgreSQL](https://postgresql.org) with [Drizzle ORM](https://orm.drizzle.team)
- **UI Components**: [Nuxt UI](https://ui.nuxt.com)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **Authentication**: [nuxt-auth-utils](https://github.com/atinux/nuxt-auth-utils)
- **Validation**: [Zod](https://zod.dev)
- **Testing**: [Vitest](https://vitest.dev) + [Playwright](https://playwright.dev)
- **Linting**: [Biome](https://biomejs.dev)
- **Mobile**: [Capacitor](https://capacitorjs.com)

## Documentation

- [User Guide](./docs/user-guide.md) - End user documentation
- [Admin Guide](./docs/admin-guide.md) - System administration guide
- [API Documentation](./docs/api-documentation.md) - REST API reference
- [Release Notes](./docs/release-notes.md) - Version history and changelog
- [Backup Configuration](./docs/backup-configuration.md) - Backup setup guide
- [Capacitor Setup](./docs/CAPACITOR_SETUP.md) - Mobile app build guide

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NUXT_DATABASE_URL` | PostgreSQL connection string | Yes |
| `NUXT_SESSION_SECRET` | Session encryption secret (32+ chars) | Yes |
| `NUXT_REDIS_URL` | Redis connection for job queues | No |
| `NUXT_PUBLIC_APP_NAME` | Application display name | No |

See [.env.example](./.env.example) for all available options.

## Mobile Apps

Fleet2 includes native mobile apps built with Capacitor.

### Building Mobile Apps

```bash
# Build web app
bun run build

# Sync to native platforms
bun run cap:sync

# Open in Android Studio
bun run cap:android

# Open in Xcode (macOS only)
bun run cap:ios
```

See [Capacitor Setup](./docs/CAPACITOR_SETUP.md) for detailed instructions.

## Development

### Running Tests

```bash
# Unit tests
bun run test

# Watch mode
bun run test:watch

# With coverage
bun run test:coverage

# E2E tests
bun run test:e2e
```

### Code Quality

```bash
# Lint code
bun run lint

# Fix lint issues
bun run lint:fix

# Format code
bun run format

# Type check
bun run typecheck
```

### Database Development

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations
bun run db:migrate

# Push schema directly (development only)
bun run db:push

# Open database GUI
bun run db:studio
```

## Deployment

See the [Admin Guide](./docs/admin-guide.md) for deployment instructions including:

- Docker deployment
- Manual deployment with PM2
- Nginx reverse proxy configuration
- SSL/TLS setup
- Production environment configuration

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`bun run test`)
5. Run linter (`bun run lint`)
6. Commit your changes (`git commit -m 'feat: add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `refactor:` - Code refactoring
- `test:` - Test additions/changes

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Support

- Check the [documentation](./docs/)
- Search existing [issues](https://github.com/your-org/fleet2/issues)
- Open a new issue for bugs or feature requests
