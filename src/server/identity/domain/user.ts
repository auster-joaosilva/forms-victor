export type Role = 'admin' | 'team'

export interface UserAccount {
  id: string
  username: string
  name: string
  role: Role
  active: boolean
  lastLoginAt: Date | null
  createdAt: Date
}

export interface Actor {
  id: string
  username: string
  role: Role
}

export interface UserChanges {
  name?: string
  password?: string
  role?: Role
  active?: boolean
}

export type IdentityErrorReason = 'invalid_username' | 'weak_password' | 'username_taken' | 'not_found' | 'forbidden' | 'last_admin'

const MESSAGES: Record<IdentityErrorReason, string> = {
  invalid_username: 'usuário deve ter de 3 a 32 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado, começando por letra',
  weak_password: 'a senha precisa de pelo menos 12 caracteres',
  username_taken: 'já existe um usuário com esse nome',
  not_found: 'usuário não encontrado',
  forbidden: 'só administrador',
  last_admin: 'não dá para desativar ou rebaixar o único administrador ativo; promova outro antes',
}

export class IdentityError extends Error {
  constructor(readonly reason: IdentityErrorReason) {
    super(MESSAGES[reason])
  }
}
