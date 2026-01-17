import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
      babel: {
        plugins: [
          ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@lib': path.resolve(__dirname, './src/lib'),
      'three': path.resolve(__dirname, 'node_modules/three'),
    }
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  base: process.env.IS_ELECTRON ? './' : '/',
  build: {
    outDir: 'dist',
    commonjsOptions: {
      include: [/three/, /node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    host: true, // 📱 Expone el servidor en la red local para iPhone
    port: 5173,
    allowedHosts: [
      '.trycloudflare.com', // 🌐 Permitir todos los túneles de Cloudflare
      '.loca.lt', // 🌐 Permitir todos los túneles de Localtunnel
      'localhost',
      '.local'
    ],
    watch: {
      usePolling: true,
    },
  },
}) 