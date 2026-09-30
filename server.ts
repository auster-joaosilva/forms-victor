import { serve } from 'srvx'
import { staticMiddleware } from 'srvx/static'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore saída do build: existe só depois de pnpm build
import app from './dist/server/server.js'

serve({
  port: Number(process.env.PORT ?? 3000),
  hostname: '0.0.0.0',
  middleware: [staticMiddleware({ dir: 'dist/client' })],
  fetch: app.fetch,
})
