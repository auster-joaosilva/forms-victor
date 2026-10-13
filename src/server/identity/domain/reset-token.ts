// 1h para o pedido do próprio usuário (R5); 48h para o link que o admin manda em lote, porque dar tempo de abrir
// importa mais que encurtar a janela quando quem está enviando já é de confiança.
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000
export const BATCH_RESET_TOKEN_TTL_MS = 48 * 60 * 60 * 1000

export function tokenExpiry(now: Date, ttlMs: number = RESET_TOKEN_TTL_MS): Date {
  return new Date(now.getTime() + ttlMs)
}

export function isUsableToken(token: { expiresAt: Date; usedAt: Date | null }, now: Date): boolean {
  return token.usedAt === null && token.expiresAt.getTime() > now.getTime()
}
