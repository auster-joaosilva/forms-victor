const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
}

const apply = (headers: Headers) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value)
}

export function withSecurityHeaders(response: Response): Response {
  try {
    apply(response.headers)
    return response
  } catch {
    const copy = new Response(response.body, response)
    apply(copy.headers)
    return copy
  }
}
