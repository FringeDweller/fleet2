<script setup lang="ts">
/**
 * Signature capture field component for custom forms
 */
const props = defineProps<{
  field: {
    id: string
    fieldType: 'signature'
    label: string
    helpText?: string
    required: boolean
  }
  modelValue: string | undefined
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const isDrawing = ref(false)
const hasSignature = ref(false)

let ctx: CanvasRenderingContext2D | null = null

onMounted(() => {
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d')
    if (ctx) {
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }

    // Load existing signature if present
    if (props.modelValue) {
      const img = new Image()
      img.onload = () => {
        ctx?.drawImage(img, 0, 0)
        hasSignature.value = true
      }
      img.src = props.modelValue
    }
  }
})

function getCoordinates(event: MouseEvent | TouchEvent) {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }

  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height

  if ('touches' in event) {
    const touch = event.touches[0]
    if (!touch) return { x: 0, y: 0 }
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    }
  }

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  }
}

function startDrawing(event: MouseEvent | TouchEvent) {
  if (props.disabled || !ctx) return
  event.preventDefault()

  isDrawing.value = true
  const { x, y } = getCoordinates(event)
  ctx.beginPath()
  ctx.moveTo(x, y)
}

function draw(event: MouseEvent | TouchEvent) {
  if (!isDrawing.value || !ctx || props.disabled) return
  event.preventDefault()

  const { x, y } = getCoordinates(event)
  ctx.lineTo(x, y)
  ctx.stroke()
  hasSignature.value = true
}

function stopDrawing() {
  if (!isDrawing.value) return

  isDrawing.value = false
  saveSignature()
}

function saveSignature() {
  if (canvasRef.value && hasSignature.value) {
    const dataUrl = canvasRef.value.toDataURL('image/png')
    emit('update:modelValue', dataUrl)
  }
}

function clearSignature() {
  if (canvasRef.value && ctx) {
    ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
    hasSignature.value = false
    emit('update:modelValue', undefined)
  }
}
</script>

<template>
  <UFormField
    :label="field.label"
    :required="field.required"
    :help="field.helpText"
    :error="error"
  >
    <div class="space-y-2">
      <div
        class="relative border-2 rounded-lg overflow-hidden bg-white"
        :class="[
          error ? 'border-error' : 'border-default',
          disabled && 'opacity-50',
        ]"
      >
        <canvas
          ref="canvasRef"
          width="400"
          height="150"
          class="w-full h-36 touch-none cursor-crosshair"
          :class="{ 'cursor-not-allowed': disabled }"
          @mousedown="startDrawing"
          @mousemove="draw"
          @mouseup="stopDrawing"
          @mouseleave="stopDrawing"
          @touchstart="startDrawing"
          @touchmove="draw"
          @touchend="stopDrawing"
        />

        <!-- Placeholder when empty -->
        <div
          v-if="!hasSignature && !disabled"
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <p class="text-sm text-muted">Sign here</p>
        </div>
      </div>

      <div v-if="!disabled" class="flex justify-end">
        <UButton
          v-if="hasSignature"
          label="Clear"
          icon="i-lucide-eraser"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="clearSignature"
        />
      </div>
    </div>
  </UFormField>
</template>
