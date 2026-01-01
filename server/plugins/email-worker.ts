import type { NitroApp } from 'nitropack'
import { type EmailTemplate, isEmailConfigured, sendEmail } from '../utils/email-service'
import { createWorker, type EmailJobData } from '../utils/queue'

let emailWorker: ReturnType<typeof createWorker<EmailJobData>> | null = null

export default defineNitroPlugin((nitroApp: NitroApp) => {
  // Only start worker in server context (not during build)
  if (process.env.NODE_ENV === 'test') {
    console.log('Email worker: Skipping in test environment')
    return
  }

  if (!isEmailConfigured()) {
    console.warn('Email worker: NUXT_RESEND_API_KEY not configured, email worker disabled')
    return
  }

  console.log('Email worker: Starting...')

  emailWorker = createWorker<EmailJobData>('email', async (job) => {
    console.log(`Email worker: Processing job ${job.id} - ${job.data.template}`)

    try {
      const result = await sendEmail({
        to: job.data.to,
        subject: job.data.subject,
        template: job.data.template as EmailTemplate,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: job.data.data as any,
      })

      if (!result.success) {
        console.error(`Email worker: Job ${job.id} failed:`, result.error)
        throw new Error(result.error || 'Email send failed')
      }

      console.log(`Email worker: Job ${job.id} completed, messageId: ${result.messageId}`)
      return result
    } catch (error) {
      console.error(`Email worker: Job ${job.id} error:`, error)
      throw error
    }
  })

  // Handle worker events
  emailWorker.on('completed', (job) => {
    console.log(`Email worker: Job ${job.id} completed successfully`)
  })

  emailWorker.on('failed', (job, error) => {
    console.error(`Email worker: Job ${job?.id} failed after all retries:`, error.message)
  })

  emailWorker.on('error', (error) => {
    console.error('Email worker: Worker error:', error)
  })

  // Graceful shutdown
  nitroApp.hooks.hook('close', async () => {
    if (emailWorker) {
      console.log('Email worker: Shutting down...')
      await emailWorker.close()
      emailWorker = null
    }
  })

  console.log('Email worker: Started successfully')
})
