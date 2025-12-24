declare module '#auth-utils' {
  interface User {
    id: string
    organisationId: string
    roleId: string
    email: string
    firstName: string
    lastName: string
    phone: string | null
    avatarUrl: string | null
    isActive: boolean
    emailVerified: boolean
    lastLoginAt: Date | null
    createdAt: Date
    updatedAt: Date
  }

  interface UserSession {
    user: User
    loggedInAt: string
  }
}

export {}
