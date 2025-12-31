// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxt/test-utils/module',
    '@vueuse/nuxt',
    '@pinia/nuxt',
    'nuxt-auth-utils',
  ],

  devtools: {
    enabled: true,
  },

  // Native app meta tags for Capacitor
  app: {
    head: {
      meta: [
        // Allow app to be installable
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Fleet2' },
        // Safe area insets for notched devices
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1.0, viewport-fit=cover',
        },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Server-only keys
    database: {
      url: '',
    },
    redis: {
      url: '',
    },
    // Public keys exposed to client
    public: {
      appName: 'Fleet',
      // Capacitor app configuration
      capacitor: {
        appId: 'com.fleet2.app',
        appName: 'Fleet2',
      },
    },
  },

  // For Capacitor static generation
  ssr: true,

  routeRules: {
    '/api/**': {
      cors: true,
    },
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    experimental: {
      tasks: true,
    },
  },

  typescript: {
    strict: true,
    typeCheck: true,
  },
})
