import { runBackup } from '../src/server/backup/composition'

const legacy = process.argv.slice(2).includes('--legacy')

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
