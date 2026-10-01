import type { TriageReason } from '@/server/diagnosis/domain/draft-rules'
import { PRIOR_ASSESSMENT_URL } from './prior-assessment'

export function TriageReferral({ reason, onBack }: { reason: TriageReason; onBack(): void }) {
  const mei = reason === 'mei'
  return (
    <div className="dx-referral">
      <h1>{mei ? 'Como MEI, essa escolha não se aplica a você.' : 'Este diagnóstico é para quem já é optante do Simples.'}</h1>
      <p>
        {mei
          ? 'O MEI não pode apurar IBS e CBS por fora do DAS — e, nas compras, é tratado como consumidor final: não aproveita crédito. Se os seus clientes são empresas e o crédito virou assunto nas negociações, o caminho seria deixar de ser MEI, que é uma decisão de outro tamanho.'
          : 'A escolha entre recolher IBS e CBS na guia única ou por fora existe só para o optante do Simples Nacional. No seu caso a pergunta é outra — e é maior: como a sua empresa se posiciona na Reforma como um todo.'}
      </p>
      <p>
        A Auster tem um diagnóstico próprio para isso, que serve a qualquer regime: a <b>Avaliação Prévia da Reforma Tributária</b>.
      </p>
      <p className="is-minor">
        {mei
          ? 'Se você acha que marcou MEI por engano, volte e corrija — a resposta vem do cadastro da Receita quando o CNPJ é consultado.'
          : 'Se o regime informado estiver errado, volte e corrija. A resposta vem do cadastro da Receita quando o CNPJ é consultado.'}
      </p>
      <div className="dx-referral-actions">
        <a className="dx-cta" href={PRIOR_ASSESSMENT_URL} target="_blank" rel="noopener">
          Ir para a Avaliação Prévia da Reforma
        </a>
        <button type="button" className="dx-button is-secondary" onClick={onBack}>
          Voltar e corrigir
        </button>
      </div>
    </div>
  )
}
