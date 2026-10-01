/* Texto do termo de opção — fonte única.
 *
 * Por que aqui, e não dentro da página: quem exibe o termo e quem guarda a
 * prova precisam ser o MESMO texto. A página recebe isto do servidor, e o
 * servidor calcula o resumo criptográfico da sua própria cópia. Assim o
 * resumo gravado prova o que a pessoa leu — e não o que o navegador dela
 * resolveu mandar.
 *
 * Transcrito de Termo_Consentimento_Simples_Nacional_CBS_2027_Auster_V3.pdf.
 * UMA adaptação, deliberada e sinalizada: onde o papel dizia "este termo deve
 * ser devolvido assinado", aqui se lê "esta confirmação deve ser concluída" —
 * o meio mudou, o prazo não.
 *
 * Regra igual à das migrações, com um marco claro: **a versão congela quando o
 * texto vai ao ar**. Enquanto uma versão só existe aqui e em revisão, pode
 * mudar à vontade — ninguém aceitou nada. Publicada, não se edita mais: mudou
 * o texto, sobe a versão, senão o resumo guardado deixa de casar com o que se
 * exibe e quem aceitou a versão anterior apareceria aderindo a outro documento.
 *
 * A V3 é o termo em papel, que já circulou. Por isso ela não voltou a mudar: o
 * que mudou virou V4 — e o que mudou de novo virou V5.
 *
 * POR QUE AS VERSÕES ANTIGAS FICAM AQUI, e não viram histórico de arquivo: o
 * backoffice reimprime adesão já registrada, e essa reimpressão tem de mostrar
 * o texto que a pessoa aceitou, não o texto de hoje. O banco guarda só a CHAVE
 * da versão (`versao_termo`) e o resumo; o texto correspondente tem de existir
 * em algum lugar, e o lugar é este. Apagar uma versão daqui é apagar a prova.
 */

/* V4 — 24/09/2026: acrescentado o quarto serviço complementar (assessoria e
   acompanhamento contínuo). A versão subiu porque o texto mudou: manter V3
   faria o resumo guardado deixar de casar com o que se exibe, e quem tivesse
   aceitado a V3 apareceria como tendo aceitado outro texto.

   CONGELADA. Publicada e em uso desde 24/09/2026. Nenhum caractere abaixo pode
   mudar: o resumo SHA-256 gravado em cada adesão da V4 é o resumo deste objeto
   exatamente como ele está. Uma vírgula a mais aqui invalida toda prova já
   registrada. */
const V4 = {
  versao: 'V4',
  titulo: 'Termo de ciência, consentimento e autorização',
  subtitulo: 'Modalidade de recolhimento da CBS no Simples Nacional — 1º semestre de 2027',

  orientacao: 'A empresa acima identificada, por meio de seu representante legal, '
    + 'declara que recebeu orientação da Auster Inteligência Contábil sobre as '
    + 'alternativas de recolhimento da CBS aplicáveis às empresas optantes pelo '
    + 'Simples Nacional, com base nas informações prestadas no diagnóstico orientado '
    + 'disponibilizado no portal reforma-tributaria.austercontabil.com.br e nas '
    + 'características conhecidas de sua atividade.',

  prazos: {
    titulo: 'Prazos aplicáveis ao 1º semestre de 2027',
    fonte: 'LC nº 214/2025; Resolução CGSN nº 186/2026, art. 2º',
    itens: [
      ['Opção pelo Simples Híbrido', 'de 01/09/2026 a 30/09/2026, no Portal do '
        + 'Simples Nacional, com efeitos a partir de 01/01/2027.'],
      ['Desistência (cancelamento da opção)', 'até 30/11/2026, em caráter '
        + 'irretratável — uma vez cancelada, a opção não pode ser refeita para o '
        + 'mesmo período.'],
      ['Reavaliação', 'nova janela de opção ou renúncia em março de 2027, com '
        + 'efeitos no 2º semestre de 2027.'],
    ],
  },

  criterios: [
    ['Simples Nacional Puro (Padrão).', 'Tende a ser a opção mais segura quando '
      + 'houver predominância de clientes pessoa física, consumidores finais ou '
      + 'empresas também optantes pelo Simples Nacional, bem como desconhecimento '
      + 'ou informalidade na cadeia de fornecedores. Nesses casos, os adquirentes '
      + 'em regra não aproveitam o crédito de CBS e, por isso, tendem a não aceitar '
      + 'pagar mais pelo crédito — o que afasta o principal benefício do Simples Híbrido.'],
    ['Simples Nacional Híbrido (Regular).', 'Merece avaliação quando o diagnóstico '
      + 'indicar clientes relevantes que aproveitam créditos (empresas do Lucro Real '
      + 'ou Presumido, ou também do Simples Híbrido) e fornecedores formais. Na maior '
      + 'parte dos casos, a avaliação envolve tratativas negociais com clientes e '
      + 'fornecedores sobre a tomada e o repasse de créditos de CBS. Por isso, '
      + 'recomenda-se iniciar essas tratativas de imediato, para que haja prazo hábil '
      + 'de levantamento de dados e informações e de simulação de cenários antes do '
      + 'prazo final de desistência (30/11/2026).'],
  ],

  servicos: {
    abertura: 'Para apoiar a decisão, a Auster oferece, mediante proposta específica '
      + 'e contratação à parte:',
    itens: [
      ['Diagnóstico personalizado', 'levantamento e apuração de informações de '
        + 'clientes, fornecedores, compras, despesas e margens;'],
      ['Simulação de cenários', 'comparação entre Simples Puro e Simples Híbrido, '
        + 'com efeito em preço, margem e carga tributária;'],
      ['Assessoria em negociações', 'apoio nas tratativas com clientes e fornecedores '
        + 'sobre tomada e repasse de créditos de CBS.'],
      // Acrescentado a pedido de Victor em 24/09/2026, e corrigido por ele: a
      // primeira redação prometia acompanhar "a apuração e as obrigações", que
      // já são escopo do contrato de contabilidade. Dizer isso em voz alta
      // evita o mal-entendido de estar cobrando de novo pelo que já se presta.
      ['Assessoria e acompanhamento contínuo', 'os serviços acima reunidos em plano '
        + 'personalizado, somando apoio para dúvidas do dia a dia e acompanhamento '
        + 'das rotinas da empresa. A apuração e as obrigações acessórias seguem no '
        + 'escopo do contrato de contabilidade.'],
    ],
    pergunta: 'A empresa tem interesse em receber proposta para esses serviços.',
  },

  modalidades: [
    { valor: 'padrao',
      titulo: 'Opção 1 — Simples Nacional Puro (Padrão)',
      texto: 'A empresa manterá a CBS recolhida dentro do DAS, na sistemática do '
        + 'Simples Nacional (como ocorre hoje com PIS/Cofins), e não autoriza a opção '
        + 'pelo Simples Híbrido para o 1º semestre de 2027.',
      partes: [] },
    { valor: 'hibrido',
      titulo: 'Opção 2 — Simples Nacional Híbrido (CBS fora do DAS)',
      texto: 'A empresa permanecerá no Simples Nacional para os demais tributos, com '
        + 'a CBS apurada e recolhida fora do DAS (Simples Híbrido).',
      partes: [
        ['Autorização', 'o representante legal autoriza expressamente a Auster '
          + 'Inteligência Contábil a formalizar essa opção no Portal do Simples '
          + 'Nacional até 30/09/2026. Para isso, esta confirmação deve ser concluída '
          + 'até 29/09/2026.'],
        ['Ciência', 'a empresa está ciente de que poderá desistir da opção até '
          + '30/11/2026, em caráter irretratável, e de que, sem desistência, a opção '
          + 'produzirá efeitos a partir de 01/01/2027.'],
      ] },
  ],

  semManifestacao: {
    enunciado: 'Se a empresa não se manifestar por escrito até 20/11/2026 sobre a '
      + 'manutenção da opção:',
    opcoes: [
      ['cancelar', 'autoriza a Auster a cancelar a opção, retornando ao Simples Puro;'],
      ['manter', 'a opção pelo Simples Híbrido será mantida.'],
    ],
  },

  ciencia: [
    'A recomendação da Auster foi elaborada com base nas informações fornecidas pela '
      + 'empresa no diagnóstico e na legislação e regulamentação vigentes na data da análise.',
    'Alterações relevantes no faturamento, no perfil de clientes, nas compras, despesas '
      + 'ou operações, assim como mudanças na legislação ou na regulamentação, podem '
      + 'alterar a recomendação apresentada.',
    'A opção pelo Simples Híbrido implica apuração e recolhimento da CBS fora do DAS, '
      + 'com obrigações próprias, e pode exigir ajustes em preços, contratos e na '
      + 'emissão de documentos fiscais.',
    'A decisão final sobre a modalidade adotada pertence à empresa, por meio de seu '
      + 'representante legal.',
  ],

  declaracao: 'O representante legal declara que as informações fornecidas no '
    + 'diagnóstico refletem a realidade da empresa no momento da análise e confirma a '
    + 'modalidade assinalada neste termo.',

  rodape: 'Auster Inteligência Contábil · CRC MG-007231/O-8 · Uberlândia-MG · austercontabil.com.br',
};

/* V5 — 01/10/2026: a Resolução CGSN nº 194/2026, assinada em 25/09 e publicada
   em edição extra do DOU de 28/09, prorrogou os prazos da Resolução CGSN nº
   186/2026. Mudaram TRÊS coisas no termo:

   1. A opção pelo regime regular de IBS e CBS passou de 30/09 para 30/10/2026.
   2. A desistência deixou de ser "até 30/11" e virou JANELA COM COMEÇO: de
      03/11 a 20/12/2026. Antes de 03/11 o serviço não existe — quem optar em
      outubro e se arrepender não tem como cancelar até lá. Isso não é detalhe
      de redação: a V4 dizia "poderá desistir até 30/11", o que hoje leria como
      promessa de uma saída disponível o tempo todo.
   3. A citação da fonte passa a nomear as duas resoluções, porque é a 194 que
      dá as datas e a 186 que dá o resto do regime.

   A versão sobe por regra: a V4 está publicada e há adesões registradas contra
   o resumo dela. */
const V5 = {
  versao: 'V5',
  titulo: 'Termo de ciência, consentimento e autorização',
  subtitulo: 'Modalidade de recolhimento da CBS no Simples Nacional — 1º semestre de 2027',

  orientacao: 'A empresa acima identificada, por meio de seu representante legal, '
    + 'declara que recebeu orientação da Auster Inteligência Contábil sobre as '
    + 'alternativas de recolhimento da CBS aplicáveis às empresas optantes pelo '
    + 'Simples Nacional, com base nas informações prestadas no diagnóstico orientado '
    + 'disponibilizado no portal reforma-tributaria.austercontabil.com.br e nas '
    + 'características conhecidas de sua atividade.',

  prazos: {
    titulo: 'Prazos aplicáveis ao 1º semestre de 2027',
    fonte: 'LC nº 214/2025; Resolução CGSN nº 186/2026, art. 2º, com a redação '
      + 'da Resolução CGSN nº 194/2026',
    itens: [
      ['Opção pelo Simples Híbrido', 'de 01/09/2026 a 30/10/2026, no Portal do '
        + 'Simples Nacional, com efeitos a partir de 01/01/2027.'],
      ['Desistência (cancelamento da opção)', 'de 03/11/2026 a 20/12/2026, em '
        + 'caráter irretratável — uma vez cancelada, a opção não pode ser refeita '
        + 'para o mesmo período. Antes de 03/11/2026 o cancelamento não está '
        + 'disponível.'],
      ['Reavaliação', 'nova janela de opção ou renúncia em março de 2027, com '
        + 'efeitos no 2º semestre de 2027.'],
    ],
  },

  criterios: [
    ['Simples Nacional Puro (Padrão).', 'Tende a ser a opção mais segura quando '
      + 'houver predominância de clientes pessoa física, consumidores finais ou '
      + 'empresas também optantes pelo Simples Nacional, bem como desconhecimento '
      + 'ou informalidade na cadeia de fornecedores. Nesses casos, os adquirentes '
      + 'em regra não aproveitam o crédito de CBS e, por isso, tendem a não aceitar '
      + 'pagar mais pelo crédito — o que afasta o principal benefício do Simples Híbrido.'],
    ['Simples Nacional Híbrido (Regular).', 'Merece avaliação quando o diagnóstico '
      + 'indicar clientes relevantes que aproveitam créditos (empresas do Lucro Real '
      + 'ou Presumido, ou também do Simples Híbrido) e fornecedores formais. Na maior '
      + 'parte dos casos, a avaliação envolve tratativas negociais com clientes e '
      + 'fornecedores sobre a tomada e o repasse de créditos de CBS. Por isso, '
      + 'recomenda-se iniciar essas tratativas de imediato, para que haja prazo hábil '
      + 'de levantamento de dados e informações e de simulação de cenários antes do '
      + 'prazo final de desistência (20/12/2026).'],
  ],

  servicos: {
    abertura: 'Para apoiar a decisão, a Auster oferece, mediante proposta específica '
      + 'e contratação à parte:',
    itens: [
      ['Diagnóstico personalizado', 'levantamento e apuração de informações de '
        + 'clientes, fornecedores, compras, despesas e margens;'],
      ['Simulação de cenários', 'comparação entre Simples Puro e Simples Híbrido, '
        + 'com efeito em preço, margem e carga tributária;'],
      ['Assessoria em negociações', 'apoio nas tratativas com clientes e fornecedores '
        + 'sobre tomada e repasse de créditos de CBS.'],
      ['Assessoria e acompanhamento contínuo', 'os serviços acima reunidos em plano '
        + 'personalizado, somando apoio para dúvidas do dia a dia e acompanhamento '
        + 'das rotinas da empresa. A apuração e as obrigações acessórias seguem no '
        + 'escopo do contrato de contabilidade.'],
    ],
    pergunta: 'A empresa tem interesse em receber proposta para esses serviços.',
  },

  modalidades: [
    { valor: 'padrao',
      titulo: 'Opção 1 — Simples Nacional Puro (Padrão)',
      texto: 'A empresa manterá a CBS recolhida dentro do DAS, na sistemática do '
        + 'Simples Nacional (como ocorre hoje com PIS/Cofins), e não autoriza a opção '
        + 'pelo Simples Híbrido para o 1º semestre de 2027.',
      partes: [] },
    { valor: 'hibrido',
      titulo: 'Opção 2 — Simples Nacional Híbrido (CBS fora do DAS)',
      texto: 'A empresa permanecerá no Simples Nacional para os demais tributos, com '
        + 'a CBS apurada e recolhida fora do DAS (Simples Híbrido).',
      partes: [
        ['Autorização', 'o representante legal autoriza expressamente a Auster '
          + 'Inteligência Contábil a formalizar essa opção no Portal do Simples '
          + 'Nacional até 30/10/2026. Para isso, esta confirmação deve ser concluída '
          + 'até 29/10/2026.'],
        ['Ciência', 'a empresa está ciente de que poderá desistir da opção entre '
          + '03/11/2026 e 20/12/2026, em caráter irretratável, de que fora desse '
          + 'período o cancelamento não está disponível, e de que, sem desistência, '
          + 'a opção produzirá efeitos a partir de 01/01/2027.'],
      ] },
  ],

  /* [CONFIRMAR COM VICTOR] A data de corte da manifestação é compromisso
     OPERACIONAL da casa, não prazo legal — a V4 pedia 20/11, dez dias antes do
     cancelamento de 30/11. Mantida a mesma folga de dez dias sobre o novo fim
     (20/12), a data equivalente é 10/12/2026. Não é dedução de norma: é quanto
     tempo a Auster quer para cancelar em lote sem correr. */
  semManifestacao: {
    enunciado: 'Se a empresa não se manifestar por escrito até 10/12/2026 sobre a '
      + 'manutenção da opção:',
    opcoes: [
      ['cancelar', 'autoriza a Auster a cancelar a opção, retornando ao Simples Puro;'],
      ['manter', 'a opção pelo Simples Híbrido será mantida.'],
    ],
  },

  ciencia: [
    'A recomendação da Auster foi elaborada com base nas informações fornecidas pela '
      + 'empresa no diagnóstico e na legislação e regulamentação vigentes na data da análise.',
    'Alterações relevantes no faturamento, no perfil de clientes, nas compras, despesas '
      + 'ou operações, assim como mudanças na legislação ou na regulamentação, podem '
      + 'alterar a recomendação apresentada.',
    'A opção pelo Simples Híbrido implica apuração e recolhimento da CBS fora do DAS, '
      + 'com obrigações próprias, e pode exigir ajustes em preços, contratos e na '
      + 'emissão de documentos fiscais.',
    'A decisão final sobre a modalidade adotada pertence à empresa, por meio de seu '
      + 'representante legal.',
  ],

  declaracao: 'O representante legal declara que as informações fornecidas no '
    + 'diagnóstico refletem a realidade da empresa no momento da análise e confirma a '
    + 'modalidade assinalada neste termo.',

  rodape: 'Auster Inteligência Contábil · CRC MG-007231/O-8 · Uberlândia-MG · austercontabil.com.br',
};

/** Todas as versões já publicadas, pela chave gravada em `adesoes.versao_termo`.
 *  A reimpressão do backoffice entra por aqui; a adesão nova entra por `TERMO`. */
export const TERMOS = { V4, V5 };

/** A versão corrente — a única que o portal oferece para aceitar. */
export const TERMO = V5;
