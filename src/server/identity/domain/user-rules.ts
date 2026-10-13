import { IdentityError, type Actor, type UserAccount, type UserChanges } from './user'

export const USERNAME_RULE = /^[a-z][a-z0-9._-]{2,31}$/
export const MINIMUM_PASSWORD = 8
const HAS_LETTER = /[A-Za-z]/
const HAS_DIGIT = /[0-9]/
const HAS_SYMBOL = /[^A-Za-z0-9]/

export function normalizeUsername(raw: string): string {
  const username = raw.trim().toLowerCase()
  if (!USERNAME_RULE.test(username)) throw new IdentityError('invalid_username')
  return username
}

export function meetsPasswordRule(password: string): boolean {
  return password.length >= MINIMUM_PASSWORD && HAS_LETTER.test(password) && HAS_DIGIT.test(password) && HAS_SYMBOL.test(password)
}

export function assertPassword(password: string): void {
  if (!meetsPasswordRule(password)) throw new IdentityError('weak_password')
}

export function assertMayChange(actor: Actor, target: UserAccount, changes: UserChanges): void {
  if (actor.role === 'admin') return
  const onlyOwnPassword =
    actor.id === target.id &&
    changes.password !== undefined &&
    changes.role === undefined &&
    changes.active === undefined &&
    changes.name === undefined
  if (!onlyOwnPassword) throw new IdentityError('forbidden')
}

export function assertKeepsAnAdmin(target: UserAccount, changes: UserChanges, activeAdmins: number): void {
  const losesAdmin =
    target.role === 'admin' && target.active && ((changes.role !== undefined && changes.role !== 'admin') || changes.active === false)
  if (losesAdmin && activeAdmins <= 1) throw new IdentityError('last_admin')
}
