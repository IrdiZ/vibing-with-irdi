import type { APIRoute } from 'astro'
import { toggleLike, isValidSlug, isValidUid } from '../../../lib/stats'

export const prerender = false

// POST /api/like/<slug>  body: { uid }
// Toggle a like for the given uid on this slug. Returns the new state.
export const POST: APIRoute = async ({ params, request }) => {
  const { slug } = params
  if (!isValidSlug(slug)) return json({ error: 'bad slug' }, 400)
  let body: { uid?: string }
  try {
    body = (await request.json()) as { uid?: string }
  } catch {
    return json({ error: 'bad json' }, 400)
  }
  if (!isValidUid(body.uid)) return json({ error: 'bad uid' }, 400)
  try {
    const result = await toggleLike(slug, body.uid)
    return json(result)
  } catch (e) {
    return json({ error: errMsg(e) }, 500)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
