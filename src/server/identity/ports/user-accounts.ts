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
  setEmail(id: string, email: string): Promise<void>
  // Tudo ou nada: se um e-mail do lote já pertence a outra conta, lança `email_taken` e nada é gravado.
  setEmails(pairs: { id: string; email: string }[]): Promise<void>
}

// O pedaço de `UserAccounts` de que os casos de uso de e-mail (um a um e em lote) precisam.
export interface AccountEmailPort {
  findByUsername(username: string): Promise<{ id: string } | null>
  setEmail(id: string, email: string): Promise<void>
  setEmails(pairs: { id: string; email: string }[]): Promise<void>
}
