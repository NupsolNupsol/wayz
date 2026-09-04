import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'node:http'
import path from 'node:path'

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:4000'

const patientKeepAlive: PluginOption = {
  name: 'patient-keep-alive',
  configureServer(server) {
    const http1 = server.httpServer as http.Server | null
    if (!http1?.keepAliveTimeout) return
    http1.keepAliveTimeout = 65_000
    http1.headersTimeout = 66_000
  },
}

const apiProxy = {
  '/api': { target: API_TARGET, changeOrigin: true, agent: new http.Agent({ keepAlive: false }) },
}

export default defineConfig({
  plugins: [react(), patientKeepAlive],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5175, strictPort: true, proxy: apiProxy },
  preview: { port: 5175, strictPort: true, proxy: apiProxy },
})
