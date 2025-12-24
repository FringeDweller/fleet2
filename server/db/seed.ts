import { db, schema } from '../utils/db'
import { hash } from '@node-rs/argon2'
import { ROLES, DEFAULT_ROLE_PERMISSIONS, type RoleName } from './schema/roles'

async function seed() {
  console.log('🌱 Starting database seed...')

  try {
    // Create default roles
    console.log('Creating roles...')
    const roleData = Object.entries(ROLES).map(([key, name]) => ({
      name,
      displayName: key
        .split('_')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' '),
      description: `${key.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')} role`,
      permissions: DEFAULT_ROLE_PERMISSIONS[name as RoleName]
    }))

    const insertedRoles = await db
      .insert(schema.roles)
      .values(roleData)
      .onConflictDoNothing()
      .returning()

    console.log(`✓ Created ${insertedRoles.length} roles`)

    // Get admin role for the demo user
    const adminRole = await db.query.roles.findFirst({
      where: (roles, { eq }) => eq(roles.name, ROLES.ADMIN)
    })

    if (!adminRole) {
      throw new Error('Admin role not found')
    }

    // Create demo organisation
    console.log('Creating demo organisation...')
    const [demoOrg] = await db
      .insert(schema.organisations)
      .values({
        name: 'Demo Fleet Company',
        slug: 'demo-fleet',
        description: 'A demo organisation for testing Fleet',
        primaryColor: '#0066cc'
      })
      .onConflictDoNothing()
      .returning()

    if (demoOrg) {
      console.log(`✓ Created organisation: ${demoOrg.name}`)

      // Create demo admin user
      console.log('Creating demo admin user...')
      const passwordHash = await hash('admin123', {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1
      })

      const [demoUser] = await db
        .insert(schema.users)
        .values({
          organisationId: demoOrg.id,
          roleId: adminRole.id,
          email: 'admin@demo.fleet.local',
          passwordHash,
          firstName: 'Admin',
          lastName: 'User',
          emailVerified: true,
          isActive: true
        })
        .onConflictDoNothing()
        .returning()

      if (demoUser) {
        console.log(`✓ Created demo user: ${demoUser.email}`)
        console.log('  Password: admin123')
      }
    }

    console.log('\n✅ Database seed completed successfully!')
    console.log('\nDemo credentials:')
    console.log('  Email: admin@demo.fleet.local')
    console.log('  Password: admin123')
  } catch (error) {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

seed()
