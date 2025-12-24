<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
  middleware: 'guest'
})

const route = useRoute()
const router = useRouter()
const toast = useToast()

const token = computed(() => route.query.token as string)

const isLoading = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string()
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  password: undefined,
  confirmPassword: undefined
})

if (!token.value) {
  router.push('/auth/login')
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isLoading.value = true

  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: token.value,
        password: event.data.password
      }
    })

    toast.add({
      title: 'Password reset successful',
      description: 'You can now sign in with your new password.',
      color: 'success'
    })
    router.push('/auth/login')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Reset failed',
      description: err.data?.statusMessage || 'Invalid or expired reset token',
      color: 'error'
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div>
    <div class="text-center">
      <div class="flex justify-center mb-4">
        <UIcon name="i-lucide-lock-keyhole" class="w-12 h-12 text-primary" />
      </div>
      <h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Set new password
      </h2>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Create a strong password for your account
      </p>
    </div>

    <UCard class="mt-8">
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-6"
        @submit="onSubmit"
      >
        <UFormField label="New password" name="password" required>
          <UInput
            v-model="state.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Enter new password"
            autocomplete="new-password"
            icon="i-lucide-lock"
            size="lg"
            :ui="{ trailing: 'pe-1' }"
          >
            <template #trailing>
              <UButton
                :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                variant="link"
                color="neutral"
                size="sm"
                :padded="false"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>
        </UFormField>

        <UFormField label="Confirm password" name="confirmPassword" required>
          <UInput
            v-model="state.confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            placeholder="Confirm new password"
            autocomplete="new-password"
            icon="i-lucide-lock"
            size="lg"
            :ui="{ trailing: 'pe-1' }"
          >
            <template #trailing>
              <UButton
                :icon="showConfirmPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                variant="link"
                color="neutral"
                size="sm"
                :padded="false"
                @click="showConfirmPassword = !showConfirmPassword"
              />
            </template>
          </UInput>
        </UFormField>

        <div class="text-xs text-gray-500 dark:text-gray-400">
          Password requirements:
          <ul class="list-disc list-inside mt-1 space-y-0.5">
            <li>At least 8 characters</li>
            <li>One uppercase letter</li>
            <li>One lowercase letter</li>
            <li>One number</li>
          </ul>
        </div>

        <UButton
          type="submit"
          block
          size="lg"
          :loading="isLoading"
        >
          Reset password
        </UButton>
      </UForm>
    </UCard>
  </div>
</template>
