export interface NewPasswordResetToken {
  userId: string
  tokenHash: string
  expiresAt: Date
}

export interface StoredPasswordResetToken {
  id: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
}

export interface PasswordResetTokens {
  // Grava o novo e invalida qualquer token anterior do mesmo usuário, numa única operação (R5).
  issue(token: NewPasswordResetToken): Promise<void>
  findByHash(tokenHash: string): Promise<StoredPasswordResetToken | null>
  markUsed(id: string, at: Date): Promise<void>
  // Quando saiu o token mais recente do usuário, usado ou não: base do limite de um pedido a cada 10 minutos.
  lastIssuedAt(userId: string): Promise<Date | null>
}
