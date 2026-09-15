/* Plano de ação gerado por gatilho.
 *
 * Cada regra observa as respostas e a saída do motor e decide se entra no plano.
 * Duas empresas na mesma saída saem com planos diferentes.
 *
 * Duas separações, e as duas importam:
 *
 *   executor  'cliente' = o que a empresa faz dentro de casa
 *             'auster'  = o que é serviço, e vai num bloco à parte do relatório
 *
 *   trilha    1 = condição para decidir dentro da janela
 *             2 = trabalho de fôlego, que melhora qualquer decisão posterior
 *
 * REGRA DE REDAÇÃO: o texto é para quem toca a empresa, não para contador.
 * Verbo no imperativo, frase curta, sem citação de artigo no corpo. O fundamento
 * legal fica em `fundamento` e só aparece se o leitor quiser abrir.
 */

const a = (id, quando, acao, extra) => ({ id, quando, acao, ...extra });

export const REGRAS_ACAO = [

  // ================================================== O QUE O CLIENTE FAZ
  a('separar_vendas_por_tipo_de_cliente',
    (r, d) => ['C', 'E'].includes(d.saida.codigo),
    'Separe suas vendas do último ano entre empresas e consumidor final.',
    { porque: 'É o que define se destacar imposto vira argumento de venda ou só custo.',
      executor: 'cliente', trilha: 1, precisa: 'Relatório de faturamento com o CNPJ de cada cliente' }),

  a('separar_compras_por_fornecedor',
    (r, d) => ['C', 'E'].includes(d.saida.codigo),
    'Separe suas compras do último ano por fornecedor.',
    { porque: 'Compra de empresa grande gera crédito; compra de MEI e de optante do Simples, quase nada. É o tamanho do seu crédito.',
      executor: 'cliente', trilha: 1, precisa: 'Relatório de compras com o CNPJ de cada fornecedor' }),

  a('decidir_com_os_socios',
    r => ['conselho_matriz', 'socios_conjunto'].includes(r.responsavelDecisao),
    'Marque a conversa com os sócios ainda nesta semana.',
    { porque: 'A decisão é de quem tem alçada, e a janela fecha em 30 de setembro. Decisão em conjunto não cabe nos últimos três dias.',
      executor: 'cliente', trilha: 1, precisa: 'Uma hora na agenda de quem decide' }),

  // A data de novembro é o que torna a opção barata — e o que a torna perigosa
  // se ninguém voltar a ela. Manual da Opção (CGSN, 01/09/2026), item 4.2.
  a('fechar_a_conta_ate_o_inicio_de_novembro',
    (r, d) => d.posicao.familia === 'hibrido' || d.posicao.familia === 'a_definir',
    'Comece a levantar os números agora e feche a conta até o início de novembro.',
    { porque: 'A solicitação feita em setembro pode ser cancelada até 30 de novembro, sem efeito nenhum. Mas 30 de novembro é o limite, não a data de começar: deixe a conclusão pronta na primeira semana de novembro, para haver tempo de cancelar com calma se o número disser o contrário.',
      fundamento: 'Manual da Opção pelo Regime Regular do IBS e da CBS, item 4.2 (CGSN, 01/09/2026)',
      executor: 'cliente', trilha: 1, precisa: 'Os relatórios em mãos agora, e a decisão marcada para a primeira semana de novembro' }),

  a('ciencia_da_trava_do_ressarcimento',
    (r, d) => d.posicao.familia === 'hibrido',
    'Saiba que pedir devolução de crédito fecha a porta de saída.',
    { porque: 'Depois de 30 de novembro a opção vale pelo semestre. E se a empresa chegar a receber ressarcimento de crédito de IBS ou CBS, fica impedida de voltar ao recolhimento unificado no ano corrente e no seguinte — a saída deixa de existir, não só atrasa.',
      fundamento: 'LC 214/2025, art. 41, § 5º',
      executor: 'cliente', trilha: 2, precisa: 'Ciência dos sócios sobre isso, por escrito' }),

  a('mapear_a_carteira_de_clientes',
    (r, d) => d.derivadas.carteiraNaoMapeada || ['nenhum', 'alguns'].includes(r.conheceRegimeClientes),
    'Descubra em que regime estão os seus principais clientes.',
    { porque: 'Este é o dado que mais pesa na decisão: só cliente do Lucro Presumido ou Real aproveita o crédito que você destacaria. Sem saber quanto do seu faturamento vai para esse grupo, a leitura fica no palpite — e dá para levantar a partir do CNPJ de cada cliente.',
      executor: 'cliente', trilha: 1, precisa: 'Relação de faturamento do último ano com o CNPJ de cada cliente' }),

  a('conversar_com_os_cinco_maiores',
    r => ['de_40_60', 'acima_60'].includes(r.concentracaoClientes),
    'Converse com seus cinco maiores clientes sobre crédito de imposto.',
    { porque: 'Sua carteira é concentrada: a decisão depende de poucos nomes. Dá para tratar um a um e saber o que cada um vai pedir.',
      executor: 'cliente', trilha: 1, precisa: 'Saber em que regime cada um desses cinco está' }),

  a('quantificar_o_desconto_pedido',
    r => ['pedido_formal', 'perdemos_negocio'].includes(r.pressaoCredito),
    'Anote quanto de desconto cada cliente já pediu por causa do imposto.',
    { porque: 'Esse número é a medida direta do que custa ficar como está. É o dado mais forte que você tem.',
      executor: 'cliente', trilha: 1, precisa: 'Histórico das negociações em que o assunto apareceu' }),

  a('revisar_contratos_sem_clausula',
    r => r.contratosLongos === 'sem_clausula',
    'Reveja os contratos de preço travado para incluir cláusula de revisão.',
    { porque: 'Preço fechado sem cláusula joga sobre você todo o efeito da mudança de imposto. Quem tem cláusula divide.',
      executor: 'cliente', trilha: 1, precisa: 'A relação dos contratos e seus prazos' }),

  a('conferir_se_tem_contrato_travado',
    r => r.contratosLongos === 'nao_sei',
    'Confira se existe contrato com preço travado por prazo longo.',
    { porque: 'Não saber tem o mesmo efeito de não ter cláusula: a conta chega e não há como repassar.',
      executor: 'cliente', trilha: 1, precisa: 'Inventário dos contratos vigentes' }),

  a('completar_diagnostico',
    r => r.versaoFormulario === 'sintetico',
    'Responda a versão completa antes de decidir.',
    { porque: 'O caminho curto diz se vale olhar. O que mostra o tamanho da oportunidade ficou nas perguntas que você não viu.',
      executor: 'cliente', trilha: 1, precisa: 'Mais cinco minutos' }),

  a('separar_compras_pessoais',
    r => ['pouco', 'relevante'].includes(r.aquisicoesUsoPessoal),
    'Separe as compras pessoais das compras da operação.',
    { porque: 'Compra para uso pessoal de sócio, administrador ou empregado não gera crédito. Misturada, faz a conta parecer melhor do que é.',
      fundamento: 'LC 214/2025, art. 57, § 5º',
      executor: 'cliente', trilha: 2, precisa: 'Classificação das compras do último ano' }),

  a('apurar_compras_pessoais',
    r => r.aquisicoesUsoPessoal === 'nao_sei',
    'Descubra se há compras pessoais saindo em nome da empresa.',
    { porque: 'Se houver e ninguém souber, o crédito projetado sai maior do que o real.',
      executor: 'cliente', trilha: 2, precisa: 'Uma amostra das compras do último ano' }),

  a('separar_despesa_de_viagem',
    r => ['pouco', 'relevante'].includes(r.despesasDeViagem),
    'Separe o que gasta com alimentação e hospedagem de equipe em viagem.',
    { porque: 'Se essa despesa gera crédito ainda não está resolvido na lei — depende de regulamento. Até sair, é mais seguro não contar com ela na conta.',
      fundamento: 'LC 214/2025, art. 57, § 3º, V',
      executor: 'cliente', trilha: 2, precisa: 'Valor anual de diárias, alimentação e hospedagem' }),

  a('descobrir_regime_dos_clientes',
    r => ['alguns', 'nenhum'].includes(r.conheceRegimeClientes),
    'Descubra em que regime seus principais clientes estão.',
    { porque: 'É o dado que falta em quase toda empresa e o que mais muda qualquer conta daqui para frente. Uma consulta simples por CNPJ resolve.',
      executor: 'cliente', trilha: 2, precisa: 'A lista de CNPJ dos seus maiores clientes' }),

  a('descobrir_regime_dos_fornecedores',
    r => ['alguns', 'nenhum'].includes(r.conheceRegimeFornecedores) || r.aquisicoesRegimeRegular === 'nao_sei',
    'Descubra em que regime seus principais fornecedores estão.',
    { porque: 'Sem isso, o crédito que você tomaria é estimativa, não conta.',
      executor: 'cliente', trilha: 2, precisa: 'A lista de CNPJ dos seus maiores fornecedores' }),

  a('precificar_o_desconto',
    (r, d) => d.saida.codigo === 'B',
    'Trate o desconto como decisão de preço, não como perda de margem.',
    { porque: 'O desconto por crédito vai ser pedido de um jeito ou de outro. A diferença entre concedê-lo por política e perdê-lo na negociação é ter o número antes: quanto você pode dar, para quem, em troca de quê.',
      executor: 'cliente', trilha: 2, precisa: 'Uma política de desconto por tipo de cliente' }),

  a('conhecer_margem_por_linha',
    r => ['so_global', 'nao_conheco'].includes(r.margemPorLinha),
    'Saiba quanto cada produto ou serviço deixa de margem.',
    { porque: 'O efeito da Reforma muda de linha para linha. A margem do total esconde o que decide.',
      executor: 'cliente', trilha: 2, precisa: 'Receita e custo separados por linha de negócio' }),

  a('organizar_nota_das_compras',
    r => ['apenas_parte', 'poucas'].includes(r.documentacaoDespesas),
    'Exija nota em nome da empresa em tudo que comprar.',
    { porque: 'No novo modelo, sem documento não há crédito. Compra sem nota passa a custar o imposto cheio.',
      executor: 'cliente', trilha: 2, precisa: 'Uma rotina de conferência na entrada' }),

  a('rever_sistema',
    r => ['planilhas', 'manual'].includes(r.sistemaGestao),
    'Avalie trocar o controle atual por um sistema que separe imposto por venda.',
    { porque: 'Hoje o imposto sai numa guia só. Apurando por fora, cada nota passa a ter imposto próprio — planilha não dá conta.',
      executor: 'cliente', trilha: 2, precisa: 'Orçamento de um sistema de gestão' }),

  // ============================================ O QUE A AUSTER PODE FAZER
  a('simular_as_duas_opcoes',
    (r, d) => ['C', 'E'].includes(d.saida.codigo),
    'Simular sua carga nas duas opções, com seus números reais',
    { porque: 'Compara o que você paga hoje com o que pagaria apurando por fora, já considerando o crédito das suas compras. É esta conta que fecha a decisão antes de 30 de novembro.',
      executor: 'auster', trilha: 1, precisa: 'Apuração dos últimos 12 meses e uma hora sua para ver o resultado' }),

  a('levantar_o_das_e_a_folha',
    (r, d) => ['C', 'D', 'E'].includes(d.saida.codigo),
    'Levantar sua alíquota real de DAS e o peso da folha',
    { porque: 'A comparação é pela diferença, não pelo valor cheio — e esses são os dois números que faltam.',
      executor: 'auster', trilha: 1, precisa: 'Acesso à apuração, que já temos' }),

  a('cuidar_do_protocolo',
    (r, d) => ['C', 'D'].includes(d.saida.codigo),
    'Protocolar a opção no prazo',
    { porque: 'Já temos procuração e certificado para operar em nome da empresa. O protocolo é nosso: fazemos com pelo menos três dias úteis de antecedência e devolvemos o comprovante.',
      executor: 'auster', trilha: 1, precisa: 'Nada da sua parte — só o "pode ir"' }),

  a('confirmar_setor_diferenciado',
    (r, d) => d.derivadas.setorComTratamentoProprio,
    'Confirmar se sua atividade entra num setor com alíquota reduzida',
    { porque: 'Alguns setores têm tratamento próprio na Reforma. Se o seu for um deles, a conta muda de patamar — e o tamanho da redução precisa ser apurado caso a caso.',
      executor: 'auster', trilha: 1, precisa: 'Seu CNAE e a descrição do que a empresa faz' }),

  a('regularizar_debitos_no_prazo',
    r => ['sim_aberto', 'nao_sei'].includes(r.debitosTributarios),
    'Levante e regularize o que estiver em aberto, sem esperar o resultado da opção.',
    { porque: 'Débito em aberto barra o ingresso de quem está entrando e é causa de exclusão de quem já está. A própria Receita orienta a confirmar o pedido mesmo com pendência, para não perder o prazo de 30 de setembro — o prazo de regularização é de 30 dias contados da confirmação, ou da ciência do termo de indeferimento.',
      fundamento: 'Roteiro da Opção pelo Simples Nacional para 2027, item 2.2 (CGSN); LC 123/2006, art. 17, V',
      executor: 'cliente', trilha: 1, precisa: 'Situação fiscal nas três esferas — podemos extrair para você' }),

  a('conferir_pendencias_antes_de_protocolar',
    r => ['sim_parcelado', 'sim_aberto', 'nao_sei'].includes(r.debitosTributarios),
    'Rodar a análise prévia de pendências e acompanhar o deferimento',
    { porque: 'O sistema de opção faz uma análise prévia e a atualiza uma vez por dia. Acompanhamos o resultado, tratamos cada termo de indeferimento no prazo e avisamos se aparecer pendência de Estado ou Município, que demora mais para baixar no sistema.',
      executor: 'auster', trilha: 1, precisa: 'Nada da sua parte' }),

  a('segregar_receita_de_alimentacao',
    (r, d) => d.derivadas.receitaMistaNoRegimeEspecifico,
    'Separar o que é alimentação servida aqui do que é refeição sob contrato',
    { porque: 'O regime próprio do seu ramo não alcança refeição para empresa sob contrato, revenda de produto de terceiro sem preparo nem bebida alcoólica. Essas receitas seguem a regra geral — e nelas o seu cliente APROVEITA crédito, o que muda a decisão. Sem separar, a conta sai errada nos dois sentidos.',
      fundamento: 'LC 214/2025, art. 273, § 2º',
      executor: 'cliente', trilha: 1, precisa: 'Faturamento do último ano separado por tipo de venda' }),

  a('conferir_venda_para_orgao_publico',
    (r, d) => d.derivadas.vendeParaOrgaoPublico,
    'Conferir a regra aplicável à sua venda para órgão público',
    { porque: 'Venda a governo tem regra própria na LC 214 e não segue a lógica de crédito do cliente privado. Por isso o portal deixou de contar essa receita como creditável: em vez de estimar, conferimos caso a caso.',
      executor: 'auster', trilha: 1, precisa: 'Contratos e notas das vendas ao poder público' }),

  a('conferir_receita_de_exportacao',
    (r, d) => d.derivadas.exporta,
    'Separar e conferir a sua receita de exportação',
    { porque: 'Exportação tem tratamento próprio no IBS e na CBS, e o cliente no exterior não aproveita crédito brasileiro. Isso muda o peso do argumento comercial e pode mudar a conta inteira — precisa entrar segregada na simulação.',
      executor: 'auster', trilha: 1, precisa: 'Faturamento de exportação do último ano, separado do mercado interno' }),

  a('ciencia_do_sublimite',
    (r, d) => d.derivadas.passouDoSublimite,
    'Entenda o que muda por ter passado do sublimite.',
    { porque: 'Passar do sublimite estadual não tira a empresa do Simples — o limite de permanência é outro, de R$ 4,8 milhões. O que muda é onde se recolhem ICMS, ISS e IBS: essas parcelas saem da guia única e passam a ser apuradas por fora, o que altera a comparação entre as duas modalidades.',
      executor: 'cliente', trilha: 1, precisa: 'Nada de imediato — só não confundir sublimite com exclusão' }),

  a('estruturar_a_base_de_numeros',
    () => true,
    'Estruturar a base de números que sustenta a decisão',
    { porque: 'A conta depende de faturamento segregado por tipo de cliente, compras por regime de fornecedor, folha e margem por linha. Quase nunca isso está pronto num relatório só. Montamos essa base com você, num formato que serve depois para a apuração e para a negociação.',
      executor: 'auster', trilha: 1, precisa: 'Acesso aos relatórios de venda, compra e folha do último ano' }),

  a('apoiar_as_reunioes_de_negociacao',
    (r, d) => d.derivadas.receitaCreditavel === null || d.derivadas.receitaCreditavel >= 20
              || ['alguns_perguntaram', 'pedido_formal', 'perdemos_negocio'].includes(r.pressaoCredito),
    'Sentar com você nas conversas com clientes e fornecedores',
    { porque: 'A parte difícil não é calcular: é negociar. Preparamos o material de cada conversa, participamos das reuniões com os principais clientes e fornecedores e ajudamos a sustentar preço em vez de conceder desconto por falta de argumento.',
      executor: 'auster', trilha: 1, precisa: 'A lista de quem você quer conversar e uma data' }),

  a('rodar_regime_especifico_do_setor',
    (r, d) => d.derivadas.clienteNaoPodeCreditar,
    'Rodar a conta do regime específico do seu setor',
    { porque: 'No seu setor a alíquota é reduzida em 40% e quem compra de você não pode aproveitar crédito. A decisão deixa de ser comercial e passa a ser aritmética: comparar o crédito das suas compras com o que você recolheria por fora.',
      fundamento: 'LC 214/2025, arts. 273 a 283',
      executor: 'auster', trilha: 1, precisa: 'Notas de compra do último ano e faturamento por tipo de venda' }),

  a('comparar_com_presumido_e_real',
    (r, d) => d.derivadas.simplesParecelMaisCaro || d.derivadas.margemAbaixoDaPresuncao,
    'Comparar o Simples com Lucro Presumido e Lucro Real',
    { porque: 'Pelos seus números, o Simples pode já estar custando mais do que os outros regimes — ou sua margem está abaixo da presunção, o que costuma favorecer o Lucro Real. É indício para verificar, não conclusão.',
      executor: 'auster', trilha: 2, precisa: 'PGDAS-D, folha e DRE do último ano' }),

  a('projetar_margem_pos_reforma',
    (r, d) => ['B', 'C', 'E'].includes(d.saida.codigo),
    'Projetar sua margem depois da Reforma, linha por linha',
    { porque: 'A margem que você informou é a de hoje. A de 2027 depende de crédito de insumo, repasse e regime da sua cadeia — e é isso que a simulação entrega.',
      executor: 'auster', trilha: 2, precisa: 'Receita e custo por linha' }),

  a('olhar_prestadores_pj',
    r => ['alguns', 'boa_parte'].includes(r.prestadoresPJ),
    'Revisar a contratação de prestadores pessoa jurídica',
    { porque: 'A proporção entre folha e prestador PJ muda o crédito e também o custo previdenciário. Vale olhar contratos, rotina de trabalho e enquadramento antes de decidir.',
      executor: 'auster', trilha: 2, precisa: 'Contratos vigentes' }),

  a('olhar_substituicao_tributaria',
    r => ['parte', 'maioria'].includes(r.mercadoriasComST),
    'Mapear as mercadorias que hoje têm substituição tributária',
    { porque: 'A substituição deixa de existir no novo modelo. Quem opera com ela tem mudança grande de preço e de crédito.',
      executor: 'auster', trilha: 2, precisa: 'Relação das mercadorias que você revende' }),

  a('projetar_faturamento_e_sublimite',
    (r, d) => d.derivadas.proximoDoTeto,
    'Projetar seu faturamento até dezembro e checar o sublimite',
    { porque: 'Você está perto do teto do Simples. Antes de escolher como apurar, é preciso saber se vai continuar nele.',
      executor: 'auster', trilha: 1, precisa: 'Faturamento mês a mês' }),

  a('simular_saida_do_simples',
    (r, d) => d.saida.codigo === 'D',
    'Simular Lucro Presumido e Lucro Real, além do Simples',
    { porque: 'No seu caso a pergunta já não é como apurar dentro do Simples, e sim se continuar nele faz sentido.',
      executor: 'auster', trilha: 1, precisa: 'DRE e apuração do último ano' }),

  // REMOVIDA: 'reuniao_de_simulacao'. Disparava na saída E junto com
  // 'simular_as_duas_opcoes' e dizia a mesma coisa em outras palavras. O que ela
  // tinha de próprio — pedir uma hora do respondente — foi para a que ficou.

  a('refazer_estudo_de_regime',
    r => ['sim_antigo', 'nao', 'nao_sei'].includes(r.jaPlanejouMudancaRegime),
    'Fazer o estudo comparativo de regime tributário',
    { porque: 'A Reforma muda as premissas de qualquer comparação feita antes dela. Estudo de mais de dois anos foi construído sobre outro sistema.',
      executor: 'auster', trilha: 2, precisa: 'O estudo anterior, se existir' }),

  a('apurar_margem',
    r => r.margemLiquida === 'nao_sei',
    'Apurar sua margem dos últimos 12 meses',
    { porque: 'Sem saber a margem não há como dizer se cabe conceder desconto ao cliente. É o primeiro número de qualquer conta.',
      executor: 'auster', trilha: 1, precisa: 'Acesso à contabilidade, que já temos' }),

  a('levantar_aliquota_do_das',
    r => r.aliquotaEfetivaDas === 'nao_sei',
    'Levantar sua alíquota efetiva de DAS',
    { porque: 'É o número que permite comparar o Simples com qualquer outro regime.',
      executor: 'auster', trilha: 1, precisa: 'Nada da sua parte' }),

  a('olhar_estrutura_de_folha',
    r => ['de_45_60', 'acima_60'].includes(r.pesoFolha) && r.terceirizacaoPossivel && r.terceirizacaoPossivel !== 'ja_e_assim',
    'Avaliar a estrutura de contratação de pessoal',
    { porque: 'Folha não gera crédito. Com folha pesada, apurar por fora tende a custar mais — e há formas de organizar isso.',
      executor: 'auster', trilha: 2, precisa: 'Composição da folha e dos contratos de serviço' }),

  a('contar_o_investimento',
    r => ['de_200k_1mi', 'acima_1mi'].includes(r.investimentoPrevisto),
    'Incluir o investimento previsto na conta de crédito',
    { porque: 'Compra de máquina, equipamento ou imóvel gera crédito no novo modelo, e pode virar o resultado da comparação.',
      executor: 'auster', trilha: 1, precisa: 'Valores e prazo do investimento' }),

  a('olhar_o_grupo',
    r => ['sim_regular', 'sim_ambos'].includes(r.grupoEconomico),
    'Avaliar o efeito entre as empresas do grupo',
    { porque: 'Se uma empresa do grupo compra da outra, hoje ela aproveita crédito limitado. Apurando por fora, passa a aproveitar integral — o ganho fica dentro de casa.',
      executor: 'auster', trilha: 2, precisa: 'Quais operações existem entre as empresas' }),

  a('revisitar_na_proxima_janela',
    (r, d) => d.saida.codigo === 'A',
    'Revisitar isso antes da próxima janela de opção',
    { porque: 'A recomendação de hoje depende do perfil da sua carteira, e carteira muda.',
      executor: 'auster', trilha: 2, precisa: 'Nada agora' }),
];

/** Monta o plano, separado por quem executa e por trilha. */
export function planoDeAcao(respostas, diagnostico) {
  const itens = REGRAS_ACAO
    .filter(regra => { try { return regra.quando(respostas, diagnostico); } catch { return false; } })
    .map(({ quando, ...item }) => item);

  const doCliente = itens.filter(i => i.executor === 'cliente');
  return {
    clienteAgora: doCliente.filter(i => i.trilha === 1),
    clienteDepois: doCliente.filter(i => i.trilha === 2),
    auster: itens.filter(i => i.executor === 'auster'),
    total: itens.length,
  };
}
