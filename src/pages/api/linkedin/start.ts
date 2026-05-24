import type { APIRoute } from 'astro'

export const prerender = false

// Redirects to LinkedIn's standard share-offsite dialog. The visitor (or me)
// writes the caption in LinkedIn's own UI and posts to their feed. No OAuth,
// no API keys, no server-side caption generation.
export const GET: APIRoute = async ({ url, redirect, site }) => {
  const slug = url.searchParams.get('slug')
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return new Response('invalid slug', { status: 400 })
  }
  const postUrl = new URL(`/posts/${slug}`, site).toString()
  const share = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`
  return redirect(share, 303)
}
