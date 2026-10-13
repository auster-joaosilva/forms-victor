export interface TokenGenerator {
  // O token em si (para o link) e o hash que vai para o banco nunca saem juntos de um caso de uso para fora.
  next(): { token: string; tokenHash: string }
}
