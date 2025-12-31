/**
 * CSRF Token Composable
 *
 * Provides CSRF token management for client-side API requests.
 * The token is automatically retrieved from cookies and added to request headers.
 *
 * Usage:
 * - Call getCsrfToken() to get the current token
 * - Use fetchWithCsrf() for protected API calls
 * - Token is automatically refreshed on GET requests
 *
 * @see US-18.2.5 CSRF Protection
 */

const CSRF_COOKIE_NAME = 'fleet2_csrf'
const CSRF_HEADER_NAME = 'X-CSRF-Token'

/**
 * Parse cookies from document.cookie string
 */
function parseCookies(): Record<string, string> {
  const cookies: Record<string, string> = {}

  if (typeof document === 'undefined') return cookies

  const cookieString = document.cookie || ''
  const pairs = cookieString.split(';')

  for (const pair of pairs) {
    const [name, ...rest] = pair.trim().split('=')
    if (name) {
      cookies[name] = rest.join('=')
    }
  }

  return cookies
}

/**
 * Get the CSRF token from cookies
 */
export function getCsrfToken(): string | null {
  const cookies = parseCookies()
  return cookies[CSRF_COOKIE_NAME] || null
}

/**
 * Create headers with CSRF token included
 *
 * @param additionalHeaders - Optional additional headers to include
 * @returns Headers object with CSRF token
 */
export function createCsrfHeaders(additionalHeaders?: HeadersInit): Headers {
  const headers = new Headers(additionalHeaders)
  const csrfToken = getCsrfToken()

  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken)
  }

  return headers
}

/**
 * Fetch wrapper that automatically includes CSRF token
 *
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns Fetch response
 *
 * @example
 * ```ts
 * const { fetchWithCsrf } = useCsrfToken()
 *
 * const response = await fetchWithCsrf('/api/assets', {
 *   method: 'POST',
 *   body: JSON.stringify(data),
 * })
 * ```
 */
export async function fetchWithCsrf(url: string, options?: RequestInit): Promise<Response> {
  const csrfToken = getCsrfToken()

  const headers = new Headers(options?.headers)

  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken)
  }

  // Ensure content-type is set for JSON requests
  if (options?.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin', // Include cookies
  })
}

/**
 * CSRF token composable
 *
 * Provides utilities for CSRF protection in Vue components
 *
 * @example
 * ```vue
 * <script setup>
 * const { getCsrfToken, fetchWithCsrf, $fetchWithCsrf } = useCsrfToken()
 *
 * async function createAsset(data) {
 *   const result = await $fetchWithCsrf('/api/assets', {
 *     method: 'POST',
 *     body: data,
 *   })
 *   return result
 * }
 * </script>
 * ```
 */
export function useCsrfToken() {
  /**
   * Nuxt's $fetch wrapper with CSRF token
   * Automatically handles JSON serialization and includes credentials
   */
  async function $fetchWithCsrf<T = unknown>(
    url: string,
    options?: Parameters<typeof $fetch>[1],
  ): Promise<T> {
    const csrfToken = getCsrfToken()

    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string>),
    }

    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken
    }

    return $fetch<T>(url, {
      ...options,
      headers,
      credentials: 'same-origin',
    })
  }

  /**
   * Create a header object for use with useFetch
   */
  function getCsrfHeaders(): Record<string, string> {
    const csrfToken = getCsrfToken()
    if (!csrfToken) return {}

    return {
      [CSRF_HEADER_NAME]: csrfToken,
    }
  }

  return {
    getCsrfToken,
    getCsrfHeaders,
    createCsrfHeaders,
    fetchWithCsrf,
    $fetchWithCsrf,
  }
}
