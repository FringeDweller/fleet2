<script setup lang="ts">
/**
 * Signature Capture Component (US-9.4)
 *
 * A canvas-based digital signature pad with:
 * - Touch and mouse input support
 * - Clear/redo functionality
 * - Export as base64 PNG
 * - Responsive sizing
 * - Accessibility support
 */

interface Props {
  /** Width of the canvas in pixels (default: 100% of container) */
  width?: number
  /** Height of the canvas in pixels (default: 200) */
  height?: number
  /** Stroke color for the signature (default: black) */
  strokeColor?: string
  /** Stroke width for the signature (default: 2) */
  strokeWidth?: number
  /** Background color (default: white) */
  backgroundColor?: string
  /** Whether the component is disabled */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  height: 200,
  strokeColor: '#000000',
  strokeWidth: 2,
  backgroundColor: '#ffffff',
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:signature', value: string | null): void
  (e: 'change', value: string | null): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const isDrawing = ref(false)
const hasSignature = ref(false)
const lastPoint = ref<{ x: number; y: number } | null>(null)

// Track canvas dimensions for responsive sizing
const canvasWidth = ref(props.width || 400)
const canvasHeight = computed(() => props.height)

// Get 2D context
function getContext(): CanvasRenderingContext2D | null {
  return canvasRef.value?.getContext('2d') || null
}

// Initialize canvas
function initCanvas() {
  const canvas = canvasRef.value
  const ctx = getContext()
  if (!canvas || !ctx) return

  // Update canvas dimensions based on container width if no fixed width
  if (containerRef.value && !props.width) {
    canvasWidth.value = containerRef.value.clientWidth
  }

  // Set canvas dimensions
  canvas.width = canvasWidth.value
  canvas.height = canvasHeight.value

  // Set initial background
  ctx.fillStyle = props.backgroundColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Configure stroke style
  ctx.strokeStyle = props.strokeColor
  ctx.lineWidth = props.strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

// Get coordinates from event (mouse or touch)
function getCoordinates(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  const canvas = canvasRef.value
  if (!canvas) return null

  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height

  if ('touches' in event) {
    const touch = event.touches[0]
    if (!touch) return null
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    }
  } else {
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }
}

// Start drawing
function startDrawing(event: MouseEvent | TouchEvent) {
  if (props.disabled) return

  event.preventDefault()
  isDrawing.value = true
  lastPoint.value = getCoordinates(event)
}

// Draw on canvas
function draw(event: MouseEvent | TouchEvent) {
  if (!isDrawing.value || props.disabled) return

  event.preventDefault()
  const ctx = getContext()
  const currentPoint = getCoordinates(event)

  if (!ctx || !currentPoint || !lastPoint.value) return

  ctx.beginPath()
  ctx.moveTo(lastPoint.value.x, lastPoint.value.y)
  ctx.lineTo(currentPoint.x, currentPoint.y)
  ctx.stroke()

  lastPoint.value = currentPoint
  hasSignature.value = true
}

// Stop drawing
function stopDrawing() {
  if (isDrawing.value) {
    isDrawing.value = false
    lastPoint.value = null

    // Emit signature data
    if (hasSignature.value) {
      const signatureData = getSignatureData()
      emit('update:signature', signatureData)
      emit('change', signatureData)
    }
  }
}

// Clear the canvas
function clear() {
  const ctx = getContext()
  const canvas = canvasRef.value
  if (!ctx || !canvas) return

  ctx.fillStyle = props.backgroundColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  hasSignature.value = false

  emit('update:signature', null)
  emit('change', null)
}

// Get signature as base64 data URL
function getSignatureData(): string | null {
  const canvas = canvasRef.value
  if (!canvas || !hasSignature.value) return null

  return canvas.toDataURL('image/png')
}

// Check if signature is empty
function isEmpty(): boolean {
  return !hasSignature.value
}

// Expose methods for parent components
defineExpose({
  clear,
  getSignatureData,
  isEmpty,
})

// Initialize on mount
onMounted(() => {
  initCanvas()

  // Handle window resize for responsive sizing
  if (!props.width) {
    const handleResize = () => {
      if (containerRef.value) {
        const newWidth = containerRef.value.clientWidth
        if (newWidth !== canvasWidth.value) {
          // Store current signature
          const currentSignature = hasSignature.value ? getSignatureData() : null

          canvasWidth.value = newWidth
          nextTick(() => {
            initCanvas()

            // Restore signature if there was one (simplified - actual restoration would need path data)
            if (currentSignature) {
              const img = new Image()
              img.onload = () => {
                const ctx = getContext()
                if (ctx && canvasRef.value) {
                  ctx.drawImage(img, 0, 0, canvasRef.value.width, canvasRef.value.height)
                  hasSignature.value = true
                }
              }
              img.src = currentSignature
            }
          })
        }
      }
    }

    window.addEventListener('resize', handleResize)
    onUnmounted(() => {
      window.removeEventListener('resize', handleResize)
    })
  }
})

// Watch for prop changes
watch(
  () => [props.strokeColor, props.strokeWidth, props.backgroundColor],
  () => {
    const ctx = getContext()
    if (ctx) {
      ctx.strokeStyle = props.strokeColor
      ctx.lineWidth = props.strokeWidth
    }
  },
)
</script>

<template>
  <div ref="containerRef" class="signature-capture">
    <div
      class="relative rounded-lg border-2 border-dashed overflow-hidden"
      :class="{
        'border-muted bg-muted/20': !hasSignature && !disabled,
        'border-primary bg-elevated': hasSignature && !disabled,
        'border-muted/50 bg-muted/10 cursor-not-allowed': disabled,
      }"
    >
      <canvas
        ref="canvasRef"
        class="block w-full touch-none"
        :style="{ height: `${height}px` }"
        :class="{ 'cursor-crosshair': !disabled, 'cursor-not-allowed': disabled }"
        role="img"
        aria-label="Signature pad - draw your signature here"
        @mousedown="startDrawing"
        @mousemove="draw"
        @mouseup="stopDrawing"
        @mouseleave="stopDrawing"
        @touchstart="startDrawing"
        @touchmove="draw"
        @touchend="stopDrawing"
        @touchcancel="stopDrawing"
      />

      <!-- Placeholder text when empty -->
      <div
        v-if="!hasSignature && !disabled"
        class="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div class="text-center text-muted">
          <UIcon name="i-lucide-pen-tool" class="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p class="text-sm">Sign here</p>
        </div>
      </div>

      <!-- Clear button -->
      <button
        v-if="hasSignature && !disabled"
        type="button"
        class="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background border border-default shadow-sm transition-colors"
        aria-label="Clear signature"
        @click="clear"
      >
        <UIcon name="i-lucide-eraser" class="w-4 h-4 text-muted" />
      </button>
    </div>

    <!-- Instructions -->
    <p class="mt-2 text-xs text-muted">
      Use your finger or mouse to sign above. Tap the eraser to clear and try again.
    </p>
  </div>
</template>

<style scoped>
.signature-capture {
  user-select: none;
}
</style>
