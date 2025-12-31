<template>
  <UCard class="shrink-0" :ui="{ body: '!px-0 !pt-0 !pb-3' }">
    <template #header>
      <div>
        <p class="text-xs text-muted uppercase mb-1.5">
          Loading...
        </p>
        <p class="text-2xl text-highlighted font-semibold">
          ---
        </p>
      </div>
    </template>

    <div class="h-64 flex items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-muted" />
    </div>
  </UCard>
</template>
