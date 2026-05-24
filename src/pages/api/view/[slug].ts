import type { APIRoute } from 'astro'
import { registerView, isValidSlug, isValidUid } from '../../../lib/stats'

export const prerender = false

// POST /api/view/<slug>  body: { uid }
// Register a unique view from this uid. Idempotent — calling more than once
// from the same uid is a no-op.
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
  // Bot heuristic: skip obvious crawler user-agents so they don't inflate views.
  const ua = (request.headers.get('user-agent') ?? '').toLowerCase()
  if (/(bot|crawler|spider|preview|fetch|curl|wget|httrack|slurp)/.test(ua)) {
    return json({ views: 0, new: false })
  }
  try {
    const result = await registerView(slug, body.uid)
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
