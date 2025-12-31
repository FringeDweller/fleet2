<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod'

interface Role {
  id: string
  name: string
  displayName: string
}

const emit = defineEmits<{
  (e: 'success', user: { id: string; email: string }): void
  (e: 'cancel'): void
}>()

const toast = useToast()

// Fetch available roles
const { data: roles, status: rolesStatus } = await useFetch<Role[]>('/api/roles', {
  default: () => [],
})

// Role options for select dropdown
const roleOptions = computed(() =>
  roles.value.map((role) => ({
    label: role.displayName,
    value: role.id,
  })),
)

/**
 * Password strength requirements:
 * - Minimum 8 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one digit
 * - At least one special character
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')

const schema = z
  .object({
    email: z.string().email('Please enter a valid email address').max(255, 'Email is too long'),
    firstName: z.string().min(1, 'First name is required').max(100, 'First name is too long'),
    lastName: z.string().min(1, 'Last name is required').max(100, 'Last name is too long'),
    password: passwordSchema,
    confirmPassword: z.string(),
    roleId: z.string().uuid('Please select a role'),
    phone: z.string().max(50, 'Phone number is too long').optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  email: undefined,
  firstName: undefined,
  lastName: undefined,
  password: undefined,
  confirmPassword: undefined,
  roleId: undefined,
  phone: undefined,
})

const isLoading = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

// Password strength indicator
const passwordStrength = computed(() => {
  const password = state.password || ''
  let strength = 0
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  }

  strength = Object.values(checks).filter(Boolean).length

  return {
    score: strength,
    checks,
    label:
      strength < 2 ? 'Weak' : strength < 4 ? 'Medium' : strength < 5 ? 'Strong' : 'Very Strong',
    color: strength < 2 ? 'error' : strength < 4 ? 'warning' : 'success',
  }
})

function resetForm() {
  state.email = undefined
  state.firstName = undefined
  state.lastName = undefined
  state.password = undefined
  state.confirmPassword = undefined
  state.roleId = undefined
  state.phone = undefined
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isLoading.value = true

  try {
    const response = await $fetch<{ id: string; email: string }>('/api/users', {
      method: 'POST',
      body: {
        email: event.data.email,
        firstName: event.data.firstName,
        lastName: event.data.lastName,
        password: event.data.password,
        roleId: event.data.roleId,
        phone: event.data.phone || null,
      },
    })

    toast.add({
      title: 'User created',
      description: `${event.data.firstName} ${event.data.lastName} has been added successfully.`,
      color: 'success',
    })

    resetForm()
    emit('success', response)
  } catch (error: unknown) {
    const err = error as {
      data?: { statusMessage?: string; data?: { fieldErrors?: Record<string, string[]> } }
    }

    // Handle validation errors
    if (err.data?.data?.fieldErrors) {
      const fieldErrors = err.data.data.fieldErrors
      const firstError = Object.entries(fieldErrors)[0]
      if (firstError) {
        const [field, messages] = firstError
        toast.add({
          title: 'Validation error',
          description: `${field}: ${messages[0]}`,
          color: 'error',
        })
        return
      }
    }

    // Handle general errors
    const message = err.data?.statusMessage || 'Failed to create user'
    toast.add({
      title: 'Error',
      description: message,
      color: 'error',
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <UForm
    :schema="schema"
    :state="state"
    class="space-y-6"
    @submit="onSubmit"
  >
    <UCard>
      <template #header>
        <h3 class="font-medium">
          User Information
        </h3>
      </template>

      <div class="space-y-4">
        <UFormField
          label="Email"
          name="email"
          required
          hint="This will be used for login"
        >
          <UInput
            v-model="state.email"
            type="email"
            placeholder="user@example.com"
            autocomplete="email"
            icon="i-lucide-mail"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UFormField label="First Name" name="firstName" required>
            <UInput
              v-model="state.firstName"
              placeholder="John"
              autocomplete="given-name"
              icon="i-lucide-user"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Last Name" name="lastName" required>
            <UInput
              v-model="state.lastName"
              placeholder="Doe"
              autocomplete="family-name"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="Phone" name="phone" hint="Optional">
          <UInput
            v-model="state.phone"
            type="tel"
            placeholder="+1 (555) 123-4567"
            autocomplete="tel"
            icon="i-lucide-phone"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Role" name="roleId" required>
          <div v-if="rolesStatus === 'pending'" class="text-muted text-sm">
            Loading roles...
          </div>
          <USelect
            v-else
            v-model="state.roleId"
            :items="roleOptions"
            placeholder="Select a role"
            class="w-full"
          />
        </UFormField>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h3 class="font-medium">
          Password
        </h3>
      </template>

      <div class="space-y-4">
        <UFormField label="Password" name="password" required>
          <UInput
            v-model="state.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Enter a secure password"
            autocomplete="new-password"
            icon="i-lucide-lock"
            class="w-full"
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

        <!-- Password strength indicator -->
        <div v-if="state.password" class="space-y-2">
          <div class="flex items-center gap-2">
            <div class="flex-1 h-1.5 bg-default rounded-full overflow-hidden">
              <div
                class="h-full transition-all duration-300"
                :class="{
                  'bg-error': passwordStrength.score < 2,
                  'bg-warning': passwordStrength.score >= 2 && passwordStrength.score < 4,
                  'bg-success': passwordStrength.score >= 4,
                }"
                :style="{ width: `${(passwordStrength.score / 5) * 100}%` }"
              />
            </div>
            <span
              class="text-xs font-medium"
              :class="{
                'text-error': passwordStrength.score < 2,
                'text-warning': passwordStrength.score >= 2 && passwordStrength.score < 4,
                'text-success': passwordStrength.score >= 4,
              }"
            >
              {{ passwordStrength.label }}
            </span>
          </div>
          <ul class="text-xs text-muted space-y-0.5">
            <li :class="{ 'text-success': passwordStrength.checks.length }">
              <UIcon :name="passwordStrength.checks.length ? 'i-lucide-check' : 'i-lucide-x'" class="w-3 h-3 inline-block mr-1" />
              At least 8 characters
            </li>
            <li :class="{ 'text-success': passwordStrength.checks.lowercase }">
              <UIcon :name="passwordStrength.checks.lowercase ? 'i-lucide-check' : 'i-lucide-x'" class="w-3 h-3 inline-block mr-1" />
              One lowercase letter
            </li>
            <li :class="{ 'text-success': passwordStrength.checks.uppercase }">
              <UIcon :name="passwordStrength.checks.uppercase ? 'i-lucide-check' : 'i-lucide-x'" class="w-3 h-3 inline-block mr-1" />
              One uppercase letter
            </li>
            <li :class="{ 'text-success': passwordStrength.checks.digit }">
              <UIcon :name="passwordStrength.checks.digit ? 'i-lucide-check' : 'i-lucide-x'" class="w-3 h-3 inline-block mr-1" />
              One number
            </li>
            <li :class="{ 'text-success': passwordStrength.checks.special }">
              <UIcon :name="passwordStrength.checks.special ? 'i-lucide-check' : 'i-lucide-x'" class="w-3 h-3 inline-block mr-1" />
              One special character
            </li>
          </ul>
        </div>

        <UFormField label="Confirm Password" name="confirmPassword" required>
          <UInput
            v-model="state.confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            placeholder="Confirm password"
            autocomplete="new-password"
            icon="i-lucide-lock"
            class="w-full"
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
      </div>
    </UCard>

    <div class="flex justify-end gap-2">
      <UButton
        label="Cancel"
        color="neutral"
        variant="subtle"
        @click="emit('cancel')"
      />
      <UButton
        label="Create User"
        color="primary"
        type="submit"
        :loading="isLoading"
        :disabled="rolesStatus === 'pending'"
      />
    </div>
  </UForm>
</template>
