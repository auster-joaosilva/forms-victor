/* Esquema declarativo do formulário — Portal de Decisão (padrão x híbrido).
 *
 * Fonte: MANUAL-DECISAO.md v1.0, seções 5 e 6.
 * Toda pergunta declara: onde aparece, o que alimenta, o que fazer com lacuna,
 * e — quando alimenta o radar — a NOTA EXPLÍCITA de cada opção.
 *
 * A nota nunca é derivada da ordem de exibição. Ver README, divergência D3.
 */

// Pontos médios das faixas da matriz de receita (seção 7.1 do manual).
export const FAIXAS_PERCENTUAIS = [
  { valor: 'zero', rotulo: '0%', pm: 0 },
  { valor: 'ate_20', rotulo: 'até 20%', pm: 10 },
  { valor: 'de_20_40', rotulo: '20–40%', pm: 30 },
  { valor: 'de_40_60', rotulo: '40–60%', pm: 50 },
  { valor: 'de_60_80', rotulo: '60–80%', pm: 70 },
  { valor: 'acima_80', rotulo: 'acima de 80%', pm: 90 },
  // "Não sei" NÃO tem ponto médio de propósito. Se tivesse 0, quem desconhece
  // a própria carteira cairia em SAÍDA A ("continue como está") sem ninguém ter
  // afirmado nada. Sem ponto médio, a lacuna interrompe a árvore e vira ação.
  { valor: 'nao_sei', rotulo: 'não sei', pm: null },
];

/** Ponto médio de uma faixa, ou null quando a faixa não tem ponto médio
 *  ("não sei"). Nunca devolve 0 para lacuna. */
export function pontoMedioFaixa(valor) {
  const f = FAIXAS_PERCENTUAIS.find(x => x.valor === valor);
  return f && typeof f.pm === 'number' ? f.pm : null;
}

export const TIPOS_CLIENTE = [
  { chave: 'pessoa_fisica', rotulo: 'Pessoa física / consumidor final' },
  { chave: 'simples_mei', rotulo: 'MEI ou empresa do Simples' },
  { chave: 'regime_regular', rotulo: 'Empresa do Lucro Presumido ou Real' },
  { chave: 'orgao_publico', rotulo: 'Órgão público' },
  { chave: 'exterior', rotulo: 'Exterior' },
];

export const BLOCOS = [
  { numero: 1, titulo: 'Identificação',
    aviso: 'Este diagnóstico é para quem já é optante do Simples Nacional. A escolha entre recolher IBS e CBS na guia única ou por fora só existe nesse caso.',
    glossario: [
      ['Simples Original', 'o que você tem hoje, e que vale até o fim de 2026'],
      ['Simples Padrão', 'a partir de 2027, com IBS e CBS continuando dentro do DAS'],
      ['Simples Híbrido', 'a partir de 2027, com IBS e CBS saindo da guia e apurados pelo regime regular — é o que as palestras chamaram de tirar o imposto da guia'],
    ] },
  { numero: 2, titulo: 'Enquadramento atual' },
  { numero: 3, titulo: 'Perfil da receita' },
  { numero: 4, titulo: 'Estrutura de custos' },
  { numero: 5, titulo: 'Margem, preço e preparo' },
];

import { VALIDADORES } from './validacao.js';
import { daParaEstimarDas, estimarAliquotaDas } from './simples.js';

const o = (valor, rotulo, nota, descricao) => ({ valor, rotulo, nota, descricao });

export const PERGUNTAS = [  { chave: 'versaoFormulario', bloco: 1,
    enunciado: 'Como você prefere responder?',
    dica: 'Dá para começar pelo caminho curto e voltar depois — as respostas ficam salvas.',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['modalidade'],
    essencial: true,
    opcoes: [
      o('sintetico', 'Caminho curto — cerca de 4 minutos', null,
        'O essencial para saber se vale entrar na fila da simulação. Entrega uma leitura inicial e um plano de ação enxuto.'),
      o('completo', 'Completo — cerca de 10 minutos', null,
        'Todas as perguntas. Entrega o radar de maturidade, o plano de ação detalhado e abre oportunidade preliminar de planejamento tributário.')] },
  { chave: 'cnpj', essencial: true, bloco: 1, enunciado: 'CNPJ',
    dica: 'Aceita o formato alfanumerico das inscricoes novas.',
    tipo: 'cnpj', origem: 'base', obrigatoria: 'sempre', alimenta: ['cadastro'],
    validador: VALIDADORES.cnpj },
  { chave: 'nomeEmpresa', essencial: true, bloco: 1, enunciado: 'Nome da empresa',
    dica: 'Se o CNPJ foi encontrado, este campo já vem preenchido com a razão social — pode ajustar para o nome que você usa.',
    tipo: 'texto', origem: 'base', obrigatoria: 'sempre', alimenta: ['cadastro'],
    validador: VALIDADORES.nomeEmpresa },
  { chave: 'regimeAtual', essencial: true, bloco: 1, enunciado: 'Regime tributário atual',
    lacuna: 'o regime tributário atual da empresa',
    dica: 'Se o CNPJ foi consultado, esta resposta já vem do cadastro da Receita. Confira antes de seguir.',
    tipo: 'unica', origem: 'base', obrigatoria: 'sempre', alimenta: ['elegibilidade'],
    naoSei: 'nao_sei',
    opcoes: [o('simples', 'Simples Nacional'), o('presumido', 'Lucro Presumido'),
             o('real', 'Lucro Real'), o('nao_sei', 'Não sei')] },
  { chave: 'ehSimei', essencial: true, bloco: 1, enunciado: 'A empresa é MEI (SIMEI)?',
    tipo: 'unica', origem: 'base', obrigatoria: 'sempre', alimenta: ['elegibilidade'],
    opcoes: [o('sim', 'Sim'), o('nao', 'Não')] },
  { chave: 'solicitante', essencial: true, bloco: 1, enunciado: 'Quem está respondendo',
    tipo: 'texto', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['cadastro'],
    validador: VALIDADORES.nomePessoa },
  { chave: 'email', essencial: true, bloco: 1, enunciado: 'E-mail',
    tipo: 'email', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['cadastro'],
    validador: VALIDADORES.email },
  { chave: 'telefone', essencial: true, bloco: 1, enunciado: 'Telefone',
    tipo: 'telefone', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['cadastro'],
    validador: VALIDADORES.telefone },
  { chave: 'jaClienteAuster', essencial: true, bloco: 1, enunciado: 'Já é cliente Auster?',
    tipo: 'unica', origem: 'base', obrigatoria: 'sempre', alimenta: ['cadastro'],
    opcoes: [o('sim', 'Sim'), o('nao', 'Não')] },
  // REVISADO 15/09/2026. A lista anterior quebrava serviço em quatro
  // (regulamentado, tecnologia, saúde, demais) e o motor colapsava os quatro em
  // `startsWith('servico')`: a quebra não decidia NADA. Em troca, faltavam as
  // duas quebras que decidem de fato — a presunção do Lucro Presumido difere
  // entre transporte de carga (8%) e de passageiros (16%), e serviço hospitalar
  // volta ao caput (8%) em vez dos 32% dos serviços em geral.
  // Profissão regulamentada saiu daqui: quem a captura com precisão jurídica é
  // `setorDiferenciado` (art. 127 da LC 214), e para o Presumido ela é serviço
  // em geral como qualquer outro.
  { chave: 'segmento', essencial: true, bloco: 1, enunciado: 'Segmento de atuação',
    dica: 'Define a presunção do Lucro Presumido, que é o parâmetro das duas comparações: contra o Simples e, quando a sua margem fica abaixo dela, também contra o Lucro Real.',
    tipo: 'select', origem: 'base', obrigatoria: 'sempre', alimenta: ['modalidade', 'acao'],
    opcoes: [
      o('comercio', 'Comércio'), o('industria', 'Indústria'),
      o('agronegocio', 'Agronegócio'),
      o('construcao_civil', 'Construção civil'),
      o('transporte_carga', 'Transporte de cargas'),
      o('transporte_passageiros', 'Transporte de passageiros'),
      o('servico_saude', 'Serviço — saúde'),
      o('servico_demais', 'Serviço — demais'),
      o('outro', 'Outro')] },
  // A presunção reduzida de serviço hospitalar depende de duas condições DE
  // FATO, não de CNAE (triagem_aliquotas.toml, [presuncao.servicos_hospitalares]).
  // Sem as duas, a presunção é a de serviços em geral.
  { chave: 'servicoHospitalar', bloco: 1,
    enunciado: 'A empresa é sociedade empresária e atende às normas da Anvisa para o serviço que presta?',
    dica: 'As duas condições juntas levam parte dos serviços de saúde à presunção reduzida do Lucro Presumido. Sem elas, vale a presunção de serviços em geral.',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'condicional', alimenta: ['modalidade'],
    cond: r => r.segmento === 'servico_saude', naoSei: 'nao_sei',
    opcoes: [o('sim', 'Sim, as duas'), o('nao', 'Não, ou só uma delas'),
             o('nao_sei', 'Não sei')] },

  { chave: 'expectativa', bloco: 1,
    enunciado: 'O que você espera descobrir aqui? (opcional)',
    dica: 'Ajuda a equipe a preparar a conversa. Pode deixar em branco.',
    tipo: 'textarea', origem: 'cliente', obrigatoria: 'nunca', alimenta: ['cadastro'],
    essencial: true },

  // ---------------------------------------------------------------- bloco 1

  // ---------------------------------------------------------------- bloco 2
  { chave: 'anexoSimples', essencial: true, bloco: 2, enunciado: 'Por qual anexo a empresa é tributada?',
    lacuna: 'o anexo do Simples em que a empresa é tributada',
    tipo: 'unica', origem: 'base', obrigatoria: 'condicional', alimenta: ['modalidade'],
    cond: r => r.regimeAtual === 'simples', naoSei: 'nao_sei',
    // [CONFERIR] descrições resumidas contra a LC 123, art. 18, §§ 5º-B a 5º-I,
    // antes de publicar. Servem para o respondente se reconhecer, não como lista
    // exaustiva de atividades.
    opcoes: [
      o('i', 'Anexo I', null, 'Comércio — revenda de mercadorias.'),
      o('ii', 'Anexo II', null, 'Indústria — venda de produtos industrializados pela própria empresa.'),
      o('iii', 'Anexo III', null, 'Serviços em geral: instalação, reparo, manutenção, academias, contabilidade, agências de viagem, laboratórios. Também recebe os serviços do Anexo V quando a folha pesa 28% ou mais do faturamento.'),
      o('iv', 'Anexo IV', null, 'Construção civil e obras, limpeza, conservação, vigilância e serviços advocatícios. Neste anexo a contribuição previdenciária patronal fica FORA do DAS e é recolhida à parte.'),
      o('v', 'Anexo V', null, 'Serviços de maior intensidade intelectual: auditoria, tecnologia, publicidade, engenharia, consultoria — quando a folha pesa menos de 28% do faturamento.'),
      o('multiplos', 'Mais de um anexo', null, 'A empresa tem atividades em anexos diferentes.'),
      o('nao_sei', 'Não sei', null, 'Sem problema: as próximas perguntas ajudam a identificar.')] },

  // --- apoio para quem respondeu "Não sei" no anexo ---
  { chave: 'atividadePrincipal', bloco: 2,
    enunciado: 'Qual é a atividade principal da empresa?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'condicional', alimenta: ['modalidade'],
    cond: r => r.anexoSimples === 'nao_sei',
    opcoes: [o('comercio', 'Revenda de mercadorias (comércio)'),
             o('industria', 'Fabricação ou industrialização própria'),
             o('servico', 'Prestação de serviços')] },
  { chave: 'servicoAnexoIV', bloco: 2,
    enunciado: 'A atividade é construção civil, obras, limpeza, conservação, vigilância ou advocacia?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'condicional', alimenta: ['modalidade'],
    cond: r => r.anexoSimples === 'nao_sei' && r.atividadePrincipal === 'servico',
    opcoes: [o('sim', 'Sim'), o('nao', 'Não')] },
  { chave: 'folhaSobreFaturamento', bloco: 2,
    enunciado: 'A folha dos últimos 12 meses — salários, pró-labore, FGTS e INSS — representa 28% ou mais do faturamento?',
    dica: 'É o chamado fator R. Ele decide entre o Anexo III e o Anexo V.',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'condicional', alimenta: ['modalidade'],
    cond: r => r.anexoSimples === 'nao_sei' && r.atividadePrincipal === 'servico'
               && r.servicoAnexoIV === 'nao',
    naoSei: 'nao_sei',
    opcoes: [o('sim', 'Sim, 28% ou mais'), o('nao', 'Não, menos de 28%'),
             o('nao_sei', 'Não sei')] },
  { chave: 'faixaRbt12', essencial: true, bloco: 2, enunciado: 'Faturamento dos últimos 12 meses',
    tipo: 'unica', origem: 'base', obrigatoria: 'sempre', alimenta: ['modalidade'],
    ordem: true,
    // As seis primeiras espelham as faixas dos Anexos da LC 123 — é nelas que a
    // alíquota efetiva muda, e a alíquota efetiva é o que define quanto crédito
    // a empresa cede hoje ao cliente do regime regular (LC 214, art. 47, §9º, II).
    // [CONFERIR] limites das faixas contra os Anexos antes de publicar.
    opcoes: [o('ate_180k', 'Até R$ 180 mil'),
             o('de_180_360k', 'R$ 180 mil a R$ 360 mil'),
             o('de_360_720k', 'R$ 360 mil a R$ 720 mil'),
             o('de_720k_1_8mi', 'R$ 720 mil a R$ 1,8 mi'),
             o('de_1_8_3_6mi', 'R$ 1,8 mi a R$ 3,6 mi'),
             o('de_3_6_4_32mi', 'R$ 3,6 mi a R$ 4,32 mi'),
             o('de_4_32_4_8mi', 'R$ 4,32 mi a R$ 4,8 mi'),
             o('acima_4_8mi', 'Acima de R$ 4,8 mi')] },
  { chave: 'aliquotaEfetivaDas', essencial: true, bloco: 2,
    enunciado: 'Qual é a alíquota efetiva atual do DAS?',
    lacuna: 'a alíquota efetiva do DAS',
    // REVISTO 15/09/2026. A pergunta só aparecia quando NÃO havia tabela conferida
    // para estimar: ficava invisível nos Anexos III e V e aparecia em I, II e IV.
    // Duas consequências ruins — a assimetria parecia arbitrária para quem
    // preenche, e o respondente nunca via a alíquota que o motor usava por ele.
    // Agora pergunta-se sempre; havendo tabela, a dica mostra o intervalo e
    // "Não sei" é resposta legítima, sem penalizar a confiança.
    dica: r => {
      const e = estimarAliquotaDas(r.anexoSimples, r.faixaRbt12);
      const base = 'Sai na apuração do PGDAS-D, na linha da alíquota efetiva. ';
      if (!e) return base + 'Se não tiver em mãos agora, marque "Não sei" — levantamos para você.';
      const um = v => v.toFixed(2).replace('.', ',');
      return base + `Pela tabela do seu anexo, na sua faixa de faturamento, ela fica entre ` +
        `${um(e.min)}% e ${um(e.max)}%. ` +
        (e.issIcmsForaDoDas
          ? 'Nessa faixa o ISS e o ICMS saem do DAS e passam a ser recolhidos por fora: a alíquota do DAS cai, o custo total não. '
          : '') +
        'Se não souber a sua, marque "Não sei" — usamos essa estimativa.';
    },
    tipo: 'unica', origem: 'base', obrigatoria: 'sempre', alimenta: ['modalidade', 'acao'],
    // "Não sei" aqui não é lacuna quando existe tabela conferida: há número, só
    // não veio do respondente. A origem do número aparece no relatório.
    lacunaSuprida: r => daParaEstimarDas(r),
    naoSei: 'nao_sei', ordem: true,
    opcoes: [o('ate_6', 'Até 6%'), o('de_6_9', '6% a 9%'), o('de_9_12', '9% a 12%'),
             o('de_12_15', '12% a 15%'), o('de_15_19', '15% a 19%'),
             o('acima_19', 'Acima de 19%'), o('nao_sei', 'Não sei')] },
  { chave: 'jaPlanejouMudancaRegime', bloco: 2,
    enunciado: 'Já foi feito algum estudo de mudança de regime tributário?',
    dica: 'Diferente de ter avaliado a Reforma: aqui é a comparação entre Simples, Presumido e Real.',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['acao'],
    naoSei: 'nao_sei',
    opcoes: [o('sim_recente', 'Sim, nos últimos 2 anos'),
             o('sim_antigo', 'Sim, mas há mais de 2 anos'),
             o('nao', 'Nunca foi feito'), o('nao_sei', 'Não sei')] },
  { chave: 'tendenciaCrescimento', bloco: 2, enunciado: 'Como está a trajetória de faturamento?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['modalidade'],
    opcoes: [o('queda', 'Em queda'), o('estavel', 'Estável'),
             o('cresce_ate_20', 'Crescendo até 20% ao ano'),
             o('cresce_acima_20', 'Crescendo acima de 20% ao ano')] },
  { chave: 'ultrapassouSublimite', bloco: 2,
    enunciado: 'Já ultrapassou o sublimite estadual de ICMS/ISS?',
    lacuna: 'se o sublimite estadual já foi ultrapassado',
    tipo: 'unica', origem: 'base', obrigatoria: 'condicional',
    alimenta: ['modalidade', 'radar'], eixos: [6], naoSei: 'nao_sei',
    cond: r => ['de_3_6_4_32mi', 'de_4_32_4_8mi', 'acima_4_8mi'].includes(r.faixaRbt12),
    opcoes: [o('nao', 'Não', 100), o('sim_corrente', 'Sim, no ano corrente', 25),
             o('sim_anteriores', 'Sim, em anos anteriores', 50),
             o('nao_sei', 'Não sei', 0)] },
  { chave: 'setorDiferenciado', bloco: 2,
    enunciado: 'A atividade está em algum destes setores, que a Reforma trata de forma diferenciada?',
    lacuna: 'se a atividade está em setor com tratamento próprio',
    dica: 'Alguns setores têm redução de alíquota ou regime específico no IBS e na CBS — 30% para as profissões regulamentadas do art. 127 e 60% para saúde, educação, alimentos e outros do art. 128 da LC 214/2025. Quando há redução, a conta do regime regular muda de patamar.',
    tipo: 'unica', origem: 'base', obrigatoria: 'sempre',
    alimenta: ['modalidade', 'acao'], naoSei: 'nao_sei',
    // CONFERIDO 15/09/2026 no texto do Planalto: art. 127 (redução de 30%, lista
    // fechada de 18 profissões) e art. 128 (redução de 60%: educação, saúde,
    // dispositivos médicos, medicamentos, alimentos, agropecuários in natura,
    // cultura, desporto e outros). O motor NÃO aplica percentual — a resposta só
    // sinaliza que existe tratamento próprio e vira ponto em aberto.
    // CORREÇÃO: "medicina" estava listada como profissão regulamentada do art.
    // 127. Não está lá. Médico é serviço de saúde (art. 128, II, redução de
    // 60%); quem consta do art. 127, XIII, é médico VETERINÁRIO.
    opcoes: [
      o('nenhum', 'Nenhum desses'),
      o('saude', 'Saúde — serviços médicos, odontológicos, laboratoriais, dispositivos médicos, medicamentos', null,
        'Redução de 60% na alíquota. É aqui que entra a medicina, não na lista das profissões regulamentadas.'),
      o('educacao', 'Educação'),
      o('alimentos', 'Alimentos, cesta básica e produtos agropecuários in natura'),
      o('transporte_coletivo', 'Transporte coletivo de passageiros'),
      o('profissao_regulamentada', 'Profissão intelectual regulamentada — advocacia, contabilidade, engenharia, arquitetura, veterinária e outras', null,
        'Redução de 30%, em lista fechada de 18 profissões: administradores, advogados, arquitetos e urbanistas, assistentes sociais, bibliotecários, biólogos, contabilistas, economistas, economistas domésticos, educação física, engenheiros e agrônomos, estatísticos, médicos veterinários e zootecnistas, museólogos, químicos, relações públicas, técnicos industriais e técnicos agrícolas. Medicina não está na lista. Para sociedade, a redução exige sócios habilitados, nenhum sócio pessoa jurídica e serviços prestados pelos próprios sócios.'),
      o('imobiliario', 'Operações com bens imóveis'),
      // CORRIGIDO 15/09/2026. "Hotelaria, restaurantes, parques e turismo" era uma
      // opção só, e são TRÊS seções distintas do Capítulo VII da LC 214. A separação
      // importa porque em duas delas a lei VEDA o crédito a quem compra — o que
      // derruba o argumento central deste diagnóstico.
      o('bares_restaurantes', 'Bares, restaurantes e lanchonetes', null,
        'Regime próprio, com alíquota reduzida em 40%. Quem compra alimentação e bebida de você NÃO pode aproveitar crédito — a lei veda (art. 276).'),
      o('hotelaria_parques', 'Hotelaria, parques de diversão e parques temáticos', null,
        'Regime próprio, com alíquota reduzida em 40%. Você aproveita crédito nas suas compras, mas quem compra de você NÃO pode aproveitar crédito (arts. 282 e 283).'),
      o('agencias_turismo', 'Agências de turismo', null,
        'Também tem regime próprio no Capítulo VII da LC 214.'),
      o('nao_sei', 'Não sei')] },
  // A pendência não impede a opção em si, mas impede o DEFERIMENTO de quem está
  // entrando, e é causa de exclusão de quem já está (LC 123, art. 17, V). O prazo
  // de 30 dias e a recomendação de confirmar mesmo com pendência estão no
  // "Roteiro da Opção pelo Simples Nacional para o ano de 2027" (CGSN), item 2.2.
  { chave: 'debitosTributarios', essencial: true, bloco: 2,
    enunciado: 'A empresa tem débito tributário em aberto, em qualquer esfera?',
    dica: 'Federal, estadual ou municipal, inclusive parcelado. Débito em aberto pode barrar o ingresso no Simples e é causa de exclusão de quem já está — e o prazo para regularizar é curto depois da opção.',
    tipo: 'unica', origem: 'base', obrigatoria: 'sempre', alimenta: ['acao'],
    naoSei: 'nao_sei', lacuna: 'se há débito tributário em aberto',
    opcoes: [o('nao', 'Não, está tudo em dia'),
             o('sim_parcelado', 'Sim, mas está parcelado e em dia'),
             o('sim_aberto', 'Sim, há débito sem parcelamento'),
             o('nao_sei', 'Não sei')] },

  // O regime específico de bares e restaurantes NÃO alcança toda a receita do
  // ramo. O art. 273, § 2º da LC 214 exclui: I — alimentação para pessoa jurídica
  // sob contrato (NBS 1.0301.31/32/39 ou CNAE 5620-1/01); II — produtos e bebidas
  // não alcoólicas adquiridos de terceiros sem preparo no estabelecimento;
  // III — bebidas alcoólicas, ainda que preparadas ali.
  // Sem esta pergunta, uma empresa de refeições coletivas para empresa caía no gate de
  // "crédito vedado ao adquirente" — e a operação dela está FORA do regime.
  { chave: 'composicaoAlimentacao', essencial: true, bloco: 2,
    enunciado: 'Como se divide o que você vende?',
    dica: 'O regime próprio de bares e restaurantes vale para a alimentação preparada e servida no seu estabelecimento. Refeição para empresa sob contrato, revenda de produto de terceiro sem preparo e bebida alcoólica ficam FORA dele e seguem a regra geral — inclusive quanto ao crédito do cliente.',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'condicional',
    alimenta: ['modalidade', 'acao'],
    cond: r => r.setorDiferenciado === 'bares_restaurantes',
    naoSei: 'nao_sei', lacuna: 'como se divide a sua receita de alimentação',
    opcoes: [
      o('quase_tudo_no_balcao', 'Quase tudo é alimentação preparada e servida aqui', null,
        'Consumo no local, balcão, delivery do que você mesmo prepara.'),
      o('parte_fora_do_regime', 'Tenho uma parte relevante fora disso', null,
        'Refeição para empresa sob contrato, revenda de produto de terceiro sem preparo, ou bebida alcoólica.'),
      o('maior_parte_fora', 'A maior parte é refeição para empresa sob contrato', null,
        'Refeições coletivas, cantina terceirizada, fornecimento para indústria ou escritório.'),
      o('nao_sei', 'Não sei')] },

  { chave: 'grupoEconomico', bloco: 2,
    enunciado: 'Existem outras empresas dos mesmos sócios?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['acao'],
    opcoes: [o('nao', 'Não'), o('sim_simples', 'Sim, no Simples'),
             o('sim_regular', 'Sim, em regime regular'), o('sim_ambos', 'Sim, em ambos')] },
  { chave: 'operacoesIntragrupo', bloco: 2,
    enunciado: 'Há compra ou venda entre essas empresas?',
    dica: 'Se a empresa do regime regular compra desta, hoje ela aproveita crédito limitado. É uma das situações em que o híbrido muda a conta.',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'condicional', alimenta: ['modalidade', 'acao'],
    cond: r => ['sim_regular', 'sim_ambos'].includes(r.grupoEconomico),
    opcoes: [o('nao', 'Não, são operações independentes'),
             o('sim_vende', 'Sim, esta empresa vende para as outras'),
             o('sim_compra', 'Sim, esta empresa compra das outras'),
             o('sim_ambos', 'Sim, nos dois sentidos')] },

  // ---------------------------------------------------------------- bloco 3
  { chave: 'receitaPorCliente', essencial: true, bloco: 3,
    enunciado: 'Quanto do seu faturamento vai para cada tipo de cliente?',
    lacuna: 'quanto do faturamento vai para',
    dica: 'Se não souber a divisão de algum tipo de cliente, marque "não sei" naquela linha — vale mais que um palpite.',
    tipo: 'matriz', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['modalidade'],
    naoSei: 'nao_sei',
    linhas: TIPOS_CLIENTE, colunas: FAIXAS_PERCENTUAIS },
  { chave: 'pressaoCredito', essencial: true, bloco: 3,
    enunciado: 'Seus clientes já perguntaram sobre crédito de CBS/IBS ou pediram desconto por isso?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['modalidade', 'acao'],
    opcoes: [o('nao', 'Não'), o('alguns_perguntaram', 'Alguns perguntaram'),
             o('pedido_formal', 'Já houve pedido formal de desconto'),
             o('perdemos_negocio', 'Já perdemos negócio por causa disso')] },
  { chave: 'descontoPedido', bloco: 3, enunciado: 'De quanto foi o desconto pedido?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'condicional', alimenta: ['acao'],
    cond: r => ['pedido_formal', 'perdemos_negocio'].includes(r.pressaoCredito),
    naoSei: 'nao_quantificado',
    opcoes: [o('ate_5', 'Até 5%'), o('de_5_10', '5% a 10%'),
             o('de_10_20', '10% a 20%'), o('acima_20', 'Acima de 20%'),
             o('nao_quantificado', 'Não foi quantificado')] },
  { chave: 'concentracaoClientes', bloco: 3,
    enunciado: 'Quanto os cinco maiores clientes representam do faturamento?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['acao', 'radar'],
    eixos: [4],
    opcoes: [o('ate_20', 'Até 20%', 100), o('de_20_40', '20% a 40%', 75),
             o('de_40_60', '40% a 60%', 45), o('acima_60', 'Acima de 60%', 15)] },
  { chave: 'conheceRegimeClientes', bloco: 3,
    enunciado: 'Você sabe o regime tributário dos seus principais clientes?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'condicional', alimenta: ['radar', 'acao'],
    // Some quando a receita é toda de pessoa física: consumidor final não tem
    // regime tributário, e perguntar seria atrito sem resposta possível.
    cond: r => temClientePessoaJuridica(r),
    eixos: [1], naoSei: 'nenhum',
    opcoes: [o('todos', 'Sim, de todos', 100), o('maioria', 'Da maioria', 70),
             o('alguns', 'De apenas alguns', 35), o('nenhum', 'Não sei de nenhum', 0)] },

  // ---------------------------------------------------------------- bloco 4
  { chave: 'pesoFolha', essencial: true, bloco: 4, enunciado: 'Quanto a folha representa do custo total?',
    dica: 'Inclui salários, pró-labore e encargos. Se a empresa não tem ninguém na folha, marque a última opção — as perguntas sobre mão de obra deixam de aparecer.',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['modalidade', 'acao'],
    opcoes: [o('ate_15', 'Até 15%'), o('de_15_30', '15% a 30%'),
             o('de_30_45', '30% a 45%'), o('de_45_60', '45% a 60%'),
             o('acima_60', 'Acima de 60%'),
             o('nenhuma', 'Não tenho folha nem prestadores na operação')] },
  { chave: 'aquisicoesRegimeRegular', essencial: true, bloco: 4,
    enunciado: 'Quanto das suas compras vem de fornecedores do Lucro Presumido ou Real?',
    lacuna: 'quanto das compras vem de fornecedor do regime regular',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['modalidade'],
    naoSei: 'nao_sei',
    opcoes: [o('ate_20', 'Até 20%'), o('de_20_40', '20% a 40%'),
             o('de_40_60', '40% a 60%'), o('de_60_80', '60% a 80%'),
             o('acima_80', 'Acima de 80%'), o('nao_sei', 'Não sei')] },
  { chave: 'conheceRegimeFornecedores', bloco: 4,
    enunciado: 'Você sabe o regime tributário dos seus principais fornecedores?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['radar', 'acao'],
    eixos: [1, 3], naoSei: 'nenhum',
    opcoes: [o('todos', 'Sim, de todos', 100), o('maioria', 'Da maioria', 70),
             o('alguns', 'De apenas alguns', 35), o('nenhum', 'Não sei de nenhum', 0)] },
  { chave: 'terceirizacaoPossivel', bloco: 4,
    enunciado: 'Parte da mão de obra poderia ser contratada de pessoa jurídica?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'condicional', alimenta: ['acao'],
    cond: r => ['de_45_60', 'acima_60'].includes(r.pesoFolha),
    opcoes: [o('nao', 'Não'), o('em_parte', 'Em parte'),
             o('boa_parte', 'Sim, boa parte'), o('ja_e_assim', 'Já é assim hoje')] },
  { chave: 'investimentoPrevisto', essencial: true, bloco: 4,
    enunciado: 'Há investimento relevante em máquinas, equipamentos ou imóveis nos próximos 24 meses?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['modalidade', 'acao'],
    opcoes: [o('nao', 'Não'), o('ate_200k', 'Sim, até R$ 200 mil'),
             o('de_200k_1mi', 'Sim, de R$ 200 mil a R$ 1 mi'),
             o('acima_1mi', 'Sim, acima de R$ 1 mi')] },
  { chave: 'pesoMercadorias', bloco: 4,
    enunciado: 'Quanto mercadorias e insumos representam do custo total?',
    dica: 'É o espelho da folha: mercadoria e insumo geram crédito no regime regular, folha não.',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'condicional', alimenta: ['modalidade'],
    cond: r => ehOperacaoComProduto(r),
    opcoes: [o('ate_20', 'Até 20%'), o('de_20_40', '20% a 40%'),
             o('de_40_60', '40% a 60%'), o('de_60_80', '60% a 80%'),
             o('acima_80', 'Acima de 80%')] },
  { chave: 'mercadoriasComST', bloco: 4,
    enunciado: 'Parte das mercadorias está hoje sujeita a substituição tributária de ICMS?',
    lacuna: 'se há mercadoria com substituição tributária',
    dica: 'A substituição tributária não existe no modelo IBS/CBS. Quem opera muito com ST tem mudança relevante na dinâmica de crédito e de preço.',
    tipo: 'unica', origem: 'base', obrigatoria: 'condicional', alimenta: ['modalidade', 'acao'],
    cond: r => ehOperacaoComProduto(r), naoSei: 'nao_sei',
    opcoes: [o('nao', 'Não, nenhuma'), o('parte', 'Sim, parte delas'),
             o('maioria', 'Sim, a maioria'), o('nao_sei', 'Não sei')] },
  { chave: 'prestadoresPJ', bloco: 4,
    enunciado: 'Parte dos prestadores que atuam na operação é pessoa jurídica?',
    lacuna: 'se há prestadores pessoa jurídica na operação',
    dica: 'Pagamento a pessoa jurídica gera crédito de IBS e CBS; folha de pagamento não. Por isso a composição muda a conta.',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'condicional', alimenta: ['modalidade', 'acao'],
    cond: r => !ehOperacaoSemMaoDeObra(r), naoSei: 'nao_sei',
    opcoes: [o('nao', 'Não, só empregados e sócios'),
             o('alguns', 'Sim, alguns prestadores'),
             o('boa_parte', 'Sim, boa parte da operação'),
             o('nao_sei', 'Não sei')] },
  { chave: 'pagaRPA', bloco: 4,
    enunciado: 'A empresa remunera autônomos por RPA?',
    dica: 'A inclusão do RPA no fator R é questão em aberto e depende de posição jurídica — a triagem apenas registra.',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'condicional', alimenta: ['acao'],
    cond: r => ehOperacaoDeServico(r) && !ehOperacaoSemMaoDeObra(r), naoSei: 'nao_sei',
    opcoes: [o('nao', 'Não'), o('pouco', 'Sim, valor pequeno'),
             o('relevante', 'Sim, valor relevante'), o('nao_sei', 'Não sei')] },
  { chave: 'aquisicoesUsoPessoal', bloco: 4,
    enunciado: 'Há compras em nome da empresa destinadas ao uso pessoal de sócios, administradores, empregados ou familiares?',
    lacuna: 'se há compras de uso pessoal em nome da empresa',
    dica: 'O art. 57 da LC 214/2025 alcança o que é fornecido sem cobrança — ou abaixo do preço de mercado — ao próprio titular, a sócios e administradores, a empregados e a parentes até o terceiro grau. Também entram sempre bebida alcoólica, joias, obras de arte, tabaco, armas e itens recreativos, esportivos e estéticos. Nada disso gera crédito (art. 57, § 5º).',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre',
    alimenta: ['modalidade', 'acao'], naoSei: 'nao_sei',
    opcoes: [o('nao', 'Não, as compras são todas da operação'),
             o('pouco', 'Sim, uma parcela pequena'),
             o('relevante', 'Sim, uma parcela relevante'),
             o('nao_sei', 'Não sei')] },
  { chave: 'despesasDeViagem', bloco: 4,
    enunciado: 'A empresa tem despesa relevante com alimentação e hospedagem de equipe em viagem?',
    dica: 'Ponto ainda aberto na lei: as exceções do art. 57 cobrem alimentação "disponibilizada no estabelecimento do contribuinte durante a jornada de trabalho" — e não há alínea para hospedagem. Se a viagem entra como insumo da atividade ou como consumo pessoal depende do regulamento (art. 57, § 3º, V). Interessa saber o tamanho antes de contar com o crédito.',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre',
    alimenta: ['acao'], naoSei: 'nao_sei',
    opcoes: [o('nao', 'Não, é irrelevante ou não existe'),
             o('pouco', 'Sim, valor pequeno'),
             o('relevante', 'Sim, valor relevante'),
             o('nao_sei', 'Não sei')] },
  { chave: 'documentacaoDespesas', bloco: 4,
    enunciado: 'Suas aquisições e despesas têm documento fiscal em nome da empresa?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['radar', 'acao'],
    eixos: [3],
    opcoes: [o('todas', 'Sim, todas', 100), o('maior_parte', 'A maior parte', 70),
             o('apenas_parte', 'Apenas parte', 35), o('poucas', 'Poucas', 0)] },

  // ---------------------------------------------------------------- bloco 5
  // REESCRITA 15/09/2026. O enunciado anterior era "margem de lucro antes do
  // IRPJ e da CSLL" — vocabulário de quem apura Presumido ou Real. Optante do
  // Simples não vê essas duas linhas: elas vivem dentro do DAS. A pergunta agora
  // é a que o dono da empresa sabe responder.
  // [CONFERIR] Consequência técnica assumida: a resposta vem DEPOIS do DAS, e a
  // presunção do Lucro Presumido é antes do IRPJ/CSLL. Comparar as duas subestima
  // a margem em relação à presunção. Como a saída é sempre "vale analisar" e o
  // corte é de triagem, aceitei a imprecisão em troca de a pergunta ser
  // respondível. Refazer quando a calibragem tiver dado real.
  { chave: 'margemLiquida', essencial: true, bloco: 5,
    enunciado: 'De cada R$ 100 que entram, quanto sobra de lucro no fim do mês?',
    lacuna: 'a margem de lucro da operação',
    dica: 'Depois de pagar tudo — mercadoria, folha, pró-labore, aluguel, DAS e demais despesas — e antes de os sócios retirarem lucro. Aproximado serve.',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre',
    alimenta: ['modalidade', 'radar'], eixos: [2], naoSei: 'nao_sei', ordem: true,
    opcoes: [o('prejuizo', 'Prejuízo', 100), o('ate_5', 'Até 5%', 100),
             o('de_5_10', '5% a 10%', 100), o('de_10_20', '10% a 20%', 100),
             o('de_20_30', '20% a 30%', 100), o('acima_30', 'Acima de 30%', 100),
             o('nao_sei', 'Não sei', 0)] },
  { chave: 'formacaoPreco', bloco: 5, enunciado: 'Como o preço é definido?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre',
    alimenta: ['modalidade', 'radar'], eixos: [2, 4],
    opcoes: [o('custo_mais_margem', 'Por custo mais margem', 100),
             o('preco_mercado', 'Por preço de mercado', 60),
             o('tabela_cliente', 'Por tabela do cliente ou do setor', 30),
             o('negociacao_caso_a_caso', 'Por negociação caso a caso', 40)] },
  { chave: 'contratosLongos', bloco: 5, enunciado: 'Há contratos com preço travado por prazo longo?',
    lacuna: 'se há contrato com preço travado',
    dica: 'Interessa saber se o preço pode ser reajustado quando a carga tributária mudar.',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre',
    alimenta: ['modalidade', 'acao', 'radar'], eixos: [4], naoSei: 'nao_sei',
    // "Não trabalho com contrato" é posição melhor do que "tenho contratos curtos":
    // não há preço travado a renegociar. Fica abaixo de quem tem cláusula de
    // revisão, porque ali a proteção foi contratada de propósito.
    opcoes: [o('sem_contratos', 'Não trabalho com contrato — cada venda é fechada na hora', 90),
             o('sem_contratos_longos', 'Tenho contratos, mas nenhum de prazo longo', 75),
             o('com_clausula', 'Sim, com cláusula de revisão tributária', 100),
             o('sem_clausula', 'Sim, sem cláusula de revisão', 20),
             o('nao_sei', 'Não sei', 0)] },
  { chave: 'margemPorLinha', bloco: 5,
    enunciado: 'Você conhece a margem por produto, serviço ou linha de negócio?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['radar', 'acao'],
    eixos: [2, 5],
    opcoes: [o('com_detalhe', 'Sim, com detalhe', 100),
             o('aproximada', 'De forma aproximada', 65),
             o('so_global', 'Só a margem global', 35),
             o('nao_conheco', 'Não conheço', 0)] },

  // ------------------------------------------- bloco 5 (preparo, fundido)
  { chave: 'sistemaGestao', bloco: 5, enunciado: 'Qual sistema a empresa usa?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['radar', 'acao'],
    eixos: [5],
    opcoes: [o('erp', 'ERP integrado', 100), o('gestao_simples', 'Sistema de gestão simples', 65),
             o('planilhas', 'Planilhas', 30), o('manual', 'Controle manual', 0)] },
  { chave: 'jaSimulou', bloco: 5, enunciado: 'Já foi feita alguma simulação do impacto da Reforma?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['radar'],
    eixos: [6], naoSei: 'nao_sei',
    opcoes: [o('detalhada', 'Sim, detalhada', 100), o('superficial', 'Sim, superficial', 60),
             o('nao', 'Não', 20), o('nao_sei', 'Não sei', 0)] },
  // REMOVIDA: 'certificadoDigital'. Não decide nada no diagnóstico e o acesso ao
  // portal se resolve por procuração eletrônica do escritório. Virou verificação
  // interna da Auster no momento de protocolar — ver acoes.js. A pergunta gerava
  // ação em 72,8% dos planos na varredura, sem mudar recomendação nenhuma.
  { chave: 'responsavelDecisao', bloco: 5, enunciado: 'Quem decide sobre mudança de regime?',
    tipo: 'unica', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['radar', 'acao'],
    eixos: [6],
    opcoes: [o('eu_mesmo', 'Eu mesmo', 100), o('socios_conjunto', 'Sócios em conjunto', 75),
             o('conselho_matriz', 'Conselho ou matriz', 45),
             o('contador_externo', 'Contador externo', 60)] },
  // REMOVIDA: 'cienteDoPrazo'. Media se a comunicação funcionou, não o cenário
  // da empresa. Não alimentava decisão nem ação — só o radar. A resposta já se
  // sabe pelo canal que trouxe o respondente.,
  // LGPD, arts. 7º, 9º e 18: o formulário coleta CNPJ, nome, e-mail e telefone.
  // Coletar sem dizer para quê, por quanto tempo e com que base é defeito legal,
  // não de produto. O aviso fica ONDE o dado é pedido — bloco 1 — e o aceite é
  // obrigatório para avançar.
  { chave: 'aceiteLgpd', essencial: true, bloco: 1,
    enunciado: 'Uso das suas informações',
    tipo: 'consentimento', origem: 'cliente', obrigatoria: 'sempre', alimenta: ['cadastro'],
    rotuloAceite: 'Concordo com o uso das minhas informações para este diagnóstico e para o contato da Auster sobre ele.' },

  { chave: 'percepcaoFinal', bloco: 5,
    enunciado: 'Depois de responder, o que mudou na sua percepção? (opcional)',
    dica: 'O que você não tinha pensado antes, ou o que ficou mais claro. Pode deixar em branco.',
    tipo: 'textarea', origem: 'cliente', obrigatoria: 'nunca', alimenta: ['cadastro'],
    essencial: true },
];

export const EIXOS_RADAR = [
  { numero: 1, titulo: 'Conhecimento da cadeia' },
  { numero: 2, titulo: 'Informação de custo e margem' },
  { numero: 3, titulo: 'Documentação fiscal' },
  { numero: 4, titulo: 'Precificação e contratos' },
  { numero: 5, titulo: 'Sistemas e informação' },
  { numero: 6, titulo: 'Preparo para a janela' },
];

/** A operação envolve mercadoria? Usado para ramificar o bloco de custos:
 *  serviço não vê estoque e ST; comércio e indústria não veem fator R. */
export function ehOperacaoComProduto(r) {
  return ['comercio', 'industria', 'agronegocio'].includes(r.segmento)
      || ['i', 'ii'].includes(r.anexoSimples)
      || ['comercio', 'industria'].includes(r.atividadePrincipal);
}

/** A empresa não tem mão de obra na operação? Dispensa o bloco de folha. */
export function ehOperacaoSemMaoDeObra(r) {
  return !!(r && r.pesoFolha === 'nenhuma');
}

/** A operação é de serviço? */
export function ehOperacaoDeServico(r) {
  return String(r.segmento || '').startsWith('servico')
      || ['construcao_civil', 'transporte_carga', 'transporte_passageiros'].includes(r.segmento)
      || ['iii', 'iv', 'v'].includes(r.anexoSimples)
      || r.atividadePrincipal === 'servico';
}

/** Há receita destinada a pessoa jurídica (Simples, regime regular ou público)? */
export function temClientePessoaJuridica(r) {
  const m = (r && r.receitaPorCliente) || {};
  const linhas = ['simples_mei', 'regime_regular', 'orgao_publico'];
  // Lacuna não afirma ausência: se o respondente não sabe o peso de um tipo de
  // cliente pessoa jurídica, a pergunta sobre o regime dos clientes fica de pé.
  if (linhas.some(k => m[k] === 'nao_sei')) return true;
  return linhas.reduce((t, k) => t + (pontoMedioFaixa(m[k]) || 0), 0) > 0;
}

/** Linhas da matriz respondidas com "não sei". Base do cálculo de confiança. */
export function linhasMatrizSemResposta(pergunta, respostas) {
  const m = (respostas && respostas[pergunta.chave]) || {};
  return (pergunta.linhas || [])
    .filter(l => m[l.chave] === pergunta.naoSei)
    .map(l => l.chave);
}

/** Perguntas visíveis para um conjunto de respostas.
 *  No caminho curto só aparecem as marcadas `essencial` — as que o motor precisa
 *  para chegar a uma saída. As demais ficam para quem escolheu o completo. */
export function perguntasVisiveis(r) {
  const curto = r && r.versaoFormulario === 'sintetico';
  return PERGUNTAS.filter(p => (!curto || p.essencial) && (!p.cond || p.cond(r)));
}

/** O respondente escolheu o caminho curto? */
export function ehCaminhoCurto(r) {
  return !!(r && r.versaoFormulario === 'sintetico');
}

/** Campos que alimentam a decisão — base do cálculo de confiança. */
export const CAMPOS_DO_MOTOR = PERGUNTAS
  .filter(p => p.alimenta.includes('modalidade') || p.alimenta.includes('elegibilidade'))
  .map(p => p.chave);
