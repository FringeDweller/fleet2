import { z } from 'zod'
import { resetPasswordWithToken } from '../../utils/auth'

const resetPasswordSchema = z.object({
  token: z.string().uuid('Invalid token format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Validate input
  const result = resetPasswordSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  const { token, password } = result.data

  // Reset password
  const success = await resetPasswordWithToken(token, password)

  if (!success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or expired reset token'
    })
  }

  return {
    success: true,
    message: 'Password reset successfully'
  }
})
