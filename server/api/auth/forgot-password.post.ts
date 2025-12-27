import { z } from 'zod'
import { generatePasswordResetToken } from '../../utils/auth'
import { jobs } from '../../utils/queue'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format')
})

export default defineEventHandler(async event => {
  const body = await readBody(event)

  // Validate input
  const result = forgotPasswordSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: result.error.flatten()
    })
  }

  const { email } = result.data

  // Generate reset token
  const token = await generatePasswordResetToken(email)

  // Always return success to prevent email enumeration
  // If token was generated, queue the email
  if (token) {
    const resetUrl = `${process.env.NUXT_PUBLIC_SITE_URL}/auth/reset-password?token=${token}`

    await jobs.sendEmail({
      to: email,
      subject: 'Reset your Fleet password',
      template: 'password-reset',
      data: { resetUrl }
    })
  }

  return {
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent'
  }
})
