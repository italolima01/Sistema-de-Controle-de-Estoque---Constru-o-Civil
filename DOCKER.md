# 🐳 Docker - BuildStock

Sistema de Controle de Estoque containerizado com Docker.

## 📋 Estrutura

```
├── backend/              # API Node.js + Express + SQLite
│   ├── Dockerfile       # Build do backend
│   └── src/
│       ├── server.ts    # Servidor Express
│       └── db.ts        # Banco de dados (estrutura melhorada)
├── frontend/            # Interface Vite + TypeScript
│   ├── Dockerfile       # Build do frontend
│   └── nginx.conf       # Configuração Nginx
└── docker-compose.yml   # Orquestração dos serviços
```

## 🚀 Como Usar

### 1. Pré-requisitos

- Docker instalado (versão 20.10+)
- Docker Compose instalado (versão 2.0+)

### 2. Build e Iniciar

```bash
# Build das imagens e iniciar containers
docker-compose up -d --build

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f
```

### 3. Acessar o Sistema

- **Frontend**: http://localhost
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/summary

### 4. Parar o Sistema

```bash
# Parar containers
docker-compose down

# Parar e remover volumes (CUIDADO: apaga o banco de dados!)
docker-compose down -v
```

## 📦 Serviços

### Backend (estoque-backend)

**Tecnologias:**
- Node.js 20 Alpine
- Express.js
- TypeScript
- SQLite3

**Portas:**
- `5000:5000` - API REST

**Volumes:**
- `db-data:/app/data` - Persistência do banco de dados

**Estrutura do Banco:**
- ✅ Tabela `users` - Usuários (preparado para autenticação)
- ✅ Tabela `materials` - Materiais cadastrados
- ✅ Tabela `stock_records` - Registros de movimentação
- ✅ Índices otimizados para performance
- ✅ Foreign Keys e validações

**Health Check:**
- Endpoint: `/api/summary`
- Intervalo: 30s
- Timeout: 10s
- Retries: 3

### Frontend (estoque-frontend)

**Tecnologias:**
- Vite + TypeScript
- Nginx Alpine
- Chart.js

**Portas:**
- `80:80` - Interface web

**Build:**
- Multi-stage build (otimizado)
- Arquivos estáticos servidos pelo Nginx

## 🔧 Configurações Avançadas

### Variáveis de Ambiente

Edite `docker-compose.yml`:

```yaml
backend:
  environment:
    - NODE_ENV=production
    - PORT=5000
    # Adicione mais variáveis aqui
```

### Alterar Portas

```yaml
backend:
  ports:
    - "3000:5000"  # Acessa em localhost:3000

frontend:
  ports:
    - "8080:80"    # Acessa em localhost:8080
```

### Backup do Banco de Dados

```bash
# Copiar banco de dados do container
docker cp estoque-backend:/app/data/db.sqlite3 ./backup-$(date +%Y%m%d).sqlite3

# Restaurar backup
docker cp ./backup-20251128.sqlite3 estoque-backend:/app/data/db.sqlite3
docker-compose restart backend
```

### Logs

```bash
# Ver logs do backend
docker-compose logs -f backend

# Ver logs do frontend
docker-compose logs -f frontend

# Ver logs de todos os serviços
docker-compose logs -f

# Ver últimas 100 linhas
docker-compose logs --tail=100
```

### Executar Comandos no Container

```bash
# Acessar shell do backend
docker-compose exec backend sh

# Verificar banco de dados
docker-compose exec backend sqlite3 /app/data/db.sqlite3 "SELECT * FROM materials;"

# Ver estrutura do banco
docker-compose exec backend sqlite3 /app/data/db.sqlite3 ".schema"
```

## 🔍 Troubleshooting

### Backend não inicia

```bash
# Ver logs detalhados
docker-compose logs backend

# Verificar se a porta 5000 está livre
netstat -ano | findstr :5000  # Windows
lsof -i :5000                 # Linux/Mac

# Rebuild forçado
docker-compose build --no-cache backend
docker-compose up -d backend
```

### Frontend não carrega

```bash
# Verificar se o backend está saudável
docker-compose ps

# Rebuild do frontend
docker-compose build --no-cache frontend
docker-compose up -d frontend

# Verificar configuração do Nginx
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf
```

### Banco de dados corrompido

```bash
# Parar serviços
docker-compose down

# Remover volume do banco
docker volume rm gerenciador-de-estoque_db-data

# Reiniciar (criará novo banco)
docker-compose up -d
```

### Permissões no volume

```bash
# Verificar permissões
docker-compose exec backend ls -la /app/data

# Corrigir permissões (se necessário)
docker-compose exec --user root backend chown -R node:node /app/data
docker-compose restart backend
```

## 📊 Monitoramento

### Health Checks

```bash
# Verificar saúde dos containers
docker-compose ps

# Status esperado:
# estoque-backend   Up (healthy)
# estoque-frontend  Up
```

### Recursos

```bash
# Ver uso de recursos
docker stats

# Ver uso de disco
docker system df

# Limpar recursos não utilizados
docker system prune -a
```

## 🔄 Atualização

### Atualizar o Sistema

```bash
# 1. Fazer backup do banco
docker cp estoque-backend:/app/data/db.sqlite3 ./backup.sqlite3

# 2. Parar containers
docker-compose down

# 3. Atualizar código (git pull, etc)

# 4. Rebuild e reiniciar
docker-compose up -d --build

# 5. Verificar logs
docker-compose logs -f
```

## 🌐 Deploy em Produção

### Recomendações

1. **Use HTTPS**: Configure um reverse proxy (Nginx/Traefik) com SSL
2. **Backup automático**: Configure cron job para backup do banco
3. **Monitoramento**: Use Prometheus + Grafana
4. **Logs centralizados**: Use ELK Stack ou similar
5. **Secrets**: Use Docker Secrets para dados sensíveis
6. **Limite de recursos**: Configure limits no docker-compose.yml

### Exemplo com Limites de Recursos

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 512M
      reservations:
        cpus: '0.5'
        memory: 256M
```

## 📝 Estrutura do Banco de Dados

### Tabelas

**users**
- Usuários do sistema (preparado para autenticação)

**materials**
- Materiais cadastrados
- Limites de estoque (mínimo/máximo)
- Criação automática ao registrar movimentação

**stock_records**
- Histórico completo de movimentações
- Entradas (quantity positivo)
- Saídas (quantity negativo)
- Foreign Keys para materials e users

### Validações

- ✅ Impede saída sem estoque suficiente
- ✅ Materiais únicos (case-insensitive)
- ✅ Integridade referencial
- ✅ Alertas de estoque baixo/alto

## 🆘 Suporte

Para problemas ou dúvidas:

1. Verifique os logs: `docker-compose logs -f`
2. Verifique o health check: `docker-compose ps`
3. Consulte a documentação: `DATABASE_MODEL.md`
4. Verifique as issues no repositório

## 📄 Licença

Este projeto está sob a licença especificada no arquivo LICENSE.
