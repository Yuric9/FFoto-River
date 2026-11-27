import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      // "server-only" só faz sentido dentro do Next; nos testes vira um módulo vazio
      'server-only': path.resolve(__dirname, 'tests/stubs/empty.ts')
    }
  },
  test: { environment: 'node' }
})
