import { createCsrfMiddleware } from '@tanstack/react-start'
import { isTrustedOrigin } from './trusted-origin'

// Declaring requestMiddleware in start.ts drops TanStack Start's default CSRF check, so it is added back here.
export const csrfProtection = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
  origin: (origin, { request }) => isTrustedOrigin(origin, request),
})
