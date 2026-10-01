import type { Question } from '@/server/diagnosis/domain/question-types'

const CONTROLLER = 'Auster Inteligência Contábil'
const PRIVACY_EMAIL = 'contato@austercontabil.com.br'
const RETENTION_MONTHS = 24

export function PrivacyConsent({ question, checked, onChange }: { question: Question; checked: boolean; onChange(checked: boolean): void }) {
  return (
    <>
      <div className="dx-privacy">
        <p>
          <b>Para que servem:</b> montar este diagnóstico e permitir que a equipe da {CONTROLLER} fale com você sobre ele. Não usamos para mais nada e não compartilhamos com terceiros.
        </p>
        <p>
          <b>Quando são enviadas:</b> ao terminar o preenchimento, automaticamente. Você recebe um número de protocolo na tela e pode baixar o plano de ação em PDF.
        </p>
        <p>
          <b>O que é coletado:</b> CNPJ, nome da empresa, nome de quem responde, e-mail, telefone e as respostas do formulário. O CNPJ é consultado na base pública da Receita para poupar digitação.
        </p>
        <p>
          <b>Por quanto tempo:</b> {RETENTION_MONTHS} meses, contados do envio.
        </p>
        <p>
          <b>Seus direitos:</b> pedir acesso, correção ou exclusão a qualquer momento, em <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> (LGPD, art. 18).
        </p>
      </div>
      <label className={`dx-option is-consent${checked ? ' is-checked' : ''}`}>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="dx-option-text">
          <b>{question.acceptLabel}</b>
        </span>
      </label>
    </>
  )
}
