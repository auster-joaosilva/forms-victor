import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ensureCapability, exportCsv } = vi.hoisted(() => ({ ensureCapability: vi.fn(), exportCsv: vi.fn() }))
vi.mock('@/server/shared/http/route-capability', () => ({ ensureCapability }))
vi.mock('@/server/adhesion/composition', () => ({ adhesionBackoffice: { exportCsv } }))

const { Route } = await import('./adhesions[.]csv')

type Handler = (context: { request: Request }) => Promise<Response>
const get = (url: string) => (Route.options.server?.handlers as { GET: Handler }).GET({ request: new Request(url) })

describe('/backoffice/adhesions.csv', () => {
  beforeEach(() => {
    ensureCapability.mockReset()
    exportCsv.mockReset()
  })

  it('asks for export_adhesions and passes the refusal through, exporting nothing', async () => {
    ensureCapability.mockResolvedValue(new Response('o seu papel não alcança esta área', { status: 403 }))
    const response = await get('http://localhost/backoffice/adhesions.csv')
    expect(ensureCapability).toHaveBeenCalledWith(expect.any(Request), 'export_adhesions')
    expect(response.status).toBe(403)
    expect(exportCsv).not.toHaveBeenCalled()
  })

  it('exports with the screen filter, ignoring values it does not know', async () => {
    ensureCapability.mockResolvedValue({ id: 'u1', username: 'gestora', name: 'Gestora', role: 'manager', capabilities: ['export_adhesions'] })
    exportCsv.mockResolvedValue({ fileName: 'adesoes-simples-2026-10-01.csv', body: '\uFEFFprotocolo\r\n' })
    const response = await get('http://localhost/backoffice/adhesions.csv?status=filed&modality=hibrido&q=padaria')
    expect(exportCsv).toHaveBeenCalledWith({ id: 'u1', username: 'gestora' }, { status: 'filed', modality: 'hibrido', search: 'padaria' })
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="adesoes-simples-2026-10-01.csv"')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await get('http://localhost/backoffice/adhesions.csv?status=nova&modality=outra')
    expect(exportCsv).toHaveBeenLastCalledWith({ id: 'u1', username: 'gestora' }, { status: undefined, modality: undefined, search: undefined })
  })
})
