import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSessionUser, recordAccessDenied } = vi.hoisted(() => ({ getSessionUser: vi.fn(), recordAccessDenied: vi.fn() }))
vi.mock('./session', () => ({ getSessionUser }))
vi.mock('../auth/access-audit', () => ({ recordAccessDenied }))
vi.mock('@tanstack/react-start/server', () => ({ getRequest: () => new Request('http://localhost/_serverFn/x') }))

const { AuthorizationError, requireCapability } = await import('./session-middleware')
const { ACCESS_RESTRICTED, ROLE_CANNOT_REACH } = await import('./access-messages')

const user = (role: string, capabilities: string[]) => ({ id: 'u1', username: 'maria', name: 'Maria', role, capabilities })

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

  it('still refuses with AuthorizationError, not the storage error, when the refusal cannot be recorded', async () => {
    getSessionUser.mockResolvedValue(user('operator', ['view_responses']))
    recordAccessDenied.mockRejectedValue(new Error('connection refused: postgres'))
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { next, result } = run('manage_users')
    await expect(result).rejects.toMatchObject({ reason: 'forbidden', message: ROLE_CANNOT_REACH })
    expect(next).not.toHaveBeenCalled()
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })

  it('hands the session user to the handler when the role has the capability', async () => {
    getSessionUser.mockResolvedValue(user('admin', ['manage_users']))
    const { next, result } = run('manage_users')
    await result
    expect(next).toHaveBeenCalledWith({ context: { session: { user: user('admin', ['manage_users']) } } })
    expect(recordAccessDenied).not.toHaveBeenCalled()
  })
})
