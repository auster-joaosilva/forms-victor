const originOf = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}

export const isTrustedOrigin = (origin: string, request: Request) =>
  [new URL(request.url).origin, originOf(process.env.APP_PUBLIC_URL), originOf(process.env.BETTER_AUTH_URL)].includes(origin)

// Same decision as csrfProtection for server functions: Sec-Fetch-Site wins when the browser sends it, else the Origin must be ours.
export function isTrustedRequest(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin'
  const origin = request.headers.get('origin')
  return origin !== null && isTrustedOrigin(origin, request)
}
