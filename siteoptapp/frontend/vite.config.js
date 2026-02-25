import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'


export default defineConfig(({ mode }) => {

  const env = loadEnv(mode, process.cwd(), '');
  const INPUT_DIR = fileURLToPath(new URL('./src', import.meta.url));
  const OUTPUT_DIR = fileURLToPath(new URL('./dist', import.meta.url));

  return {
    define: {
      'import.meta.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE),  // Add variable to env vars manually
    },
    plugins: [
        vue(),
        tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    root: INPUT_DIR,
    base: './',
    server: {
      host: env.DJANGO_VITE_DEV_SERVER_HOST,
      port: env.DJANGO_VITE_DEV_SERVER_PORT,
      watch: {
        usePolling: true,
        interval: 100
      }
    },
    build: {
      manifest: true,
      emptyOutDir: true,
      outDir: OUTPUT_DIR,
      assetsDir: "vite-assets",
      rollupOptions: {
        input: {
          index: resolve(INPUT_DIR, "index.html"),
          style: resolve(INPUT_DIR, "style.css"),
        },
      },
    },
  }
});
