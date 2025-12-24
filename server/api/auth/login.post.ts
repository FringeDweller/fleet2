import { z } from 'zod'
import { authenticateUser } from '../../utils/auth'

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Validate input
  const result = loginSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  const { email, password } = result.data

  // Authenticate user
  const authResult = await authenticateUser(email, password)

  if (!authResult.success) {
    throw createError({
      statusCode: 401,
      statusMessage: authResult.error || 'Authentication failed',
      data: {
        isLocked: authResult.isLocked,
        remainingAttempts: authResult.remainingAttempts
      }
    })
  }

  // Set session using nuxt-auth-utils
  await setUserSession(event, {
    user: authResult.user!,
    loggedInAt: new Date().toISOString()
  })

  return {
    success: true,
    user: authResult.user
  }
})
