# Cloud Run: imagem única com Node 22, build do Vite e servidor Express/TSX.
FROM node:22-bookworm-slim

WORKDIR /app

# Instala todas as dependências (inclui devDependencies necessárias ao build).
COPY package.json ./
RUN npm install --no-audit --no-fund

# Código, Códice e Story Cards. O .dockerignore remove node_modules/dist/.env.
COPY . .

# Gera o dist/ que o servidor serve em produção.
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
