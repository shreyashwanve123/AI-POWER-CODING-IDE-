export async function loginUser(username, password) {
  return { token: `${username}-${Date.now()}` }
}

export async function googleLogin(idToken) {
  try {
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Google authentication failed')
    }

    return {
      token: data.token,
      user: {
        name: data.user?.name || '',
        email: data.user?.email || '',
        picture: data.user?.picture || '',
      },
    }
  } catch (error) {
    throw error
  }
}
