import { randomBytes } from 'node:crypto'
import { PROTOCOL_ALPHABET, formatProtocol } from '../domain/protocol'
import type { ProtocolGenerator } from '../ports/protocol-generator'

export const createRandomProtocolGenerator = (): ProtocolGenerator => ({
  next: (now) => formatProtocol(now, Array.from(randomBytes(4), (byte) => PROTOCOL_ALPHABET.charAt(byte % PROTOCOL_ALPHABET.length)).join('')),
})
