import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'RAPIDA Crisis Mapping',
        short_name: 'RAPIDA',
        description: 'Community crisis damage reporting platform',
        theme_color: '#0468B1',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/submit',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // SSE stream cannot be cached or cloned — pass through without SW interception.
            urlPattern: /\/api\/v1\/reports\/stream.*/i,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /\/api\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              plugins: [
                { fetchDidFail: async () => {} }
              ]
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true }
    }
  }
})
