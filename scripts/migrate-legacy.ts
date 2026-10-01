import { existsSync } from 'node:fs'
import { legacyImporter } from '../src/server/legacy-import/composition'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const path = args.find((arg) => !arg.startsWith('--'))

if (!path || !existsSync(path)) {
  console.error('uso: pnpm migrate:legacy <caminho do portal.db> [--dry-run]')
  process.exit(2)
}

const importer = legacyImporter(path)
try {
  const report = await importer.run({ dryRun })
  console.log(dryRun ? 'Simulação: nada foi gravado.' : report.conflicts.length ? 'Nada foi gravado.' : 'Migração gravada.')
  console.table({ usuários: report.users, convites: report.invitations, respostas: report.responses, auditoria: report.audit })
  for (const note of report.notes) console.log(`aviso · ${note}`)
  for (const conflict of report.conflicts) console.error(`conflito · ${conflict}`)
  if (report.conflicts.length) process.exitCode = 1
} finally {
  importer.close()
}
process.exit(process.exitCode ?? 0)
