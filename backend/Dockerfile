# Backend Dockerfile - Node.js + TypeScript + Express + PostgreSQL
FROM node:20-alpine AS builder

# Não precisa mais de Python (era só para compilar sqlite3)

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY tsconfig.json ./

# Configurar npm para usar o registro oficial e aumentar timeout
RUN npm config set fetch-timeout 60000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

# Instalar todas as dependências (incluindo dev para build)
RUN npm install

# Copiar código fonte
COPY src ./src

# Compilar TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

# Instalar apenas wget para health check
RUN apk add --no-cache wget

WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Copiar node_modules do builder
COPY --from=builder /app/node_modules ./node_modules

# Copiar código compilado do builder
COPY --from=builder /app/dist ./dist

# Configurar permissões
RUN chown -R node:node /app

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
# Conecta ao PostgreSQL automaticamente
CMD ["node", "dist/server.js"]
