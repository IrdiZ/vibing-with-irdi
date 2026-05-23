import type { APIRoute } from 'astro'
import { randomBytes } from 'node:crypto'
import { signValue } from '../../../lib/cookies'
import { authorizeUrl } from '../../../lib/linkedin'

export const prerender = false

export const GET: APIRoute = async ({ url, redirect, cookies }) => {
  const slug = url.searchParams.get('slug')
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return new Response('invalid slug', { status: 400 })
  }
  // state = `<slug>:<nonce>`. Cookie stores the same value signed so we can
  // verify the slug round-trip wasn't tampered with.
  const nonce = randomBytes(16).toString('hex')
  const state = `${slug}:${nonce}`
  cookies.set('li_state', signValue(state), {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
  })
  return redirect(authorizeUrl(state))
}
