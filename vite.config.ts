import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

function walletSyncPlugin() {
  return {
    name: 'wallet-sync-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api-sync-wallet', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let bodyStr = '';
        req.on('data', (chunk: any) => { bodyStr += chunk; });
        req.on('end', async () => {
          try {
            const { url, username, password, endpoint } = JSON.parse(bodyStr || '{}');
            const cleanUrl = (url || 'https://arena-wallet-pi.vercel.app').replace(/\/+$/, '');
            let cookieHeader = '';

            if (!username || !password) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'لطفاً نام کاربری و رمز عبور کیف پول خود را وارد نمایید.' }));
              return;
            }

            // ۱. احراز هویت در کیف پول آنلاین
            const authRes = await fetch(`${cleanUrl}/api/auth`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'login',
                username: String(username).trim(),
                password: String(password),
              }),
            });

            if (!authRes.ok) {
              const errData = await authRes.json().catch(() => ({}));
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.statusCode = authRes.status;
              res.end(JSON.stringify({ error: errData.error || 'نام کاربری یا رمز عبور کیف پول اشتباه است.' }));
              return;
            }

            // دریافت کوکی سشن
            const rawCookie = authRes.headers.get('set-cookie');
            if (rawCookie) {
              const match = rawCookie.match(/arena_wallet_session=[^;]+/);
              if (match) {
                cookieHeader = match[0];
              }
            }

            // ۲. دریافت اطلاعات از اندپوینت درخواستی
            const headers: Record<string, string> = {
              'Accept': 'application/json',
            };
            if (cookieHeader) {
              headers['Cookie'] = cookieHeader;
            }

            const targetPath = endpoint || '/api/transactions?limit=250';
            const txRes = await fetch(`${cleanUrl}${targetPath}`, {
              headers,
            });

            if (!txRes.ok) {
              const errData = await txRes.json().catch(() => ({}));
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.statusCode = txRes.status;
              res.end(JSON.stringify({ error: errData.error || `عدم دسترسی به تراکنش‌ها (${txRes.status})` }));
              return;
            }

            const data = await txRes.json();
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = 200;
            res.end(JSON.stringify(data));
          } catch (err: any) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err?.message || 'خطای سرور محلی در دریافت اطلاعات' }));
          }
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), walletSyncPlugin()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      '/api-wallet': {
        target: 'https://arena-wallet-pi.vercel.app',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api-wallet/, ''),
      },
    },
  },
}));
