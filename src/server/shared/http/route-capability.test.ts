import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSessionUser, recordAccessDenied } = vi.hoisted(() => ({ getSessionUser: vi.fn(), recordAccessDenied: vi.fn() }))
vi.mock('./session', () => ({ getSessionUser }))
vi.mock('../auth/access-audit', () => ({ recordAccessDenied }))

const { ensureCapability } = await import('./route-capability')
const { ACCESS_RESTRICTED, ROLE_CANNOT_REACH } = await import('./access-messages')

const request = () => new Request('http://localhost/backoffice/responses.csv?q=x')
const user = (role: string, capabilities: string[]) => ({ id: 'u1', username: 'maria', name: 'Maria', role, capabilities })

describe('ensureCapability', () => {
  beforeEach(() => {
    getSessionUser.mockReset()
    recordAccessDenied.mockReset()
  })

  it('answers 401 with the old text without a session and records nothing', async () => {
    getSessionUser.mockResolvedValue(null)
    const result = await ensureCapability(request(), 'export_responses')
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
    expect(await (result as Response).text()).toBe(ACCESS_RESTRICTED)
    expect(recordAccessDenied).not.toHaveBeenCalled()
  })

  it('answers 403 and records the refusal with the path when the role lacks the capability', async () => {
    getSessionUser.mockResolvedValue(user('regularization', ['dashboard', 'view_responses']))
    const result = await ensureCapability(request(), 'export_responses')
    expect((result as Response).status).toBe(403)
    expect(await (result as Response).text()).toBe(ROLE_CANNOT_REACH)
    expect(recordAccessDenied).toHaveBeenCalledWith({ id: 'u1', username: 'maria', role: 'regularization' }, 'export_responses', '/backoffice/responses.csv')
  })

  it('still answers 403 when the refusal cannot be recorded', async () => {
    getSessionUser.mockResolvedValue(user('operator', ['view_responses']))
    recordAccessDenied.mockRejectedValue(new Error('connection refused: postgres'))
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const result = await ensureCapability(request(), 'export_responses')
    expect((result as Response).status).toBe(403)
    expect(await (result as Response).text()).toBe(ROLE_CANNOT_REACH)
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })

  it('reads the role again on every request, so a demotion counts at once', async () => {
    getSessionUser.mockResolvedValueOnce(user('manager', ['export_responses'])).mockResolvedValueOnce(user('operator', ['view_responses']))
    expect(await ensureCapability(request(), 'export_responses')).toMatchObject({ username: 'maria', role: 'manager' })
    expect(((await ensureCapability(request(), 'export_responses')) as Response).status).toBe(403)
    expect(getSessionUser).toHaveBeenCalledTimes(2)
  })
})
