import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'node:http'
import path from 'node:path'

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:4000'

/**
 * Node closes idle keep-alive sockets after five seconds. A client pool that reuses one at that
 * exact moment sees ECONNRESET — which the browser reports as a 500 that never reached a server.
 * Outliving every pool in front of us removes the race for both the app and the test runner.
 */
const patientKeepAlive: PluginOption = {
  name: 'patient-keep-alive',
  configureServer(server) {
    // Vite types the server as HTTP/1 or HTTP/2; only the former carries these knobs.
    const http1 = server.httpServer as http.Server | null
    if (!http1?.keepAliveTimeout) return
    http1.keepAliveTimeout = 65_000
    http1.headersTimeout = 66_000
  },
}

export default defineConfig({
  plugins: [react(), patientKeepAlive],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      // A pooled socket the API closes at the same moment the proxy reuses it surfaces in the
      // browser as a 500 that never reached the server. Fresh sockets cost little in dev.
      '/api': { target: API_TARGET, changeOrigin: true, agent: new http.Agent({ keepAlive: false }) },
    },
  },
  preview: { port: 5175, strictPort: true },
})
