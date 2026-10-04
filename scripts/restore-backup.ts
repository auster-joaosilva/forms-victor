import { parseArgs } from 'node:util'
import { restoreBackup, type RestoreResult } from '../src/server/backup/composition'

const REFUSALS: Record<Exclude<RestoreResult, { ok: true }>['reason'], string> = {
  'app-database': 'o destino é o banco do app; para sobrescrevê-lo, repita com --overwrite',
  'invalid-key': 'a chave não está no formato postgres/<banco>-AAAA-MM-DDTHHmm.dump',
  'missing-dump': 'dump não encontrado no bucket de backup',
}

const USAGE = 'uso: pnpm backup:restore <chave> <url-de-destino> [--overwrite]'

function parseArguments(): { key: string; targetUrl: string; overwrite: boolean } {
  try {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: { overwrite: { type: 'boolean' } },
      strict: true,
      allowPositionals: true,
    })
    const [key, targetUrl, ...extra] = positionals
    if (!key || !targetUrl || extra.length > 0) throw new Error(USAGE)
    return { key, targetUrl, overwrite: values.overwrite === true }
  } catch {
    console.error(USAGE)
    process.exit(1)
  }
}

const { key, targetUrl, overwrite } = parseArguments()

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
