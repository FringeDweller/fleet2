/**
 * Inspection QR Code Payload Utilities
 *
 * Generates and parses QR/NFC data payloads for initiating pre-start inspections.
 * Follows similar patterns to fuel-auth.ts for consistency.
 */

/**
 * QR code data payload structure for inspections
 */
export interface InspectionQRCodePayload {
  /** Version for forward compatibility */
  v: number
  /** Type identifier */
  type: 'inspection'
  /** Asset ID */
  assetId: string
  /** Asset number/identifier for display */
  assetNumber: string
  /** Organisation ID */
  orgId: string
  /** Asset category ID (optional, for template selection) */
  categoryId?: string
  /** Generated timestamp (ISO 8601) */
  generatedAt: string
}

/**
 * Generate QR code data JSON payload for inspection initiation
 */
export function generateInspectionQRCodeData(
  assetId: string,
  assetNumber: string,
  organisationId: string,
  categoryId?: string | null,
): string {
  const payload: InspectionQRCodePayload = {
    v: 1,
    type: 'inspection',
    assetId,
    assetNumber,
    orgId: organisationId,
    generatedAt: new Date().toISOString(),
  }

  if (categoryId) {
    payload.categoryId = categoryId
  }

  return JSON.stringify(payload)
}

/**
 * Parse QR code data back to payload object
 */
export function parseInspectionQRCodeData(qrCodeData: string): InspectionQRCodePayload | null {
  try {
    const payload = JSON.parse(qrCodeData)

    // Validate required fields
    if (!payload.v || !payload.assetId || !payload.orgId) {
      return null
    }

    // Check type if present (for versioned payloads)
    if (payload.type && payload.type !== 'inspection') {
      return null
    }

    return payload as InspectionQRCodePayload
  } catch {
    return null
  }
}

/**
 * NFC payload structure (typically more compact)
 * Can be used for NDEF text records
 */
export interface InspectionNFCPayload {
  /** Type identifier */
  t: 'i'
  /** Asset ID */
  a: string
  /** Organisation ID */
  o: string
  /** Category ID (optional) */
  c?: string
}

/**
 * Generate compact NFC payload for inspection initiation
 */
export function generateInspectionNFCData(
  assetId: string,
  organisationId: string,
  categoryId?: string | null,
): string {
  const payload: InspectionNFCPayload = {
    t: 'i',
    a: assetId,
    o: organisationId,
  }

  if (categoryId) {
    payload.c = categoryId
  }

  return JSON.stringify(payload)
}

/**
 * Parse compact NFC data to standard format
 */
export function parseInspectionNFCData(nfcData: string): InspectionQRCodePayload | null {
  try {
    const payload = JSON.parse(nfcData)

    // Check if it's a compact NFC format
    if (payload.t === 'i' && payload.a && payload.o) {
      return {
        v: 1,
        type: 'inspection',
        assetId: payload.a,
        assetNumber: '', // Not available in compact format
        orgId: payload.o,
        categoryId: payload.c,
        generatedAt: new Date().toISOString(),
      }
    }

    // Try parsing as standard QR format
    return parseInspectionQRCodeData(nfcData)
  } catch {
    return null
  }
}

/**
 * Unified parser that handles both QR and NFC formats
 */
export function parseInspectionScanData(scanData: string): InspectionQRCodePayload | null {
  // First try standard QR format
  const qrResult = parseInspectionQRCodeData(scanData)
  if (qrResult) {
    return qrResult
  }

  // Then try compact NFC format
  return parseInspectionNFCData(scanData)
}
