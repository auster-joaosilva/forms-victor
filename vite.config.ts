import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    // Rotas vivem na camada `app/`, conforme bulletproof-react. O plugin
    // resolve estes caminhos a partir de `srcDirectory` e NAO le o
    // tsr.config.json — que existe apenas para o CLI `tsr generate`.
    tanstackStart({
      srcDirectory: 'src',
      router: {
        routesDirectory: 'app/routes',
        generatedRouteTree: 'app/routeTree.gen.ts',
      },
    }),
    viteReact(),
  ],
})

export default config
