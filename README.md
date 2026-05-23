# vibing with irdi

Personal blog. Engineering, mostly. Vibes always.

Built with [Astro](https://astro.build). Loud personal brand, dark theme,
Open Graph cards pre-rendered to PNG so the LinkedIn / Twitter previews look
sharp.

## structure

```
src/
  content/posts/         # markdown posts (one .md per post)
  content.config.ts      # frontmatter schema (title, date, excerpt, tags, ogImage)
  layouts/Layout.astro   # base layout + OG / Twitter meta
  pages/index.astro      # homepage with post list
  pages/posts/[...slug]  # per-post page
  styles/global.css      # all styling lives here
scripts/
  og-*.html              # OG card HTML templates (1200x630)
  gen-og.sh              # renders OG cards to public/og-*.png via headless Chrome
public/
  og-*.png               # pre-rendered Open Graph cards
  favicon.svg
```

## dev

```sh
npm install
npm run dev          # http://localhost:4321
```

## writing a new post

1. Drop a markdown file in `src/content/posts/<slug>.md`.
2. Frontmatter (all required except `ogImage` and `tags`):
   ```yaml
   ---
   title: my new post
   subtitle: a short one-line hook
   date: 2026-06-01
   excerpt: shows on the homepage card and as og:description
   tags: [whatever, you, want]
   ogImage: /og-mypost.png   # optional, falls back to /og-default.png
   ---
   ```
3. (Optional) add a per-post OG card: copy `scripts/og-default.html` to
   `scripts/og-mypost.html`, edit, then run `npm run og`.

## regenerating Open Graph images

```sh
npm run og
```

Renders every `scripts/og-*.html` template into `public/<name>.png` at
1200×630 using headless Chrome. No npm deps needed.

## deploy

Hybrid build: static pages prerendered, `/api/*` routes deployed as Vercel
serverless functions. For Vercel:

```sh
npm i -g vercel
vercel              # follow prompts
vercel --prod       # ship to production
```

Or connect the GitHub repo via the Vercel web UI. Astro is auto-detected,
defaults work out of the box.

## share-on-linkedin setup

The "share on linkedin" button on each post fires an OAuth flow, asks
Claude to write a viral first-person caption from the article markdown,
then posts to the authenticated member's LinkedIn feed automatically.

### 1. LinkedIn Developer Portal

- https://www.linkedin.com/developers/apps → your app
- Products tab: enable **"Sign In with LinkedIn using OpenID Connect"**
  and **"Share on LinkedIn"**.
- Auth tab → Authorized redirect URLs: add both
  - `https://<your-vercel-domain>/api/linkedin/callback`
  - `http://localhost:4321/api/linkedin/callback` (optional, for local dev)

### 2. Environment variables

Copy `.env.example` to `.env.local` for local dev (`.env.local` is
gitignored, never commit it). On Vercel, add the same variables in
Project Settings → Environment Variables.

| variable | value |
|---|---|
| `LINKEDIN_CLIENT_ID`      | from LinkedIn app Auth tab |
| `LINKEDIN_CLIENT_SECRET`  | from LinkedIn app Auth tab |
| `LINKEDIN_REDIRECT_URI`   | `https://<your-vercel-domain>/api/linkedin/callback` |
| `SESSION_SECRET`          | `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY`       | from Anthropic Console |

### 3. Flow

1. Visit any post (e.g. `/posts/openpriya`) and click **share on linkedin →**.
2. Browser redirects to LinkedIn for OAuth consent (`openid profile email
   w_member_social`).
3. LinkedIn redirects back to `/api/linkedin/callback`.
4. The callback exchanges the code for a token, fetches the member URN,
   runs the article markdown through Claude to produce a viral first-person
   caption, and posts via the v2 UGC Posts API.
5. You land back on `/posts/<slug>?shared=1` with a success state.

OAuth state cookie is HMAC-signed with `SESSION_SECRET` so the slug
round-trip can't be tampered with. Access tokens are never persisted —
every share runs through OAuth fresh.
