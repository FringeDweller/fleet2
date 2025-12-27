# Fleet2 Project Instructions

## Package Manager
- Use `bun` for all JavaScript/TypeScript package management (not pnpm/npm/yarn)
- Commands: `bun install`, `bun run dev`, `bun test`, `bun run build`

## Tech Stack
- Nuxt 4 with Vue 3
- Drizzle ORM with PostgreSQL
- TypeScript (strict mode)
- Biome for linting/formatting
- Vitest for testing

## Database
- Run migrations with `bun run db:migrate`
- Generate migrations with `bun run db:generate`

## Development
- Dev server: `bun run dev`
- Type check: `bun run typecheck`
- Lint: `bun run lint`
- Test: `bun test`
