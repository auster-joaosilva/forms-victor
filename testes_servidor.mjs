/* Testes do servidor e do backoffice — sobem o processo de verdade, num banco
 * temporário, e batem nas rotas por HTTP. Servidor não testado não é entregável.
 *
 * Uso:  node testes_servidor.mjs
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SENHA = 'senha-de-teste-nao-usar-em-producao';
const PORTA = 8731;
const BASE = `http://127.0.0.1:${PORTA}`;
const pasta = mkdtempSync(join(tmpdir(), 'portal-teste-'));

let passou = 0, falhou = 0;
const conferir = (nome, ok, detalhe) => {
  if (ok) { passou++; console.log('  ok   ' + nome); }
  else { falhou++; console.log('  FALHA ' + nome + (detalhe ? ' · ' + detalhe : '')); }
};

const cabecalhoSenha = (usuario = 'tester') =>
  'Basic ' + Buffer.from(`${usuario}:${SENHA}`).toString('base64');

const filho = spawn(process.execPath, ['servidor.mjs'], {
  env: { ...process.env, PORT: String(PORTA), AUSTER_SENHA_BACKOFFICE: SENHA,
         AUSTER_BANCO: join(pasta, 'teste.db'),
         AUSTER_ENDERECO_PUBLICO: 'https://exemplo.test', NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
filho.stderr.on('data', d => process.stderr.write('[servidor] ' + d));

async function esperarSubir() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/saude');
      if (r.ok) return true;
    } catch { }
    await new Promise(r => setTimeout(r, 120));
  }
  return false;
}

function pacoteDeTeste(extra = {}) {
  return {
    protocolo: 'DS-260915-TEST',
    enviadoEm: new Date().toISOString(),
    versaoFormulario: 'completo',
    diagnostico: {
      saida: 'C', posicao: 'Híbrido como proteção', certeza: 'aberta',
      urgencia: 'ALTA', confianca: 'MÉDIA', lacunas: ['margemLiquida'],
      gatilhos: ['cadeia_b2b'], pontosEmAberto: ['um ponto qualquer'],
    },
    respostas: {
      aceiteLgpd: 'sim', nomeEmpresa: 'Empresa de Teste',
      cnpj: '11.222.333/0001-81', solicitante: 'Fulano de Tal',
      email: 'fulano@exemplo.test', telefone: '(34) 99999-9999',
      versaoFormulario: 'completo',
    },
    solicitanteNoQsa: false,
    ...extra,
  };
}

const postar = (rota, corpo, cabecalhos = {}) => fetch(BASE + rota, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...cabecalhos },
  body: JSON.stringify(corpo),
});

try {
  console.log('\nTestes do servidor\n');
  if (!await esperarSubir()) throw new Error('o servidor não subiu');
  conferir('sobe e responde /saude', true);

  // ------------------------------------------------------------- formulário
  let r = await fetch(BASE + '/');
  const html = await r.text();
  conferir('GET / devolve o portal', r.ok && html.includes('Diagn'), 'status ' + r.status);
  conferir('o endpoint de envio é injetado',
    html.includes('"endpointEnvio":"/api/respostas"'));
  conferir('o e-mail de privacidade é injetado',
    html.includes('contato@austercontabil.com.br'));
  conferir('o marcador de publicação foi substituído',
    !html.includes('/*__PUBLICACAO__*/'));

  // --------------------------------------------------------------- recebe
  r = await postar('/api/respostas', pacoteDeTeste());
  const gravado = await r.json();
  conferir('POST grava a resposta', r.status === 201 && gravado.ok, 'status ' + r.status);

  r = await postar('/api/respostas', { respostas: { aceiteLgpd: '' } });
  conferir('recusa resposta sem aceite de privacidade', r.status === 422, 'status ' + r.status);

  r = await postar('/api/respostas', { nada: true });
  conferir('recusa pacote sem respostas', r.status === 400, 'status ' + r.status);

  r = await fetch(BASE + '/api/respostas', { method: 'POST', body: 'isso não é json' });
  conferir('recusa corpo que não é JSON', r.status === 400, 'status ' + r.status);

  // ----------------------------------------------------------- backoffice
  r = await fetch(BASE + '/backoffice');
  conferir('backoffice exige senha', r.status === 401, 'status ' + r.status);

  r = await fetch(BASE + '/backoffice', { headers: { Authorization: 'Basic ' + Buffer.from('x:errada').toString('base64') } });
  conferir('senha errada não entra', r.status === 401, 'status ' + r.status);

  r = await fetch(BASE + '/backoffice', { headers: { Authorization: cabecalhoSenha() } });
  const paginaBack = await r.text();
  conferir('senha certa entra', r.ok && paginaBack.includes('Confer'), 'status ' + r.status);
  conferir('o usuário autenticado é injetado', paginaBack.includes('"tester"'));

  r = await fetch(BASE + '/api/backoffice/respostas', { headers: { Authorization: cabecalhoSenha() } });
  const lista = await r.json();
  conferir('a resposta aparece na lista', lista.ok && lista.respostas.length === 1);
  conferir('a contagem soma', lista.contagem && lista.contagem.total === 1 && lista.contagem.nova === 1);
  conferir('o QSA divergente é registrado',
    lista.respostas[0].solicitante_no_qsa === 'nao');

  const id = lista.respostas[0].id;
  r = await fetch(`${BASE}/api/backoffice/resposta?id=${id}`, { headers: { Authorization: cabecalhoSenha() } });
  const detalhe = await r.json();
  conferir('a ficha traz o pacote inteiro',
    detalhe.ok && detalhe.resposta.pacote.respostas.nomeEmpresa === 'Empresa de Teste');

  r = await postar('/api/backoffice/tratar', { id, situacao: 'validada', nota: 'conferido no PGDAS' },
    { Authorization: cabecalhoSenha('maria') });
  conferir('tratar muda a situação', (await r.json()).ok);

  r = await fetch(BASE + '/api/backoffice/respostas?situacao=validada', { headers: { Authorization: cabecalhoSenha() } });
  const validadas = await r.json();
  conferir('o filtro por situação funciona', validadas.respostas.length === 1);
  conferir('o autor do tratamento fica gravado', validadas.respostas[0].tratado_por === 'maria');
  conferir('a nota interna fica gravada', validadas.respostas[0].nota_interna === 'conferido no PGDAS');

  r = await postar('/api/backoffice/tratar', { id, situacao: 'inventada' },
    { Authorization: cabecalhoSenha() });
  conferir('situação inválida é recusada', r.status === 400, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/respostas?busca=11.222', { headers: { Authorization: cabecalhoSenha() } });
  conferir('a busca por CNPJ encontra', (await r.json()).respostas.length === 1);

  // ------------------------------------------------------------- convites
  r = await postar('/api/backoffice/convites',
    { nomeEmpresa: 'Cliente Convidado', cnpj: '12.345.678/0001-95' },
    { Authorization: cabecalhoSenha('joao') });
  const criado = await r.json();
  const token = criado.convite && criado.convite.token;
  conferir('cria convite com token', r.status === 201 && !!token && token.length === 10);
  conferir('o endereço público volta para montar o link', criado.base === 'https://exemplo.test');

  r = await fetch(`${BASE}/?c=${token}`);
  const comConvite = await r.text();
  conferir('o link de convite pré-preenche a empresa',
    comConvite.includes('Cliente Convidado') && comConvite.includes('__CONVITE__'));

  r = await fetch(`${BASE}/?c=TOKENINEXIS`);
  const semConvite = await r.text();
  conferir('token inexistente não quebra a página',
    r.ok && !/window\.__CONVITE__\s*=/.test(semConvite));

  r = await postar(`/api/respostas?c=${token}`, pacoteDeTeste({ protocolo: 'DS-260915-CONV' }));
  conferir('resposta por convite é aceita', r.status === 201);

  r = await fetch(BASE + '/api/backoffice/convites', { headers: { Authorization: cabecalhoSenha() } });
  const convites = await r.json();
  const c = convites.convites.find(x => x.token === token);
  conferir('o convite contabiliza a abertura e a resposta',
    c && c.aberturas >= 1 && c.respostas === 1, c ? `aberturas=${c.aberturas} respostas=${c.respostas}` : 'não achou');

  r = await postar('/api/backoffice/convites/apagar', { token }, { Authorization: cabecalhoSenha() });
  conferir('convite com resposta não é apagado', r.status === 409, 'status ' + r.status);

  r = await postar('/api/backoffice/convites', { nomeEmpresa: 'Para apagar' },
    { Authorization: cabecalhoSenha() });
  const descartavel = (await r.json()).convite.token;
  r = await postar('/api/backoffice/convites/apagar', { token: descartavel }, { Authorization: cabecalhoSenha() });
  conferir('convite sem resposta é apagado', r.status === 200);

  r = await postar('/api/backoffice/convites', {}, { Authorization: cabecalhoSenha() });
  conferir('convite sem nome nem CNPJ ainda é criado pelo servidor', r.status === 201);

  // ------------------------------------------------------------ auditoria
  r = await fetch(BASE + '/api/backoffice/eventos', { headers: { Authorization: cabecalhoSenha() } });
  const eventos = (await r.json()).eventos;
  const tipos = new Set(eventos.map(e => e.o_que));
  conferir('auditoria registra recebimento, tratamento e convites',
    tipos.has('resposta_recebida') && tipos.has('resposta_tratada')
    && tipos.has('convite_criado') && tipos.has('convite_apagado'),
    [...tipos].join(','));
  conferir('a auditoria guarda quem tratou',
    eventos.some(e => e.o_que === 'resposta_tratada' && e.quem === 'maria'));

  // ---------------------------------------------------------------- borda
  r = await fetch(BASE + '/api/backoffice/respostas');
  conferir('a API do backoffice também exige senha', r.status === 401);

  r = await fetch(BASE + '/rota-que-nao-existe');
  conferir('rota desconhecida devolve 404', r.status === 404);

  r = await postar('/api/respostas', { respostas: { aceiteLgpd: 'sim' }, lixo: 'x'.repeat(300000) });
  conferir('corpo grande demais é recusado', r.status >= 400, 'status ' + r.status);

  // ------------------------------------------------------------- usuarios
  // Daqui para baixo a senha de ambiente vai PARAR de abrir o backoffice: e o
  // efeito de existir usuario ativo, e esta ordem faz parte do que se testa.
  const SENHA_MARIA = 'senha-da-maria-1234';
  const SENHA_JOAO = 'senha-do-joao-1234';
  const SENHA_JOAO_NOVA = 'outra-senha-do-joao-1234';
  const cabecalhoDe = (usuario, senha) =>
    'Basic ' + Buffer.from(`${usuario}:${senha}`).toString('base64');

  r = await fetch(BASE + '/api/backoffice/usuarios', { headers: { Authorization: cabecalhoSenha() } });
  const antes = await r.json();
  conferir('sem usuario, a senha de implantacao abre a tela de usuarios',
    r.ok && antes.usuarios.length === 0 && antes.implantacao === true, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios', { usuario: 'maria', nome: 'Maria', senha: 'curta' },
    { Authorization: cabecalhoSenha() });
  conferir('senha curta e recusada', r.status === 400, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios', { usuario: 'Maria Silva', senha: SENHA_MARIA },
    { Authorization: cabecalhoSenha() });
  conferir('usuario com espaco e maiuscula e recusado', r.status === 400, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios',
    { usuario: 'maria', nome: 'Maria', senha: SENHA_MARIA, papel: 'equipe' },
    { Authorization: cabecalhoSenha('implantacao') });
  const criada = await r.json();
  conferir('cria o primeiro usuario', r.status === 201 && criada.ok, 'status ' + r.status);
  conferir('o primeiro usuario nasce administrador, mesmo pedindo equipe',
    criada.papel === 'admin' && criada.primeiro === true, JSON.stringify(criada));

  r = await fetch(BASE + '/api/backoffice/usuarios', { headers: { Authorization: cabecalhoSenha() } });
  conferir('criado o primeiro usuario, a senha de ambiente para de abrir',
    r.status === 401, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/usuarios',
    { headers: { Authorization: cabecalhoDe('maria', SENHA_MARIA) } });
  const listada = await r.json();
  conferir('o usuario criado entra com a propria senha', r.ok, 'status ' + r.status);
  conferir('a lista nunca devolve resumo nem sal',
    !JSON.stringify(listada).match(/resumo|"sal"/), 'vazou campo de senha');

  r = await fetch(BASE + '/api/backoffice/usuarios',
    { headers: { Authorization: cabecalhoDe('maria', 'senha-errada-mas-longa') } });
  conferir('senha errada de usuario existente nao entra', r.status === 401, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios', { usuario: 'maria', senha: SENHA_MARIA },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  conferir('usuario repetido e recusado', r.status === 400, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios',
    { usuario: 'joao', nome: 'Joao', senha: SENHA_JOAO, papel: 'equipe' },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  conferir('administrador cria usuario de equipe', r.status === 201, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/usuarios',
    { headers: { Authorization: cabecalhoDe('joao', SENHA_JOAO) } });
  conferir('equipe nao ve a lista de usuarios', r.status === 403, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/respostas',
    { headers: { Authorization: cabecalhoDe('joao', SENHA_JOAO) } });
  conferir('equipe continua vendo as respostas', r.ok, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'joao', papel: 'admin' },
    { Authorization: cabecalhoDe('joao', SENHA_JOAO) });
  conferir('equipe nao se promove', r.status === 403, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'maria', senha: 'invasao-1234567' },
    { Authorization: cabecalhoDe('joao', SENHA_JOAO) });
  conferir('equipe nao troca a senha de outra pessoa', r.status === 403, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'joao', senha: SENHA_JOAO_NOVA },
    { Authorization: cabecalhoDe('joao', SENHA_JOAO) });
  conferir('equipe troca a propria senha', r.ok, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/respostas',
    { headers: { Authorization: cabecalhoDe('joao', SENHA_JOAO_NOVA) } });
  conferir('a senha nova passa a valer', r.ok, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/respostas',
    { headers: { Authorization: cabecalhoDe('joao', SENHA_JOAO) } });
  conferir('a senha antiga deixa de valer', r.status === 401, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'maria', ativo: false },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  const trava = await r.json();
  conferir('o unico administrador ativo nao se desativa',
    r.status === 400 && /[uú]nico administrador/.test(trava.motivo || ''), JSON.stringify(trava));

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'maria', papel: 'equipe' },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  conferir('o unico administrador tambem nao se rebaixa', r.status === 400, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'joao', ativo: false },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  conferir('administrador desativa usuario', r.ok, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/respostas',
    { headers: { Authorization: cabecalhoDe('joao', SENHA_JOAO_NOVA) } });
  conferir('usuario desativado nao entra', r.status === 401, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'joao', ativo: true, papel: 'admin' },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  conferir('administrador reativa e promove', r.ok, 'status ' + r.status);

  r = await postar('/api/backoffice/usuarios/alterar', { usuario: 'maria', papel: 'equipe' },
    { Authorization: cabecalhoDe('maria', SENHA_MARIA) });
  conferir('com dois administradores, a trava libera o rebaixamento', r.ok, 'status ' + r.status);

  r = await fetch(BASE + '/api/backoffice/eventos',
    { headers: { Authorization: cabecalhoDe('joao', SENHA_JOAO_NOVA) } });
  const trilha = (await r.json()).eventos;
  const tiposUsuario = new Set(trilha.map(e => e.o_que));
  conferir('auditoria registra criacao, alteracao e acesso negado',
    tiposUsuario.has('usuario_criado') && tiposUsuario.has('usuario_alterado')
    && tiposUsuario.has('acesso_negado'), [...tiposUsuario].join(','));
  conferir('a auditoria nunca guarda a senha',
    !JSON.stringify(trilha).includes(SENHA_MARIA)
    && !JSON.stringify(trilha).includes(SENHA_JOAO), 'senha apareceu na trilha');

} catch (e) {
  falhou++;
  console.log('  FALHA geral · ' + e.message);
} finally {
  filho.kill();
  try { rmSync(pasta, { recursive: true, force: true }); } catch { }
  console.log(`\n${passou} passaram · ${falhou} falharam\n`);
  process.exit(falhou ? 1 : 0);
}
