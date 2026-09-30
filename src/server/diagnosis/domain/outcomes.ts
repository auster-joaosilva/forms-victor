import type { Confidence } from './confidence'
import { DEADLINES, GAPS_THAT_LOCK_DECISION, OPENS_OPEN_POINT, READABLE_OPEN_POINT } from './thresholds'

export type ModalityKey = 'padrao' | 'hibrido' | 'a_definir' | 'nao_se_aplica'

export interface Modality {
  label: string
  detail: string
}

export interface Outcome {
  code: string
  title: string
  summary: string
  meaning: string
  modality: ModalityKey
}

export type OutcomeKey =
  'A' | 'B' | 'C' | 'D' | 'E' | 'E_NO_DATA' | 'SECTOR_WITHOUT_CREDIT' | 'MEI' | 'OUTSIDE'

export type PositionKey =
  | 'padrao'
  | 'padrao_a_confirmar'
  | 'hibrido_definitivo'
  | 'hibrido_a_confirmar'
  | 'a_definir'
  | 'setor_sem_credito'
  | 'nao_se_aplica'

export interface PositionDefinition {
  family: 'padrao' | 'hibrido' | 'a_definir' | 'nao_se_aplica'
  certainty: 'fechada' | 'aberta'
  label: string
  qualifier: string
  singleAction: string
  detail: string
}

export interface Position extends PositionDefinition {
  key: PositionKey
  openPoints: string[]
}

export interface PreliminaryReading {
  modality: Modality
  modalityKey: 'padrao' | 'hibrido'
  condition: string | null
  triggers: string[]
}

// The screen color follows `certainty`, not `family`: first the respondent needs to know whether it is settled.
export const POSITIONS: Record<PositionKey, PositionDefinition> = {
  padrao: {
    family: 'padrao',
    certainty: 'fechada',
    label: 'Simples padrão',
    qualifier: 'decisão fechada',
    singleAction: 'Não há nada a protocolar em setembro. Você continua na guia única.',
    detail: 'IBS e CBS seguem sendo recolhidos dentro do DAS.',
  },
  padrao_a_confirmar: {
    family: 'padrao',
    certainty: 'aberta',
    label: 'Simples padrão',
    qualifier: 'a confirmar',
    singleAction:
      'Nada a protocolar em setembro. Antes de fechar o ano, confira o que ficou em aberto abaixo.',
    detail:
      'IBS e CBS seguem sendo recolhidos dentro do DAS. Se a conferência mudar a leitura, a próxima janela é ' +
      DEADLINES.nextWindow +
      '.',
  },
  hibrido_definitivo: {
    family: 'hibrido',
    certainty: 'fechada',
    label: 'Simples híbrido',
    qualifier: 'decisão fechada',
    singleAction: 'Protocole a opção até 30 de setembro de 2026.',
    detail:
      'O DAS continua para os demais tributos e o IBS e a CBS passam a ser apurados por fora, com direito a crédito. O efeito é no ' +
      DEADLINES.effectSemester +
      '.',
  },
  // The hedge must not read as "Simples híbrido": the decision is still open.
  hibrido_a_confirmar: {
    family: 'hibrido',
    certainty: 'aberta',
    label: 'Híbrido como proteção',
    qualifier: 'a decisão em si continua aberta',
    singleAction:
      'Protocole a opção até 30 de setembro para não perder a janela, e feche a conta até o início de novembro — se ela disser que não vale, cancele até 30 de novembro.',
    detail:
      'Optar agora não é escolher o híbrido: é guardar o direito de escolher. O prazo de setembro não volta; a opção feita nele se desfaz até 30 de novembro sem efeito nenhum.',
  },
  a_definir: {
    family: 'a_definir',
    certainty: 'aberta',
    label: 'Proteja o prazo antes de decidir',
    qualifier: 'a conta depende de número real',
    singleAction:
      'Protocole a opção até 30 de setembro para não perder a janela, e decida de verdade até 30 de novembro, com os números na mão.',
    detail:
      'As respostas não fecham a conta em nenhum dos dois lados. Como a solicitação pode ser cancelada até 30 de novembro e setembro não volta, o movimento barato é optar e conferir depois — desde que a decisão seja retomada mesmo.',
  },
  setor_sem_credito: {
    family: 'a_definir',
    certainty: 'aberta',
    label: 'Depende do regime do seu setor',
    qualifier: 'o argumento do crédito ao cliente não existe aqui',
    singleAction:
      'Antes de pensar em guia única ou por fora, é preciso rodar a conta do regime específico do setor.',
    detail:
      'A alíquota do setor é reduzida em 40% e a lei veda o crédito a quem compra de você. O que sobra para decidir é o crédito das suas próprias compras.',
  },
  nao_se_aplica: {
    family: 'a_definir',
    certainty: 'aberta',
    label: 'Não se aplica',
    qualifier: '',
    singleAction: 'A escolha entre as duas modalidades não existe neste caso.',
    detail: '',
  },
}

// The two paths of LC 214/2025, art. 41, caput and § 3º.
export const MODALITIES: Record<ModalityKey, Modality> = {
  padrao: {
    label: 'Simples padrão',
    detail: 'IBS e CBS continuam sendo recolhidos dentro do DAS, na guia única.',
  },
  hibrido: {
    label: 'Simples híbrido',
    detail:
      'O DAS continua para os demais tributos e o IBS e a CBS passam a ser apurados por fora, com direito a crédito.',
  },
  a_definir: {
    label: 'A definir na simulação',
    detail: 'As respostas não fecham a conta em nenhum dos dois lados. Decidir agora seria apostar.',
  },
  nao_se_aplica: {
    label: 'Não se aplica',
    detail: 'A escolha entre as duas modalidades não existe neste caso.',
  },
}

export const OUTCOMES: Record<OutcomeKey, Outcome> = {
  A: {
    code: 'A',
    title: 'Continue como está.',
    summary: 'Siga recolhendo IBS e CBS dentro do DAS, na guia única.',
    meaning:
      'Seus clientes são, na maior parte, consumidor final ou empresas que não aproveitam crédito de imposto. Destacar imposto na nota não daria vantagem nenhuma na sua venda, porque do outro lado não há quem aproveite. Sem esse ganho comercial, sair da guia única só se justificaria pelo crédito das suas próprias compras — e é isso que a simulação mede.',
    modality: 'padrao',
  },
  B: {
    code: 'B',
    title: 'Continue como está, mas resolva o lado comercial.',
    summary: 'A mudança que você precisa é de contrato e de preço, não de forma de recolher.',
    meaning:
      'Você tem clientes que aproveitam crédito e vão pedir desconto por isso, e a sua margem está numa faixa que dá espaço para negociar sem apurar por fora. Qual das duas opções sai mais barata é conta, não leitura de perfil — o que este diagnóstico diz é que o seu problema imediato é comercial: não deixar o desconto ser arrancado cliente por cliente em vez de ser política sua.',
    modality: 'padrao',
  },
  C: {
    code: 'C',
    title: 'Vale apurar IBS e CBS por fora do DAS.',
    summary: 'Sua cadeia é de empresas, e o crédito virou condição para competir.',
    meaning:
      'Boa parte do que você fatura vai para empresas que aproveitam crédito de imposto. Continuando na guia única, você entrega a elas um crédito menor do que um concorrente entregaria — e a diferença aparece no preço. Apurar por fora corrige isso. A decisão precisa ser confirmada por simulação e protocolada até 30 de setembro.',
    modality: 'hibrido',
  },
  D: {
    code: 'D',
    title: 'A pergunta é maior: vale continuar no Simples?',
    summary: 'Você está no teto do Simples, ou muito perto dele.',
    meaning:
      'Antes de escolher como recolher IBS e CBS, é preciso saber se a empresa continua no Simples em 2027. Nesse patamar a comparação certa é entre Simples, Lucro Presumido e Lucro Real — e essa conta muda tudo o que vem depois.',
    modality: 'a_definir',
  },
  E: {
    code: 'E',
    title: 'Não decida sem simular.',
    summary: 'Suas respostas apontam para lados opostos.',
    meaning:
      'Há motivo para mudar e motivo para ficar, nas mesmas informações. Isso não é indefinição do formulário: é um caso que depende de número real, não de estimativa. Mas os dois erros não custam igual. Deixar setembro passar e descobrir depois que valia apurar por fora custa um semestre inteiro, e esse prazo não volta: a janela seguinte é março, com efeito só no segundo semestre de 2027. Já optar em setembro e concluir que era melhor ficar se resolve cancelando a solicitação até 30 de novembro, antes de qualquer efeito. Por isso o movimento prudente é proteger o prazo agora e fechar a conta em outubro e novembro.',
    modality: 'a_definir',
  },
  E_NO_DATA: {
    code: 'E',
    title: 'Falta uma informação para decidir.',
    summary: 'Sem ela, qualquer recomendação aqui seria chute.',
    meaning:
      'Você marcou "não sei" em uma resposta que decide o resultado: o tipo de cliente que compra de você, ou a origem das suas compras. Não é problema — são dados que a contabilidade tem, e levantados a leitura sai na hora. O que não dá é deixar setembro passar esperando por eles: a solicitação pode ser cancelada até 30 de novembro, mas o prazo para fazê-la não se recupera.',
    modality: 'a_definir',
  },
  SECTOR_WITHOUT_CREDIT: {
    code: 'ESPECIAL-SETOR-SEM-CREDITO',
    title: 'Seu cliente não pode aproveitar crédito — por lei.',
    summary: 'O seu setor tem regime próprio, e nele a lei veda o crédito a quem compra de você.',
    meaning:
      'Na parte da sua receita que está dentro do regime próprio do setor, a conversa sobre destacar imposto para o cliente aproveitar crédito não se aplica: quem compra alimentação, bebida ou hospedagem está proibido de creditar, esteja você na guia única ou fora dela. Em troca, a alíquota do setor é reduzida em 40%. Sobra uma única pergunta, e ela é de cálculo: o crédito das SUAS compras compensa sair da guia única? Isso depende do regime específico e não sai de um formulário.',
    modality: 'a_definir',
  },
  MEI: {
    code: 'ESPECIAL-MEI',
    title: 'Como MEI, essa escolha não se aplica a você.',
    summary: 'O MEI não pode apurar IBS e CBS por fora.',
    meaning:
      'Se seus clientes são empresas e o crédito virou assunto nas negociações, o caminho seria deixar de ser MEI — o que é uma decisão de outro tamanho. Vale conversar antes de qualquer movimento.',
    modality: 'nao_se_aplica',
  },
  OUTSIDE: {
    code: 'ESPECIAL-FORA-DO-SIMPLES',
    title: 'Sua empresa não está no Simples.',
    summary: 'Este diagnóstico trata de quem já é optante.',
    meaning:
      'A escolha entre recolher IBS e CBS na guia única ou por fora só existe para quem está no Simples. No seu caso a pergunta vem antes: vale ou não entrar no Simples. E o prazo é o mesmo — quem quer ingressar em 2027 precisa pedir entre 1º e 30 de setembro de 2026, e só depois formalizar a escolha do IBS e da CBS. Perdido setembro, a entrada fica para 2028.',
    modality: 'nao_se_aplica',
  },
}

// Resolução CGSN 186/2026, art. 2º, parágrafo único [CONFERIR JURÍDICO]: full annulment is the firm's reading.
export const ASYMMETRY = {
  title: 'Os dois erros não custam igual',
  text:
    'Optar em setembro e concluir depois que era melhor ficar tem remédio: ' +
    'a solicitação pode ser cancelada até 30 de novembro de 2026 e a opção é anulada, ' +
    'sem efeito nenhum sobre o que veio antes. Deixar setembro passar não tem remédio: ' +
    'a próxima janela é março de 2027 e só produz efeito no segundo semestre, então o ' +
    'primeiro semestre inteiro fica decidido por omissão.',
  forWhom:
    'Se a leitura for ficar no Simples Padrão, que seja por escolha: ' +
    'não fazer nada produz o mesmo resultado, mas sem ninguém ter decidido.',
  source:
    'Resolução CGSN 186/2026, art. 2º e parágrafo único; janela seguinte de ' +
    '1º a 31 de março de 2027, com efeito no 2º semestre.',
}

export type Asymmetry = typeof ASYMMETRY

const INCONSISTENCIES = ['aliquota_fora_do_estimado']

export function positionForRegime(
  outcome: Outcome,
  confidence: Confidence,
  triggers: string[],
  reading: PreliminaryReading | null,
): Position {
  // An information inconsistency is carried in every position, including those closed for another reason.
  const inconsistencies = triggers
    .filter((t) => INCONSISTENCIES.includes(t))
    .map((t) => READABLE_OPEN_POINT[t])
    .filter((p): p is string => Boolean(p))

  if (outcome.code === 'ESPECIAL-SETOR-SEM-CREDITO') {
    return { key: 'setor_sem_credito', ...POSITIONS.setor_sem_credito, openPoints: inconsistencies }
  }
  if (outcome.modality === 'nao_se_aplica') {
    return { key: 'nao_se_aplica', ...POSITIONS.nao_se_aplica, openPoints: inconsistencies }
  }

  const open = triggers.filter((t) => OPENS_OPEN_POINT.includes(t))
  const criticalGaps = confidence.gaps
    .map((gap, i) => (GAPS_THAT_LOCK_DECISION.includes(gap) ? confidence.readableGaps[i] : null))
    .filter((g): g is string => Boolean(g))
  // The short path never closes a position: it does not ask enough.
  const closed = !criticalGaps.length && !open.length && !confidence.shortPath

  const points = [
    ...open.map((t) => READABLE_OPEN_POINT[t]).filter((p): p is string => Boolean(p)),
    ...criticalGaps.map((g) => `${g} ficou em "não sei"`),
  ]
  if (confidence.shortPath) {
    points.push('você respondeu o caminho curto, que não cobre tudo o que a conta pede')
  }

  const withPoints = (key: PositionKey): Position => ({
    key,
    ...POSITIONS[key],
    openPoints: closed ? [] : points,
  })

  if (outcome.modality === 'padrao') return withPoints(closed ? 'padrao' : 'padrao_a_confirmar')
  if (outcome.modality === 'hibrido') return withPoints(closed ? 'hibrido_definitivo' : 'hibrido_a_confirmar')

  // A gate suspended the decision but the tree had a side: show it, always "a confirmar".
  if (reading?.modalityKey === 'hibrido') return withPoints('hibrido_a_confirmar')
  if (reading?.modalityKey === 'padrao') return withPoints('padrao_a_confirmar')
  return withPoints('a_definir')
}
