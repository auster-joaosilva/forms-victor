import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ensureCapability, exportCsv } = vi.hoisted(() => ({ ensureCapability: vi.fn(), exportCsv: vi.fn() }))
vi.mock('@/server/shared/http/route-capability', () => ({ ensureCapability }))
vi.mock('@/server/events/composition', () => ({ eventBackoffice: { exportCsv } }))

const { Route } = await import('./events/$id/registrations[.]csv')

type Handler = (context: { request: Request; params: { id: string } }) => Promise<Response>
const handler = (Route.options.server?.handlers as { GET: Handler }).GET
const get = (url: string, id = '9') => handler({ request: new Request(`http://localhost${url}`), params: { id } })
const admin = { id: 'u1', username: 'victor', name: 'Victor', role: 'admin', capabilities: [] }

describe('GET /backoffice/events/:id/registrations.csv', () => {
  beforeEach(() => {
    ensureCapability.mockReset()
    exportCsv.mockReset()
  })

  it('refuses without export_registrations with the answer of ensureCapability', async () => {
    ensureCapability.mockResolvedValue(new Response('o seu papel não alcança esta área', { status: 403 }))
    const response = await get('/backoffice/events/9/registrations.csv')
    expect(response.status).toBe(403)
    expect(ensureCapability).toHaveBeenCalledWith(expect.any(Request), 'export_registrations')
    expect(exportCsv).not.toHaveBeenCalled()
  })

  it('exports with the filters of the old portal and the attachment headers', async () => {
    ensureCapability.mockResolvedValue(admin)
    exportCsv.mockResolvedValue({ fileName: 'inscritos-2026-10-03.csv', body: '﻿protocolo\r\n' })
    const response = await get('/backoffice/events/9/registrations.csv?sessao=3&situacao=present&busca=ana')
    expect(exportCsv).toHaveBeenCalledWith({ id: 'u1', username: 'victor' }, 9, { sessionId: 3, status: 'present', search: 'ana' })
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="inscritos-2026-10-03.csv"')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new TextEncoder().encode('﻿protocolo\r\n'))
  })

  it('ignores unknown filters and answers 404 for an unknown or malformed event', async () => {
    ensureCapability.mockResolvedValue(admin)
    exportCsv.mockResolvedValue(null)
    expect((await get('/backoffice/events/9/registrations.csv?situacao=constructor&sessao=x')).status).toBe(404)
    expect(exportCsv).toHaveBeenCalledWith({ id: 'u1', username: 'victor' }, 9, { sessionId: undefined, status: undefined, search: undefined })
    expect((await get('/backoffice/events/abc/registrations.csv', 'abc')).status).toBe(404)
  })
})
