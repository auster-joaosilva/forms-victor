# Implantação — Portal de Decisão (Simples padrão x híbrido)

Para quem vai subir na VPS com Dokploy. Escrito para ser executado sem consultar
mais ninguém; onde houver decisão a tomar, está marcado.

---

## O que é

Uma aplicação Node que serve tudo na mesma porta:

| Rota | O que faz |
|---|---|
| `GET /` | o formulário público |
| `GET /?c=TOKEN` | o mesmo formulário, pré-preenchido pelo convite |
| `POST /api/respostas` | recebe o preenchimento |
| `GET /adesao` | termo de opção, aberto: a empresa digita o próprio CNPJ |
| `GET /adesao?c=TOKEN` | o mesmo termo, pré-preenchido pelo convite |
| `POST /api/adesao` | recebe a opção confirmada |
| `GET /entrar` | tela de entrada: usuário e senha na própria página |
| `GET /sair` | encerra a sessão |
| `GET /backoffice` | conferência interna; sem sessão, manda para `/entrar` |
| `GET /saude` | saúde para o orquestrador, e a **versão do esquema** do banco |

**Zero dependência de terceiro.** Não há `npm install`, `package-lock.json` nem
`node_modules`. O servidor usa só o que vem no Node: `node:http`, `node:sqlite`
e `node:crypto`. Isso exige **Node 22 ou superior** — abaixo disso `node:sqlite`
não existe e o processo não sobe.

---

## Variáveis de ambiente

Definir no painel do Dokploy. **Nenhuma delas vai para o repositório.**

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `AUSTER_SENHA_BACKOFFICE` | **sim** | **senha de implantação**: abre o backoffice só enquanto não existe usuário interno ativo, para criar o primeiro. Sem ela o processo se recusa a subir, com mensagem explícita — é proteção deliberada, não defeito |
| `AUSTER_ENDERECO_PUBLICO` | quase | URL pública, ex. `https://diagnostico.austercontabil.com.br`. Sem ela os links de convite saem sem domínio e não dá para copiar e enviar |
| `AUSTER_BANCO` | não | caminho do SQLite. O contêiner já aponta para `/app/dados/portal.db` |
| `PORT` | não | padrão 8080 |
| `NODE_ENV` | não | `production` liga o cache das páginas em memória |

### Como se entra

Pela tela `/entrar`, com **campo de usuário e campo de senha na própria página**.
A sessão vive num **cookie assinado** (HMAC-SHA256, `node:crypto`): `HttpOnly`,
`SameSite=Strict`, `Secure` quando a conexão é HTTPS de fato, 12 horas de
validade. Há botão **Sair** no cabeçalho.

A chave da assinatura deriva da senha de implantação, e não de bytes sorteados
na subida: **reiniciar o contêiner não desloga a equipe**. Trocar
`AUSTER_SENHA_BACKOFFICE` invalida todas as sessões — o que é o desejado.

Autenticação HTTP (`curl -u`) continua aceita, para script e teste. Pessoa
nenhuma precisa dela.

### Usuários internos

O backoffice tem **usuários próprios**, criados na aba **Usuários** por quem é
administrador. Cada pessoa entra com usuário e senha seus, e é esse nome que
fica gravado na auditoria de cada resposta validada — é o que faz a trilha
significar alguma coisa.

Dois papéis:

| Papel | Pode |
|---|---|
| `admin` | tudo, mais criar, alterar, promover e desativar usuários |
| `equipe` | conferir respostas, tratar situação, gerar convites, e trocar **a própria** senha |

**A senha nunca é guardada.** Guarda-se o resumo `scrypt` com sal por usuário —
scrypt vem do próprio Node e é lento de propósito, o que inviabiliza força bruta
contra um banco vazado. O resumo não sai do banco nem para a tela do
administrador.

**Como nasce o primeiro usuário.** Enquanto não existe usuário ativo, a senha de
`AUSTER_SENHA_BACKOFFICE` abre o backoffice como administrador e a tela já abre
na aba Usuários, com aviso. O primeiro usuário criado **nasce administrador**,
mesmo que se peça "equipe" — sem isso ninguém conseguiria criar o segundo.

**E aí a senha de ambiente para de abrir o backoffice.** É deliberado: com
usuário ativo, só vale credencial individual. A tela avisa e manda fechar a aba,
porque o navegador guarda a credencial antiga enquanto ela estiver aberta.

**Saída de emergência.** Se todos os usuários forem desativados, a senha de
ambiente volta a valer. Não é preciso mexer no banco para recuperar o acesso.

**Trava contra ficar sem administrador.** O sistema recusa desativar ou rebaixar
o único administrador ativo. Crie ou promova outro antes — a mensagem diz isso.

---

## Subir no Dokploy

1. **Criar a aplicação** apontando para este repositório, tipo **Docker Compose**
   (o `docker-compose.yml` está na raiz) ou **Dockerfile**.
2. **Definir as variáveis** acima no painel.
3. **Volume**: o compose já declara `dados:/app/dados`. Confirmar que o volume
   está criado — é onde vive o banco. Se o contêiner subir sem volume, os dados
   somem no próximo deploy.
4. **Domínio e TLS**: apontar o domínio no Dokploy e deixar o Traefik emitir o
   certificado. A aplicação fala HTTP puro na 8080 e não deve ser exposta direto.
5. **Healthcheck**: já configurado, bate em `/saude` a cada 30 segundos.

### Por que o `file://` importava

A consulta automática de CNPJ chama a BrasilAPI pelo navegador. Aberto como
arquivo local, o navegador recusa a chamada a outro domínio e o campo fica
vazio. **Servido por HTTP(S) a consulta funciona** — é o único motivo pelo qual
ela não funcionava antes de existir este servidor.

Provado em 15/09/2026, no Chrome, com o servidor local de pé: digitado o CNPJ e
saído do campo, o nome da empresa chegou preenchido. A consulta nunca esteve
quebrada; o que a impedia era a origem do arquivo aberto por duplo clique.

### Impressão: gerar o PDF pelo Chrome

As seis folhas do relatório foram conferidas página a página no Chrome: cada
folha abre em página nova e nenhum enquadramento é cortado ao meio — quando uma
ação não cabe inteira, a página termina antes. Paginação é coisa de motor de
navegador: **quem for entregar o PDF a cliente deve gerá-lo pelo Chrome**, que é
onde isso foi medido.

---

## O termo de opção (`/adesao`)

Página separada do formulário, com o texto integral do **Termo de ciência,
consentimento e autorização** e duas escolhas: **Opção 1 (Padrão)** ou
**Opção 2 (Híbrido)**. Na Opção 2 o representante **autoriza a Auster a
formalizar a opção no Portal do Simples Nacional**, e por isso a página é mais
exigente que o formulário.

**Duas portas, de propósito.** O link com `?c=TOKEN` chega pré-preenchido e
amarra a adesão ao cliente; o link sem nada aceita qualquer empresa, que digita
o CNPJ. O botão **Adesão**, na aba Convites, copia o link de cada cliente.

**O que fica guardado como prova**, tudo decidido pelo servidor e nunca pelo
navegador:

| Campo | Para que serve |
|---|---|
| `versao_termo` e `resumo_termo` | dizem **qual texto** foi aceito — o resumo é SHA-256 do termo |
| `aceito_em` | quando, em UTC |
| `origem` | endereço de origem (primeiro salto do `x-forwarded-for`) |
| `representante`, `cpf`, `cargo` | quem confirmou, e em que qualidade |

**Mudou o texto do termo, sobe a versão.** O texto vive em `src/termo.js` e é a
única fonte: a página exibe o que o servidor manda, e o servidor resume a
própria cópia. Editar o texto sem trocar a versão faria o resumo guardado deixar
de casar com o que se exibe — e a prova perderia o sentido. Adesão enviada com
versão diferente da atual é **recusada**, para ninguém aderir a um texto que não
viu.

**O sistema não protocola nada.** A opção continua sendo feita à mão no Portal
do Simples Nacional, empresa por empresa. A aba **Adesões** existe para isso:
o quadro *A protocolar* conta o híbrido confirmado e ainda não feito, e o botão
**Protocolei** registra quem fez e quando.

**Validação jurídica pendente.** O aceite em página vale entre as partes, e o
registro acima é o que o sustenta. Se essa prova basta para um documento que
autoriza ato irretratável no semestre é pergunta para o parceiro jurídico —
a Auster não é escritório de advocacia.

---

## Backup

O banco é **um arquivo**. Backup é copiar `/app/dados/portal.db` mais os
arquivos `-wal` e `-shm` se existirem, ou usar o comando do próprio SQLite com o
contêiner de pé:

```
docker exec <contêiner> node -e "const {DatabaseSync}=require('node:sqlite'); new DatabaseSync('/app/dados/portal.db').exec(\"VACUUM INTO '/app/dados/copia.db'\")"
```

`VACUUM INTO` gera cópia consistente sem parar a aplicação — copiar o arquivo
com o serviço escrevendo pode render banco corrompido.

**O arquivo tem dado pessoal de cliente.** Guardar como se guarda backup de
cliente: fora do repositório, com acesso restrito, dentro da política da casa.

---

## Depois de subir, conferir nesta ordem

1. `GET /saude` responde `{"ok":true}` — e confira que `esquema` e
   `esquemaEsperado` são **iguais**. Diferentes significam imagem antiga
   servindo banco novo, ou o contrário.
2. Abrir `/` e preencher o caminho curto até o fim. O cartão do protocolo
   aparece com o botão de enviar — se disser "suas respostas ficaram só neste
   navegador", o endpoint não foi injetado e o `portal.html` precisa ser
   regerado (`node construir.mjs`).
3. No bloco 1, digitar um CNPJ real e sair do campo: o nome da empresa deve
   chegar preenchido. **É o teste de que a publicação resolveu o `file://`.**
4. Enviar. Abrir `/backoffice` com a **senha de implantação** e, na aba
   **Usuários**, criar o primeiro usuário — ele nasce administrador. Fechar a
   aba e entrar de novo com ele: a senha de ambiente já não abre mais.
5. Criar um usuário de **equipe** para quem vai conferir respostas no dia a dia.
6. Abrir a ficha de uma resposta, mudar a situação para "Em análise" e conferir
   se o **seu usuário** aparece em "último tratamento".
7. Na aba **Convites**, gerar um link de teste e abri-lo: nome e CNPJ devem vir
   preenchidos, e a aba deve contar a abertura.
8. Na aba **Auditoria**, confirmar que os eventos acima estão registrados —
   inclusive `usuario_criado` e, se alguém errar a senha, `acesso_negado`.

---

## Rodar na máquina, antes de subir

```bash
node construir.mjs
AUSTER_SENHA_BACKOFFICE=teste AUSTER_ENDERECO_PUBLICO=http://localhost:8080 node servidor.mjs
```

Testes, todos sem dependência:

```bash
node testes.mjs            # 28 invariantes sobre 40.000 preenchimentos
node testes_servidor.mjs   # 128 verificações: servidor, backoffice, usuários, sessão e adesões
node varredura.mjs         # distribuição das saídas, sorteio uniforme
node varredura_pesos.mjs   # distribuição com pesos plausíveis (premissa, não dado)
```

`node construir.mjs` regenera o `portal.html` a partir de `modelo.html` e de
`src/`. **O `portal.html` não é versionado** — é artefato de build, e a imagem o
gera sozinha.

---

## O que ainda depende de decisão

1. **Endereço de privacidade.** O aviso do formulário aponta para
   `contato@austercontabil.com.br`. Está em `CONFIG` no `modelo.html` e também
   injetado pelo servidor, em `portalConfigurado()`. Trocar nos dois.
2. **Retenção.** O aviso declara **24 meses** de guarda. Não há expurgo
   automático: quando a data chegar, alguém precisa apagar. Vale programar.
3. **Divulgação aberta x convite.** O link sem `?c=` entra como "link aberto" e
   serve para redes sociais. O link com convite amarra a resposta ao cliente.
   Os dois funcionam ao mesmo tempo.
4. **Cadastro divergente do regime declarado.** O selo embaixo do CNPJ mostra o
   que a Receita diz ("optante" ou "não optante pelo Simples"), mas o formulário
   não cruza isso com a resposta de regime atual. Como o portal existe para quem
   **já é** optante, uma divergência aí significa diagnóstico montado sobre
   premissa falsa. Decidir se deve barrar ou apenas avisar.
5. **`noindex`.** A página sai com `noindex, nofollow`, porque o público previsto
   é a carteira e os convidados. Se virar porta de entrada aberta, trocar no
   `<head>` do `modelo.html`.

---

## Onde olhar quando algo der errado

| Sintoma | Causa provável |
|---|---|
| processo não sobe, erro sobre senha | `AUSTER_SENHA_BACKOFFICE` não definida |
| `portal.html não encontrado` | a imagem não rodou `node construir.mjs` |
| CNPJ não preenche o nome | página aberta como arquivo, ou BrasilAPI fora do ar — o aviso âmbar embaixo do campo diz qual |
| logo do cabeçalho com cor estranha na impressão | `ativos/logo-contabil-positiva.b64` não entrou no build; rodar `node construir.mjs` |
| build aborta dizendo "função exposta em window" | um botão deixou de chamar a função, ou a função sobrou; o build não deixa passar tela que não alcança o código |
| respostas somem entre deploys | volume `dados` não montado |
| links de convite sem domínio | `AUSTER_ENDERECO_PUBLICO` não definida |
| `/entrar` responde 500 | `entrar.html` não entrou na imagem; o Dockerfile copia lista explícita de arquivos, e a suíte tem teste para isso |
| backoffice pede senha em loop | não deve mais acontecer: sem sessão, a rota redireciona para `/entrar`. Se acontecer, é `curl` com `-u` errado |
| todos deslogados de repente | `AUSTER_SENHA_BACKOFFICE` foi trocada: ela é a chave das sessões |
| a senha de implantação deixou de abrir | é o comportamento: já existe usuário ativo. Entre com o usuário criado |
| ninguém consegue entrar | desative todos os usuários no banco (`UPDATE usuarios SET ativo = 0`) e a senha de implantação volta a valer |
| não dá para desativar um administrador | é a trava do único administrador ativo: promova outro antes |
