import { Fragment, type ReactNode } from 'react'
import type { NumberedAction, ReportSheets } from '@/server/diagnosis/domain/report-sheets'
import { AnswerText } from './review-screen'

function Action({ item }: { item: NumberedAction }) {
  return (
    <div className="rp-action">
      <div className="rp-action-number">{item.number}</div>
      <div>
        <div className="rp-action-title">{item.action}</div>
        <div className="rp-action-reason">{item.reason}</div>
        {item.requires ? (
          <div className="rp-action-requires">
            <b>Você precisa:</b> {item.requires}
          </div>
        ) : null}
        {item.legalBasis ? <div className="rp-action-basis">{item.legalBasis}</div> : null}
      </div>
    </div>
  )
}

function Cover({ cover }: { cover: ReportSheets['cover'] }) {
  const { decision } = cover
  return (
    <section className="rp-sheet is-cover">
      <div className="rp-badge">Diagnóstico preliminar</div>
      <h1>
        Simples padrão ou híbrido:
        <br />o que a sua empresa deve fazer até 30 de setembro
      </h1>
      <table className="rp-header-table">
        <tbody>
          <tr>
            <td>Empresa</td>
            <th>{cover.company}</th>
          </tr>
          <tr>
            <td>CNPJ</td>
            <th>{cover.cnpj}</th>
          </tr>
          <tr>
            <td>Quem respondeu</td>
            <th>{cover.requester}</th>
          </tr>
          <tr>
            <td>Protocolo</td>
            <th>{cover.protocol}</th>
          </tr>
          <tr>
            <td>Emitido em</td>
            <th>{cover.issuedOn}</th>
          </tr>
          <tr>
            <td>Versão respondida</td>
            <th>{cover.version}</th>
          </tr>
        </tbody>
      </table>

      <div className="rp-decision" data-certainty={decision.certainty}>
        <div className="rp-decision-label">A decisão</div>
        <div className="rp-decision-name">{decision.label}</div>
        {decision.qualifier ? <div className="rp-decision-qualifier">{decision.qualifier}</div> : null}
        <p>{decision.singleAction}</p>
      </div>

      {cover.openPoints.length ? (
        <div className="rp-open">
          <b>O que ficou em aberto</b>
          <ul>
            {cover.openPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="rp-note">
        Leitura de perfil, sem valor jurídico, baseada exclusivamente nas respostas registradas neste documento. Conclusão definitiva exige simulação individual com dados
        contábeis e de negócios reais.
      </p>
    </section>
  )
}

function Meaning({ meaning }: { meaning: ReportSheets['meaning'] }) {
  const { conflict, asymmetry } = meaning
  return (
    <section className="rp-sheet">
      <h2>O que isso significa para a sua empresa</h2>
      <p className="rp-prose">{meaning.text}</p>

      {conflict ? (
        <>
          <h3>Por que a sua conta não fecha sozinha</h3>
          <p className="rp-prose">
            <b>O que está em conflito:</b> {conflict.conflict}
          </p>
          <p className="rp-prose">
            <b>O que decide entre os dois lados:</b> {conflict.decides}
          </p>
          <p className="rp-prose">
            <b>O que precisamos levantar:</b> {conflict.gather}.
          </p>
        </>
      ) : null}

      <h3>{asymmetry.title}</h3>
      <p className="rp-prose">{asymmetry.text}</p>
      {asymmetry.forWhom ? (
        <p className="rp-prose">
          <b>{asymmetry.forWhom}</b>
        </p>
      ) : null}
      <p className="rp-source">{asymmetry.source}</p>

      <h3>Os três nomes, para não confundir</h3>
      <table className="rp-deadlines">
        <tbody>
          <tr>
            <td>Simples Original</td>
            <th>o que você tem hoje, e que vale até o fim de 2026.</th>
          </tr>
          <tr>
            <td>Simples Padrão</td>
            <th>a partir de 2027, com IBS e CBS continuando dentro do DAS.</th>
          </tr>
          <tr>
            <td>Simples Híbrido</td>
            <th>
              a partir de 2027, com IBS e CBS saindo da guia e apurados pelo regime regular — é o que as palestras chamaram de <b>tirar o imposto da guia</b>.
            </th>
          </tr>
        </tbody>
      </table>
      {meaning.showDeadlines ? (
        <>
          <h3>Os prazos, em ordem</h3>
          <table className="rp-deadlines">
            <tbody>
              <tr>
                <td>30 de setembro de 2026</td>
                <th>Último dia para protocolar a opção. Não se recupera: a janela seguinte é março de 2027, com efeito só no 2º semestre.</th>
              </tr>
              <tr>
                <td>30 de novembro de 2026</td>
                <th>
                  Último dia para <b>cancelar</b> a solicitação, sem efeito nenhum — como se nunca tivesse sido feita.
                </th>
              </tr>
              <tr>
                <td>1º de janeiro de 2027</td>
                <th>
                  A opção começa a valer, para todo o primeiro semestre. Dali em diante, só cabe <b>renunciar</b>, nas janelas de março e setembro.
                </th>
              </tr>
            </tbody>
          </table>
          <p className="rp-source">
            LC 123/2006, art. 13, §§ 9º e 10, com a redação da LC 227/2026; Manual da Opção pelo Regime Regular do IBS e da CBS, item 4.2 (CGSN, 01/09/2026); LC 214/2025,
            art. 41, § 5º.
          </p>
        </>
      ) : null}
    </section>
  )
}

function Plan({ plan }: { plan: ReportSheets['plan'] }) {
  return (
    <section className="rp-sheet">
      <h2>O que fazer na sua empresa</h2>
      {plan.clientNow.length ? (
        <>
          <h3>Antes de 30 de setembro</h3>
          {plan.clientNow.map((item) => (
            <Action key={item.number} item={item} />
          ))}
        </>
      ) : null}
      {plan.clientLater.length ? (
        <>
          <h3>Nos próximos meses</h3>
          {plan.clientLater.map((item) => (
            <Action key={item.number} item={item} />
          ))}
        </>
      ) : null}
      {!plan.clientNow.length && !plan.clientLater.length ? <p className="rp-prose">Nada a fazer de imediato do seu lado.</p> : null}
    </section>
  )
}

function Auster({ items }: { items: NumberedAction[] }) {
  return (
    <section className="rp-sheet">
      <h2>Como a Auster pode ajudar</h2>
      <p className="rp-prose">Frentes da Auster Inteligência Tributária. Nenhuma depende de você fazer antes.</p>
      {items.map((item) => (
        <Action key={item.number} item={item} />
      ))}
    </section>
  )
}

function Summary({ summary }: { summary: ReportSheets['summary'] }) {
  return (
    <section className="rp-sheet">
      <h2>Resumo do que foi preenchido</h2>
      <p className="rp-prose">O diagnóstico acima decorre destas respostas. Em âmbar, o que ficou em "não sei" — é por onde a conversa começa.</p>
      {summary.blocks.map((block) => (
        <Fragment key={block.title}>
          <h3>{block.title}</h3>
          <table className="rp-summary">
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.prompt}>
                  <td className="rp-summary-question">{row.prompt}</td>
                  <td className={row.answer?.gap ? 'rp-summary-answer is-gap' : 'rp-summary-answer'}>{row.answer ? <AnswerText answer={row.answer} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Fragment>
      ))}
      {summary.freeText.length ? (
        <>
          <h3>Em suas palavras</h3>
          {summary.freeText.map((item) => (
            <div key={item.label} className="rp-free">
              <b>{item.label}</b>
              <p>{item.value}</p>
            </div>
          ))}
        </>
      ) : null}
    </section>
  )
}

function Cautions({ footer }: { footer: string }) {
  return (
    <section className="rp-sheet">
      <h2>Três coisas para não errar</h2>
      <ol className="rp-cautions">
        <li>
          <b>A opção do híbrido pode ser cancelada até 30 de novembro de 2026.</b> Pedida em setembro, produz efeito a partir de 1º de janeiro de 2027. Até 30 de novembro a
          solicitação pode ser cancelada, sem consequência nenhuma. Depois, só cabe renunciar, nas janelas semestrais de março e setembro. Quem receber ressarcimento de
          crédito fica impedido de voltar ao recolhimento unificado no ano corrente e no seguinte.
        </li>
        <li>
          <b>O MEI não pode optar pelo regime regular</b> — e não aproveita nem transfere crédito. Nas compras é tratado como consumo final. Há duas exceções de crédito
          presumido para quem compra do MEI: transporte autônomo de carga e bem móvel usado para revenda.
        </li>
        <li>
          <b>Conclusão definitiva exige simulação individual</b> com dados contábeis e de negócios reais. Este documento organiza o cenário e aponta onde olhar; a decisão se
          fecha com os números do seu negócio na mesa.
        </li>
      </ol>
      <p className="rp-note">
        Os cortes percentuais usados na leitura são parâmetros de triagem da Auster, não constantes legais. Quando este documento compara o Simples com o Lucro Presumido, usa
        números de hoje dos dois lados — inclusive PIS e COFINS, que deixam de existir em 1º de janeiro de 2027 — e serve para apontar onde olhar, não para concluir qual
        regime sai mais barato em 2027.
      </p>
      <div className="rp-footer">
        <div>{footer}</div>
        <div>auster Inteligência Contábil</div>
      </div>
    </section>
  )
}

export function ReportDocument({ sheets, toolbar }: { sheets: ReportSheets; toolbar: ReactNode }) {
  return (
    <div className="rp">
      <div className="rp-toolbar">{toolbar}</div>
      <Cover cover={sheets.cover} />
      <Meaning meaning={sheets.meaning} />
      <Plan plan={sheets.plan} />
      {sheets.auster.length ? <Auster items={sheets.auster} /> : null}
      <Summary summary={sheets.summary} />
      <Cautions footer={sheets.footer} />
    </div>
  )
}
