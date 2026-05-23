// LinkedIn API client. Implements the OAuth 2.0 3-legged flow plus the v2 UGC
// Posts API. Three external calls per share:
//   1. POST /oauth/v2/accessToken  (code → bearer token)
//   2. GET  /v2/userinfo           (token → member URN)
//   3. POST /v2/ugcPosts            (token + URN → published share)
//
// Required env: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI

const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'
const POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts'
const SCOPES = 'openid profile email w_member_social'

function env(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`Missing env: ${key}`)
  return v
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env('LINKEDIN_CLIENT_ID'),
    redirect_uri: env('LINKEDIN_REDIRECT_URI'),
    scope: SCOPES,
    state,
  })
  return `${AUTH_URL}?${params}`
}

export async function exchangeCode(code: string): Promise<{ access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env('LINKEDIN_REDIRECT_URI'),
    client_id: env('LINKEDIN_CLIENT_ID'),
    client_secret: env('LINKEDIN_CLIENT_SECRET'),
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`token exchange failed (${res.status}): ${t}`)
  }
  return (await res.json()) as { access_token: string; expires_in: number }
}

export async function getMemberURN(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`userinfo failed (${res.status})`)
  const info = (await res.json()) as { sub: string }
  return `urn:li:person:${info.sub}`
}

export type ShareInput = {
  accessToken: string
  authorURN: string
  caption: string
  url: string
  title: string
  description: string
}

export async function createShare(opts: ShareInput): Promise<string> {
  const body = {
    author: opts.authorURN,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: opts.caption },
        shareMediaCategory: 'ARTICLE',
        media: [
          {
            status: 'READY',
            originalUrl: opts.url,
            title: { text: opts.title },
            description: { text: opts.description },
          },
        ],
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  }
  const res = await fetch(POSTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`UGC post failed (${res.status}): ${t}`)
  }
  return res.headers.get('x-restli-id') ?? ''
}
