import type { APIRoute } from 'astro'
import { signValue, unsignValue } from '../../lib/cookies'

export const prerender = false

const COOKIE = 'vw_admin'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

// GET /api/admin?key=<ADMIN_SECRET>  → set signed admin cookie, redirect home
// GET /api/admin?logout=1            → clear cookie, redirect home
// GET /api/admin                     → return JSON { isAdmin: boolean }
export const GET: APIRoute = ({ url, cookies, redirect }) => {
  if (url.searchParams.get('logout') === '1') {
    cookies.delete(COOKIE, { path: '/' })
    return redirect('/', 303)
  }

  const key = url.searchParams.get('key')
  if (key) {
    const secret = process.env.ADMIN_SECRET
    if (!secret) return new Response('admin not configured', { status: 500 })
    if (key !== secret) return new Response('forbidden', { status: 403 })
    cookies.set(COOKIE, signValue('admin'), {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: MAX_AGE,
    })
    return redirect('/', 303)
  }

  return new Response(
    JSON.stringify({ isAdmin: isAdmin(cookies.get(COOKIE)?.value) }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}

export function isAdmin(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false
  return unsignValue(cookieValue) === 'admin'
}
