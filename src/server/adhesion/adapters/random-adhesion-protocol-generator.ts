import { randomBytes } from 'node:crypto'
import { ADHESION_PROTOCOL_ALPHABET, formatAdhesionProtocol } from '../domain/protocol'
import type { ProtocolGenerator } from '../ports/protocol-generator'

// 32 símbolos: byte % 32 não enviesa a distribuição.
export const createRandomAdhesionProtocolGenerator = (): ProtocolGenerator => ({
  next: (now) =>
    formatAdhesionProtocol(now, Array.from(randomBytes(5), (byte) => ADHESION_PROTOCOL_ALPHABET.charAt(byte % 32)).join('')),
})
