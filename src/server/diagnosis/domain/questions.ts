import type {
  Answers,
  Block,
  MatrixAnswer,
  MatrixColumn,
  MatrixRow,
  Option,
  Question,
  RadarAxis,
} from './question-types'
import { canEstimateDas, estimateDasRate } from './simples-rates'

// "Não sei" has no midpoint on purpose: a 0 would send someone who does not know their customers to exit A.
export const PERCENT_BANDS: MatrixColumn[] = [
  { value: 'zero', label: '0%', midpoint: 0 },
  { value: 'ate_20', label: 'até 20%', midpoint: 10 },
  { value: 'de_20_40', label: '20–40%', midpoint: 30 },
  { value: 'de_40_60', label: '40–60%', midpoint: 50 },
  { value: 'de_60_80', label: '60–80%', midpoint: 70 },
  { value: 'acima_80', label: 'acima de 80%', midpoint: 90 },
  { value: 'nao_sei', label: 'não sei', midpoint: null },
]

export function bandMidpoint(value: string): number | null {
  const band = PERCENT_BANDS.find((b) => b.value === value)
  return band && typeof band.midpoint === 'number' ? band.midpoint : null
}

export const CUSTOMER_TYPES: MatrixRow[] = [
  { key: 'pessoa_fisica', label: 'Pessoa física / consumidor final' },
  { key: 'simples_mei', label: 'MEI ou empresa do Simples' },
  { key: 'regime_regular', label: 'Empresa do Lucro Presumido ou Real' },
  { key: 'orgao_publico', label: 'Órgão público' },
  { key: 'exterior', label: 'Exterior' },
]

export const BLOCKS: Block[] = [
  {
    number: 1,
    title: 'Identificação',
    notice:
      'Este diagnóstico é para quem já é optante do Simples Nacional. A escolha entre recolher IBS e CBS na guia única ou por fora só existe nesse caso.',
    glossary: [
      { term: 'Simples Original', meaning: 'o que você tem hoje, e que vale até o fim de 2026' },
      { term: 'Simples Padrão', meaning: 'a partir de 2027, com IBS e CBS continuando dentro do DAS' },
      {
        term: 'Simples Híbrido',
        meaning:
          'a partir de 2027, com IBS e CBS saindo da guia e apurados pelo regime regular — é o que as palestras chamaram de tirar o imposto da guia',
      },
    ],
  },
  { number: 2, title: 'Enquadramento atual' },
  { number: 3, title: 'Perfil da receita' },
  { number: 4, title: 'Estrutura de custos' },
  { number: 5, title: 'Margem, preço e preparo' },
]

function option(value: string, label: string, score?: number | null, description?: string): Option {
  return { value, label, score, description }
}

const text = (answers: Answers, key: string): string => {
  const value = answers[key]
  return typeof value === 'string' ? value : ''
}

const isOneOf = (value: unknown, list: readonly string[]): boolean =>
  typeof value === 'string' && list.includes(value)

export function isProductOperation(a: Answers): boolean {
  return (
    isOneOf(a.segmento, ['comercio', 'industria', 'agronegocio']) ||
    isOneOf(a.anexoSimples, ['i', 'ii']) ||
    isOneOf(a.atividadePrincipal, ['comercio', 'industria'])
  )
}

export function isOperationWithoutLabor(a: Answers): boolean {
  return a.pesoFolha === 'nenhuma'
}

export function isServiceOperation(a: Answers): boolean {
  return (
    text(a, 'segmento').startsWith('servico') ||
    isOneOf(a.segmento, ['construcao_civil', 'transporte_carga', 'transporte_passageiros']) ||
    isOneOf(a.anexoSimples, ['iii', 'iv', 'v']) ||
    a.atividadePrincipal === 'servico'
  )
}

export function hasLegalEntityCustomer(a: Answers): boolean {
  const matrix = (a.receitaPorCliente as MatrixAnswer | undefined) ?? {}
  const rows = ['simples_mei', 'regime_regular', 'orgao_publico']
  // A gap does not assert absence: an unknown legal-entity share keeps the customer-regime question alive.
  if (rows.some((k) => matrix[k] === 'nao_sei')) return true
  return rows.reduce((total, k) => total + (bandMidpoint(matrix[k] ?? '') || 0), 0) > 0
}

export const QUESTIONS: Question[] = [
  {
    key: 'versaoFormulario',
    block: 1,
    prompt: 'Como você prefere responder?',
    hint: 'Dá para começar pelo caminho curto e voltar depois — as respostas ficam salvas.',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['modality'],
    essential: true,
    options: [
      option(
        'sintetico',
        'Caminho curto — cerca de 4 minutos',
        null,
        'O essencial para saber se vale entrar na fila da simulação. Entrega uma leitura inicial e um plano de ação enxuto.',
      ),
      option(
        'completo',
        'Completo — cerca de 10 minutos',
        null,
        'Todas as perguntas. Entrega o radar de maturidade, o plano de ação detalhado e abre oportunidade preliminar de planejamento tributário.',
      ),
    ],
  },
  {
    key: 'cnpj',
    essential: true,
    block: 1,
    prompt: 'CNPJ',
    hint: 'Aceita o formato alfanumerico das inscricoes novas.',
    type: 'cnpj',
    origin: 'registry',
    required: 'always',
    feeds: ['registry'],
    validator: 'cnpj',
  },
  {
    key: 'nomeEmpresa',
    essential: true,
    block: 1,
    prompt: 'Nome da empresa',
    hint: 'Se o CNPJ foi encontrado, este campo já vem preenchido com a razão social — pode ajustar para o nome que você usa.',
    type: 'text',
    origin: 'registry',
    required: 'always',
    feeds: ['registry'],
    validator: 'companyName',
  },
  {
    key: 'regimeAtual',
    essential: true,
    block: 1,
    prompt: 'Regime tributário atual',
    gapLabel: 'o regime tributário atual da empresa',
    hint: 'Se o CNPJ foi consultado, esta resposta já vem do cadastro da Receita. Confira antes de seguir.',
    type: 'single',
    origin: 'registry',
    required: 'always',
    feeds: ['eligibility'],
    unknownValue: 'nao_sei',
    options: [
      option('simples', 'Simples Nacional'),
      option('presumido', 'Lucro Presumido'),
      option('real', 'Lucro Real'),
      option('nao_sei', 'Não sei'),
    ],
  },
  {
    key: 'ehSimei',
    essential: true,
    block: 1,
    prompt: 'A empresa é MEI (SIMEI)?',
    type: 'single',
    origin: 'registry',
    required: 'always',
    feeds: ['eligibility'],
    options: [option('sim', 'Sim'), option('nao', 'Não')],
  },
  {
    key: 'solicitante',
    essential: true,
    block: 1,
    prompt: 'Quem está respondendo',
    type: 'text',
    origin: 'client',
    required: 'always',
    feeds: ['registry'],
    validator: 'personName',
  },
  {
    key: 'email',
    essential: true,
    block: 1,
    prompt: 'E-mail',
    type: 'email',
    origin: 'client',
    required: 'always',
    feeds: ['registry'],
    validator: 'email',
  },
  {
    key: 'telefone',
    essential: true,
    block: 1,
    prompt: 'Telefone',
    type: 'phone',
    origin: 'client',
    required: 'always',
    feeds: ['registry'],
    validator: 'phone',
  },
  {
    key: 'jaClienteAuster',
    essential: true,
    block: 1,
    prompt: 'Já é cliente Auster?',
    type: 'single',
    origin: 'registry',
    required: 'always',
    feeds: ['registry'],
    options: [option('sim', 'Sim'), option('nao', 'Não')],
  },
  {
    key: 'segmento',
    essential: true,
    block: 1,
    prompt: 'Segmento de atuação',
    hint: 'Define a presunção do Lucro Presumido, que é o parâmetro das duas comparações: contra o Simples e, quando a sua margem fica abaixo dela, também contra o Lucro Real.',
    type: 'select',
    origin: 'registry',
    required: 'always',
    feeds: ['modality', 'action'],
    options: [
      option('comercio', 'Comércio'),
      option('industria', 'Indústria'),
      option('agronegocio', 'Agronegócio'),
      option('construcao_civil', 'Construção civil'),
      option('transporte_carga', 'Transporte de cargas'),
      option('transporte_passageiros', 'Transporte de passageiros'),
      option('servico_saude', 'Serviço — saúde'),
      option('servico_demais', 'Serviço — demais'),
      option('outro', 'Outro'),
    ],
  },
  // Reduced presumption for hospital services depends on two facts, not on CNAE (triagem_aliquotas.toml).
  {
    key: 'servicoHospitalar',
    block: 1,
    prompt: 'A empresa é sociedade empresária e atende às normas da Anvisa para o serviço que presta?',
    hint: 'As duas condições juntas levam parte dos serviços de saúde à presunção reduzida do Lucro Presumido. Sem elas, vale a presunção de serviços em geral.',
    type: 'single',
    origin: 'client',
    required: 'conditional',
    feeds: ['modality'],
    condition: (a) => a.segmento === 'servico_saude',
    unknownValue: 'nao_sei',
    options: [
      option('sim', 'Sim, as duas'),
      option('nao', 'Não, ou só uma delas'),
      option('nao_sei', 'Não sei'),
    ],
  },
  {
    key: 'expectativa',
    block: 1,
    prompt: 'O que você espera descobrir aqui? (opcional)',
    hint: 'Ajuda a equipe a preparar a conversa. Pode deixar em branco.',
    type: 'textarea',
    origin: 'client',
    required: 'never',
    feeds: ['registry'],
    essential: true,
  },
  {
    key: 'anexoSimples',
    essential: true,
    block: 2,
    prompt: 'Por qual anexo a empresa é tributada?',
    gapLabel: 'o anexo do Simples em que a empresa é tributada',
    type: 'single',
    origin: 'registry',
    required: 'conditional',
    feeds: ['modality'],
    condition: (a) => a.regimeAtual === 'simples',
    unknownValue: 'nao_sei',
    // [CONFERIR] descriptions against LC 123, art. 18, §§ 5º-B to 5º-I, before publishing.
    options: [
      option('i', 'Anexo I', null, 'Comércio — revenda de mercadorias.'),
      option('ii', 'Anexo II', null, 'Indústria — venda de produtos industrializados pela própria empresa.'),
      option(
        'iii',
        'Anexo III',
        null,
        'Serviços em geral: instalação, reparo, manutenção, academias, contabilidade, agências de viagem, laboratórios. Também recebe os serviços do Anexo V quando a folha pesa 28% ou mais do faturamento.',
      ),
      option(
        'iv',
        'Anexo IV',
        null,
        'Construção civil e obras, limpeza, conservação, vigilância e serviços advocatícios. Neste anexo a contribuição previdenciária patronal fica FORA do DAS e é recolhida à parte.',
      ),
      option(
        'v',
        'Anexo V',
        null,
        'Serviços de maior intensidade intelectual: auditoria, tecnologia, publicidade, engenharia, consultoria — quando a folha pesa menos de 28% do faturamento.',
      ),
      option('multiplos', 'Mais de um anexo', null, 'A empresa tem atividades em anexos diferentes.'),
      option('nao_sei', 'Não sei', null, 'Sem problema: as próximas perguntas ajudam a identificar.'),
    ],
  },
  {
    key: 'atividadePrincipal',
    block: 2,
    prompt: 'Qual é a atividade principal da empresa?',
    type: 'single',
    origin: 'client',
    required: 'conditional',
    feeds: ['modality'],
    condition: (a) => a.anexoSimples === 'nao_sei',
    options: [
      option('comercio', 'Revenda de mercadorias (comércio)'),
      option('industria', 'Fabricação ou industrialização própria'),
      option('servico', 'Prestação de serviços'),
    ],
  },
  {
    key: 'servicoAnexoIV',
    block: 2,
    prompt: 'A atividade é construção civil, obras, limpeza, conservação, vigilância ou advocacia?',
    type: 'single',
    origin: 'client',
    required: 'conditional',
    feeds: ['modality'],
    condition: (a) => a.anexoSimples === 'nao_sei' && a.atividadePrincipal === 'servico',
    options: [option('sim', 'Sim'), option('nao', 'Não')],
  },
  {
    key: 'folhaSobreFaturamento',
    block: 2,
    prompt:
      'A folha dos últimos 12 meses — salários, pró-labore, FGTS e INSS — representa 28% ou mais do faturamento?',
    hint: 'É o chamado fator R. Ele decide entre o Anexo III e o Anexo V.',
    type: 'single',
    origin: 'client',
    required: 'conditional',
    feeds: ['modality'],
    condition: (a) =>
      a.anexoSimples === 'nao_sei' && a.atividadePrincipal === 'servico' && a.servicoAnexoIV === 'nao',
    unknownValue: 'nao_sei',
    options: [
      option('sim', 'Sim, 28% ou mais'),
      option('nao', 'Não, menos de 28%'),
      option('nao_sei', 'Não sei'),
    ],
  },
  {
    key: 'faixaRbt12',
    essential: true,
    block: 2,
    prompt: 'Faturamento dos últimos 12 meses',
    type: 'single',
    origin: 'registry',
    required: 'always',
    feeds: ['modality'],
    order: true,
    // The first six mirror the LC 123 annex brackets, where the effective rate changes (LC 214, art. 47, § 9º, II).
    // [CONFERIR] band limits against the annexes before publishing.
    options: [
      option('ate_180k', 'Até R$ 180 mil'),
      option('de_180_360k', 'R$ 180 mil a R$ 360 mil'),
      option('de_360_720k', 'R$ 360 mil a R$ 720 mil'),
      option('de_720k_1_8mi', 'R$ 720 mil a R$ 1,8 mi'),
      option('de_1_8_3_6mi', 'R$ 1,8 mi a R$ 3,6 mi'),
      option('de_3_6_4_32mi', 'R$ 3,6 mi a R$ 4,32 mi'),
      option('de_4_32_4_8mi', 'R$ 4,32 mi a R$ 4,8 mi'),
      option('acima_4_8mi', 'Acima de R$ 4,8 mi'),
    ],
  },
  {
    key: 'aliquotaEfetivaDas',
    essential: true,
    block: 2,
    prompt: 'Qual é a alíquota efetiva atual do DAS?',
    gapLabel: 'a alíquota efetiva do DAS',
    hint: (a) => {
      const estimate = estimateDasRate(text(a, 'anexoSimples'), text(a, 'faixaRbt12'))
      const base = 'Sai na apuração do PGDAS-D, na linha da alíquota efetiva. '
      if (!estimate) return base + 'Se não tiver em mãos agora, marque "Não sei" — levantamos para você.'
      const format = (v: number) => v.toFixed(2).replace('.', ',')
      return (
        base +
        `Pela tabela do seu anexo, na sua faixa de faturamento, ela fica entre ` +
        `${format(estimate.min)}% e ${format(estimate.max)}%. ` +
        (estimate.issIcmsOutsideDas
          ? 'Nessa faixa o ISS e o ICMS saem do DAS e passam a ser recolhidos por fora: a alíquota do DAS cai, o custo total não. '
          : '') +
        'Se não souber a sua, marque "Não sei" — usamos essa estimativa.'
      )
    },
    type: 'single',
    origin: 'registry',
    required: 'always',
    feeds: ['modality', 'action'],
    // "Não sei" is not a gap when a confirmed table exists: there is a number, it just did not come from the respondent.
    gapFilled: (a) => canEstimateDas(a),
    unknownValue: 'nao_sei',
    order: true,
    options: [
      option('ate_6', 'Até 6%'),
      option('de_6_9', '6% a 9%'),
      option('de_9_12', '9% a 12%'),
      option('de_12_15', '12% a 15%'),
      option('de_15_19', '15% a 19%'),
      option('acima_19', 'Acima de 19%'),
      option('nao_sei', 'Não sei'),
    ],
  },
  {
    key: 'jaPlanejouMudancaRegime',
    block: 2,
    prompt: 'Já foi feito algum estudo de mudança de regime tributário?',
    hint: 'Diferente de ter avaliado a Reforma: aqui é a comparação entre Simples, Presumido e Real.',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['action'],
    unknownValue: 'nao_sei',
    options: [
      option('sim_recente', 'Sim, nos últimos 2 anos'),
      option('sim_antigo', 'Sim, mas há mais de 2 anos'),
      option('nao', 'Nunca foi feito'),
      option('nao_sei', 'Não sei'),
    ],
  },
  {
    key: 'tendenciaCrescimento',
    block: 2,
    prompt: 'Como está a trajetória de faturamento?',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['modality'],
    options: [
      option('queda', 'Em queda'),
      option('estavel', 'Estável'),
      option('cresce_ate_20', 'Crescendo até 20% ao ano'),
      option('cresce_acima_20', 'Crescendo acima de 20% ao ano'),
    ],
  },
  {
    key: 'ultrapassouSublimite',
    block: 2,
    prompt: 'Já ultrapassou o sublimite estadual de ICMS/ISS?',
    gapLabel: 'se o sublimite estadual já foi ultrapassado',
    type: 'single',
    origin: 'registry',
    required: 'conditional',
    feeds: ['modality', 'radar'],
    axes: [6],
    unknownValue: 'nao_sei',
    condition: (a) => isOneOf(a.faixaRbt12, ['de_3_6_4_32mi', 'de_4_32_4_8mi', 'acima_4_8mi']),
    options: [
      option('nao', 'Não', 100),
      option('sim_corrente', 'Sim, no ano corrente', 25),
      option('sim_anteriores', 'Sim, em anos anteriores', 50),
      option('nao_sei', 'Não sei', 0),
    ],
  },
  {
    key: 'setorDiferenciado',
    block: 2,
    prompt: 'A atividade está em algum destes setores, que a Reforma trata de forma diferenciada?',
    gapLabel: 'se a atividade está em setor com tratamento próprio',
    hint: 'Alguns setores têm redução de alíquota ou regime específico no IBS e na CBS — 30% para as profissões regulamentadas do art. 127 e 60% para saúde, educação, alimentos e outros do art. 128 da LC 214/2025. Quando há redução, a conta do regime regular muda de patamar.',
    type: 'single',
    origin: 'registry',
    required: 'always',
    feeds: ['modality', 'action'],
    unknownValue: 'nao_sei',
    // LC 214 arts. 127 (30%, closed list of 18 professions) and 128 (60%). Medicine is art. 128, II; only the
    // VETERINARY doctor is in art. 127, XIII. The engine does not apply a percentage: the answer becomes an open point.
    options: [
      option('nenhum', 'Nenhum desses'),
      option(
        'saude',
        'Saúde — serviços médicos, odontológicos, laboratoriais, dispositivos médicos, medicamentos',
        null,
        'Redução de 60% na alíquota. É aqui que entra a medicina, não na lista das profissões regulamentadas.',
      ),
      option('educacao', 'Educação'),
      option('alimentos', 'Alimentos, cesta básica e produtos agropecuários in natura'),
      option('transporte_coletivo', 'Transporte coletivo de passageiros'),
      option(
        'profissao_regulamentada',
        'Profissão intelectual regulamentada — advocacia, contabilidade, engenharia, arquitetura, veterinária e outras',
        null,
        'Redução de 30%, em lista fechada de 18 profissões: administradores, advogados, arquitetos e urbanistas, assistentes sociais, bibliotecários, biólogos, contabilistas, economistas, economistas domésticos, educação física, engenheiros e agrônomos, estatísticos, médicos veterinários e zootecnistas, museólogos, químicos, relações públicas, técnicos industriais e técnicos agrícolas. Medicina não está na lista. Para sociedade, a redução exige sócios habilitados, nenhum sócio pessoa jurídica e serviços prestados pelos próprios sócios.',
      ),
      option('imobiliario', 'Operações com bens imóveis'),
      // Three distinct sections of LC 214 chapter VII; in two of them the law bars the buyer's credit.
      option(
        'bares_restaurantes',
        'Bares, restaurantes e lanchonetes',
        null,
        'Regime próprio, com alíquota reduzida em 40%. Quem compra alimentação e bebida de você NÃO pode aproveitar crédito — a lei veda (art. 276).',
      ),
      option(
        'hotelaria_parques',
        'Hotelaria, parques de diversão e parques temáticos',
        null,
        'Regime próprio, com alíquota reduzida em 40%. Você aproveita crédito nas suas compras, mas quem compra de você NÃO pode aproveitar crédito (arts. 282 e 283).',
      ),
      option('agencias_turismo', 'Agências de turismo', null, 'Também tem regime próprio no Capítulo VII da LC 214.'),
      option('nao_sei', 'Não sei'),
    ],
  },
  // Pending debt blocks entry and is a cause of exclusion — LC 123, art. 17, V; CGSN option roadmap 2027, item 2.2.
  {
    key: 'debitosTributarios',
    essential: true,
    block: 2,
    prompt: 'A empresa tem débito tributário em aberto, em qualquer esfera?',
    hint: 'Federal, estadual ou municipal, inclusive parcelado. Débito em aberto pode barrar o ingresso no Simples e é causa de exclusão de quem já está — e o prazo para regularizar é curto depois da opção.',
    type: 'single',
    origin: 'registry',
    required: 'always',
    feeds: ['action'],
    unknownValue: 'nao_sei',
    gapLabel: 'se há débito tributário em aberto',
    options: [
      option('nao', 'Não, está tudo em dia'),
      option('sim_parcelado', 'Sim, mas está parcelado e em dia'),
      option('sim_aberto', 'Sim, há débito sem parcelamento'),
      option('nao_sei', 'Não sei'),
    ],
  },
  // LC 214, art. 273, § 2: the bars regime excludes contract catering, resale without preparation and alcoholic drinks.
  {
    key: 'composicaoAlimentacao',
    essential: true,
    block: 2,
    prompt: 'Como se divide o que você vende?',
    hint: 'O regime próprio de bares e restaurantes vale para a alimentação preparada e servida no seu estabelecimento. Refeição para empresa sob contrato, revenda de produto de terceiro sem preparo e bebida alcoólica ficam FORA dele e seguem a regra geral — inclusive quanto ao crédito do cliente.',
    type: 'single',
    origin: 'client',
    required: 'conditional',
    feeds: ['modality', 'action'],
    condition: (a) => a.setorDiferenciado === 'bares_restaurantes',
    unknownValue: 'nao_sei',
    gapLabel: 'como se divide a sua receita de alimentação',
    options: [
      option(
        'quase_tudo_no_balcao',
        'Quase tudo é alimentação preparada e servida aqui',
        null,
        'Consumo no local, balcão, delivery do que você mesmo prepara.',
      ),
      option(
        'parte_fora_do_regime',
        'Tenho uma parte relevante fora disso',
        null,
        'Refeição para empresa sob contrato, revenda de produto de terceiro sem preparo, ou bebida alcoólica.',
      ),
      option(
        'maior_parte_fora',
        'A maior parte é refeição para empresa sob contrato',
        null,
        'Refeições coletivas, cantina terceirizada, fornecimento para indústria ou escritório.',
      ),
      option('nao_sei', 'Não sei'),
    ],
  },
  {
    key: 'grupoEconomico',
    block: 2,
    prompt: 'Existem outras empresas dos mesmos sócios?',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['action'],
    options: [
      option('nao', 'Não'),
      option('sim_simples', 'Sim, no Simples'),
      option('sim_regular', 'Sim, em regime regular'),
      option('sim_ambos', 'Sim, em ambos'),
    ],
  },
  {
    key: 'operacoesIntragrupo',
    block: 2,
    prompt: 'Há compra ou venda entre essas empresas?',
    hint: 'Se a empresa do regime regular compra desta, hoje ela aproveita crédito limitado. É uma das situações em que o híbrido muda a conta.',
    type: 'single',
    origin: 'client',
    required: 'conditional',
    feeds: ['modality', 'action'],
    condition: (a) => isOneOf(a.grupoEconomico, ['sim_regular', 'sim_ambos']),
    options: [
      option('nao', 'Não, são operações independentes'),
      option('sim_vende', 'Sim, esta empresa vende para as outras'),
      option('sim_compra', 'Sim, esta empresa compra das outras'),
      option('sim_ambos', 'Sim, nos dois sentidos'),
    ],
  },
  {
    key: 'receitaPorCliente',
    essential: true,
    block: 3,
    prompt: 'Quanto do seu faturamento vai para cada tipo de cliente?',
    gapLabel: 'quanto do faturamento vai para',
    hint: 'Se não souber a divisão de algum tipo de cliente, marque "não sei" naquela linha — vale mais que um palpite.',
    type: 'matrix',
    origin: 'client',
    required: 'always',
    feeds: ['modality'],
    unknownValue: 'nao_sei',
    rows: CUSTOMER_TYPES,
    columns: PERCENT_BANDS,
  },
  {
    key: 'pressaoCredito',
    essential: true,
    block: 3,
    prompt: 'Seus clientes já perguntaram sobre crédito de CBS/IBS ou pediram desconto por isso?',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['modality', 'action'],
    options: [
      option('nao', 'Não'),
      option('alguns_perguntaram', 'Alguns perguntaram'),
      option('pedido_formal', 'Já houve pedido formal de desconto'),
      option('perdemos_negocio', 'Já perdemos negócio por causa disso'),
    ],
  },
  {
    key: 'descontoPedido',
    block: 3,
    prompt: 'De quanto foi o desconto pedido?',
    type: 'single',
    origin: 'client',
    required: 'conditional',
    feeds: ['action'],
    condition: (a) => isOneOf(a.pressaoCredito, ['pedido_formal', 'perdemos_negocio']),
    unknownValue: 'nao_quantificado',
    options: [
      option('ate_5', 'Até 5%'),
      option('de_5_10', '5% a 10%'),
      option('de_10_20', '10% a 20%'),
      option('acima_20', 'Acima de 20%'),
      option('nao_quantificado', 'Não foi quantificado'),
    ],
  },
  {
    key: 'concentracaoClientes',
    block: 3,
    prompt: 'Quanto os cinco maiores clientes representam do faturamento?',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['action', 'radar'],
    axes: [4],
    options: [
      option('ate_20', 'Até 20%', 100),
      option('de_20_40', '20% a 40%', 75),
      option('de_40_60', '40% a 60%', 45),
      option('acima_60', 'Acima de 60%', 15),
    ],
  },
  {
    key: 'conheceRegimeClientes',
    block: 3,
    prompt: 'Você sabe o regime tributário dos seus principais clientes?',
    type: 'single',
    origin: 'client',
    required: 'conditional',
    feeds: ['radar', 'action'],
    // Hidden when all revenue is from individuals: consumers have no tax regime.
    condition: (a) => hasLegalEntityCustomer(a),
    axes: [1],
    unknownValue: 'nenhum',
    options: [
      option('todos', 'Sim, de todos', 100),
      option('maioria', 'Da maioria', 70),
      option('alguns', 'De apenas alguns', 35),
      option('nenhum', 'Não sei de nenhum', 0),
    ],
  },
  {
    key: 'pesoFolha',
    essential: true,
    block: 4,
    prompt: 'Quanto a folha representa do custo total?',
    hint: 'Inclui salários, pró-labore e encargos. Se a empresa não tem ninguém na folha, marque a última opção — as perguntas sobre mão de obra deixam de aparecer.',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['modality', 'action'],
    options: [
      option('ate_15', 'Até 15%'),
      option('de_15_30', '15% a 30%'),
      option('de_30_45', '30% a 45%'),
      option('de_45_60', '45% a 60%'),
      option('acima_60', 'Acima de 60%'),
      option('nenhuma', 'Não tenho folha nem prestadores na operação'),
    ],
  },
  {
    key: 'aquisicoesRegimeRegular',
    essential: true,
    block: 4,
    prompt: 'Quanto das suas compras vem de fornecedores do Lucro Presumido ou Real?',
    gapLabel: 'quanto das compras vem de fornecedor do regime regular',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['modality'],
    unknownValue: 'nao_sei',
    options: [
      option('ate_20', 'Até 20%'),
      option('de_20_40', '20% a 40%'),
      option('de_40_60', '40% a 60%'),
      option('de_60_80', '60% a 80%'),
      option('acima_80', 'Acima de 80%'),
      option('nao_sei', 'Não sei'),
    ],
  },
  {
    key: 'conheceRegimeFornecedores',
    block: 4,
    prompt: 'Você sabe o regime tributário dos seus principais fornecedores?',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['radar', 'action'],
    axes: [1, 3],
    unknownValue: 'nenhum',
    options: [
      option('todos', 'Sim, de todos', 100),
      option('maioria', 'Da maioria', 70),
      option('alguns', 'De apenas alguns', 35),
      option('nenhum', 'Não sei de nenhum', 0),
    ],
  },
  {
    key: 'terceirizacaoPossivel',
    block: 4,
    prompt: 'Parte da mão de obra poderia ser contratada de pessoa jurídica?',
    type: 'single',
    origin: 'client',
    required: 'conditional',
    feeds: ['action'],
    condition: (a) => isOneOf(a.pesoFolha, ['de_45_60', 'acima_60']),
    options: [
      option('nao', 'Não'),
      option('em_parte', 'Em parte'),
      option('boa_parte', 'Sim, boa parte'),
      option('ja_e_assim', 'Já é assim hoje'),
    ],
  },
  {
    key: 'investimentoPrevisto',
    essential: true,
    block: 4,
    prompt: 'Há investimento relevante em máquinas, equipamentos ou imóveis nos próximos 24 meses?',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['modality', 'action'],
    options: [
      option('nao', 'Não'),
      option('ate_200k', 'Sim, até R$ 200 mil'),
      option('de_200k_1mi', 'Sim, de R$ 200 mil a R$ 1 mi'),
      option('acima_1mi', 'Sim, acima de R$ 1 mi'),
    ],
  },
  {
    key: 'pesoMercadorias',
    block: 4,
    prompt: 'Quanto mercadorias e insumos representam do custo total?',
    hint: 'É o espelho da folha: mercadoria e insumo geram crédito no regime regular, folha não.',
    type: 'single',
    origin: 'client',
    required: 'conditional',
    feeds: ['modality'],
    condition: (a) => isProductOperation(a),
    options: [
      option('ate_20', 'Até 20%'),
      option('de_20_40', '20% a 40%'),
      option('de_40_60', '40% a 60%'),
      option('de_60_80', '60% a 80%'),
      option('acima_80', 'Acima de 80%'),
    ],
  },
  {
    key: 'mercadoriasComST',
    block: 4,
    prompt: 'Parte das mercadorias está hoje sujeita a substituição tributária de ICMS?',
    gapLabel: 'se há mercadoria com substituição tributária',
    hint: 'A substituição tributária não existe no modelo IBS/CBS. Quem opera muito com ST tem mudança relevante na dinâmica de crédito e de preço.',
    type: 'single',
    origin: 'registry',
    required: 'conditional',
    feeds: ['modality', 'action'],
    condition: (a) => isProductOperation(a),
    unknownValue: 'nao_sei',
    options: [
      option('nao', 'Não, nenhuma'),
      option('parte', 'Sim, parte delas'),
      option('maioria', 'Sim, a maioria'),
      option('nao_sei', 'Não sei'),
    ],
  },
  {
    key: 'prestadoresPJ',
    block: 4,
    prompt: 'Parte dos prestadores que atuam na operação é pessoa jurídica?',
    gapLabel: 'se há prestadores pessoa jurídica na operação',
    hint: 'Pagamento a pessoa jurídica gera crédito de IBS e CBS; folha de pagamento não. Por isso a composição muda a conta.',
    type: 'single',
    origin: 'client',
    required: 'conditional',
    feeds: ['modality', 'action'],
    condition: (a) => !isOperationWithoutLabor(a),
    unknownValue: 'nao_sei',
    options: [
      option('nao', 'Não, só empregados e sócios'),
      option('alguns', 'Sim, alguns prestadores'),
      option('boa_parte', 'Sim, boa parte da operação'),
      option('nao_sei', 'Não sei'),
    ],
  },
  {
    key: 'pagaRPA',
    block: 4,
    prompt: 'A empresa remunera autônomos por RPA?',
    hint: 'A inclusão do RPA no fator R é questão em aberto e depende de posição jurídica — a triagem apenas registra.',
    type: 'single',
    origin: 'client',
    required: 'conditional',
    feeds: ['action'],
    condition: (a) => isServiceOperation(a) && !isOperationWithoutLabor(a),
    unknownValue: 'nao_sei',
    options: [
      option('nao', 'Não'),
      option('pouco', 'Sim, valor pequeno'),
      option('relevante', 'Sim, valor relevante'),
      option('nao_sei', 'Não sei'),
    ],
  },
  {
    key: 'aquisicoesUsoPessoal',
    block: 4,
    prompt:
      'Há compras em nome da empresa destinadas ao uso pessoal de sócios, administradores, empregados ou familiares?',
    gapLabel: 'se há compras de uso pessoal em nome da empresa',
    hint: 'O art. 57 da LC 214/2025 alcança o que é fornecido sem cobrança — ou abaixo do preço de mercado — ao próprio titular, a sócios e administradores, a empregados e a parentes até o terceiro grau. Também entram sempre bebida alcoólica, joias, obras de arte, tabaco, armas e itens recreativos, esportivos e estéticos. Nada disso gera crédito (art. 57, § 5º).',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['modality', 'action'],
    unknownValue: 'nao_sei',
    options: [
      option('nao', 'Não, as compras são todas da operação'),
      option('pouco', 'Sim, uma parcela pequena'),
      option('relevante', 'Sim, uma parcela relevante'),
      option('nao_sei', 'Não sei'),
    ],
  },
  {
    key: 'despesasDeViagem',
    block: 4,
    prompt: 'A empresa tem despesa relevante com alimentação e hospedagem de equipe em viagem?',
    hint: 'Ponto ainda aberto na lei: as exceções do art. 57 cobrem alimentação "disponibilizada no estabelecimento do contribuinte durante a jornada de trabalho" — e não há alínea para hospedagem. Se a viagem entra como insumo da atividade ou como consumo pessoal depende do regulamento (art. 57, § 3º, V). Interessa saber o tamanho antes de contar com o crédito.',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['action'],
    unknownValue: 'nao_sei',
    options: [
      option('nao', 'Não, é irrelevante ou não existe'),
      option('pouco', 'Sim, valor pequeno'),
      option('relevante', 'Sim, valor relevante'),
      option('nao_sei', 'Não sei'),
    ],
  },
  {
    key: 'documentacaoDespesas',
    block: 4,
    prompt: 'Suas aquisições e despesas têm documento fiscal em nome da empresa?',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['radar', 'action'],
    axes: [3],
    options: [
      option('todas', 'Sim, todas', 100),
      option('maior_parte', 'A maior parte', 70),
      option('apenas_parte', 'Apenas parte', 35),
      option('poucas', 'Poucas', 0),
    ],
  },
  // The answer comes AFTER the DAS while the Presumido presumption is BEFORE IRPJ/CSLL; accepted for a triage cut.
  // [CONFERIR] redo when there is real calibration data.
  {
    key: 'margemLiquida',
    essential: true,
    block: 5,
    prompt: 'De cada R$ 100 que entram, quanto sobra de lucro no fim do mês?',
    gapLabel: 'a margem de lucro da operação',
    hint: 'Depois de pagar tudo — mercadoria, folha, pró-labore, aluguel, DAS e demais despesas — e antes de os sócios retirarem lucro. Aproximado serve.',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['modality', 'radar'],
    axes: [2],
    unknownValue: 'nao_sei',
    order: true,
    options: [
      option('prejuizo', 'Prejuízo', 100),
      option('ate_5', 'Até 5%', 100),
      option('de_5_10', '5% a 10%', 100),
      option('de_10_20', '10% a 20%', 100),
      option('de_20_30', '20% a 30%', 100),
      option('acima_30', 'Acima de 30%', 100),
      option('nao_sei', 'Não sei', 0),
    ],
  },
  {
    key: 'formacaoPreco',
    block: 5,
    prompt: 'Como o preço é definido?',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['modality', 'radar'],
    axes: [2, 4],
    options: [
      option('custo_mais_margem', 'Por custo mais margem', 100),
      option('preco_mercado', 'Por preço de mercado', 60),
      option('tabela_cliente', 'Por tabela do cliente ou do setor', 30),
      option('negociacao_caso_a_caso', 'Por negociação caso a caso', 40),
    ],
  },
  {
    key: 'contratosLongos',
    block: 5,
    prompt: 'Há contratos com preço travado por prazo longo?',
    gapLabel: 'se há contrato com preço travado',
    hint: 'Interessa saber se o preço pode ser reajustado quando a carga tributária mudar.',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['modality', 'action', 'radar'],
    axes: [4],
    unknownValue: 'nao_sei',
    // No contract is a better position than short contracts (nothing to renegotiate), below a revision clause.
    options: [
      option('sem_contratos', 'Não trabalho com contrato — cada venda é fechada na hora', 90),
      option('sem_contratos_longos', 'Tenho contratos, mas nenhum de prazo longo', 75),
      option('com_clausula', 'Sim, com cláusula de revisão tributária', 100),
      option('sem_clausula', 'Sim, sem cláusula de revisão', 20),
      option('nao_sei', 'Não sei', 0),
    ],
  },
  {
    key: 'margemPorLinha',
    block: 5,
    prompt: 'Você conhece a margem por produto, serviço ou linha de negócio?',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['radar', 'action'],
    axes: [2, 5],
    options: [
      option('com_detalhe', 'Sim, com detalhe', 100),
      option('aproximada', 'De forma aproximada', 65),
      option('so_global', 'Só a margem global', 35),
      option('nao_conheco', 'Não conheço', 0),
    ],
  },
  {
    key: 'sistemaGestao',
    block: 5,
    prompt: 'Qual sistema a empresa usa?',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['radar', 'action'],
    axes: [5],
    options: [
      option('erp', 'ERP integrado', 100),
      option('gestao_simples', 'Sistema de gestão simples', 65),
      option('planilhas', 'Planilhas', 30),
      option('manual', 'Controle manual', 0),
    ],
  },
  {
    key: 'jaSimulou',
    block: 5,
    prompt: 'Já foi feita alguma simulação do impacto da Reforma?',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['radar'],
    axes: [6],
    unknownValue: 'nao_sei',
    options: [
      option('detalhada', 'Sim, detalhada', 100),
      option('superficial', 'Sim, superficial', 60),
      option('nao', 'Não', 20),
      option('nao_sei', 'Não sei', 0),
    ],
  },
  {
    key: 'responsavelDecisao',
    block: 5,
    prompt: 'Quem decide sobre mudança de regime?',
    type: 'single',
    origin: 'client',
    required: 'always',
    feeds: ['radar', 'action'],
    axes: [6],
    options: [
      option('eu_mesmo', 'Eu mesmo', 100),
      option('socios_conjunto', 'Sócios em conjunto', 75),
      option('conselho_matriz', 'Conselho ou matriz', 45),
      option('contador_externo', 'Contador externo', 60),
    ],
  },
  // LGPD arts. 7, 9 and 18: the notice sits where the data is requested (block 1) and the consent is mandatory.
  {
    key: 'aceiteLgpd',
    essential: true,
    block: 1,
    prompt: 'Uso das suas informações',
    type: 'consent',
    origin: 'client',
    required: 'always',
    feeds: ['registry'],
    acceptLabel:
      'Concordo com o uso das minhas informações para este diagnóstico e para o contato da Auster sobre ele.',
  },
  {
    key: 'percepcaoFinal',
    block: 5,
    prompt: 'Depois de responder, o que mudou na sua percepção? (opcional)',
    hint: 'O que você não tinha pensado antes, ou o que ficou mais claro. Pode deixar em branco.',
    type: 'textarea',
    origin: 'client',
    required: 'never',
    feeds: ['registry'],
    essential: true,
  },
]

export const RADAR_AXES: RadarAxis[] = [
  { number: 1, title: 'Conhecimento da cadeia' },
  { number: 2, title: 'Informação de custo e margem' },
  { number: 3, title: 'Documentação fiscal' },
  { number: 4, title: 'Precificação e contratos' },
  { number: 5, title: 'Sistemas e informação' },
  { number: 6, title: 'Preparo para a janela' },
]

export function unansweredMatrixRows(question: Question, answers: Answers): string[] {
  const matrix = (answers[question.key] as MatrixAnswer | undefined) ?? {}
  return (question.rows ?? []).filter((row) => matrix[row.key] === question.unknownValue).map((row) => row.key)
}

// The short path shows only `essential` questions: the ones the engine needs to reach an exit.
export function visibleQuestions(answers: Answers): Question[] {
  const short = isShortPath(answers)
  return QUESTIONS.filter((q) => (!short || q.essential) && (!q.condition || q.condition(answers)))
}

export function isShortPath(answers: Answers): boolean {
  return answers.versaoFormulario === 'sintetico'
}

export const ENGINE_FIELDS: string[] = QUESTIONS.filter(
  (q) => q.feeds.includes('modality') || q.feeds.includes('eligibility'),
).map((q) => q.key)

export function optionLabel(key: string, value: unknown): string | null {
  const question = QUESTIONS.find((q) => q.key === key)
  if (!question || value === undefined || value === null) return null
  return (question.options ?? []).find((o) => o.value === value)?.label ?? null
}

export function matrixRowLabel(key: string, row: string, answers: Answers): string | null {
  const question = QUESTIONS.find((q) => q.key === key)
  const matrix = (answers[key] as MatrixAnswer | undefined) ?? {}
  const value = matrix[row]
  if (!question || !value) return null
  return (question.columns ?? []).find((c) => c.value === value)?.label ?? null
}
