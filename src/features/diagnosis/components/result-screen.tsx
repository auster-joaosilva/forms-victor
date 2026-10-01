import type { ActionItem } from '@/server/diagnosis/domain/action-plan'
import type { ResultView } from '@/server/diagnosis/domain/result-view'
import type { SubmissionState } from '../hooks/form-state'
import { PRIOR_ASSESSMENT_URL } from './prior-assessment'
import { SubmissionCard } from './submission-card'

function ClientAction({ item }: { item: ActionItem }) {
  return (
    <div className="dx-action">
      <div className="dx-action-title">{item.action}</div>
      <div className="dx-action-reason">{item.reason}</div>
      <div className="dx-action-meta">
        {item.requires ? (
          <span>
            <b>Você precisa:</b> {item.requires}
          </span>
        ) : null}
        {item.legalBasis ? <span className="dx-action-basis">{item.legalBasis}</span> : null}
      </div>
    </div>
  )
}

function AusterAction({ item }: { item: ActionItem }) {
  return (
    <div className="dx-action is-auster">
      <div className="dx-action-title">{item.action}</div>
      <div className="dx-action-reason">{item.reason}</div>
      {item.requires ? (
        <div className="dx-action-meta">
          <span>
            <b>Precisamos de:</b> {item.requires}
          </span>
        </div>
      ) : null}
    </div>
  )
}

function Decision({ decision }: { decision: ResultView['decision'] }) {
  const { openPoints, preliminaryReading, why } = decision
  return (
    <div className="dx-decision" data-certainty={decision.certainty} data-family={decision.family}>
      <div className="dx-decision-label">A decisão</div>
      <div className="dx-decision-name">{decision.label}</div>
      {decision.qualifier ? <span className="dx-decision-qualifier">{decision.qualifier}</span> : null}
      <p className="dx-decision-action">{decision.singleAction}</p>
      {openPoints.length ? (
        <div className="dx-decision-open">
          <div className="dx-decision-open-title">{openPoints.length === 1 ? 'O que ficou em aberto' : `O que ficou em aberto (${openPoints.length})`}</div>
          <ul>
            {openPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {preliminaryReading ? (
        <p className="dx-decision-why">
          <b>O que ainda trava:</b> esta leitura {preliminaryReading.condition}. O perfil que você descreveu aponta para o <b>{preliminaryReading.modalityLabel}</b> — não
          como recomendação fechada, mas como o lado para o qual a conta caminha se essa condição se confirmar.
        </p>
      ) : null}
      {why ? (
        <p className="dx-decision-why">
          {why.preliminary ? (
            <>
              <span className="dx-decision-prefix">Indicação preliminar —</span>{' '}
            </>
          ) : null}
          <b>{why.title}</b> {why.summary}
        </p>
      ) : null}
      {decision.detail ? <p className="dx-decision-detail">{decision.detail}</p> : null}
      {decision.showWithdrawalNotice ? (
        <p className="dx-decision-notice">
          <b>Setembro não volta; novembro ainda dá.</b> São duas coisas diferentes, e o sistema as chama por nomes diferentes: <b>cancelar</b> é desfazer a solicitação até{' '}
          <b>30 de novembro de 2026</b>, antes de qualquer efeito, como se nunca tivesse sido feita; <b>renunciar</b> é sair depois que ela já vale, e isso só acontece nas
          janelas semestrais de março e setembro. Já o prazo para pedir encerra em 30 de setembro e não se recupera — a janela seguinte tem efeito só no 2º semestre de
          2027.{' '}
          <span className="dx-decision-source">
            LC 123/2006, art. 13, §§ 9º e 10 (LC 227/2026); Manual da Opção pelo Regime Regular do IBS e da CBS, item 4.2 (CGSN, 01/09/2026).
          </span>
        </p>
      ) : null}
    </div>
  )
}

export function ResultScreen({
  view,
  submission,
  onRetry,
  onReview,
  onDownload,
}: {
  view: ResultView
  submission: SubmissionState
  onRetry(): void
  onReview(): void
  onDownload(): void
}) {
  const { lowConfidence, plan, conflict, asymmetry } = view
  return (
    <>
      {lowConfidence ? (
        <div className="dx-notice">
          <b>Confiança reduzida.</b> Você respondeu "não sei" em{' '}
          {lowConfidence.gapCount === 1 ? 'um ponto que decide' : `${lowConfidence.gapCount} pontos que decidem`} o resultado: {lowConfidence.readableGaps.join('; ')}. O
          resultado abaixo é indicativo, e a urgência subiu um nível por causa disso.
        </div>
      ) : null}
      <Decision decision={view.decision} />

      <div className="dx-needs-numbers">
        <span className="dx-needs-numbers-mark">⌗</span>
        <p>
          <b>Isto é uma leitura de perfil, não um diagnóstico.</b> O que decide de verdade são os números do seu negócio: alíquota efetiva do DAS mês a mês, crédito que
          cada cliente consegue aproveitar, composição real das compras e a margem por linha de produto ou serviço. É isso que a simulação individual olha — e é ela que
          confirma ou derruba o que está escrito acima.
        </p>
        <p>
          <b>E uma ressalva de método:</b> quando este relatório compara o Simples com o Lucro Presumido, ele usa números de <b>hoje</b> dos dois lados — inclusive PIS e
          COFINS, que deixam de existir em 1º de janeiro de 2027, quando entra a CBS. Serve para apontar onde olhar; não serve para concluir qual regime sai mais barato
          em 2027.
        </p>
      </div>

      {view.meaning ? (
        <div className="dx-card dx-meaning">
          <h2>O que isso significa para a sua empresa</h2>
          <p>{view.meaning}</p>
        </div>
      ) : null}

      <div className="dx-grid">
        <div className="dx-mini is-highlight">
          <div className="dx-mini-label">Janela legal</div>
          <div className="dx-mini-value is-large">{view.windowText}</div>
          <div className="dx-mini-note">
            Até <b>30 de setembro de 2026</b>, em dias de calendário. É o único prazo que a lei fixa aqui — e o único que não volta.
          </div>
        </div>
        <div className="dx-mini">
          <div className="dx-mini-label">Protocolar até</div>
          <div className="dx-mini-value is-deadline">{view.filingDeadline.value}</div>
          <div className="dx-mini-note">{view.filingDeadline.note}</div>
        </div>
        <div className="dx-mini">
          <div className="dx-mini-label">Urgência</div>
          <div className="dx-mini-value">
            <span className="dx-level" data-level={view.urgency}>
              {view.urgency}
            </span>
          </div>
        </div>
        <div className="dx-mini">
          <div className="dx-mini-label">Confiança</div>
          <div className="dx-mini-value is-confidence">{view.confidence.level}</div>
          {view.confidence.dasEstimated ? (
            <div className="dx-mini-note">A alíquota do DAS usada aqui foi estimada pela tabela do seu anexo, não lida da sua apuração.</div>
          ) : null}
        </div>
      </div>

      <div className="dx-card is-spaced">
        <h2>Radar de maturidade</h2>
        {view.radar.map((axis) => (
          <div key={axis.title} className="dx-axis">
            <div className="dx-axis-head">
              <span>{axis.title}</span>
              <span>
                {axis.scoreText} · {axis.band}
              </span>
            </div>
            <div className="dx-bar">
              <i className="dx-bar-fill" data-tone={axis.tone ?? undefined} style={{ width: `${axis.width}%` }} />
            </div>
          </div>
        ))}
        <p className="dx-radar-note">O radar não influencia a recomendação. Sustenta o acompanhamento consultivo.</p>
      </div>

      <div className="dx-card is-spaced">
        <h2>O que fazer na sua empresa</h2>
        {plan.clientNow.length ? (
          <>
            <h3>Antes de 30 de setembro</h3>
            {plan.clientNow.map((item) => (
              <ClientAction key={item.id} item={item} />
            ))}
          </>
        ) : null}
        {plan.clientLater.length ? (
          <>
            <h3>Nos próximos meses</h3>
            {plan.clientLater.map((item) => (
              <ClientAction key={item.id} item={item} />
            ))}
          </>
        ) : null}
        {!plan.clientNow.length && !plan.clientLater.length ? <p className="dx-plan-empty">Nada a fazer de imediato do seu lado.</p> : null}
      </div>

      {plan.auster.length ? (
        <div className="dx-card dx-auster is-spaced">
          <h2>Como a Auster pode ajudar</h2>
          <p className="dx-auster-intro">
            A Reforma Tributária é cuidada por uma <b>equipe dedicada da Auster Inteligência Tributária</b>, que acompanha a legislação desde a promulgação e já vem rodando
            esse trabalho na carteira. É ela que faz as simulações, sustenta as premissas e senta nas conversas com clientes e fornecedores. Estas são as frentes em que ela
            entra com você — nenhuma depende de você fazer antes.
          </p>
          {plan.auster.map((item) => (
            <AusterAction key={item.id} item={item} />
          ))}
          <div className="dx-fit">
            <div className="dx-fit-title">Quer tratar a Reforma além da escolha de setembro?</div>
            <p>
              A decisão do Simples é uma peça. A Avaliação Prévia da Reforma Tributária olha a empresa inteira — cadeia, preço, margem, estrutura societária — e é a partir
              dela que marcamos a reunião com a consultoria.
            </p>
            <a className="dx-cta" href={PRIOR_ASSESSMENT_URL} target="_blank" rel="noopener">
              Preencher a Avaliação Prévia e agendar a reunião
            </a>
          </div>
        </div>
      ) : null}

      <SubmissionCard submission={submission} onRetry={onRetry} />

      <div className="dx-card">
        <h2>Três coisas para não errar</h2>

        <div className="dx-caution is-strong">
          <div className="dx-caution-number">1</div>
          <div>
            <div className="dx-caution-title">A opção do híbrido pode ser cancelada até 30 de novembro de 2026.</div>
            <div className="dx-caution-text">
              Pedida em setembro, ela produz efeito a partir de 1º de janeiro de 2027. Até 30 de novembro a solicitação pode ser <b>cancelada</b>, sem consequência nenhuma,
              porque nada começou a valer. Depois dessa data só cabe <b>renunciar</b> ao regime regular, e a renúncia só acontece nas janelas semestrais de março e setembro.
              Quem chegar a receber ressarcimento de crédito fica impedido de voltar ao recolhimento unificado no ano corrente e no seguinte.{' '}
              <span className="dx-caution-source">
                LC 123/2006, art. 13, §§ 9º e 10 (LC 227/2026); Manual da Opção pelo Regime Regular do IBS e da CBS, item 4.2 (CGSN, 01/09/2026); LC 214/2025, art. 41, §
                5º.
              </span>
            </div>
          </div>
        </div>

        <div className="dx-caution">
          <div className="dx-caution-number">2</div>
          <div>
            <div className="dx-caution-title">O MEI não pode optar pelo regime regular — não aproveita nem transfere crédito.</div>
            <div className="dx-caution-text">
              Nas compras, o MEI é tratado como consumo final: não apropria crédito de IBS e CBS. Nas vendas, em regra não transfere crédito ao cliente. Há duas exceções de
              crédito presumido para quem compra do MEI: transporte autônomo de carga e bem móvel usado para revenda.{' '}
              <span className="dx-caution-source">LC 214/2025, art. 41, § 2º, art. 47, § 9º, arts. 169 e 171; LC 227/2026, art. 106, § 5º.</span>
            </div>
          </div>
        </div>

        <div className="dx-caution">
          <div className="dx-caution-number">3</div>
          <div>
            <div className="dx-caution-title">Conclusão definitiva exige simulação individual com dados contábeis e de negócios reais.</div>
            <div className="dx-caution-text">
              Nada aqui substitui a apuração. Este relatório organiza o cenário e aponta onde olhar; a decisão se fecha com os números do seu negócio na mesa.
            </div>
          </div>
        </div>

        {conflict ? (
          <div className="dx-card dx-conflict">
            <h2>Por que a sua conta não fecha sozinha</h2>
            <div className="dx-conflict-part">
              <b>O que está em conflito</b>
              <p>{conflict.conflict}</p>
            </div>
            <div className="dx-conflict-part">
              <b>O que decide entre os dois lados</b>
              <p>{conflict.decides}</p>
            </div>
            <div className="dx-conflict-part">
              <b>O que precisamos levantar</b>
              <p>{conflict.gather}.</p>
            </div>
          </div>
        ) : null}

        <div className="dx-card dx-asymmetry">
          <h2>{asymmetry.title}</h2>
          <p>{asymmetry.text}</p>
          {asymmetry.forWhom ? (
            <p>
              <b>{asymmetry.forWhom}</b>
            </p>
          ) : null}
          <p className="dx-legal-source">{asymmetry.source}</p>
        </div>

        <ul className="dx-footnotes">
          <li>Análise preliminar, sem valor jurídico, baseada exclusivamente nas respostas fornecidas.</li>
          <li>Os cortes percentuais são parâmetros de triagem da Auster, não constantes legais.</li>
        </ul>
        <div className="dx-nav">
          <button type="button" className="dx-button is-secondary" onClick={onReview}>
            Revisar respostas
          </button>
          <button type="button" className="dx-button is-primary" disabled={submission.status !== 'sent'} onClick={onDownload}>
            Baixar o plano de ação em PDF
          </button>
        </div>
      </div>
    </>
  )
}
