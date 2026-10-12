import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Turns the app into an installable PWA: writes the manifest (name, icons,
    // colours) and a service worker that saves the app and recent prices offline.
    VitePWA({
      registerType: 'autoUpdate', // a new version replaces the old one on next visit
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'SenSen: Grocery prices near you',
        short_name: 'SenSen',
        description: 'Compare grocery prices across shops in Selangor and Kuala Lumpur.',
        lang: 'en',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app's own files (HTML, JS, CSS, icons) are saved at install time.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        runtimeCaching: [
          {
            // API answers: try the network first so prices are fresh; if the
            // phone is offline (or slow for 4 s), use the last saved answer.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /^\/(meta|areas|items|stores|movers|deals)\b/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sensen-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Fonts rarely change, so serve the saved copy straight away.
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'sensen-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})