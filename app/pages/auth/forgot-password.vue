<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})

const toast = useToast()

const isLoading = ref(false)
const isSubmitted = ref(false)

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  email: undefined,
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isLoading.value = true

  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: {
        email: event.data.email,
      },
    })

    isSubmitted.value = true
    toast.add({
      title: 'Check your email',
      description: "If an account exists, we've sent password reset instructions.",
      color: 'success',
    })
  } catch {
    toast.add({
      title: 'Error',
      description: 'Something went wrong. Please try again.',
      color: 'error',
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
        <UIcon name="i-lucide-key-round" class="w-12 h-12 text-primary" />
      </div>
      <h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        Reset your password
      </h2>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Enter your email and we'll send you reset instructions
      </p>
    </div>

    <UCard class="mt-8">
      <template v-if="isSubmitted">
        <div class="text-center py-4">
          <UIcon name="i-lucide-mail-check" class="w-16 h-16 text-success mx-auto mb-4" />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            Check your inbox
          </h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            If an account with that email exists, we've sent password reset instructions.
          </p>
          <NuxtLink
            to="/auth/login"
            class="mt-4 inline-flex items-center text-sm font-medium text-primary hover:text-primary/80"
          >
            <UIcon name="i-lucide-arrow-left" class="w-4 h-4 mr-1" />
            Back to sign in
          </NuxtLink>
        </div>
      </template>

      <template v-else>
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-6"
          @submit="onSubmit"
        >
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

          <UButton
            type="submit"
            block
            size="lg"
            :loading="isLoading"
          >
            Send reset link
          </UButton>

          <div class="text-center">
            <NuxtLink
              to="/auth/login"
              class="text-sm font-medium text-primary hover:text-primary/80"
            >
              <UIcon name="i-lucide-arrow-left" class="w-4 h-4 inline mr-1" />
              Back to sign in
            </NuxtLink>
          </div>
        </UForm>
      </template>
    </UCard>
  </div>
</template>
