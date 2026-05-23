import type { APIRoute } from 'astro'
import { getEntry } from 'astro:content'
import { unsignValue } from '../../../lib/cookies'
import { exchangeCode, getMemberURN, createShare } from '../../../lib/linkedin'
import { generateViralCaption } from '../../../lib/caption'

export const prerender = false

export const GET: APIRoute = async ({ url, cookies, redirect, site }) => {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) return redirect(`/?li_error=${encodeURIComponent(error)}`, 303)
  if (!code || !state) return new Response('missing code or state', { status: 400 })

  const signed = cookies.get('li_state')?.value
  cookies.delete('li_state', { path: '/' })
  if (!signed) return new Response('no state cookie', { status: 400 })
  const verified = unsignValue(signed)
  if (verified !== state) return new Response('state mismatch', { status: 400 })

  const slug = state.split(':')[0]
  const post = await getEntry('posts', slug)
  if (!post) return new Response('unknown post', { status: 404 })

  try {
    const { access_token } = await exchangeCode(code)
    const authorURN = await getMemberURN(access_token)

    const postUrl = new URL(`/posts/${slug}`, site).toString()
    const caption = await generateViralCaption({
      title: post.data.title,
      excerpt: post.data.excerpt,
      bodyMarkdown: post.body ?? '',
      url: postUrl,
    })

    await createShare({
      accessToken: access_token,
      authorURN,
      caption,
      url: postUrl,
      title: post.data.title,
      description: post.data.excerpt,
    })

    return redirect(`/posts/${slug}?shared=1`, 303)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[linkedin callback] failed:', msg)
    return redirect(`/posts/${slug}?li_error=${encodeURIComponent(msg)}`, 303)
  }
}
