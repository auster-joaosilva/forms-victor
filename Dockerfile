# Imagem do portal. Node 22+ porque o servidor usa `node:sqlite` de fabrica.
# Sem `npm install`: o projeto nao tem dependencia de terceiro, e por isso nao
# ha lockfile para divergir nem pacote para auditar.
FROM node:22-alpine

WORKDIR /app

# Copia so o que o servidor precisa em execucao.
COPY servidor.mjs construir.mjs modelo.html modelo_adesao.html backoffice.html entrar.html ./
COPY src ./src
COPY ativos ./ativos

# Gera portal.html dentro da imagem, a partir da mesma fonte que roda nos testes.
RUN node construir.mjs

# O banco vive em volume, nunca na imagem.
RUN mkdir -p /app/dados
VOLUME ["/app/dados"]

ENV NODE_ENV=production
ENV AUSTER_BANCO=/app/dados/portal.db
ENV PORT=8080
EXPOSE 8080

# Sem shell: sinal de parada chega direto ao Node e o SQLite fecha limpo.
CMD ["node", "servidor.mjs"]
