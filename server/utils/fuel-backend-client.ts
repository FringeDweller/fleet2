/**
 * Fuel Backend Integration Client
 *
 * HTTP client for communicating with external fuel backend systems.
 * Supports authentication, retry logic, timeout handling, and health monitoring.
 */

/**
 * Configuration for the fuel backend client
 */
export interface FuelBackendConfig {
  /** Base URL for the fuel backend API */
  baseUrl: string
  /** API key or token for authentication */
  apiKey: string
  /** API secret (if required for signature-based auth) */
  apiSecret?: string
  /** Request timeout in milliseconds */
  timeoutMs: number
  /** Maximum retry attempts for transient failures */
  maxRetries: number
  /** Delay between retries in milliseconds (will be multiplied for backoff) */
  retryDelayMs: number
  /** Organization/tenant identifier in the external system */
  externalOrgId?: string
}

/**
 * Transaction data from external fuel backend
 */
export interface ExternalFuelTransaction {
  /** External system's transaction ID */
  transactionId: string
  /** External pump/station identifier */
  stationId?: string
  /** Pump number at the station */
  pumpNumber?: string
  /** Vehicle/asset identifier from external system */
  vehicleId?: string
  /** Vehicle registration/plate number */
  vehicleRegistration?: string
  /** Driver/operator identifier */
  driverId?: string
  /** Driver name */
  driverName?: string
  /** Transaction timestamp */
  transactionDate: string
  /** Fuel type (diesel, petrol, etc.) */
  fuelType?: string
  /** Quantity in litres */
  quantityLitres: number
  /** Unit price per litre */
  unitPrice?: number
  /** Total cost */
  totalCost?: number
  /** Currency code (e.g., AUD, USD) */
  currency?: string
  /** Odometer reading at time of fill */
  odometer?: number
  /** Station/location name */
  locationName?: string
  /** Station address */
  locationAddress?: string
  /** Station latitude */
  latitude?: number
  /** Station longitude */
  longitude?: number
  /** Authorization code used (if any) */
  authorizationCode?: string
  /** Reference to original authorization */
  authorizationId?: string
  /** Any additional metadata from external system */
  metadata?: Record<string, unknown>
}

/**
 * Response from the external fuel backend for transaction sync
 */
export interface ExternalSyncResponse {
  /** Whether the request was successful */
  success: boolean
  /** Transactions fetched */
  transactions: ExternalFuelTransaction[]
  /** Pagination cursor for next batch */
  nextCursor?: string
  /** Total count of available transactions */
  totalCount?: number
  /** Response message */
  message?: string
  /** Error details if not successful */
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

/**
 * Health check response from external system
 */
export interface ExternalHealthResponse {
  /** Whether the system is healthy */
  healthy: boolean
  /** Current status */
  status: 'online' | 'degraded' | 'offline' | 'maintenance'
  /** Version of the external API */
  version?: string
  /** Response time in ms */
  responseTimeMs?: number
  /** Additional status details */
  details?: Record<string, unknown>
}

/**
 * Error types from the fuel backend client
 */
export type FuelBackendErrorType =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'AUTH_ERROR'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'CLIENT_ERROR'
  | 'PARSE_ERROR'
  | 'UNKNOWN'

/**
 * Custom error for fuel backend operations
 */
export class FuelBackendError extends Error {
  constructor(
    message: string,
    public readonly type: FuelBackendErrorType,
    public readonly statusCode?: number,
    public readonly details?: unknown,
    public readonly retryable: boolean = false,
  ) {
    super(message)
    this.name = 'FuelBackendError'
  }
}

/**
 * Get default configuration from environment variables
 */
export function getDefaultConfig(): FuelBackendConfig {
  const baseUrl = process.env.FUEL_BACKEND_URL || ''
  const apiKey = process.env.FUEL_BACKEND_API_KEY || ''
  const apiSecret = process.env.FUEL_BACKEND_API_SECRET

  return {
    baseUrl,
    apiKey,
    apiSecret,
    timeoutMs: Number.parseInt(process.env.FUEL_BACKEND_TIMEOUT_MS || '30000', 10),
    maxRetries: Number.parseInt(process.env.FUEL_BACKEND_MAX_RETRIES || '3', 10),
    retryDelayMs: Number.parseInt(process.env.FUEL_BACKEND_RETRY_DELAY_MS || '1000', 10),
    externalOrgId: process.env.FUEL_BACKEND_ORG_ID,
  }
}

/**
 * Validate configuration is complete
 */
export function validateConfig(config: FuelBackendConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.baseUrl) {
    errors.push('baseUrl is required')
  } else {
    try {
      new URL(config.baseUrl)
    } catch {
      errors.push('baseUrl is not a valid URL')
    }
  }

  if (!config.apiKey) {
    errors.push('apiKey is required')
  }

  if (config.timeoutMs < 1000) {
    errors.push('timeoutMs should be at least 1000ms')
  }

  if (config.maxRetries < 0) {
    errors.push('maxRetries must be non-negative')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Mask sensitive config values for display
 */
export function maskConfig(config: FuelBackendConfig): Record<string, unknown> {
  return {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey ? `${config.apiKey.slice(0, 4)}...${config.apiKey.slice(-4)}` : null,
    apiSecret: config.apiSecret ? '********' : null,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    retryDelayMs: config.retryDelayMs,
    externalOrgId: config.externalOrgId,
  }
}

/**
 * Fuel Backend Client
 *
 * Handles all communication with the external fuel management system.
 */
export class FuelBackendClient {
  private config: FuelBackendConfig

  constructor(config?: Partial<FuelBackendConfig>) {
    const defaults = getDefaultConfig()
    this.config = { ...defaults, ...config }
  }

  /**
   * Get the current configuration (masked for security)
   */
  getConfig(): Record<string, unknown> {
    return maskConfig(this.config)
  }

  /**
   * Check if the client is properly configured
   */
  isConfigured(): boolean {
    const validation = validateConfig(this.config)
    return validation.valid
  }

  /**
   * Generate authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
    }

    // If API secret is provided, generate a signature
    if (this.config.apiSecret) {
      const timestamp = Date.now().toString()
      headers['X-Timestamp'] = timestamp
      // In production, you would compute HMAC signature here
      // headers['X-Signature'] = computeHmac(this.config.apiSecret, timestamp)
    }

    if (this.config.externalOrgId) {
      headers['X-Organization-ID'] = this.config.externalOrgId
    }

    return headers
  }

  /**
   * Execute a request with retry logic and timeout
   */
  private async executeWithRetry<T>(
    method: string,
    path: string,
    body?: unknown,
    attempt = 1,
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs)

    try {
      const response = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Handle different response status codes
      if (response.status === 401 || response.status === 403) {
        throw new FuelBackendError(
          'Authentication failed',
          'AUTH_ERROR',
          response.status,
          undefined,
          false,
        )
      }

      if (response.status === 429) {
        throw new FuelBackendError(
          'Rate limited by external API',
          'RATE_LIMITED',
          429,
          undefined,
          true,
        )
      }

      if (response.status >= 500) {
        throw new FuelBackendError(
          `Server error: ${response.statusText}`,
          'SERVER_ERROR',
          response.status,
          undefined,
          true,
        )
      }

      if (response.status >= 400) {
        let errorDetails: unknown
        try {
          errorDetails = await response.json()
        } catch {
          errorDetails = await response.text()
        }
        throw new FuelBackendError(
          `Client error: ${response.statusText}`,
          'CLIENT_ERROR',
          response.status,
          errorDetails,
          false,
        )
      }

      // Parse successful response
      try {
        return (await response.json()) as T
      } catch (parseError) {
        throw new FuelBackendError(
          'Failed to parse response',
          'PARSE_ERROR',
          response.status,
          parseError,
          false,
        )
      }
    } catch (error) {
      clearTimeout(timeoutId)

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new FuelBackendError(
          `Request timed out after ${this.config.timeoutMs}ms`,
          'TIMEOUT',
          undefined,
          undefined,
          true,
        )
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new FuelBackendError(
          'Network error connecting to fuel backend',
          'NETWORK_ERROR',
          undefined,
          error,
          true,
        )
      }

      // If it's already our error, check if we should retry
      if (error instanceof FuelBackendError) {
        if (error.retryable && attempt < this.config.maxRetries) {
          // Exponential backoff
          const delay = this.config.retryDelayMs * 2 ** (attempt - 1)
          await new Promise((resolve) => setTimeout(resolve, delay))
          return this.executeWithRetry<T>(method, path, body, attempt + 1)
        }
        throw error
      }

      // Unknown error
      throw new FuelBackendError('Unknown error occurred', 'UNKNOWN', undefined, error, false)
    }
  }

  /**
   * Check the health of the external fuel backend
   */
  async checkHealth(): Promise<ExternalHealthResponse> {
    if (!this.isConfigured()) {
      return {
        healthy: false,
        status: 'offline',
        details: { error: 'Client not configured' },
      }
    }

    const startTime = Date.now()

    try {
      const response = await this.executeWithRetry<{
        status?: string
        version?: string
        [key: string]: unknown
      }>('GET', '/health')

      const responseTimeMs = Date.now() - startTime

      return {
        healthy: true,
        status: 'online',
        version: response.version,
        responseTimeMs,
        details: response,
      }
    } catch (error) {
      const responseTimeMs = Date.now() - startTime

      if (error instanceof FuelBackendError) {
        return {
          healthy: false,
          status: error.type === 'AUTH_ERROR' ? 'offline' : 'degraded',
          responseTimeMs,
          details: {
            error: error.message,
            type: error.type,
            statusCode: error.statusCode,
          },
        }
      }

      return {
        healthy: false,
        status: 'offline',
        responseTimeMs,
        details: { error: String(error) },
      }
    }
  }

  /**
   * Fetch transactions from the external fuel backend
   *
   * @param fromDate Start of date range (ISO 8601)
   * @param toDate End of date range (ISO 8601)
   * @param cursor Pagination cursor for subsequent pages
   * @param limit Number of transactions per page
   */
  async fetchTransactions(
    fromDate: string,
    toDate: string,
    cursor?: string,
    limit = 100,
  ): Promise<ExternalSyncResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        transactions: [],
        error: {
          code: 'NOT_CONFIGURED',
          message: 'Fuel backend client is not configured',
        },
      }
    }

    const params = new URLSearchParams({
      from: fromDate,
      to: toDate,
      limit: limit.toString(),
    })

    if (cursor) {
      params.append('cursor', cursor)
    }

    try {
      const response = await this.executeWithRetry<{
        data?: ExternalFuelTransaction[]
        transactions?: ExternalFuelTransaction[]
        next_cursor?: string
        nextCursor?: string
        total?: number
        totalCount?: number
      }>('GET', `/transactions?${params.toString()}`)

      // Handle different API response formats
      const transactions = response.data || response.transactions || []
      const nextCursor = response.next_cursor || response.nextCursor
      const totalCount = response.total || response.totalCount

      return {
        success: true,
        transactions,
        nextCursor,
        totalCount,
      }
    } catch (error) {
      if (error instanceof FuelBackendError) {
        return {
          success: false,
          transactions: [],
          error: {
            code: error.type,
            message: error.message,
            details: error.details,
          },
        }
      }

      return {
        success: false,
        transactions: [],
        error: {
          code: 'UNKNOWN',
          message: String(error),
        },
      }
    }
  }

  /**
   * Verify an authorization code with the external backend
   */
  async verifyAuthorization(authCode: string): Promise<{
    valid: boolean
    authorization?: {
      id: string
      vehicleId: string
      driverId: string
      maxLitres?: number
      maxAmount?: number
      expiresAt: string
    }
    error?: string
  }> {
    if (!this.isConfigured()) {
      return { valid: false, error: 'Client not configured' }
    }

    try {
      const response = await this.executeWithRetry<{
        valid: boolean
        authorization?: {
          id: string
          vehicleId: string
          driverId: string
          maxLitres?: number
          maxAmount?: number
          expiresAt: string
        }
        error?: string
      }>('POST', '/authorizations/verify', { authCode })

      return response
    } catch (error) {
      if (error instanceof FuelBackendError) {
        return { valid: false, error: error.message }
      }
      return { valid: false, error: String(error) }
    }
  }

  /**
   * Report a transaction back to the external backend
   * (for bidirectional sync)
   */
  async reportTransaction(transaction: {
    internalId: string
    authorizationCode?: string
    vehicleId: string
    driverId?: string
    quantityLitres: number
    totalCost?: number
    transactionDate: string
    latitude?: number
    longitude?: number
  }): Promise<{
    success: boolean
    externalId?: string
    error?: string
  }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Client not configured' }
    }

    try {
      const response = await this.executeWithRetry<{
        success: boolean
        id?: string
        transactionId?: string
        error?: string
      }>('POST', '/transactions', transaction)

      return {
        success: response.success,
        externalId: response.id || response.transactionId,
        error: response.error,
      }
    } catch (error) {
      if (error instanceof FuelBackendError) {
        return { success: false, error: error.message }
      }
      return { success: false, error: String(error) }
    }
  }
}

/**
 * Create a singleton instance of the fuel backend client
 */
let clientInstance: FuelBackendClient | null = null

export function getFuelBackendClient(): FuelBackendClient {
  if (!clientInstance) {
    clientInstance = new FuelBackendClient()
  }
  return clientInstance
}

/**
 * Reset the client instance (useful for testing or config changes)
 */
export function resetFuelBackendClient(): void {
  clientInstance = null
}
