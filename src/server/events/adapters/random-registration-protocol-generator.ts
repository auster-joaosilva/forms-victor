import { randomBytes } from 'node:crypto'
import { REGISTRATION_PROTOCOL_ALPHABET, formatRegistrationProtocol } from '../domain/protocol'
import type { ProtocolGenerator } from '../ports/protocol-generator'

// 32 símbolos: byte % 32 não enviesa a distribuição.
export const createRandomRegistrationProtocolGenerator = (): ProtocolGenerator => ({
  next: (now) =>
    formatRegistrationProtocol(now, Array.from(randomBytes(5), (byte) => REGISTRATION_PROTOCOL_ALPHABET.charAt(byte % 32)).join('')),
})
