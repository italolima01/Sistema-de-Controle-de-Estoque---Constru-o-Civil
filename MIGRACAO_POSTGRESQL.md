# 🐘 Migração para PostgreSQL

## Por que PostgreSQL?

✅ **Escalabilidade** - Suporta milhares de usuários simultâneos  
✅ **Performance** - Escritas paralelas e queries complexas  
✅ **Confiabilidade** - ACID completo, transações robustas  
✅ **Recursos avançados** - Triggers, procedures, views materializadas  
✅ **Replicação** - Backup automático e alta disponibilidade  
✅ **Comunidade** - Suporte ativo e documentação extensa  

---

## 🚀 Como Usar

### Opção 1: Docker com PostgreSQL (Recomendado)

```bash
# Usar docker-compose com PostgreSQL
docker-compose -f docker-compose-postgres.yml up -d --build

# Verificar logs
docker-compose -f docker-compose-postgres.yml logs -f

# Acessar
# Frontend: http://localhost
# Backend: http://localhost:5000
# PostgreSQL: localhost:5432
```

### Opção 2: PostgreSQL Local

**1. Instalar PostgreSQL:**
```bash
# Windows: Baixar de https://www.postgresql.org/download/windows/
# Mac: brew install postgresql
# Linux: sudo apt install postgresql
```

**2. Criar banco de dados:**
```bash
psql -U postgres
CREATE DATABASE buildstock;
\q
```

**3. Configurar variáveis de ambiente:**
```bash
# Windows (PowerShell)
$env:DB_TYPE="postgres"
$env:DB_HOST="localhost"
$env:DB_PORT="5432"
$env:DB_NAME="buildstock"
$env:DB_USER="postgres"
$env:DB_PASSWORD="sua_senha"

# Linux/Mac
export DB_TYPE=postgres
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=buildstock
export DB_USER=postgres
export DB_PASSWORD=sua_senha
```

**4. Instalar dependências e iniciar:**
```bash
cd backend
npm install
npm run dev
```

---

## 🔄 Migrar Dados do SQLite para PostgreSQL

### Script de Migração Automática:

```bash
# 1. Exportar dados do SQLite
node backend/migrate-sqlite-to-postgres.js
```

Ou manualmente:

```bash
# 1. Dump do SQLite
sqlite3 backend/db.sqlite3 .dump > backup.sql

# 2. Converter para PostgreSQL (ajustar sintaxe)
# - AUTOINCREMENT → SERIAL
# - datetime('now') → CURRENT_TIMESTAMP
# - INTEGER → INTEGER ou BIGINT
# - REAL → DECIMAL(10,2)

# 3. Importar no PostgreSQL
psql -U postgres -d buildstock < backup-converted.sql
```

---

## ⚙️ Configuração

### Variáveis de Ambiente:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DB_TYPE` | `sqlite` | Tipo de banco: `sqlite` ou `postgres` |
| `DB_HOST` | `localhost` | Host do PostgreSQL |
| `DB_PORT` | `5432` | Porta do PostgreSQL |
| `DB_NAME` | `buildstock` | Nome do banco |
| `DB_USER` | `postgres` | Usuário do banco |
| `DB_PASSWORD` | `postgres123` | Senha do banco |

### Arquivo `.env`:

```env
# Banco de Dados
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=buildstock
DB_USER=postgres
DB_PASSWORD=sua_senha_segura

# Aplicação
NODE_ENV=production
PORT=5000
```

---

## 🔍 Diferenças Técnicas

### SQLite vs PostgreSQL no Código:

| Aspecto | SQLite | PostgreSQL |
|---------|--------|------------|
| **Driver** | `sqlite3` | `pg` |
| **Conexão** | Arquivo | Pool de conexões |
| **Placeholders** | `?` | `$1, $2, $3` |
| **Auto-increment** | `AUTOINCREMENT` | `SERIAL` |
| **Boolean** | `INTEGER (0/1)` | `BOOLEAN` |
| **Timestamp** | `TEXT` | `TIMESTAMP` |
| **Case-insensitive** | `COLLATE NOCASE` | `LOWER()` ou `ILIKE` |

### Exemplo de Query:

**SQLite:**
```sql
SELECT * FROM materials WHERE name = ? COLLATE NOCASE
```

**PostgreSQL:**
```sql
SELECT * FROM materials WHERE LOWER(name) = LOWER($1)
```

---

## 📊 Estrutura do Banco (Igual em ambos)

```sql
-- Usuários
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'operador',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT true
);

-- Materiais
CREATE TABLE materials (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  unit VARCHAR(50) DEFAULT 'un',
  min_stock DECIMAL(10,2) DEFAULT 0,
  max_stock DECIMAL(10,2),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT true
);

-- Registros de Estoque
CREATE TABLE stock_records (
  id SERIAL PRIMARY KEY,
  material_id INTEGER NOT NULL REFERENCES materials(id),
  user_id INTEGER REFERENCES users(id),
  quantity DECIMAL(10,2) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK(type IN ('entrada', 'saida')),
  location VARCHAR(255),
  message TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_stock_material ON stock_records(material_id);
CREATE INDEX idx_stock_timestamp ON stock_records(timestamp DESC);
CREATE INDEX idx_stock_type ON stock_records(type);
CREATE INDEX idx_materials_name ON materials(LOWER(name));
```

---

## 🛠️ Ferramentas Úteis

### pgAdmin (GUI para PostgreSQL):
```bash
# Download: https://www.pgadmin.org/download/
```

### Comandos psql:

```bash
# Conectar
psql -U postgres -d buildstock

# Listar tabelas
\dt

# Descrever tabela
\d materials

# Ver dados
SELECT * FROM materials;

# Backup
pg_dump -U postgres buildstock > backup.sql

# Restore
psql -U postgres buildstock < backup.sql

# Sair
\q
```

---

## 🔒 Segurança em Produção

### 1. Senha Forte:
```bash
# Gerar senha segura
openssl rand -base64 32
```

### 2. Configurar pg_hba.conf:
```
# Permitir apenas conexões locais com senha
local   all   all   md5
host    all   all   127.0.0.1/32   md5
```

### 3. Firewall:
```bash
# Bloquear porta 5432 externamente
# Permitir apenas do backend
```

### 4. SSL/TLS:
```javascript
const pool = new Pool({
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-cert.pem')
  }
});
```

---

## 📈 Performance

### Otimizações:

**1. Índices (já criados):**
```sql
CREATE INDEX idx_stock_material ON stock_records(material_id);
CREATE INDEX idx_stock_timestamp ON stock_records(timestamp DESC);
```

**2. VACUUM (manutenção):**
```sql
VACUUM ANALYZE;
```

**3. Pool de Conexões:**
```javascript
max: 20,  // Máximo de conexões
idleTimeoutMillis: 30000,
connectionTimeoutMillis: 2000
```

**4. Prepared Statements:**
Já implementado automaticamente pelo driver `pg`.

---

## 🔄 Rollback (Voltar para SQLite)

Se precisar voltar:

```bash
# 1. Mudar variável de ambiente
export DB_TYPE=sqlite

# 2. Reiniciar backend
npm run dev

# 3. Ou no Docker
docker-compose up -d --build
```

---

## 📊 Monitoramento

### Queries Lentas:

```sql
-- Habilitar log de queries lentas
ALTER SYSTEM SET log_min_duration_statement = 1000; -- 1 segundo
SELECT pg_reload_conf();

-- Ver queries ativas
SELECT * FROM pg_stat_activity;

-- Ver estatísticas de tabelas
SELECT * FROM pg_stat_user_tables;
```

### Tamanho do Banco:

```sql
-- Tamanho total
SELECT pg_size_pretty(pg_database_size('buildstock'));

-- Tamanho por tabela
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## ✅ Checklist de Migração

- [ ] PostgreSQL instalado e rodando
- [ ] Banco de dados `buildstock` criado
- [ ] Variáveis de ambiente configuradas
- [ ] Dependências instaladas (`npm install`)
- [ ] Backup do SQLite feito
- [ ] Dados migrados (se necessário)
- [ ] Backend iniciado com sucesso
- [ ] Frontend conectando corretamente
- [ ] Testes de entrada/saída funcionando
- [ ] Configurações de estoque funcionando

---

## 🆘 Troubleshooting

### Erro: "Connection refused"
```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql  # Linux
brew services list  # Mac
```

### Erro: "password authentication failed"
```bash
# Resetar senha
sudo -u postgres psql
ALTER USER postgres PASSWORD 'nova_senha';
```

### Erro: "database does not exist"
```bash
# Criar banco
createdb -U postgres buildstock
```

---

## 📞 Suporte

- Documentação PostgreSQL: https://www.postgresql.org/docs/
- Driver Node.js (pg): https://node-postgres.com/
- Issues: Abra uma issue no repositório

---

**Pronto para escalar! 🚀**
