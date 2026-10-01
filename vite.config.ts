import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

// Fills %SITE_URL% in index.html and emits robots.txt (+ sitemap.xml). With no
// site URL (not deployed yet) every line that needs an absolute URL is dropped
// instead of shipping a fake domain.
function seoPlugin(siteUrl: string): Plugin {
  return {
    name: 'flowboard-seo',
    transformIndexHtml: (html) =>
      siteUrl
        ? html.replaceAll('%SITE_URL%', siteUrl)
        : html
            .split('\n')
            .filter((line) => !line.includes('%SITE_URL%'))
            .join('\n'),
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ''}`,
      })
      if (!siteUrl) return
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}/</loc>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = (env.VITE_SITE_URL ?? '').replace(/\/$/, '')
  if (mode === 'production' && !siteUrl) {
    console.warn('[seo] VITE_SITE_URL not set; canonical, og:url/image and sitemap are omitted')
  }
  return { plugins: [react(), seoPlugin(siteUrl)] }
})
