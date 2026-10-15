const TOKEN_KEY = 'finscope_token'
const USER_KEY = 'finscope_user'

export function saveSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    /* private browsing can refuse to store; the session just lasts this tab */
  }
}

/**
 * The stored session, or null.
 *
 * Anything unreadable is treated as no session at all and thrown away. Parsing
 * it blindly would throw during render and take the whole page down with it.
 */
export function getSession() {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const user = localStorage.getItem(USER_KEY)
    if (!token || !user) return null

    const parsed = JSON.parse(user)
    if (!parsed || typeof parsed !== 'object') return null

    return { token, user: parsed }
  } catch {
    clearSession()
    return null
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    /* nothing to clear if storage is unavailable */
  }
}
