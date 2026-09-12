# ponytail: um estagio so. O `prisma` CLI precisa existir em runtime para o
# `db push` do entrypoint; podar node_modules economizaria imagem e custaria
# um segundo estagio. Trocar por multi-stage quando o tamanho incomodar.
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Cliente Prisma e gerado, nao versionado (ver CLAUDE.md).
# `generate` so le o schema, nao conecta no banco, mas prisma.config.ts exige
# DATABASE_URL setada pra carregar. Valor real entra em runtime via compose.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Sem pasta de migrations no repo ainda: `db push` cria o esquema.
# Trocar por `prisma migrate deploy` quando a primeira migration existir.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node .output/server/index.mjs"]
