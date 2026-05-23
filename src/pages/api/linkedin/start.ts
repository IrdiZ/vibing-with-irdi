import type { APIRoute } from 'astro'
import { randomBytes } from 'node:crypto'
import { signValue } from '../../../lib/cookies'
import { authorizeUrl } from '../../../lib/linkedin'
import { isAdmin } from '../admin'

export const prerender = false

// Same button, two different fates depending on who clicked.
//
// Admin (signed-in via /api/admin?key=...):
//   → full OAuth flow → AI caption → auto-post to LinkedIn
//
// Anyone else:
//   → redirect to LinkedIn's no-auth share-offsite intent URL. Standard
//     share dialog opens, the visitor writes their own caption, posts to
//     their own feed. No OAuth, no Anthropic call, no cost.
export const GET: APIRoute = async ({ url, redirect, cookies, site }) => {
  const slug = url.searchParams.get('slug')
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return new Response('invalid slug', { status: 400 })
  }

  if (!isAdmin(cookies.get('vw_admin')?.value)) {
    const postUrl = new URL(`/posts/${slug}`, site).toString()
    const share = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`
    return redirect(share, 303)
  }

  // Admin: kick off the OAuth dance.
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
