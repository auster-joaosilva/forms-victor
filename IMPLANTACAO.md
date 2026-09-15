# Implantação — Portal de Decisão (Simples padrão x híbrido)

Para quem vai subir na VPS com Dokploy. Escrito para ser executado sem consultar
mais ninguém; onde houver decisão a tomar, está marcado.

---

## O que é

Uma aplicação Node que serve três coisas na mesma porta:

| Rota | O que faz |
|---|---|
| `GET /` | o formulário público |
| `GET /?c=TOKEN` | o mesmo formulário, pré-preenchido pelo convite |
| `POST /api/respostas` | recebe o preenchimento |
| `GET /backoffice` | conferência interna, protegida por senha |
| `GET /saude` | verificação de saúde para o orquestrador |

**Zero dependência de terceiro.** Não há `npm install`, `package-lock.json` nem
`node_modules`. O servidor usa só o que vem no Node: `node:http`, `node:sqlite`
e `node:crypto`. Isso exige **Node 22 ou superior** — abaixo disso `node:sqlite`
não existe e o processo não sobe.

---

## Variáveis de ambiente

Definir no painel do Dokploy. **Nenhuma delas vai para o repositório.**

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `AUSTER_SENHA_BACKOFFICE` | **sim** | senha do backoffice. Sem ela o processo se recusa a subir, com mensagem explícita — é proteção deliberada, não defeito |
| `AUSTER_ENDERECO_PUBLICO` | quase | URL pública, ex. `https://diagnostico.austercontabil.com.br`. Sem ela os links de convite saem sem domínio e não dá para copiar e enviar |
| `AUSTER_BANCO` | não | caminho do SQLite. O contêiner já aponta para `/app/dados/portal.db` |
| `PORT` | não | padrão 8080 |
| `NODE_ENV` | não | `production` liga o cache das páginas em memória |

A senha do backoffice é **compartilhada pela equipe**; o **usuário** é livre e
fica registrado na auditoria. Quem entrar como `maria` aparece como `maria` no
histórico de cada resposta validada. Não há cadastro de usuário: é de propósito,
para não guardar mais credencial do que o necessário.

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

1. `GET /saude` responde `{"ok":true}`.
2. Abrir `/` e preencher o caminho curto até o fim. O cartão do protocolo
   aparece com o botão de enviar — se disser "suas respostas ficaram só neste
   navegador", o endpoint não foi injetado e o `portal.html` precisa ser
   regerado (`node construir.mjs`).
3. No bloco 1, digitar um CNPJ real e sair do campo: o nome da empresa deve
   chegar preenchido. **É o teste de que a publicação resolveu o `file://`.**
4. Enviar. Abrir `/backoffice`, entrar com o usuário próprio e ver a resposta na
   lista.
5. Abrir a ficha, mudar a situação para "Em análise" e conferir se o seu nome
   aparece em "último tratamento".
6. Na aba **Convites**, gerar um link de teste e abri-lo: nome e CNPJ devem vir
   preenchidos, e a aba deve contar a abertura.
7. Na aba **Auditoria**, confirmar que os eventos acima estão registrados.

---

## Rodar na máquina, antes de subir

```bash
node construir.mjs
AUSTER_SENHA_BACKOFFICE=teste AUSTER_ENDERECO_PUBLICO=http://localhost:8080 node servidor.mjs
```

Testes, todos sem dependência:

```bash
node testes.mjs            # 26 invariantes sobre 40.000 preenchimentos
node testes_servidor.mjs   # 37 verificações sobre o servidor e o backoffice
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
| backoffice pede senha em loop | senha com caractere que o navegador escapa; trocar por algo sem dois-pontos |
