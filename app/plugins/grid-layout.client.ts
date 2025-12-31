import { GridItem, GridLayout } from 'vue3-grid-layout-next'

/**
 * Register vue3-grid-layout-next components globally (client-side only)
 *
 * These components are used by the configurable dashboard feature (US-14.2)
 * to enable drag-and-drop widget arrangement.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('GridLayout', GridLayout)
  nuxtApp.vueApp.component('GridItem', GridItem)
})
