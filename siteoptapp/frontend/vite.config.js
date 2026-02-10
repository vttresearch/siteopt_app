import { defineConfig, loadEnv } from 'vite'
import { resolve, join } from 'path'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'


export default defineConfig(({ mode }) => {

  const env = loadEnv(mode, process.cwd(), '');
  const INPUT_DIR = './src';
  const OUTPUT_DIR = './dist';
  const apiBase = env.VITE_API_BASE || '/';
  const backendUrl = env.VITE_BACKEND_URL || env.VITE_API_BASE || 'http://localhost:8000';

  return {
    define: {
      'import.meta.env.VITE_API_BASE': JSON.stringify(apiBase),
    },
    plugins: [
        vue(),
        tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': resolve(INPUT_DIR),
        'vue': 'vue/dist/vue.esm-bundler.js',
      },
    },
    root: resolve(INPUT_DIR),
    base: './',
    server: {
      host: env.DJANGO_VITE_DEV_SERVER_HOST,  // TODO: undefined. set in .env.development
      port: env.DJANGO_VITE_DEV_SERVER_PORT,  // TODO: undefined. set in .env.development
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/static': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/__reload__': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
    build: {
      manifest: true,
      emptyOutDir: true,
      outDir: resolve(OUTPUT_DIR),
      assetsDir: "vite-assets",
      rollupOptions: {
        input: {
          index: join(INPUT_DIR, "index.html"),
          style: join(INPUT_DIR, "style.css"),
        },
      },
    },
  };
});
