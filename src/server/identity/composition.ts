import { recordAudit } from '@/server/audit/composition'
import { betterAuthUserAccounts } from './adapters/better-auth-user-accounts'
import { makeManageUsers } from './application/manage-users'

const manageUsers = makeManageUsers({ accounts: betterAuthUserAccounts, recordAudit })

export const listUsers = manageUsers.listUsers
export const createUser = manageUsers.createUser
export const updateUser = manageUsers.updateUser
export { IdentityError } from './domain/user'
export type { Actor, Role, UserAccount, UserChanges } from './domain/user'
