import type { Diagnosis } from './diagnose'
import type { Answers } from './question-types'

export interface ActionItem {
  id: string
  action: string
  reason: string
  executor: 'client' | 'auster'
  track: 1 | 2
  requires?: string
  legalBasis?: string
}

export interface ActionRule extends ActionItem {
  when: (answers: Answers, diagnosis: Diagnosis) => boolean
}

export interface ActionPlan {
  clientNow: ActionItem[]
  clientLater: ActionItem[]
  auster: ActionItem[]
  total: number
}

const oneOf = (value: unknown, options: string[]): boolean =>
  typeof value === 'string' && options.includes(value)

type RuleExtra = Omit<ActionItem, 'id' | 'action'>

const rule = (id: string, when: ActionRule['when'], action: string, extra: RuleExtra): ActionRule => ({
  id,
  when,
  action,
  ...extra,
})

export const ACTION_RULES: ActionRule[] = [
  rule(
    'conferir_aliquota_no_pgdas',
    (_answers, diagnosis) => diagnosis.derived.dasCheck === 'fora_do_intervalo',
    'Confira no PGDAS-D qual é a sua alíquota efetiva de verdade.',
    {
      reason:
        'A alíquota que você informou não bate com a faixa de receita e o anexo declarados. O erro mais comum é informar a alíquota da tabela — a nominal — em vez da efetiva, que é sempre menor. Enquanto isso não fecha, qualquer comparação de carga anda sobre número errado.',
      executor: 'client',
      track: 1,
      requires: 'A última apuração do PGDAS-D, na linha da alíquota efetiva',
      legalBasis: 'LC 123/2006, art. 18, § 1º-A (alíquota efetiva = (RBT12 × Aliq − PD) / RBT12)',
    },
  ),

  rule(
    'separar_vendas_por_tipo_de_cliente',
    (_answers, diagnosis) => oneOf(diagnosis.outcome.code, ['C', 'E']),
    'Separe suas vendas do último ano entre empresas e consumidor final.',
    {
      reason: 'É o que define se destacar imposto vira argumento de venda ou só custo.',
      executor: 'client',
      track: 1,
      requires: 'Relatório de faturamento com o CNPJ de cada cliente',
    },
  ),

  rule(
    'separar_compras_por_fornecedor',
    (_answers, diagnosis) => oneOf(diagnosis.outcome.code, ['C', 'E']),
    'Separe suas compras do último ano por fornecedor.',
    {
      reason:
        'Compra de empresa grande gera crédito; compra de MEI e de optante do Simples, quase nada. É o tamanho do seu crédito.',
      executor: 'client',
      track: 1,
      requires: 'Relatório de compras com o CNPJ de cada fornecedor',
    },
  ),

  rule(
    'decidir_com_os_socios',
    (answers) => oneOf(answers.responsavelDecisao, ['conselho_matriz', 'socios_conjunto']),
    'Marque a conversa com os sócios ainda nesta semana.',
    {
      reason:
        'A decisão é de quem tem alçada, e a janela fecha em 30 de setembro. Decisão em conjunto não cabe nos últimos três dias.',
      executor: 'client',
      track: 1,
      requires: 'Uma hora na agenda de quem decide',
    },
  ),

  rule(
    'fechar_a_conta_ate_o_inicio_de_novembro',
    (_answers, diagnosis) =>
      diagnosis.position.family === 'hibrido' || diagnosis.position.family === 'a_definir',
    'Comece a levantar os números agora e feche a conta até o início de novembro.',
    {
      reason:
        'A solicitação feita em setembro pode ser cancelada até 30 de novembro, sem efeito nenhum. Mas 30 de novembro é o limite, não a data de começar: deixe a conclusão pronta na primeira semana de novembro, para haver tempo de cancelar com calma se o número disser o contrário.',
      legalBasis: 'Manual da Opção pelo Regime Regular do IBS e da CBS, item 4.2 (CGSN, 01/09/2026)',
      executor: 'client',
      track: 1,
      requires: 'Os relatórios em mãos agora, e a decisão marcada para a primeira semana de novembro',
    },
  ),

  rule(
    'ciencia_da_trava_do_ressarcimento',
    (_answers, diagnosis) => diagnosis.position.family === 'hibrido',
    'Saiba que pedir devolução de crédito fecha a porta de saída.',
    {
      reason:
        'Depois de 30 de novembro a opção vale pelo semestre. E se a empresa chegar a receber ressarcimento de crédito de IBS ou CBS, fica impedida de voltar ao recolhimento unificado no ano corrente e no seguinte — a saída deixa de existir, não só atrasa.',
      legalBasis: 'LC 214/2025, art. 41, § 5º',
      executor: 'client',
      track: 2,
      requires: 'Ciência dos sócios sobre isso, por escrito',
    },
  ),

  rule(
    'mapear_a_carteira_de_clientes',
    (answers, diagnosis) =>
      diagnosis.derived.unmappedPortfolio || oneOf(answers.conheceRegimeClientes, ['nenhum', 'alguns']),
    'Descubra em que regime estão os seus principais clientes.',
    {
      reason:
        'Este é o dado que mais pesa na decisão: só cliente do Lucro Presumido ou Real aproveita o crédito que você destacaria. Sem saber quanto do seu faturamento vai para esse grupo, a leitura fica no palpite — e dá para levantar a partir do CNPJ de cada cliente.',
      executor: 'client',
      track: 1,
      requires: 'Relação de faturamento do último ano com o CNPJ de cada cliente',
    },
  ),

  rule(
    'conversar_com_os_cinco_maiores',
    (answers) => oneOf(answers.concentracaoClientes, ['de_40_60', 'acima_60']),
    'Converse com seus cinco maiores clientes sobre crédito de imposto.',
    {
      reason:
        'Sua carteira é concentrada: a decisão depende de poucos nomes. Dá para tratar um a um e saber o que cada um vai pedir.',
      executor: 'client',
      track: 1,
      requires: 'Saber em que regime cada um desses cinco está',
    },
  ),

  rule(
    'quantificar_o_desconto_pedido',
    (answers) => oneOf(answers.pressaoCredito, ['pedido_formal', 'perdemos_negocio']),
    'Anote quanto de desconto cada cliente já pediu por causa do imposto.',
    {
      reason: 'Esse número é a medida direta do que custa ficar como está. É o dado mais forte que você tem.',
      executor: 'client',
      track: 1,
      requires: 'Histórico das negociações em que o assunto apareceu',
    },
  ),

  rule(
    'revisar_contratos_sem_clausula',
    (answers) => answers.contratosLongos === 'sem_clausula',
    'Reveja os contratos de preço travado para incluir cláusula de revisão.',
    {
      reason:
        'Preço fechado sem cláusula joga sobre você todo o efeito da mudança de imposto. Quem tem cláusula divide.',
      executor: 'client',
      track: 1,
      requires: 'A relação dos contratos e seus prazos',
    },
  ),

  rule(
    'conferir_se_tem_contrato_travado',
    (answers) => answers.contratosLongos === 'nao_sei',
    'Confira se existe contrato com preço travado por prazo longo.',
    {
      reason: 'Não saber tem o mesmo efeito de não ter cláusula: a conta chega e não há como repassar.',
      executor: 'client',
      track: 1,
      requires: 'Inventário dos contratos vigentes',
    },
  ),

  rule(
    'completar_diagnostico',
    (answers) => answers.versaoFormulario === 'sintetico',
    'Responda a versão completa antes de decidir.',
    {
      reason:
        'O caminho curto diz se vale olhar. O que mostra o tamanho da oportunidade ficou nas perguntas que você não viu.',
      executor: 'client',
      track: 1,
      requires: 'Mais cinco minutos',
    },
  ),

  rule(
    'separar_compras_pessoais',
    (answers) => oneOf(answers.aquisicoesUsoPessoal, ['pouco', 'relevante']),
    'Separe as compras pessoais das compras da operação.',
    {
      reason:
        'Compra para uso pessoal de sócio, administrador ou empregado não gera crédito. Misturada, faz a conta parecer melhor do que é.',
      legalBasis: 'LC 214/2025, art. 57, § 5º',
      executor: 'client',
      track: 2,
      requires: 'Classificação das compras do último ano',
    },
  ),

  rule(
    'apurar_compras_pessoais',
    (answers) => answers.aquisicoesUsoPessoal === 'nao_sei',
    'Descubra se há compras pessoais saindo em nome da empresa.',
    {
      reason: 'Se houver e ninguém souber, o crédito projetado sai maior do que o real.',
      executor: 'client',
      track: 2,
      requires: 'Uma amostra das compras do último ano',
    },
  ),

  rule(
    'separar_despesa_de_viagem',
    (answers) => oneOf(answers.despesasDeViagem, ['pouco', 'relevante']),
    'Separe o que gasta com alimentação e hospedagem de equipe em viagem.',
    {
      reason:
        'Se essa despesa gera crédito ainda não está resolvido na lei — depende de regulamento. Até sair, é mais seguro não contar com ela na conta.',
      legalBasis: 'LC 214/2025, art. 57, § 3º, V',
      executor: 'client',
      track: 2,
      requires: 'Valor anual de diárias, alimentação e hospedagem',
    },
  ),

  rule(
    'descobrir_regime_dos_clientes',
    (answers) => oneOf(answers.conheceRegimeClientes, ['alguns', 'nenhum']),
    'Descubra em que regime seus principais clientes estão.',
    {
      reason:
        'É o dado que falta em quase toda empresa e o que mais muda qualquer conta daqui para frente. Uma consulta simples por CNPJ resolve.',
      executor: 'client',
      track: 2,
      requires: 'A lista de CNPJ dos seus maiores clientes',
    },
  ),

  rule(
    'descobrir_regime_dos_fornecedores',
    (answers) =>
      oneOf(answers.conheceRegimeFornecedores, ['alguns', 'nenhum']) ||
      answers.aquisicoesRegimeRegular === 'nao_sei',
    'Descubra em que regime seus principais fornecedores estão.',
    {
      reason: 'Sem isso, o crédito que você tomaria é estimativa, não conta.',
      executor: 'client',
      track: 2,
      requires: 'A lista de CNPJ dos seus maiores fornecedores',
    },
  ),

  rule(
    'precificar_o_desconto',
    (_answers, diagnosis) => diagnosis.outcome.code === 'B',
    'Trate o desconto como decisão de preço, não como perda de margem.',
    {
      reason:
        'O desconto por crédito vai ser pedido de um jeito ou de outro. A diferença entre concedê-lo por política e perdê-lo na negociação é ter o número antes: quanto você pode dar, para quem, em troca de quê.',
      executor: 'client',
      track: 2,
      requires: 'Uma política de desconto por tipo de cliente',
    },
  ),

  rule(
    'conhecer_margem_por_linha',
    (answers) => oneOf(answers.margemPorLinha, ['so_global', 'nao_conheco']),
    'Saiba quanto cada produto ou serviço deixa de margem.',
    {
      reason: 'O efeito da Reforma muda de linha para linha. A margem do total esconde o que decide.',
      executor: 'client',
      track: 2,
      requires: 'Receita e custo separados por linha de negócio',
    },
  ),

  rule(
    'organizar_nota_das_compras',
    (answers) => oneOf(answers.documentacaoDespesas, ['apenas_parte', 'poucas']),
    'Exija nota em nome da empresa em tudo que comprar.',
    {
      reason: 'No novo modelo, sem documento não há crédito. Compra sem nota passa a custar o imposto cheio.',
      executor: 'client',
      track: 2,
      requires: 'Uma rotina de conferência na entrada',
    },
  ),

  rule(
    'rever_sistema',
    (answers) => oneOf(answers.sistemaGestao, ['planilhas', 'manual']),
    'Avalie trocar o controle atual por um sistema que separe imposto por venda.',
    {
      reason:
        'Hoje o imposto sai numa guia só. Apurando por fora, cada nota passa a ter imposto próprio — planilha não dá conta.',
      executor: 'client',
      track: 2,
      requires: 'Orçamento de um sistema de gestão',
    },
  ),

  rule(
    'simular_as_duas_opcoes',
    (_answers, diagnosis) => oneOf(diagnosis.outcome.code, ['C', 'E']),
    'Simular sua carga nas duas opções, com seus números reais',
    {
      reason:
        'Compara o que você paga hoje com o que pagaria apurando por fora, já considerando o crédito das suas compras. É esta conta que fecha a decisão antes de 30 de novembro.',
      executor: 'auster',
      track: 1,
      requires: 'Apuração dos últimos 12 meses e uma hora sua para ver o resultado',
    },
  ),

  rule(
    'levantar_o_das_e_a_folha',
    (_answers, diagnosis) => oneOf(diagnosis.outcome.code, ['C', 'D', 'E']),
    'Levantar sua alíquota real de DAS e o peso da folha',
    {
      reason: 'A comparação é pela diferença, não pelo valor cheio — e esses são os dois números que faltam.',
      executor: 'auster',
      track: 1,
      requires: 'Acesso à apuração, que já temos',
    },
  ),

  rule(
    'cuidar_do_protocolo',
    (_answers, diagnosis) => oneOf(diagnosis.outcome.code, ['C', 'D']),
    'Protocolar a opção no prazo',
    {
      reason:
        'Já temos procuração e certificado para operar em nome da empresa. O protocolo é nosso: fazemos com pelo menos três dias úteis de antecedência e devolvemos o comprovante.',
      executor: 'auster',
      track: 1,
      requires: 'Nada da sua parte — só o "pode ir"',
    },
  ),

  rule(
    'confirmar_setor_diferenciado',
    (_answers, diagnosis) => diagnosis.derived.sectorWithOwnRegime,
    'Confirmar se sua atividade entra num setor com alíquota reduzida',
    {
      reason:
        'Alguns setores têm tratamento próprio na Reforma. Se o seu for um deles, a conta muda de patamar — e o tamanho da redução precisa ser apurado caso a caso.',
      executor: 'auster',
      track: 1,
      requires: 'Seu CNAE e a descrição do que a empresa faz',
    },
  ),

  rule(
    'regularizar_debitos_no_prazo',
    (answers) => oneOf(answers.debitosTributarios, ['sim_aberto', 'nao_sei']),
    'Levante e regularize o que estiver em aberto, sem esperar o resultado da opção.',
    {
      reason:
        'Débito em aberto barra o ingresso de quem está entrando e é causa de exclusão de quem já está. A própria Receita orienta a confirmar o pedido mesmo com pendência, para não perder o prazo de 30 de setembro — o prazo de regularização é de 30 dias contados da confirmação, ou da ciência do termo de indeferimento.',
      legalBasis:
        'Roteiro da Opção pelo Simples Nacional para 2027, item 2.2 (CGSN); LC 123/2006, art. 17, V',
      executor: 'client',
      track: 1,
      requires: 'Situação fiscal nas três esferas — podemos extrair para você',
    },
  ),

  rule(
    'conferir_pendencias_antes_de_protocolar',
    (answers) => oneOf(answers.debitosTributarios, ['sim_parcelado', 'sim_aberto', 'nao_sei']),
    'Rodar a análise prévia de pendências e acompanhar o deferimento',
    {
      reason:
        'O sistema de opção faz uma análise prévia e a atualiza uma vez por dia. Acompanhamos o resultado, tratamos cada termo de indeferimento no prazo e avisamos se aparecer pendência de Estado ou Município, que demora mais para baixar no sistema.',
      executor: 'auster',
      track: 1,
      requires: 'Nada da sua parte',
    },
  ),

  rule(
    'segregar_receita_de_alimentacao',
    (_answers, diagnosis) => diagnosis.derived.mixedRevenueInSpecificRegime,
    'Separar o que é alimentação servida aqui do que é refeição sob contrato',
    {
      reason:
        'O regime próprio do seu ramo não alcança refeição para empresa sob contrato, revenda de produto de terceiro sem preparo nem bebida alcoólica. Essas receitas seguem a regra geral — e nelas o seu cliente APROVEITA crédito, o que muda a decisão. Sem separar, a conta sai errada nos dois sentidos.',
      legalBasis: 'LC 214/2025, art. 273, § 2º',
      executor: 'client',
      track: 1,
      requires: 'Faturamento do último ano separado por tipo de venda',
    },
  ),

  rule(
    'conferir_venda_para_orgao_publico',
    (_answers, diagnosis) => diagnosis.derived.sellsToPublicSector,
    'Conferir a regra aplicável à sua venda para órgão público',
    {
      reason:
        'Venda a governo tem regra própria na LC 214 e não segue a lógica de crédito do cliente privado. Por isso o portal deixou de contar essa receita como creditável: em vez de estimar, conferimos caso a caso.',
      executor: 'auster',
      track: 1,
      requires: 'Contratos e notas das vendas ao poder público',
    },
  ),

  rule(
    'conferir_receita_de_exportacao',
    (_answers, diagnosis) => diagnosis.derived.exports,
    'Separar e conferir a sua receita de exportação',
    {
      reason:
        'Exportação tem tratamento próprio no IBS e na CBS, e o cliente no exterior não aproveita crédito brasileiro. Isso muda o peso do argumento comercial e pode mudar a conta inteira — precisa entrar segregada na simulação.',
      executor: 'auster',
      track: 1,
      requires: 'Faturamento de exportação do último ano, separado do mercado interno',
    },
  ),

  rule(
    'ciencia_do_sublimite',
    (_answers, diagnosis) => diagnosis.derived.aboveSublimit,
    'Entenda o que muda por ter passado do sublimite.',
    {
      reason:
        'Passar do sublimite estadual não tira a empresa do Simples — o limite de permanência é outro, de R$ 4,8 milhões. O que muda é onde se recolhem ICMS, ISS e IBS: essas parcelas saem da guia única e passam a ser apuradas por fora, o que altera a comparação entre as duas modalidades.',
      executor: 'client',
      track: 1,
      requires: 'Nada de imediato — só não confundir sublimite com exclusão',
    },
  ),

  rule('estruturar_a_base_de_numeros', () => true, 'Estruturar a base de números que sustenta a decisão', {
    reason:
      'A conta depende de faturamento segregado por tipo de cliente, compras por regime de fornecedor, folha e margem por linha. Quase nunca isso está pronto num relatório só. Montamos essa base com você, num formato que serve depois para a apuração e para a negociação.',
    executor: 'auster',
    track: 1,
    requires: 'Acesso aos relatórios de venda, compra e folha do último ano',
  }),

  rule(
    'apoiar_as_reunioes_de_negociacao',
    (answers, diagnosis) =>
      diagnosis.derived.creditableRevenue === null ||
      diagnosis.derived.creditableRevenue >= 20 ||
      oneOf(answers.pressaoCredito, ['alguns_perguntaram', 'pedido_formal', 'perdemos_negocio']),
    'Sentar com você nas conversas com clientes e fornecedores',
    {
      reason:
        'A parte difícil não é calcular: é negociar. Preparamos o material de cada conversa, participamos das reuniões com os principais clientes e fornecedores e ajudamos a sustentar preço em vez de conceder desconto por falta de argumento.',
      executor: 'auster',
      track: 1,
      requires: 'A lista de quem você quer conversar e uma data',
    },
  ),

  rule(
    'rodar_regime_especifico_do_setor',
    (_answers, diagnosis) => diagnosis.derived.customerCannotCredit,
    'Rodar a conta do regime específico do seu setor',
    {
      reason:
        'No seu setor a alíquota é reduzida em 40% e quem compra de você não pode aproveitar crédito. A decisão deixa de ser comercial e passa a ser aritmética: comparar o crédito das suas compras com o que você recolheria por fora.',
      legalBasis: 'LC 214/2025, arts. 273 a 283',
      executor: 'auster',
      track: 1,
      requires: 'Notas de compra do último ano e faturamento por tipo de venda',
    },
  ),

  rule(
    'comparar_com_presumido_e_real',
    (_answers, diagnosis) =>
      diagnosis.derived.simplesMayBeMoreExpensive || diagnosis.derived.marginBelowPresumption,
    'Comparar o Simples com Lucro Presumido e Lucro Real',
    {
      reason:
        'Pelos seus números, o Simples pode já estar custando mais do que os outros regimes — ou sua margem está abaixo da presunção, o que costuma favorecer o Lucro Real. É indício para verificar, não conclusão.',
      executor: 'auster',
      track: 2,
      requires: 'PGDAS-D, folha e DRE do último ano',
    },
  ),

  rule(
    'projetar_margem_pos_reforma',
    (_answers, diagnosis) => oneOf(diagnosis.outcome.code, ['B', 'C', 'E']),
    'Projetar sua margem depois da Reforma, linha por linha',
    {
      reason:
        'A margem que você informou é a de hoje. A de 2027 depende de crédito de insumo, repasse e regime da sua cadeia — e é isso que a simulação entrega.',
      executor: 'auster',
      track: 2,
      requires: 'Receita e custo por linha',
    },
  ),

  rule(
    'olhar_prestadores_pj',
    (answers) => oneOf(answers.prestadoresPJ, ['alguns', 'boa_parte']),
    'Revisar a contratação de prestadores pessoa jurídica',
    {
      reason:
        'A proporção entre folha e prestador PJ muda o crédito e também o custo previdenciário. Vale olhar contratos, rotina de trabalho e enquadramento antes de decidir.',
      executor: 'auster',
      track: 2,
      requires: 'Contratos vigentes',
    },
  ),

  rule(
    'olhar_substituicao_tributaria',
    (answers) => oneOf(answers.mercadoriasComST, ['parte', 'maioria']),
    'Mapear as mercadorias que hoje têm substituição tributária',
    {
      reason:
        'A substituição deixa de existir no novo modelo. Quem opera com ela tem mudança grande de preço e de crédito.',
      executor: 'auster',
      track: 2,
      requires: 'Relação das mercadorias que você revende',
    },
  ),

  rule(
    'projetar_faturamento_e_sublimite',
    (_answers, diagnosis) => diagnosis.derived.nearCeiling,
    'Projetar seu faturamento até dezembro e checar o sublimite',
    {
      reason:
        'Você está perto do teto do Simples. Antes de escolher como apurar, é preciso saber se vai continuar nele.',
      executor: 'auster',
      track: 1,
      requires: 'Faturamento mês a mês',
    },
  ),

  rule(
    'simular_saida_do_simples',
    (_answers, diagnosis) => diagnosis.outcome.code === 'D',
    'Simular Lucro Presumido e Lucro Real, além do Simples',
    {
      reason:
        'No seu caso a pergunta já não é como apurar dentro do Simples, e sim se continuar nele faz sentido.',
      executor: 'auster',
      track: 1,
      requires: 'DRE e apuração do último ano',
    },
  ),

  rule(
    'refazer_estudo_de_regime',
    (answers) => oneOf(answers.jaPlanejouMudancaRegime, ['sim_antigo', 'nao', 'nao_sei']),
    'Fazer o estudo comparativo de regime tributário',
    {
      reason:
        'A Reforma muda as premissas de qualquer comparação feita antes dela. Estudo de mais de dois anos foi construído sobre outro sistema.',
      executor: 'auster',
      track: 2,
      requires: 'O estudo anterior, se existir',
    },
  ),

  rule(
    'apurar_margem',
    (answers) => answers.margemLiquida === 'nao_sei',
    'Apurar sua margem dos últimos 12 meses',
    {
      reason:
        'Sem saber a margem não há como dizer se cabe conceder desconto ao cliente. É o primeiro número de qualquer conta.',
      executor: 'auster',
      track: 1,
      requires: 'Acesso à contabilidade, que já temos',
    },
  ),

  rule(
    'levantar_aliquota_do_das',
    (answers) => answers.aliquotaEfetivaDas === 'nao_sei',
    'Levantar sua alíquota efetiva de DAS',
    {
      reason: 'É o número que permite comparar o Simples com qualquer outro regime.',
      executor: 'auster',
      track: 1,
      requires: 'Nada da sua parte',
    },
  ),

  rule(
    'olhar_estrutura_de_folha',
    (answers) =>
      oneOf(answers.pesoFolha, ['de_45_60', 'acima_60']) &&
      Boolean(answers.terceirizacaoPossivel) &&
      answers.terceirizacaoPossivel !== 'ja_e_assim',
    'Avaliar a estrutura de contratação de pessoal',
    {
      reason:
        'Folha não gera crédito. Com folha pesada, apurar por fora tende a custar mais — e há formas de organizar isso.',
      executor: 'auster',
      track: 2,
      requires: 'Composição da folha e dos contratos de serviço',
    },
  ),

  rule(
    'contar_o_investimento',
    (answers) => oneOf(answers.investimentoPrevisto, ['de_200k_1mi', 'acima_1mi']),
    'Incluir o investimento previsto na conta de crédito',
    {
      reason:
        'Compra de máquina, equipamento ou imóvel gera crédito no novo modelo, e pode virar o resultado da comparação.',
      executor: 'auster',
      track: 1,
      requires: 'Valores e prazo do investimento',
    },
  ),

  rule(
    'olhar_o_grupo',
    (answers) => oneOf(answers.grupoEconomico, ['sim_regular', 'sim_ambos']),
    'Avaliar o efeito entre as empresas do grupo',
    {
      reason:
        'Se uma empresa do grupo compra da outra, hoje ela aproveita crédito limitado. Apurando por fora, passa a aproveitar integral — o ganho fica dentro de casa.',
      executor: 'auster',
      track: 2,
      requires: 'Quais operações existem entre as empresas',
    },
  ),

  rule(
    'revisitar_na_proxima_janela',
    (_answers, diagnosis) => diagnosis.outcome.code === 'A',
    'Revisitar isso antes da próxima janela de opção',
    {
      reason: 'A recomendação de hoje depende do perfil da sua carteira, e carteira muda.',
      executor: 'auster',
      track: 2,
      requires: 'Nada agora',
    },
  ),
]

export function buildActionPlan(answers: Answers, diagnosis: Diagnosis): ActionPlan {
  const items = ACTION_RULES.filter((actionRule) => {
    try {
      return actionRule.when(answers, diagnosis)
    } catch {
      return false
    }
  }).map(({ when, ...item }): ActionItem => {
    void when
    return item
  })

  const client = items.filter((item) => item.executor === 'client')
  return {
    clientNow: client.filter((item) => item.track === 1),
    clientLater: client.filter((item) => item.track === 2),
    auster: items.filter((item) => item.executor === 'auster'),
    total: items.length,
  }
}
