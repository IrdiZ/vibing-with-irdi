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

Static output. Drop `dist/` on any static host. For Vercel:

```sh
npm i -g vercel
vercel              # follow prompts
vercel --prod       # ship to production
```

Or connect the GitHub repo via the Vercel web UI. Astro is auto-detected,
defaults work out of the box.
