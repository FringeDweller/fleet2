<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
  middleware: 'guest'
})

const toast = useToast()
const router = useRouter()
const { fetch: refreshSession } = useUserSession()

const isLoading = ref(false)
const showPassword = ref(false)

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  email: undefined,
  password: undefined
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isLoading.value = true

  try {
    const response = await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: event.data.email,
        password: event.data.password
      }
    })

    if (response.success) {
      await refreshSession()
      toast.add({
        title: 'Welcome back!',
        description: `Logged in as ${response.user?.email}`,
        color: 'success'
      })
      router.push('/')
    }
  } catch (error: unknown) {
    const err = error as {
      data?: { statusMessage?: string; data?: { remainingAttempts?: number } }
    }
    const message = err.data?.statusMessage || 'Login failed'
    const remainingAttempts = err.data?.data?.remainingAttempts

    toast.add({
      title: 'Login failed',
      description:
        remainingAttempts !== undefined
          ? `${message}. ${remainingAttempts} attempts remaining.`
          : message,
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
        <UIcon name="i-lucide-truck" class="w-12 h-12 text-primary" />
      </div>
      <h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Sign in to Fleet
      </h2>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Enter your credentials to access the dashboard
      </p>
    </div>

    <UCard class="mt-8">
      <UForm :schema="schema" :state="state" class="space-y-6" @submit="onSubmit">
        <UFormField label="Email address" name="email" required>
          <UInput
            v-model="state.email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            icon="i-lucide-mail"
            size="lg"
          />
        </UFormField>

        <UFormField label="Password" name="password" required>
          <UInput
            v-model="state.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Enter your password"
            autocomplete="current-password"
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

        <div class="flex items-center justify-between">
          <UCheckbox label="Remember me" />
          <NuxtLink
            to="/auth/forgot-password"
            class="text-sm font-medium text-primary hover:text-primary/80"
          >
            Forgot your password?
          </NuxtLink>
        </div>

        <UButton type="submit" block size="lg" :loading="isLoading"> Sign in </UButton>
      </UForm>
    </UCard>
  </div>
</template>
