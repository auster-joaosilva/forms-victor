import { randomBytes } from 'node:crypto'
import { TOKEN_LENGTH, tokenFromBytes } from '../domain/invitation'
import type { TokenSource } from '../ports/token-source'

export const randomTokenSource: TokenSource = { next: () => tokenFromBytes(randomBytes(TOKEN_LENGTH)) }
