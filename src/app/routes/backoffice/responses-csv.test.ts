import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSessionUser, exportResponses } = vi.hoisted(() => ({ getSessionUser: vi.fn(), exportResponses: vi.fn() }))
vi.mock('@/server/shared/http/session', () => ({ getSessionUser }))
vi.mock('@/server/diagnosis/composition', () => ({ responseBackoffice: { exportResponses } }))

const { Route } = await import('./responses[.]csv')

type Handler = (context: { request: Request }) => Promise<Response>
const get = (url: string) => (Route.options.server?.handlers as { GET: Handler }).GET({ request: new Request(url) })

describe('/backoffice/responses.csv', () => {
  beforeEach(() => {
    getSessionUser.mockReset()
    exportResponses.mockReset()
  })

  it('refuses without a session, with the legacy text, and exports nothing', async () => {
    getSessionUser.mockResolvedValue(null)
    const response = await get('http://localhost/backoffice/responses.csv')
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Acesso restrito.')
    expect(exportResponses).not.toHaveBeenCalled()
  })

  it('exports with the screen filter for the logged user', async () => {
    getSessionUser.mockResolvedValue({ id: 'u1', username: 'maria', name: 'Maria', role: 'team' })
    exportResponses.mockResolvedValue({ fileName: 'respostas-simples-2026-09-30.csv', body: 'x', count: 0 })
    const response = await get('http://localhost/backoffice/responses.csv?status=validated&q=padaria')
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="respostas-simples-2026-09-30.csv"')
    expect(exportResponses).toHaveBeenCalledWith({ id: 'u1', username: 'maria' }, { status: 'validated', search: 'padaria' })
  })
})
