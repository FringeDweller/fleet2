export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    return {
      authenticated: false,
      user: null,
    }
  }

  return {
    authenticated: true,
    user: session.user,
  }
})
