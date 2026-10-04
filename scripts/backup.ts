import { parseArgs } from 'node:util'
import { runBackup } from '../src/server/backup/composition'

function parseLegacyFlag(): boolean {
  try {
    return parseArgs({ args: process.argv.slice(2), options: { legacy: { type: 'boolean' } }, strict: true, allowPositionals: false }).values
      .legacy === true
  } catch {
    console.error('uso: pnpm backup [--legacy]')
    process.exit(1)
  }
}

const legacy = parseLegacyFlag()

try {
  const summary = await runBackup({ legacy })
  console.log(`dump: ${summary.dumpKey} (${summary.bytes} bytes)`)
  console.log(`arquivos copiados: ${summary.filesCopied}`)
  if (legacy) {
    if (summary.legacyFiles.length === 0) console.log('portal antigo: nenhum arquivo encontrado')
    for (const key of summary.legacyFiles) console.log(`portal antigo: ${key}`)
  }
  for (const key of summary.dumpsDeleted) console.log(`dump apagado: ${key}`)
  process.exit(0)
} catch (error) {
  console.error(`backup falhou: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
