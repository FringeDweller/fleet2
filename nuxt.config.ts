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
    // Encryption key for sensitive data (generate with: openssl rand -base64 32)
    encryptionKey: '',
    // Session configuration for nuxt-auth-utils (US-18.2.5 CSRF Protection)
    // Cookie settings: sameSite=strict, secure in production, httpOnly
    // These are configured via environment variables:
    // NUXT_SESSION_PASSWORD (required, min 32 chars)
    // NUXT_SESSION_MAX_AGE (default: 604800 = 7 days)
    session: {
      password: '', // Set via NUXT_SESSION_PASSWORD env var
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
    // Public keys exposed to client
    public: {
      appName: 'Fleet',
      // Application URL for CSRF validation
      appUrl: '',
      // Capacitor app configuration
      capacitor: {
        appId: 'com.fleet2.app',
        appName: 'Fleet2',
      },
      // Firebase configuration for push notifications
      // Set via NUXT_PUBLIC_FIREBASE_* environment variables
      firebaseApiKey: '',
      firebaseAuthDomain: '',
      firebaseProjectId: '',
      firebaseMessagingSenderId: '',
      firebaseAppId: '',
      firebaseVapidKey: '', // For web push
    },
  },

  // For Capacitor static generation
  ssr: true,

  routeRules: {
    // API CORS Security Headers
    // In production, Access-Control-Allow-Origin should be the app's domain
    // Environment variable NUXT_PUBLIC_APP_URL controls allowed origins
    '/api/**': {
      cors: true,
      headers: {
        // Allow specific HTTP methods for API
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        // Allow common headers needed for API requests
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token',
        // Allow credentials (cookies, authorization headers)
        'Access-Control-Allow-Credentials': 'true',
        // Cache preflight requests for 24 hours (86400 seconds)
        'Access-Control-Max-Age': '86400',
        // Expose rate limit headers to client
        'Access-Control-Expose-Headers':
          'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After',
      },
    },
    // US-18.1.2: Static assets caching for performance
    '/_nuxt/**': {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
    // Cache static pages
    '/auth/**': {
      swr: 3600, // 1 hour SWR cache
    },
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    experimental: {
      tasks: true,
    },
    // US-18.1.1: Compression for API responses
    compressPublicAssets: true,
    minify: true,
  },

  // US-18.1.2: Build optimizations for faster page loads
  vite: {
    build: {
      // Enable CSS code splitting
      cssCodeSplit: true,
      // Optimize chunk size
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            // Vendor chunks for heavy dependencies
            'vendor-vue': ['vue', 'vue-router'],
            'vendor-charts': ['@unovis/ts', '@unovis/vue'],
            'vendor-utils': ['date-fns', 'zod'],
          },
        },
      },
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['vue', 'vue-router', 'date-fns', 'zod'],
    },
  },

  // US-18.1.2: Experimental features for performance
  experimental: {
    // Enable payload extraction for smaller initial HTML
    payloadExtraction: true,
    // Enable component islands for partial hydration
    componentIslands: true,
  },

  typescript: {
    strict: true,
    typeCheck: true,
  },
})
