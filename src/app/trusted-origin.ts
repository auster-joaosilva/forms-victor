const originOf = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}

export const isTrustedOrigin = (origin: string, request: Request) =>
  [new URL(request.url).origin, originOf(process.env.APP_PUBLIC_URL), originOf(process.env.BETTER_AUTH_URL)].includes(origin)

// A mesma decisão do csrfProtection das server functions: vale o Sec-Fetch-Site quando o navegador manda, senão a Origin tem de ser a nossa.
export function isTrustedRequest(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin'
  const origin = request.headers.get('origin')
  return origin !== null && isTrustedOrigin(origin, request)
}
