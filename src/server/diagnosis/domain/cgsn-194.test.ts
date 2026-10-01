import { describe, expect, it } from 'vitest'
import { ACTION_RULES } from './action-plan'
import { ASYMMETRY, OUTCOMES, POSITIONS } from './outcomes'

const reasonOf = (id: string) => ACTION_RULES.find((rule) => rule.id === id)?.reason

describe('texts of Resolução CGSN 194/2026 (origin/main 212aea5)', () => {
  it('moves every position to October and the withdrawal to the 03/11–20/12 window', () => {
    expect(POSITIONS.padrao.singleAction).toBe('Não há nada a protocolar em outubro. Você continua na guia única.')
    expect(POSITIONS.padrao_a_confirmar.singleAction).toBe('Nada a protocolar em outubro. Antes de fechar o ano, confira o que ficou em aberto abaixo.')
    expect(POSITIONS.hibrido_definitivo.singleAction).toBe('Protocole a opção até 30 de outubro de 2026.')
    expect(POSITIONS.hibrido_a_confirmar.singleAction).toBe(
      'Protocole a opção até 30 de outubro para não perder a janela, e feche a conta até o fim de outubro — se ela disser que não vale, cancele entre 3 de novembro e 20 de dezembro.',
    )
    expect(POSITIONS.hibrido_a_confirmar.detail).toBe(
      'Optar agora não é escolher o híbrido: é guardar o direito de escolher. A janela de outubro não volta; a opção feita nela se desfaz entre 3 de novembro e 20 de dezembro, sem efeito nenhum. Antes de 3 de novembro o cancelamento não está disponível — e isso é o que você precisa saber antes de optar.',
    )
    expect(POSITIONS.a_definir.singleAction).toBe(
      'Protocole a opção até 30 de outubro para não perder a janela, e decida de verdade até 20 de dezembro, com os números na mão.',
    )
    expect(POSITIONS.a_definir.detail).toBe(
      'As respostas não fecham a conta em nenhum dos dois lados. Como a solicitação pode ser cancelada entre 3 de novembro e 20 de dezembro, e outubro não volta, o movimento barato é optar e conferir depois — desde que a decisão seja retomada mesmo, e a tempo de usar a janela de cancelamento.',
    )
  })

  it('rewrites the outcomes that cite the deadlines', () => {
    expect(OUTCOMES.C.meaning).toMatch(/protocolada até 30 de outubro\.$/)
    expect(OUTCOMES.E.meaning).toContain('Deixar outubro passar e descobrir depois')
    expect(OUTCOMES.E.meaning).toContain('Já optar em outubro e concluir que era melhor ficar se resolve cancelando a solicitação entre 3 de novembro e 20 de dezembro, antes de qualquer efeito.')
    expect(OUTCOMES.E.meaning).toMatch(/proteger o prazo agora e fechar a conta em novembro\.$/)
    expect(OUTCOMES.E_NO_DATA.meaning).toContain('O que não dá é deixar outubro passar esperando por eles: a solicitação pode ser cancelada entre 3 de novembro e 20 de dezembro, mas o prazo para fazê-la não se recupera.')
    expect(OUTCOMES.OUTSIDE.meaning).toContain(
      'E são DOIS prazos diferentes, atenção: quem quer ingressar em 2027 precisa pedir a entrada até 15 de outubro de 2026, e só depois formalizar a escolha do IBS e da CBS, que vai até 30 de outubro. Pendência que barre o ingresso pode ser regularizada até 30 de outubro. Perdida a entrada, ela fica para 2028.',
    )
    expect(ASYMMETRY.text).toBe(
      'Optar em outubro e concluir depois que era melhor ficar tem remédio: a solicitação pode ser cancelada entre 3 de novembro e 20 de dezembro de 2026 e a opção é anulada, sem efeito nenhum sobre o que veio antes. Antes de 3 de novembro o cancelamento não está disponível. Deixar outubro passar não tem remédio: a próxima janela é março de 2027 e só produz efeito no segundo semestre, então o primeiro semestre inteiro fica decidido por omissão.',
    )
  })

  it('rewrites the action rules that cite the deadlines', () => {
    expect(reasonOf('decidir_com_os_socios')).toBe('A decisão é de quem tem alçada, e a janela fecha em 30 de outubro. Decisão em conjunto não cabe nos últimos três dias.')
    expect(reasonOf('fechar_a_conta_ate_o_inicio_de_novembro')).toBe(
      'A solicitação feita em outubro pode ser cancelada entre 3 de novembro e 20 de dezembro, sem efeito nenhum. Mas 20 de dezembro é o limite, não a data de começar — e antes de 3 de novembro o cancelamento nem existe. Deixe a conclusão pronta até o fim de outubro, para chegar em 3 de novembro já sabendo se cancela.',
    )
    expect(reasonOf('ciencia_da_trava_do_ressarcimento')).toMatch(/^Depois de 20 de dezembro a opção vale pelo semestre\./)
    expect(reasonOf('simular_as_duas_opcoes')).toMatch(/É esta conta que fecha a decisão antes de 20 de dezembro\.$/)
    expect(reasonOf('regularizar_debitos_no_prazo')).toBe(
      'Débito em aberto barra o ingresso de quem está entrando e é causa de exclusão de quem já está. A própria Receita orienta a confirmar o pedido mesmo com pendência, para não perder o prazo — que agora é 15 de outubro para a entrada no Simples e 30 de outubro para regularizar o que barrou o ingresso.',
    )
  })
})
