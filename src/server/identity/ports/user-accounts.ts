import type { Role, UserAccount } from '../domain/user'

export interface UserAccounts {
  list(): Promise<UserAccount[]>
  findByUsername(username: string): Promise<UserAccount | null>
  countActiveAdmins(): Promise<number>
  create(input: { username: string; name: string; password: string; role: Role }): Promise<UserAccount>
  rename(id: string, name: string): Promise<void>
  setRole(id: string, role: Role): Promise<void>
  setActive(id: string, active: boolean): Promise<void>
  setPassword(id: string, password: string): Promise<void>
}
