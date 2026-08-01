import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves this repo from a sub-path. The service worker scope,
// start_url and asset URLs all have to agree with it or the PWA never installs.
// Override with BASE_PATH=/ when deploying to a custom domain.
const base = process.env.BASE_PATH ?? '/hashlamot/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'השלמות',
        short_name: 'השלמות',
        description: 'רשימת הקניות המשותפת של אמא ואבא',
        lang: 'he',
        dir: 'rtl',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FBFAF6',
        theme_color: '#2B5CD9',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Product photos they took. Without these cached the offline list
            // is text-only and loses the visual recognition it was built for.
            urlPattern: /\/storage\/v1\/object\/public\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-images',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Never serve a cached shell for API calls.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/realtime\//],
      },
    }),
  ],
})
