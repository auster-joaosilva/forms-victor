import { mailSender } from '../src/server/mail/composition'

async function main() {
  const toIndex = process.argv.indexOf('--to')
  const to = toIndex !== -1 ? process.argv[toIndex + 1] : undefined
  if (!to) throw new Error('uso: tsx scripts/send-test-mail.ts --to <email>')

  await mailSender.send({ to, subject: 'Teste de envio — Auster', text: 'Se você recebeu isto, o SMTP do portal está configurado corretamente.' })
  console.log(`mensagem de teste enviada para ${to}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
