/* Consulta cadastral por CNPJ nos dados abertos da Receita, via BrasilAPI.
 *
 * Três regras inegociáveis:
 *
 * 1. NUNCA bloqueia. Timeout, 403, CNPJ recém-aberto ou rede caída devolvem
 *    `{ ok: false }` e o formulário segue em digitação manual. O portal é
 *    preenchido ao vivo, em plateia — indisponibilidade de terceiro não pode
 *    travar ninguém.
 * 2. O QSA é buscado e NÃO é exibido. Serve só para marcar, por trás, se quem
 *    preencheu consta no quadro societário. Listar nomes de sócios na tela
 *    convidaria quem não é sócio a escolher um, e gravaria dado pessoal de
 *    quem não participou do preenchimento.
 * 3. A API exige header `User-Agent` — sem ele devolve 403.
 */

const ENDERECO = 'https://brasilapi.com.br/api/cnpj/v1/';
const TEMPO_LIMITE_MS = 4000;

/** CNAE vem da API como INTEIRO: 0600001 chega como 600001. Sem o zero à
 *  esquerda, classificar pelos dois primeiros dígitos joga extração de petróleo
 *  (divisão 06) em telecomunicações (divisão 60). */
export function normalizarCnae(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  return String(valor).replace(/\D/g, '').padStart(7, '0');
}

export function divisaoCnae(valor) {
  const c = normalizarCnae(valor);
  return c ? c.slice(0, 2) : null;
}

const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();

const PARTICULAS = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E']);

/**
 * O nome informado consta no quadro societário?
 * Compara por palavras significativas, tolerando ordem e partículas.
 * @returns true | false | null (null = sem QSA para comparar)
 */
export function nomeConstaNoQsa(nomeInformado, qsa) {
  if (!Array.isArray(qsa) || qsa.length === 0) return null;
  const palavras = semAcento(nomeInformado).split(' ').filter(p => p.length > 1 && !PARTICULAS.has(p));
  if (palavras.length < 2) return null;   // um nome só não identifica ninguém
  return qsa.some(socio => {
    const alvo = semAcento(socio && socio.nome_socio).split(' ').filter(Boolean);
    return palavras.every(p => alvo.includes(p));
  });
}

/**
 * Consulta o CNPJ. Nunca lança.
 * @returns {Promise<{ok:boolean, motivo?:string, dados?:object, qsa?:Array}>}
 */
export async function consultarCnpj(cnpjBruto) {
  const limpo = String(cnpjBruto || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (limpo.length !== 14) return { ok: false, motivo: 'cnpj incompleto' };

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    // O User-Agent é exigido pela BrasilAPI FORA do navegador (sem ele, 403).
    // Dentro do navegador é cabeçalho proibido: o navegador manda o dele e,
    // se a gente insistir, só se ganha um preflight a mais. Por isso, condicional.
    const noNavegador = typeof window !== 'undefined' && typeof document !== 'undefined';
    const cabecalhos = noNavegador
      ? { Accept: 'application/json' }
      : { 'User-Agent': 'Auster-Portal-Diagnostico/1.0', Accept: 'application/json' };
    const resposta = await fetch(ENDERECO + limpo, {
      signal: controle.signal,
      headers: cabecalhos,
    });
    if (!resposta.ok) return { ok: false, motivo: `HTTP ${resposta.status}` };
    const d = await resposta.json();
    return {
      ok: true,
      dados: {
        razaoSocial: d.razao_social || null,
        nomeFantasia: d.nome_fantasia || null,
        situacao: d.descricao_situacao_cadastral || null,
        ativa: String(d.descricao_situacao_cadastral || '').toUpperCase() === 'ATIVA',
        optanteSimples: d.opcao_pelo_simples === true,
        optanteMei: d.opcao_pelo_mei === true,
        inicioAtividade: d.data_inicio_atividade || null,
        cnaePrincipal: normalizarCnae(d.cnae_fiscal),
        cnaeDescricao: d.cnae_fiscal_descricao || null,
        cnaesSecundarios: (d.cnaes_secundarios || []).map(c => normalizarCnae(c.codigo)).filter(Boolean),
        uf: d.uf || null,
        municipio: d.municipio || null,
      },
      // Fica no objeto de retorno, mas quem consome NÃO deve renderizar.
      qsa: Array.isArray(d.qsa) ? d.qsa : [],
    };
  } catch (e) {
    // Aberto por duplo clique (file://), o navegador recusa a chamada a outro
    // domínio antes de sair da máquina — a API não tem culpa nem é alcançada.
    // Distinguir esse caso importa: é permanente enquanto o arquivo não for
    // publicado, ao contrário de uma indisponibilidade passageira.
    const arquivoLocal = typeof location !== 'undefined' && location.protocol === 'file:';
    return { ok: false,
             motivo: e && e.name === 'AbortError' ? 'tempo esgotado'
                   : arquivoLocal ? 'bloqueado por abrir o arquivo direto'
                   : 'indisponível',
             detalhe: (e && e.message) || null };
  } finally {
    clearTimeout(relogio);
  }
}

/** Início de atividade no ano-calendário → limite proporcional (LC 123, art. 3º,
 *  § 2º). O mês da abertura conta inteiro: início em novembro = 2 meses. */
export function mesesDeAtividadeNoAno(inicioAtividade, ano) {
  if (!inicioAtividade) return null;
  const d = new Date(inicioAtividade + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() > ano) return 0;
  if (d.getFullYear() < ano) return 12;
  return 12 - d.getMonth();
}
