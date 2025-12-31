/**
 * DTC (Diagnostic Trouble Code) Lookup Data
 *
 * Server-side utility for DTC code processing.
 * OBD-II DTCs follow a standard format:
 * - First character: System (P=Powertrain, C=Chassis, B=Body, U=Network)
 * - Second character: 0=Generic (SAE), 1=Manufacturer-specific
 * - Third character: Subsystem
 * - Fourth & Fifth characters: Specific fault
 */

export type DtcSeverity = 'info' | 'warning' | 'critical'
export type DtcCodeType = 'P' | 'C' | 'B' | 'U'

export interface DtcDefinition {
  code: string
  description: string
  severity: DtcSeverity
  system: string
  possibleCauses?: string[]
}

/**
 * Determine the severity of a DTC code based on its characteristics
 */
export function getDtcSeverity(code: string): DtcSeverity {
  const prefix = code.charAt(0).toUpperCase()
  const subsystem = code.charAt(2)

  // Critical codes - engine/transmission failures that could cause damage
  if (prefix === 'P') {
    // Misfire codes (P030x, P031x) - can damage catalytic converter
    if (code.startsWith('P030') || code.startsWith('P031')) {
      return 'critical'
    }
    // Fuel system issues (P017x, P018x)
    if (code.startsWith('P017') || code.startsWith('P018')) {
      return 'critical'
    }
    // Transmission issues (P07xx)
    if (code.startsWith('P07')) {
      return 'critical'
    }
    // Engine coolant temperature issues (P011x, P012x)
    if (code.startsWith('P011') || code.startsWith('P012')) {
      return 'critical'
    }
    // Oil pressure issues
    if (code.startsWith('P052')) {
      return 'critical'
    }
  }

  // Chassis critical codes - safety related
  if (prefix === 'C') {
    // ABS system (C0035-C0051)
    if (code.match(/^C00[345]/)) {
      return 'critical'
    }
    // Brake system
    if (code.startsWith('C01')) {
      return 'critical'
    }
    // Steering system
    if (code.startsWith('C02')) {
      return 'critical'
    }
  }

  // Warning level codes - need attention but not immediately dangerous
  if (prefix === 'P') {
    // Emission-related codes
    if (subsystem === '0' || subsystem === '4') {
      return 'warning'
    }
  }

  // Body codes - usually info level unless airbag related
  if (prefix === 'B') {
    // Airbag codes - critical
    if (code.startsWith('B00') || code.startsWith('B01')) {
      return 'critical'
    }
    return 'info'
  }

  // Network codes - usually info unless critical system
  if (prefix === 'U') {
    // Lost communication with critical systems
    if (code.startsWith('U01')) {
      return 'warning'
    }
    return 'info'
  }

  // Default to warning
  return 'warning'
}

/**
 * Get the code type from a DTC code string
 */
export function getDtcCodeType(code: string): DtcCodeType {
  const prefix = code.charAt(0).toUpperCase()
  if (prefix === 'P' || prefix === 'C' || prefix === 'B' || prefix === 'U') {
    return prefix as DtcCodeType
  }
  return 'P' // Default to Powertrain
}

/**
 * Get the system name for a code type
 */
export function getSystemName(codeType: DtcCodeType): string {
  switch (codeType) {
    case 'P':
      return 'Powertrain'
    case 'C':
      return 'Chassis'
    case 'B':
      return 'Body'
    case 'U':
      return 'Network'
    default:
      return 'Unknown'
  }
}

/**
 * Common DTC code definitions (subset for server-side lookups)
 */
const DTC_CODES: Record<string, DtcDefinition> = {
  // Powertrain - Critical
  P0115: {
    code: 'P0115',
    description: 'Engine Coolant Temperature Circuit',
    severity: 'critical',
    system: 'Engine Temperature',
  },
  P0171: {
    code: 'P0171',
    description: 'System Too Lean (Bank 1)',
    severity: 'critical',
    system: 'Fuel Trim',
  },
  P0172: {
    code: 'P0172',
    description: 'System Too Rich (Bank 1)',
    severity: 'critical',
    system: 'Fuel Trim',
  },
  P0300: {
    code: 'P0300',
    description: 'Random/Multiple Cylinder Misfire Detected',
    severity: 'critical',
    system: 'Ignition System',
  },
  P0301: {
    code: 'P0301',
    description: 'Cylinder 1 Misfire Detected',
    severity: 'critical',
    system: 'Ignition System',
  },
  P0302: {
    code: 'P0302',
    description: 'Cylinder 2 Misfire Detected',
    severity: 'critical',
    system: 'Ignition System',
  },
  P0303: {
    code: 'P0303',
    description: 'Cylinder 3 Misfire Detected',
    severity: 'critical',
    system: 'Ignition System',
  },
  P0304: {
    code: 'P0304',
    description: 'Cylinder 4 Misfire Detected',
    severity: 'critical',
    system: 'Ignition System',
  },
  P0335: {
    code: 'P0335',
    description: 'Crankshaft Position Sensor A Circuit',
    severity: 'critical',
    system: 'Ignition System',
  },
  P0700: {
    code: 'P0700',
    description: 'Transmission Control System Malfunction',
    severity: 'critical',
    system: 'Transmission',
  },

  // Powertrain - Warning
  P0100: {
    code: 'P0100',
    description: 'Mass or Volume Air Flow Circuit Malfunction',
    severity: 'warning',
    system: 'Fuel and Air Metering',
  },
  P0420: {
    code: 'P0420',
    description: 'Catalyst System Efficiency Below Threshold (Bank 1)',
    severity: 'warning',
    system: 'Emission Controls',
  },
  P0455: {
    code: 'P0455',
    description: 'Evaporative Emission Control System Leak Detected (large leak)',
    severity: 'warning',
    system: 'Emission Controls',
  },

  // Powertrain - Info
  P0440: {
    code: 'P0440',
    description: 'Evaporative Emission Control System Malfunction',
    severity: 'info',
    system: 'Emission Controls',
  },
  P0442: {
    code: 'P0442',
    description: 'Evaporative Emission Control System Leak Detected (small leak)',
    severity: 'info',
    system: 'Emission Controls',
  },

  // Chassis codes
  C0035: {
    code: 'C0035',
    description: 'Left Front Wheel Speed Sensor Circuit',
    severity: 'critical',
    system: 'ABS',
  },
  C0121: {
    code: 'C0121',
    description: 'Valve Relay Circuit',
    severity: 'critical',
    system: 'ABS',
  },

  // Body codes
  B0001: {
    code: 'B0001',
    description: 'Driver Frontal Stage 1 Deployment Control',
    severity: 'critical',
    system: 'Airbag',
  },

  // Network codes
  U0100: {
    code: 'U0100',
    description: 'Lost Communication With ECM/PCM A',
    severity: 'critical',
    system: 'CAN Bus',
  },
  U0121: {
    code: 'U0121',
    description: 'Lost Communication With ABS',
    severity: 'critical',
    system: 'CAN Bus',
  },
}

/**
 * Look up a DTC definition by code
 * Returns a generated definition if the code is not in the database
 */
export function lookupDtcCode(code: string): DtcDefinition {
  const normalizedCode = code.toUpperCase().trim()

  // Check if we have a known definition
  if (DTC_CODES[normalizedCode]) {
    return DTC_CODES[normalizedCode]
  }

  // Generate a definition for unknown codes
  const codeType = getDtcCodeType(normalizedCode)
  const severity = getDtcSeverity(normalizedCode)
  const system = getSystemName(codeType)

  // Try to identify subsystem from code structure
  let description = `${system} Fault - Code ${normalizedCode}`
  if (codeType === 'P') {
    const subsystem = normalizedCode.charAt(2)
    switch (subsystem) {
      case '0':
        description = `Fuel and Air Metering - ${normalizedCode}`
        break
      case '1':
        description = `Fuel and Air Metering - ${normalizedCode}`
        break
      case '2':
        description = `Fuel Injection System - ${normalizedCode}`
        break
      case '3':
        description = `Ignition System - ${normalizedCode}`
        break
      case '4':
        description = `Emission Controls - ${normalizedCode}`
        break
      case '5':
        description = `Speed Control and Idle Control - ${normalizedCode}`
        break
      case '6':
        description = `Computer Output Circuit - ${normalizedCode}`
        break
      case '7':
        description = `Transmission - ${normalizedCode}`
        break
      case '8':
        description = `Transmission - ${normalizedCode}`
        break
    }
  }

  return {
    code: normalizedCode,
    description,
    severity,
    system,
  }
}
