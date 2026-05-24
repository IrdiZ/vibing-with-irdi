import { Redis } from '@upstash/redis'

// Tiny stats backend for hearts + views. Uses Upstash Redis (free tier
// covers tens of thousands of ops/day, more than enough for a personal blog).
//
// Required env (set on Vercel + .env.local):
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//
// Data model (all keys are flat, slug-scoped):
//   stats:<slug>:likes    : integer counter
//   stats:<slug>:views    : integer counter
//   stats:<slug>:likers   : set<uid>   (so a single visitor can only +1 once)
//   stats:<slug>:viewers  : set<uid>   (unique view dedupe)

let cached: Redis | null = null

function redis(): Redis {
  if (cached) return cached
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Upstash env vars missing')
  cached = new Redis({ url, token })
  return cached
}

export function isStatsConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

export type PostStats = {
  likes: number
  views: number
  liked: boolean
}

export async function getStats(slug: string, uid: string | null): Promise<PostStats> {
  if (!isStatsConfigured()) return { likes: 0, views: 0, liked: false }
  const r = redis()
  const [likes, views, liked] = await Promise.all([
    r.get<number>(`stats:${slug}:likes`).then((v) => v ?? 0),
    r.get<number>(`stats:${slug}:views`).then((v) => v ?? 0),
    uid ? r.sismember(`stats:${slug}:likers`, uid).then((v) => v === 1) : Promise.resolve(false),
  ])
  return { likes, views, liked }
}

// Toggle the like for `uid` on `slug`. Returns the new state.
export async function toggleLike(slug: string, uid: string): Promise<{ liked: boolean; likes: number }> {
  if (!isStatsConfigured()) return { liked: false, likes: 0 }
  const r = redis()
  const wasLiked = (await r.sismember(`stats:${slug}:likers`, uid)) === 1
  if (wasLiked) {
    await Promise.all([
      r.srem(`stats:${slug}:likers`, uid),
      r.decr(`stats:${slug}:likes`),
    ])
  } else {
    await Promise.all([
      r.sadd(`stats:${slug}:likers`, uid),
      r.incr(`stats:${slug}:likes`),
    ])
  }
  const likes = (await r.get<number>(`stats:${slug}:likes`)) ?? 0
  return { liked: !wasLiked, likes: Math.max(0, likes) }
}

// Register a unique view from `uid`. Returns the new view count.
export async function registerView(slug: string, uid: string): Promise<{ views: number; new: boolean }> {
  if (!isStatsConfigured()) return { views: 0, new: false }
  const r = redis()
  const added = await r.sadd(`stats:${slug}:viewers`, uid)
  if (added === 1) await r.incr(`stats:${slug}:views`)
  const views = (await r.get<number>(`stats:${slug}:views`)) ?? 0
  return { views, new: added === 1 }
}

// Slug guard — block weird input from hitting Redis with arbitrary keys.
export function isValidSlug(s: string | undefined | null): s is string {
  return typeof s === 'string' && /^[a-z0-9-]{1,80}$/.test(s)
}

// uid guard — same reason.
export function isValidUid(s: string | undefined | null): s is string {
  return typeof s === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(s)
}
