# Backend Dockerfile - Node.js + TypeScript + Express + SQLite (Estrutura Melhorada)
FROM node:20-alpine AS builder

# Instalar dependências de build
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY tsconfig.json ./

# Instalar todas as dependências (incluindo dev para build)
RUN npm ci

# Copiar código fonte
COPY src ./src

# Compilar TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

# Instalar apenas dependências de runtime
RUN apk add --no-cache sqlite wget

WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --only=production && npm cache clean --force

# Copiar código compilado do builder
COPY --from=builder /app/dist ./dist

# Criar diretório para o banco de dados com permissões corretas
RUN mkdir -p /app/data && chown -R node:node /app /app/data

# Usar usuário não-root
USER node

# Expor porta
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/summary || exit 1

# Variáveis de ambiente
ENV NODE_ENV=production \
    PORT=5000

# Comando para iniciar
# O banco de dados será criado automaticamente na primeira execução
CMD ["node", "dist/server.js"]
