import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSessionUser, recordAccessDenied } = vi.hoisted(() => ({ getSessionUser: vi.fn(), recordAccessDenied: vi.fn() }))
vi.mock('./session', () => ({ getSessionUser }))
vi.mock('../auth/access-audit', () => ({ recordAccessDenied }))
vi.mock('@tanstack/react-start/server', () => ({ getRequest: () => new Request('http://localhost/_serverFn/x') }))

const { AuthorizationError, ensureCapability, requireCapability, ROLE_CANNOT_REACH, ACCESS_RESTRICTED } = await import('./session-middleware')

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

  it('reads the role again on every request, so a demotion counts at once', async () => {
    getSessionUser.mockResolvedValueOnce(user('manager', ['export_responses'])).mockResolvedValueOnce(user('operator', ['view_responses']))
    expect(await ensureCapability(request(), 'export_responses')).toMatchObject({ username: 'maria', role: 'manager' })
    expect(((await ensureCapability(request(), 'export_responses')) as Response).status).toBe(403)
    expect(getSessionUser).toHaveBeenCalledTimes(2)
  })
})

describe('requireCapability', () => {
  type Server = (options: { next(options: { context: unknown }): unknown }) => Promise<unknown>
  const run = (capability: Parameters<typeof requireCapability>[0]) => {
    const next = vi.fn((options: { context: unknown }) => options)
    const server = requireCapability(capability).options.server as unknown as Server
    return { next, result: server({ next }) }
  }

  beforeEach(() => {
    getSessionUser.mockReset()
    recordAccessDenied.mockReset()
  })

  it('refuses without a session and records nothing', async () => {
    getSessionUser.mockResolvedValue(null)
    const { next, result } = run('view_responses')
    await expect(result).rejects.toMatchObject({ reason: 'unauthenticated', message: ACCESS_RESTRICTED })
    expect(next).not.toHaveBeenCalled()
    expect(recordAccessDenied).not.toHaveBeenCalled()
  })

  it('refuses a role without the capability and records access_denied with the capability as reference', async () => {
    getSessionUser.mockResolvedValue(user('operator', ['dashboard', 'view_responses']))
    const { next, result } = run('manage_users')
    await expect(result).rejects.toBeInstanceOf(AuthorizationError)
    await expect(result).rejects.toMatchObject({ reason: 'forbidden', message: ROLE_CANNOT_REACH })
    expect(next).not.toHaveBeenCalled()
    expect(recordAccessDenied).toHaveBeenCalledWith({ id: 'u1', username: 'maria', role: 'operator' }, 'manage_users')
  })

  it('hands the session user to the handler when the role has the capability', async () => {
    getSessionUser.mockResolvedValue(user('admin', ['manage_users']))
    const { next, result } = run('manage_users')
    await result
    expect(next).toHaveBeenCalledWith({ context: { session: { user: user('admin', ['manage_users']) } } })
    expect(recordAccessDenied).not.toHaveBeenCalled()
  })
})
