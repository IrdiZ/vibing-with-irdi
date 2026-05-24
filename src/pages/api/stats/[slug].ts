import type { APIRoute } from 'astro'
import { getStats, isValidSlug, isValidUid } from '../../../lib/stats'

export const prerender = false

// GET /api/stats/<slug>?uid=<uid>
// Returns { likes, views, liked }. Used by the post page on load.
export const GET: APIRoute = async ({ params, url }) => {
  const { slug } = params
  if (!isValidSlug(slug)) return json({ error: 'bad slug' }, 400)
  const uidParam = url.searchParams.get('uid')
  const uid = isValidUid(uidParam) ? uidParam : null
  try {
    const stats = await getStats(slug, uid)
    return json(stats)
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
