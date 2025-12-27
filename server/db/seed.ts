import { hash } from '@node-rs/argon2'
import { db, schema } from '../utils/db'
import { DEFAULT_ROLE_PERMISSIONS, ROLES, type RoleName } from './schema/roles'

async function seed() {
  console.log('🌱 Starting database seed...')

  try {
    // Create default roles
    console.log('Creating roles...')
    const roleData = Object.entries(ROLES).map(([key, name]) => ({
      name,
      displayName: key
        .split('_')
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' '),
      description: `${key
        .split('_')
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ')} role`,
      permissions: DEFAULT_ROLE_PERMISSIONS[name as RoleName],
    }))

    const insertedRoles = await db
      .insert(schema.roles)
      .values(roleData)
      .onConflictDoNothing()
      .returning()

    console.log(`✓ Created ${insertedRoles.length} roles`)

    // Get admin role for the demo user
    const adminRole = await db.query.roles.findFirst({
      where: (roles, { eq }) => eq(roles.name, ROLES.ADMIN),
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
        primaryColor: '#0066cc',
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
        parallelism: 1,
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
          isActive: true,
        })
        .onConflictDoNothing()
        .returning()

      if (demoUser) {
        console.log(`✓ Created demo user: ${demoUser.email}`)
        console.log('  Password: admin123')
      }

      // Create asset categories
      console.log('Creating asset categories...')
      const categoryData = [
        { name: 'Trucks', description: 'Heavy duty trucks and semi-trailers' },
        { name: 'Vans', description: 'Delivery vans and cargo vehicles' },
        { name: 'Cars', description: 'Passenger vehicles' },
        { name: 'Equipment', description: 'Machinery and equipment' },
      ]

      const insertedCategories = await db
        .insert(schema.assetCategories)
        .values(categoryData.map((c) => ({ ...c, organisationId: demoOrg.id })))
        .onConflictDoNothing()
        .returning()

      console.log(`✓ Created ${insertedCategories.length} asset categories`)

      // Create sample assets
      console.log('Creating sample assets...')
      const trucksCategory = insertedCategories.find((c) => c.name === 'Trucks')
      const vansCategory = insertedCategories.find((c) => c.name === 'Vans')
      const carsCategory = insertedCategories.find((c) => c.name === 'Cars')

      const assetData = [
        {
          assetNumber: 'FLT-0001',
          make: 'Toyota',
          model: 'Hilux',
          year: 2023,
          vin: '1HGBH41JXMN109186',
          licensePlate: 'ABC-123',
          mileage: '45000',
          operationalHours: '1200',
          status: 'active' as const,
          categoryId: trucksCategory?.id,
          description: 'Primary delivery truck',
        },
        {
          assetNumber: 'FLT-0002',
          make: 'Ford',
          model: 'Transit',
          year: 2022,
          vin: '2FMDK3GC5DBA12345',
          licensePlate: 'DEF-456',
          mileage: '62000',
          operationalHours: '1800',
          status: 'active' as const,
          categoryId: vansCategory?.id,
          description: 'Cargo van for city deliveries',
        },
        {
          assetNumber: 'FLT-0003',
          make: 'Mercedes-Benz',
          model: 'Sprinter',
          year: 2021,
          vin: 'WDAPF4CC4F9123456',
          licensePlate: 'GHI-789',
          mileage: '78000',
          operationalHours: '2100',
          status: 'maintenance' as const,
          categoryId: vansCategory?.id,
          description: 'Large capacity delivery van - scheduled for service',
        },
        {
          assetNumber: 'FLT-0004',
          make: 'Volkswagen',
          model: 'Amarok',
          year: 2024,
          vin: 'WVWZZZ3CZWE123456',
          licensePlate: 'JKL-012',
          mileage: '12000',
          operationalHours: '350',
          status: 'active' as const,
          categoryId: trucksCategory?.id,
          description: 'New fleet addition',
        },
        {
          assetNumber: 'FLT-0005',
          make: 'Toyota',
          model: 'Camry',
          year: 2023,
          vin: '4T1BF1FK5CU123456',
          licensePlate: 'MNO-345',
          mileage: '28000',
          operationalHours: '800',
          status: 'active' as const,
          categoryId: carsCategory?.id,
          description: 'Executive vehicle',
        },
      ]

      const insertedAssets = await db
        .insert(schema.assets)
        .values(assetData.map((a) => ({ ...a, organisationId: demoOrg.id })))
        .onConflictDoNothing()
        .returning()

      console.log(`✓ Created ${insertedAssets.length} sample assets`)
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
