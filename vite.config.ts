import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { viteSourceLocator } from "@metagptx/vite-plugin-source-locator";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    viteSourceLocator({
      prefix: "mgx",
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Bundle optimization settings
    chunkSizeWarningLimit: 600, // Increase warning limit slightly
    sourcemap: mode !== 'production', // Disable sourcemaps in production for obfuscation
    minify: 'terser', // Use terser for better minification
    terserOptions: {
      compress: {
        drop_console: mode === 'production', // Remove console logs in production
        drop_debugger: true, // Remove debugger statements
        pure_funcs: mode === 'production' ? ['console.log', 'console.info', 'console.debug', 'console.warn'] : [], // Remove specific console methods
      },
      mangle: {
        // Mangle variable names for obfuscation with safer settings
        toplevel: false, // Disable toplevel mangling to prevent undefined property access
        safari10: true, // Fix Safari 10 bugs
        properties: false, // Disable property mangling to prevent runtime errors
      },
      format: {
        comments: false, // Remove all comments
      },
    },
    rollupOptions: {
      output: {
        // Manual chunking strategy for better code splitting
        manualChunks: {
          // Vendor chunk for React and related libraries
          vendor: ['react', 'react-dom', 'react-router-dom'],
          
          // UI component libraries chunk
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-accordion',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-aspect-ratio'
          ],
          
          // Icons and animations chunk
          icons: ['lucide-react', 'lottie-react'],
          
          // Utilities chunk
          utils: [
            'clsx',
            'tailwind-merge',
            'class-variance-authority',
            'date-fns',
            'zod',
            'jwt-decode'
          ],
          
          // Data management chunk
          data: [
            '@tanstack/react-query',
            'zustand',
            'react-hook-form',
            '@hookform/resolvers'
          ],
          
          // Large third-party libraries
          charts: ['recharts'],
          notifications: ['sonner', 'alertifyjs', 'sweetalert2'],
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/display.html': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/display.js': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
}));
