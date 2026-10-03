# Etapa 3 — Eventos, inscrições e capa

Data: 2026-10-03 · Status: decidido pelo controlador com as recomendações (usuário autorizou seguir sem portão)

Base: Etapas 0 a 2, no ar em `hml-reforma.austercontabil.com.br` pela branch `teste`. A referência é o portal antigo na `origin/main` (`10f5a4c`): `src/banco.mjs` (ESQUEMA_EVENTOS, `criarEvento`, `alterarEvento`, `gravarSessoes`, `eventosDoPortal`, `gravarInscricao`, `inscricoes`, `tratarInscricao`), `servidor.mjs` (rotas `/`, `/principal`, `/eventos`, `/eventos/<apelido>`, `/imagens/<nome>`, `/api/inscricao`, `/api/backoffice/eventos*`, `/api/backoffice/inscricoes*`, `/api/backoffice/imagens`), `modelo_evento.html`, `modelo_principal.html`, `backoffice.html` (aba Eventos), `ativos/estilo_publico.css` e `testes_servidor.mjs:731-875`.

Com esta etapa, o app novo cobre tudo o que a `main` serve e a virada pode acontecer.

## Decisões

| # | Decisão |
|---|---|
| V1 | **Conteúdo fiel à `main`.** Textos, seções, temas da capa, rótulos, mensagens de tela e de servidor, ordem das validações, colunas do CSV e regras do endereço (`apelido`) ficam como na `main`. A validação do servidor continua mais frouxa que a da tela: telefone opcional e CNPJ sem dígito verificador. |
| V2 | **Correções de defeito**, sem mudar texto: (a) "Fazer o diagnóstico" na lista de eventos e no recibo leva a `/diagnosis`, e não a `/`, que agora é a capa; (b) o cartão "Encontros" da capa mostra o **próximo** evento publicado, ou seja, o de primeira sessão em data igual ou posterior a hoje, de data mais próxima; sem nenhum, mostra o mais recente, como no antigo; (c) o tema vazio vale `marca` no painel e na página; (d) salvar as sessões no painel não apaga a `descrição`, que ganha um campo no editor; (e) a capa ganha as metatags OG que o antigo deixou como comentário. |
| V3 | **Imagens no MinIO, nunca base64.** A fundação já guarda as seis fotos da casa como `StoredFile` `house_photo`. O envio no painel continua reduzindo a imagem no navegador (retrato com lado maior de 360 px e JPEG 0,82; capa com 1280 px e JPEG 0,68), mas manda os bytes para uma server function, que grava pelo `storeFile` e audita `file_stored`. O `content` guarda a referência `{ "fileId": "<uuid>" }`. `/imagens/<nome>` continua respondendo: serve a foto da casa pelo nome original, com o mesmo cache de 1 dia. |
| V4 | **Vaga conferida e gravada na mesma transação**, como pede a fundação. A sessão é travada com `SELECT … FOR UPDATE`; depois vêm a contagem das inscrições não canceladas e a inserção. Uma inscrição repetida (mesma sessão e mesmo e-mail em minúsculas, fora de `cancelled`) devolve a existente com `repetida: true`, como no antigo. Isso é conferido antes da vaga, para quem já está inscrito numa sessão lotada não ouvir "sem vaga". O índice único parcial da fundação é a rede de segurança: o erro P2002 dele também vira "repetida". |
| V5 | **Protocolo `INS-AAAAMMDD-XXXXX` com a data de Brasília**, no mesmo alfabeto do `ADS-`. Na migração, protocolo repetido ganha `-2`, como em E6. |
| V6 | **Rate limit da inscrição** pelo módulo `rate-limit`: rota `event-registration`, 5 por minuto e 30 por hora por origem, com a resposta 429 do antigo ("muitos envios seguidos; tente daqui a pouco"). |
| V7 | **Endereço trocado não redireciona**, fiel ao antigo, que avisa no painel que trocar o endereço quebra os links. Fica registrado em `event_slug_changed`. |
| V8 | **Rascunho visível só com sessão do backoffice** que tenha `view_events`. Sem isso, 404 "Evento não encontrado.". O evento encerrado continua acessível pelo endereço, mas não aparece na lista. |
| V9 | **Migração completa**: `agenda`, `agenda_sessoes` e `inscricoes`, com ids preservados. As imagens base64 do `conteudo` são extraídas para `StoredFile`, e `/imagens/<nome>` vira a referência da foto da casa. |
| V10 | **Backoffice de eventos como no antigo**: lista, editor e inscritos por evento, com as capacidades `view_events`, `manage_events`, `handle_registrations` e `export_registrations`. Não existe lista de inscritos de todos os eventos juntos, e não existe botão "Confirmada", também como no antigo. |

## 1. Rotas

| Rota | O que é |
|---|---|
| `/` | Capa institucional (`modelo_principal.html`). `/?c=` continua indo para `/diagnosis?invite=`, regra que já existe. |
| `/events` | Lista dos eventos publicados (301 de `/eventos`, que já existe). |
| `/events/$slug` | Página do evento, com inscrição (301 de `/eventos/<apelido>`, que já existe). |
| `/imagens/$name` | Foto da casa pelo nome original, servida do MinIO. |
| `/backoffice?tab=events` | Aba Eventos: lista, editor e inscritos. |
| `/backoffice/events/$id/registrations.csv` | Planilha dos inscritos do evento, com os filtros. |

## 2. Servidor — módulo `events`

**`domain/`** (puro):
- `event.ts`: tipos, `EVENT_STATUSES`, `SESSION_FORMATS`, `REGISTRATION_STATUSES`, os mapas de rótulos da `main` e `EventContent`. O `EventContent` tem as chaves `chamada`, `local`, `intro`, `destaques[{titulo,texto}]`, `temas[]`, `avisos[]`, `aposEncerrar`, `tema`, `rotulo`, `capa`, `palestrante{nome,cargo,bio,foto}`; `capa` e `foto` são `{ fileId }` ou nulos. Os nomes das chaves são valor de domínio e ficam em português.
- `slug.ts`: `slugFrom(title)` e `checkSlug(slug, taken)`, com as regras e mensagens literais da `main`.
- `seats.ts`: `remainingSeats` e `sessionBadge`. O selo segue a regra da `main`: "Sem vagas", "Última vaga", "Últimas N vagas" até 5, ou "N vagas".
- `registration.ts`: `checkRegistration(body, { event, sessions })`, com a ordem e as mensagens do `conferirInscricao` da `main`, mais o truncamento de nome 120, e-mail 160, telefone 40, empresa 160 e cargo 60.
- `client-rules.ts`: as regras da tela, com as mensagens e a lista de cargos da `main`.
- `protocol.ts`: o formato `INS-`.
- `csv.ts`: as 18 colunas da planilha da `main` e o nome `inscritos-AAAA-MM-DD.csv`.
- `home.ts`: `homeEventCard(events, today)`, que aplica a regra V2b.

**`application/`**:
- **`publicEvents`:**
  - `list()`: os publicados, do mais recente para o mais antigo pela primeira data, como no antigo;
  - `page(slug, viewer)`: aplica a regra de rascunho V8 e calcula o estado de cada sessão.
- **`registerForSession`:**
  - checa o rate limit;
  - roda o `checkRegistration`;
  - grava na transação de V4;
  - liga a inscrição à resposta mais recente com o mesmo `cnpjDigits`;
  - grava origem (IP, fonte e cadeia no `payload`, e o user agent cortado em 300);
  - audita `registration_received` com `{ event, session }`.

  Devolve o recibo, ou a recusa com a mensagem do antigo: 422 nas validações, 409 "sessão sem vaga" e 429.
- **`eventBackoffice`:**
  - `list`;
  - `get(id)`: o evento com as sessões, as contagens e os inscritos;
  - `create(actor, { title })`: "o evento precisa de um título";
  - `update(actor, changes)`: as regras do `alterarEvento` e do `gravarSessoes` da `main`, menos o defeito V2d, e audita `event_updated` e `event_slug_changed`;
  - `uploadImage(actor, kind, bytes)`: grava pelo `storeFile` e audita `file_stored`;
  - `gallery()`: as fotos da casa e as imagens de evento já enviadas;
  - `handleRegistration(actor, { id, status })`: audita `registration_handled` com `{ from, to }`;
  - `exportCsv(actor, filter)`: no máximo 5.000 linhas, audita `spreadsheet_exported` com `{ kind: 'registrations' }`.

**Portas e adaptadores** seguem o padrão de `adhesion`: `EventRepository`, `RegistrationRepository` (com o método transacional de inscrição), `ResponseLookup`, `ProtocolGenerator`, `Clock`, `RateLimiter`, `ImageStore` (sobre o `storage`) e `AuditRecorder`.

## 3. Telas públicas — `src/features/events` e `src/features/home`

- **Capa (`/`):** a `modelo_principal.html` inteira, com os textos literais da `main`:
  - barra e capa com a foto `recepcao` e os dois números;
  - as quatro portas;
  - o cartão do termo aberto ou fechado, pela `adhesionWindow`;
  - o cartão dos encontros pela regra V2b;
  - "Como funciona", "Quem faz", o bloco de fechamento e o rodapé;
  - `noindex, nofollow`;
  - as metatags OG de V2e.

  As fotos vêm do MinIO por `/imagens/<nome>`.
- **Lista (`/events`):**
  - capa da marca;
  - cartões com o dia e o mês, ou "data a definir";
  - o estado vazio;
  - o bloco "enquanto isso", com o botão para `/diagnosis`.
- **Página do evento (`/events/$slug`):**
  - a barra fixa com as âncoras;
  - a capa nos 5 temas, com o SVG da onda e a contagem regressiva calculada pela data de Brasília;
  - as seções `#sobre`, `#temas`, `#programa` (com os selos de vaga), `#quem`, `#onde` (com a foto `fachada-larga`) e `#participar`;
  - a seção `#inscricao` nos três estados: aberta, encerrada e lotada.

  Metatags `title`, `description`, OG e `twitter:card` como na `main`. Sem `robots` próprio: o `X-Robots-Tag: noindex` global continua valendo.
- **Formulário:**
  - os campos e os cargos da `main`;
  - a consulta do CNPJ por server function no `company-lookup`, devolvendo só a razão social, como na adesão;
  - o aceite LGPD literal;
  - as mensagens de tela e de envio;
  - o recibo, nos casos "Inscrição confirmada" e "Você já estava inscrito", com o bloco "enquanto isso" e os botões "Fazer o diagnóstico" (que leva a `/diagnosis`) e "Ver outros encontros".

  O recibo não sobrevive ao F5, como no antigo; o protocolo fica na tela.
- **Nada local.** Os campos só respondem depois da hidratação.

## 4. Backoffice — `src/features/backoffice-events`

- **Aba "Eventos"** (`view_events`), depois de Adesões:
  - "Agenda de eventos", com a nota do antigo;
  - "Novo evento" (`manage_events`), com o título pedido em linha, sem `prompt()`;
  - a tabela com as colunas Evento, Primeira data, Situação e Inscritos;
  - o estado vazio.
- **Editor** (`manage_events` para salvar):
  - **topo:** "← Todos os eventos", "Copiar link" e "Ver a página";
  - **contagens:** Inscritos, Presentes, Canceladas, Situação e Inscrições;
  - **ações:** "Publicar" ou "Voltar a rascunho", "Encerrar inscrições" ou "Reabrir inscrições", e "Marcar como encerrado";
  - **"Baixar inscritos (CSV)":** só com `export_registrations`;
  - **"Conteúdo da página":**
    - o endereço checado ao vivo, com os avisos literais;
    - destaques e temas, um por linha, como no antigo;
  - **"Aparência da capa":**
    - os 5 fundos;
    - a etiqueta;
    - a galeria, com as fotos da casa filtradas por `fachada|recepcao` e as imagens enviadas, além do envio de arquivo;
  - **"Quem apresenta":** com a galeria filtrada por `palestrante` e o envio;
  - **"Encontros":** a tabela com data, hora, formato, título, descrição (V2d), local e vagas, mais "Tirar" ou "N inscritos";
  - **"Salvar alterações".**
- **Inscritos** (`handle_registrations`):
  - a nota sobre presença;
  - as colunas Quem, Empresa (com "· fez o diagnóstico"), Encontro e Situação, mais os botões Presente, Ausente e Cancelar;
  - o estado vazio;
  - os rótulos Inscrita, Confirmada, Presente, Ausente e Cancelada.
- **Planilha:** `/backoffice/events/$id/registrations.csv`, com `ensureCapability('export_registrations')`.

## 5. Migração

O `legacy-import` passa a importar, nesta ordem: usuários → convites → respostas → adesões → **eventos e sessões** → **inscrições** → auditoria.

- **`agenda` → `events`:**
  - ids preservados;
  - situação traduzida: `rascunho`, `publicado` e `encerrado` viram `draft`, `published` e `closed`;
  - inscrições traduzidas: `abertas` e `encerradas` viram `open` e `closed`;
  - `conteudo` é processado antes de ir para `content`:
    - a `capa` e a `palestrante.foto` em data URL são decodificadas e gravadas como `StoredFile` (`event_cover` e `speaker_photo`), com o sha256 e o tipo checados pelo `checkFile`;
    - `/imagens/<nome>` vira o `fileId` da foto da casa com aquele nome;
    - um nome desconhecido fica nulo, com aviso;
  - `criado_por` e `alterado_por` são ligados ao usuário pelo nome.
- **`agenda_sessoes` → `event_sessions`:**
  - ids preservados;
  - formato traduzido: `presencial` e `online` viram `in_person` e `online`;
  - a data inválida é conflito.
- **`inscricoes` → `registrations`:**
  - ids preservados;
  - protocolo repetido ganha `-2`;
  - situação traduzida: `inscrita`, `confirmada`, `presente`, `ausente` e `cancelada` viram `registered`, `confirmed`, `present`, `absent` e `cancelled`;
  - situação ou data inválida é conflito, e usa-se `Object.hasOwn` nas traduções;
  - `pacote` vai para o `payload`;
  - `origem` vai para o `originIp`, e `agente` para o `userAgent`;
  - `resposta_id` inexistente vira nulo, com aviso;
  - duas inscrições ativas da mesma sessão com o mesmo e-mail são conflito, porque o índice parcial as recusaria.
- **Sequências:** as de `events`, `event_sessions` e `registrations` são reiniciadas.
- **Gravação:** as imagens vão para o MinIO **antes** da transação do Postgres; a chave inclui o id do evento, então rodar de novo não duplica nada.
- **Simulação:** o `--dry-run` e a aba Migração contam as três tabelas e as imagens.
- **"Apagar dados de teste":** também apaga as `registrations`.

## 6. Testes

- **`domain`:**
  - slug e mensagens;
  - selos de vaga;
  - `checkRegistration`, cada recusa na ordem;
  - `homeEventCard`;
  - CSV (18 colunas, escape e fórmula);
  - protocolo com a data de Brasília.
- **`application`, com fakes:**
  - rascunho invisível sem `view_events`;
  - inscrição repetida devolve a existente;
  - sessão lotada recusa;
  - rate limit;
  - endereço trocado audita;
  - salvar as sessões preserva a descrição e não apaga sessão com inscrição.
- **`int`:**
  - **duas inscrições simultâneas na última vaga**: só uma entra;
  - P2002 do índice parcial vira "repetida";
  - imagem gravada no MinIO e lida por `/files` e `/imagens`;
  - migração com evento, sessões, inscrições e imagem base64, rodada duas vezes.
- **Componentes:**
  - os 5 temas da capa;
  - os estados da seção de inscrição;
  - o formulário e as mensagens;
  - a galeria e o editor de sessões.
- **Ponta a ponta:**
  - a capa com os 4 cartões;
  - o admin cria o evento com uma sessão de 1 vaga, publica, e o visitante se inscreve: recibo, depois "Você já estava inscrito" ao repetir, e outro visitante vê "Todas as vagas foram preenchidas";
  - o backoffice marca "Presente" e baixa o CSV;
  - o `operator` gerencia eventos mas não baixa o CSV;
  - nada local.

## Critério de pronto (em hml)

1. `/` mostra a capa, com os cartões certos para a janela da adesão e para os eventos.
2. Um evento criado, publicado e com foto enviada aparece em `/events` e abre em `/events/<slug>` com os textos da `main`.
3. A inscrição respeita vagas, repetição e rate limit, inclusive com dois envios ao mesmo tempo.
4. O backoffice trata os inscritos e baixa o CSV, e os papéis valem nas server functions.
5. A migração traz os eventos, as sessões, as inscrições e as imagens do `portal.db`, duas vezes sem duplicar.
6. Lint, typecheck, `pnpm test` e o ponta a ponta limpos.

## Fora do escopo

- E-mail automático (o antigo não tem).
- Lista de espera, ICS e sitemap.
- Redirecionamento de endereço trocado (V7).
- Virada de domínio.
