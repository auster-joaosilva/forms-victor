import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ensureCapability, exportResponses } = vi.hoisted(() => ({ ensureCapability: vi.fn(), exportResponses: vi.fn() }))
vi.mock('@/server/shared/http/session-middleware', () => ({ ensureCapability }))
vi.mock('@/server/diagnosis/composition', () => ({ responseBackoffice: { exportResponses } }))

const { Route } = await import('./responses[.]csv')

type Handler = (context: { request: Request }) => Promise<Response>
const get = (url: string) => (Route.options.server?.handlers as { GET: Handler }).GET({ request: new Request(url) })

describe('/backoffice/responses.csv', () => {
  beforeEach(() => {
    ensureCapability.mockReset()
    exportResponses.mockReset()
  })

  it('returns the refusal of the guard and exports nothing', async () => {
    ensureCapability.mockResolvedValue(new Response('Acesso restrito.', { status: 401 }))
    const response = await get('http://localhost/backoffice/responses.csv')
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Acesso restrito.')
    expect(ensureCapability).toHaveBeenCalledWith(expect.any(Request), 'export_responses')
    expect(exportResponses).not.toHaveBeenCalled()
  })

  it('exports with the screen filter for the logged user', async () => {
    ensureCapability.mockResolvedValue({ id: 'u1', username: 'maria', name: 'Maria', role: 'manager', capabilities: ['export_responses'] })
    exportResponses.mockResolvedValue({ fileName: 'respostas-simples-2026-09-30.csv', body: 'x', count: 0 })
    const response = await get('http://localhost/backoffice/responses.csv?status=validated&q=padaria')
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="respostas-simples-2026-09-30.csv"')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.text()).toBe('x')
    expect(exportResponses).toHaveBeenCalledWith({ id: 'u1', username: 'maria' }, { status: 'validated', search: 'padaria' })
  })
})
