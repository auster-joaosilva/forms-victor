import { createHash, randomBytes } from 'node:crypto'
import type { TokenGenerator } from '../ports/token-generator'

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

// O e-mail carrega o token puro; o banco guarda só o hash (R5). Vazar o banco não basta para redefinir a senha de ninguém.
export const createRandomTokenGenerator = (): TokenGenerator => ({
  next: () => {
    const token = randomBytes(32).toString('hex')
    return { token, tokenHash: sha256(token) }
  },
})

export const hashToken = sha256
