import { defineConfig } from 'astro/config'

// Update this once the production URL is known. Used for canonical URLs and
// social-card og:url so LinkedIn / Twitter cards point at the right place.
const SITE = process.env.SITE ?? 'https://vibing-with-irdi.vercel.app'

export default defineConfig({
  site: SITE,
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
})
