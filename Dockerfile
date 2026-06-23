FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG DATABASE_URL=mongodb://build-placeholder
ENV DATABASE_URL=$DATABASE_URL
RUN npm run build

RUN npm prune --omit=dev

CMD ["npm", "run", "start"]
