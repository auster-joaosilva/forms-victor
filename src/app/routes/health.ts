import { createFileRoute } from '@tanstack/react-router'
import { getHealth } from '@/server/health/composition'

export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: async () => {
        const health = await getHealth()
        return Response.json(health, { status: health.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
      },
    },
  },
})
