import { restoreBackup, type RestoreResult } from '../src/server/backup/composition'

const REFUSALS: Record<Exclude<RestoreResult, { ok: true }>['reason'], string> = {
  'app-database': 'o destino é o banco do app; para sobrescrevê-lo, repita com --overwrite',
  'invalid-key': 'a chave não está no formato postgres/<banco>-AAAA-MM-DDTHHmm.dump',
  'missing-dump': 'dump não encontrado no bucket de backup',
}

const args = process.argv.slice(2)
const overwrite = args.includes('--overwrite')
const [key, targetUrl] = args.filter((arg) => !arg.startsWith('--'))

if (!key || !targetUrl) {
  console.error('uso: pnpm backup:restore <chave> <url-de-destino> [--overwrite]')
  process.exit(2)
}

try {
  const result = await restoreBackup({ key, targetUrl, overwrite })
  if (!result.ok) {
    console.error(`restauração recusada: ${REFUSALS[result.reason]}`)
    process.exit(1)
  }
  console.log(`restaurado: ${key}`)
  process.exit(0)
} catch (error) {
  console.error(`restauração falhou: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
