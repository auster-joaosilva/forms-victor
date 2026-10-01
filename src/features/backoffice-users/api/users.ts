import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { IdentityError, createUser, listUsers, updateUser } from '@/server/identity/composition'
import type { Role } from '@/server/identity/domain/user'
import { ROLES } from '@/server/shared/domain/permissions'
import { adminMiddleware, sessionMiddleware } from '@/server/shared/http/session-middleware'

export type UserRow = { id: string; username: string; name: string; role: Role; active: boolean; lastLoginAt: string | null; createdAt: string }
export type Outcome = { ok: true } | { ok: false; message: string }

const role = z.enum(ROLES)
const password = z.string().max(128)

const outcome = async (run: () => Promise<unknown>): Promise<Outcome> => {
  try {
    await run()
    return { ok: true }
  } catch (error) {
    if (error instanceof IdentityError) return { ok: false, message: error.message }
    throw error
  }
}

export const listUsersFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async (): Promise<UserRow[]> =>
    (await listUsers()).map((user) => ({ ...user, lastLoginAt: user.lastLoginAt?.toISOString() ?? null, createdAt: user.createdAt.toISOString() })),
  )

export const createUserFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator(z.object({ username: z.string().max(64), name: z.string().max(120), password, role }))
  .handler(({ data, context }) => outcome(() => createUser(context.session.user, data)))

export const updateUserFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator(
    z.object({
      username: z.string().max(64),
      changes: z.object({ name: z.string().max(120).optional(), password: password.optional(), role: role.optional(), active: z.boolean().optional() }),
    }),
  )
  .handler(({ data, context }) => outcome(() => updateUser(context.session.user, data.username, data.changes)))

export const changeOwnPasswordFn = createServerFn({ method: 'POST' })
  .middleware([sessionMiddleware])
  .inputValidator(z.object({ password }))
  .handler(({ data, context }) => outcome(() => updateUser(context.session.user, context.session.user.username, { password: data.password })))
