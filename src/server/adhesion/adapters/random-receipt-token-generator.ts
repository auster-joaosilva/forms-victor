import { randomBytes } from 'node:crypto'
import type { ReceiptTokenGenerator } from '../ports/receipt-token-generator'

// O cookie carrega este token, nunca o id: id sequencial no cookie deixaria trocar 5 por 6 e ler o CPF de outra empresa.
export const createRandomReceiptTokenGenerator = (): ReceiptTokenGenerator => ({
  next: () => randomBytes(32).toString('hex'),
})
