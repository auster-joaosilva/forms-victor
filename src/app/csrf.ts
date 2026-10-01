import { createCsrfMiddleware } from '@tanstack/react-start'

const originOf = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}

// Declaring requestMiddleware in start.ts drops TanStack Start's default CSRF check, so it is added back here.
export const csrfProtection = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
  origin: (origin, { request }) =>
    [new URL(request.url).origin, originOf(process.env.APP_PUBLIC_URL), originOf(process.env.BETTER_AUTH_URL)].includes(origin),
})
