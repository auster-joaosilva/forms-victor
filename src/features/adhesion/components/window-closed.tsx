import { isoDateToBr } from '@/server/shared/domain/dates'

export const CONTACT_EMAIL = 'contato@austercontabil.com.br'

// Não promete a próxima janela: a data do próximo ciclo é decisão de conteúdo da casa.
export function WindowClosed({ end }: { end: string }) {
  return (
    <div className="ad-card">
      <h2>A janela de opção encerrou</h2>
      <p>
        O prazo para formalizar a opção pelo Simples Híbrido terminou em <b>{isoDateToBr(end)}</b>, e por isso
        esta página não recebe mais confirmações.
      </p>
      <p>
        Se a sua empresa confirmou a opção antes do prazo, nada muda: a Auster já tem o registro e segue com o
        que foi combinado.
      </p>
      <p>
        Se você chegou aqui agora, ou ficou em dúvida sobre o que foi feito no caso da sua empresa, escreva
        para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> — a equipe responde com a situação da sua
        empresa e com o que ainda dá para fazer.
      </p>
    </div>
  )
}
