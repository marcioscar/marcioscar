# Espelho do Docker Hub mantido pelo Google: mesmo conteúdo da imagem oficial,
# sem o limite de pulls anônimos por IP que derrubava o build com HTTP 429.
FROM mirror.gcr.io/library/node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# O build não acessa o banco: `prisma generate` só lê o schema e o app é SSR
# (sem prerender), então nenhum loader roda aqui. O placeholder existe apenas
# para satisfazer a validação da env do Prisma — a URL real entra em runtime,
# e assim a senha de produção não fica gravada nas camadas da imagem.
RUN DATABASE_URL=mongodb://build-placeholder npm run build

RUN npm prune --omit=dev

CMD ["npm", "run", "start"]
