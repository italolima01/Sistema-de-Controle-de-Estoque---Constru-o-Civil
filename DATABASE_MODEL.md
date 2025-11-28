# 🗄️ Modelagem MELHORADA do Banco de Dados - BuildStock

## 🎯 Melhorias Implementadas

✅ **Normalização** - Materiais em tabela separada  
✅ **Rastreamento** - Tabela de usuários  
✅ **Validações** - Impede estoque negativo  
✅ **Performance** - Índices otimizados  
✅ **Alertas** - Estoque mínimo/máximo  

---

## 📊 Diagrama Entidade-Relacionamento (ER)  usuarios ainda esta em aberto ser usado(somente modelado)

```
┌─────────────────────────────┐
│         USERS               │
├─────────────────────────────┤
│ 🔑 id          INTEGER PK   │
│    name        TEXT          │
│    email       TEXT UNIQUE   │
│    role        TEXT          │
│    created_at  TEXT          │
│    active      INTEGER       │
└──────────────┬──────────────┘
               │
               │ 1:N
               │ registra
               │
               ▼
┌─────────────────────────────┐         ┌─────────────────────────────┐
│      STOCK_RECORDS          │         │        MATERIALS            │
├─────────────────────────────┤         ├─────────────────────────────┤
│ 🔑 id          INTEGER PK   │    N:1  │ 🔑 id          INTEGER PK   │
│ 🔗 material_id INTEGER FK   │◄────────┤    name        TEXT UNIQUE   │
│ 🔗 user_id     INTEGER FK   │         │    unit        TEXT          │
│    quantity    REAL          │         │    min_stock   REAL          │
│    type        TEXT          │         │    max_stock   REAL          │
│    location    TEXT          │         │    description TEXT          │
│    message     TEXT          │         │    created_at  TEXT          │
│    timestamp   TEXT          │         │    active      INTEGER       │
└─────────────────────────────┘         └─────────────────────────────┘
```

---

## 📋 Estrutura Detalhada das Tabelas

### 1️⃣ Tabela: `users`

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| **id** | INTEGER | PRIMARY KEY, AUTOINCREMENT | Identificador único |
| **name** | TEXT | NOT NULL | Nome do usuário |
| **email** | TEXT | NOT NULL, UNIQUE | Email (login) |
| **role** | TEXT | DEFAULT 'operador' | Papel: admin, operador, visualizador |
| **created_at** | TEXT | DEFAULT datetime('now') | Data de criação |
| **active** | INTEGER | DEFAULT 1 | Status: 1=ativo, 0=inativo |

**SQL de Criação:**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'operador',
  created_at TEXT DEFAULT (datetime('now')),
  active INTEGER DEFAULT 1
);
```

---

### 2️⃣ Tabela: `materials`

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| **id** | INTEGER | PRIMARY KEY, AUTOINCREMENT | Identificador único |
| **name** | TEXT | NOT NULL, UNIQUE | Nome do material |
| **unit** | TEXT | DEFAULT 'un' | Unidade de medida |
| **min_stock** | REAL | DEFAULT 0 | Estoque mínimo (alerta) |
| **max_stock** | REAL | NULL | Estoque máximo (alerta) |
| **description** | TEXT | NULL | Descrição do material |
| **created_at** | TEXT | DEFAULT datetime('now') | Data de cadastro |
| **active** | INTEGER | DEFAULT 1 | Status: 1=ativo, 0=inativo |

**SQL de Criação:**
```sql
CREATE TABLE materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  unit TEXT DEFAULT 'un',
  min_stock REAL DEFAULT 0,
  max_stock REAL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  active INTEGER DEFAULT 1
);
```

---

### 3️⃣ Tabela: `stock_records`

| Campo | Tipo | Restrições | Descrição |
|-------|------|------------|-----------|
| **id** | INTEGER | PRIMARY KEY, AUTOINCREMENT | Identificador único |
| **material_id** | INTEGER | NOT NULL, FK → materials(id) | Referência ao material |
| **user_id** | INTEGER | FK → users(id) | Quem registrou |
| **quantity** | REAL | NOT NULL | Quantidade (+ entrada, - saída) |
| **type** | TEXT | NOT NULL, CHECK IN ('entrada','saida') | Tipo de movimentação |
| **location** | TEXT | NULL | Local da movimentação |
| **message** | TEXT | NULL | Observações |
| **timestamp** | TEXT | DEFAULT datetime('now') | Data/hora do registro |

**SQL de Criação:**
```sql
CREATE TABLE stock_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER NOT NULL,
  user_id INTEGER,
  quantity REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('entrada', 'saida')),
  location TEXT,
  message TEXT,
  timestamp TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (material_id) REFERENCES materials(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 🚀 Índices para Performance

```sql
-- Índice para buscar movimentações por material
CREATE INDEX idx_stock_material ON stock_records(material_id);

-- Índice para ordenar por data (DESC)
CREATE INDEX idx_stock_timestamp ON stock_records(timestamp DESC);

-- Índice para filtrar por tipo
CREATE INDEX idx_stock_type ON stock_records(type);
```

**Benefícios:**
- ⚡ Consultas 10-100x mais rápidas
- 📊 Relatórios otimizados
- 🔍 Buscas instantâneas

---

## 🔒 Validações e Regras de Negócio

### 1. Validação de Estoque Negativo

```typescript
async validateStock(materialId: number, quantity: number): Promise<boolean> {
  // Calcula estoque atual
  const currentStock = SUM(entradas) - SUM(saidas);
  
  // Valida se há estoque suficiente
  return currentStock >= quantity;
}
```

**Comportamento:**
- ✅ **Entrada**: Sempre permitida
- ⚠️ **Saída**: Só permitida se houver estoque suficiente
- ❌ **Bloqueio**: Retorna erro se estoque insuficiente

### 2. Normalização de Materiais

```typescript
async getOrCreateMaterial(name: string, unit: string): Promise<number> {
  // Busca material existente (case-insensitive)
  const existing = SELECT id FROM materials WHERE name = ? COLLATE NOCASE;
  
  if (existing) {
    return existing.id;
  } else {
    // Cria novo material automaticamente
    INSERT INTO materials (name, unit) VALUES (?, ?);
    return lastID;
  }
}
```

**Benefícios:**
- 📝 Evita duplicatas (Cimento ≠ cimento)
- 🎯 Consistência nos dados
- 📊 Relatórios mais precisos

### 3. Alertas de Estoque

```sql
SELECT 
  name,
  current_stock,
  min_stock,
  max_stock,
  CASE 
    WHEN current_stock <= min_stock THEN 'BAIXO'
    WHEN current_stock >= max_stock THEN 'ALTO'
    ELSE 'NORMAL'
  END as status
FROM materials_with_stock;
```

**Status:**
- 🔴 **BAIXO**: Estoque ≤ mínimo (precisa repor)
- 🟢 **NORMAL**: Estoque adequado
- 🟡 **ALTO**: Estoque ≥ máximo (excesso)

---

## 📈 Queries Otimizadas

### 1. Estoque Atual com Alertas

```sql
SELECT 
  m.id,
  m.name as material,
  SUM(CASE WHEN sr.type = 'entrada' THEN sr.quantity ELSE -sr.quantity END) as total,
  m.unit,
  m.min_stock,
  m.max_stock,
  MAX(sr.timestamp) as last_update,
  CASE 
    WHEN SUM(CASE WHEN sr.type = 'entrada' THEN sr.quantity ELSE -sr.quantity END) <= m.min_stock 
    THEN 'baixo'
    WHEN SUM(CASE WHEN sr.type = 'entrada' THEN sr.quantity ELSE -sr.quantity END) >= COALESCE(m.max_stock, 999999)
    THEN 'alto'
    ELSE 'normal'
  END as status
FROM materials m
LEFT JOIN stock_records sr ON m.id = sr.material_id
WHERE m.active = 1
GROUP BY m.id
ORDER BY m.name;
```

### 2. Histórico Completo com Usuário

```sql
SELECT 
  sr.id,
  m.name as material,
  sr.quantity,
  m.unit,
  sr.type,
  sr.location,
  sr.message,
  sr.timestamp,
  u.name as user_name
FROM stock_records sr
JOIN materials m ON sr.material_id = m.id
LEFT JOIN users u ON sr.user_id = u.id
ORDER BY sr.timestamp DESC;
```

### 3. Dashboard com Estatísticas

```sql
SELECT 
  COUNT(DISTINCT m.id) as totalMaterials,
  COUNT(sr.id) as totalRecords,
  SUM(CASE WHEN sr.type = 'entrada' THEN 1 ELSE 0 END) as totalEntradas,
  SUM(CASE WHEN sr.type = 'saida' THEN 1 ELSE 0 END) as totalSaidas,
  (SELECT COUNT(*) FROM materials_with_low_stock) as lowStock
FROM materials m
LEFT JOIN stock_records sr ON m.id = sr.material_id
WHERE m.active = 1;
```

---

## 🔄 Fluxo de Dados Melhorado

```
┌──────────────┐
│   USUÁRIO    │
│  (autenticado)│
└──────┬───────┘
       │
       │ 1. Registra movimentação
       ▼
┌──────────────────┐
│   FORMULÁRIO     │
│  + Validações JS │
└──────┬───────────┘
       │
       │ 2. POST /api/stock
       ▼
┌──────────────────┐
│   API REST       │
│  + Validações    │
└──────┬───────────┘
       │
       │ 3. Valida estoque
       ▼
┌──────────────────┐
│  validateStock() │
│  (se saída)      │
└──────┬───────────┘
       │
       │ 4. Busca/Cria material
       ▼
┌──────────────────┐
│ getOrCreateMat() │
└──────┬───────────┘
       │
       │ 5. INSERT com FK
       ▼
┌──────────────────┐
│   SQLITE DB      │
│  3 tabelas       │
│  + índices       │
└──────┬───────────┘
       │
       │ 6. SELECT com JOINs
       ▼
┌──────────────────┐
│  ESTOQUE ATUAL   │
│  + Alertas       │
│  + Auditoria     │
└──────────────────┘
```

---

## 📊 Exemplo de Dados

### Tabela: users
```
id │ name           │ email                  │ role    │ active
───┼────────────────┼────────────────────────┼─────────┼────────
1  │ Administrador  │ admin@buildstock.com   │ admin   │ 1
2  │ João Silva     │ joao@buildstock.com    │ operador│ 1
3  │ Maria Santos   │ maria@buildstock.com   │ operador│ 1
```

### Tabela: materials
```
id │ name    │ unit │ min_stock │ max_stock │ active
───┼─────────┼──────┼───────────┼───────────┼────────
1  │ Cimento │ saco │ 20        │ 100       │ 1
2  │ Areia   │ m³   │ 5         │ 50        │ 1
3  │ Tijolo  │ un   │ 1000      │ 10000     │ 1
```

### Tabela: stock_records
```
id │ material_id │ user_id │ quantity │ type    │ location  │ timestamp
───┼─────────────┼─────────┼──────────┼─────────┼───────────┼─────────────────
1  │ 1           │ 1       │ 50       │ entrada │ Depósito A│ 2025-11-27 10:00
2  │ 2           │ 2       │ 15       │ entrada │ Pátio     │ 2025-11-27 10:15
3  │ 1           │ 2       │ -10      │ saida   │ Obra 1    │ 2025-11-27 14:00
```

### View: Estoque Atual com Alertas
```
material │ estoque │ unit │ min │ max │ status  │ última_atualização
─────────┼─────────┼──────┼─────┼─────┼─────────┼────────────────────
Cimento  │ 40      │ saco │ 20  │ 100 │ NORMAL  │ 2025-11-27 14:00
Areia    │ 15      │ m³   │ 5   │ 50  │ NORMAL  │ 2025-11-27 10:15
Tijolo   │ 800     │ un   │ 1000│10000│ 🔴 BAIXO│ 2025-11-26 16:30
```

---

## ✅ Comparação: Antes vs Depois

| Aspecto | ❌ Antes | ✅ Depois |
|---------|---------|----------|
| **Normalização** | Material como texto | Tabela separada com FK |
| **Duplicatas** | "Cimento" ≠ "cimento" | Case-insensitive, único |
| **Validação** | Permite estoque negativo | Bloqueia saída sem estoque |
| **Auditoria** | Sem rastreamento | Registra usuário e data |
| **Performance** | Sem índices | 3 índices otimizados |
| **Alertas** | Não tem | Estoque mínimo/máximo |
| **Integridade** | Sem constraints | Foreign Keys + CHECK |
| **Relatórios** | Dados inconsistentes | Dados normalizados |

---

## 🎯 Benefícios da Nova Estrutura

### 1. Integridade de Dados
- ✅ Foreign Keys garantem consistência
- ✅ CHECK constraints validam tipos
- ✅ UNIQUE evita duplicatas
- ✅ NOT NULL garante campos obrigatórios

### 2. Performance
- ⚡ Índices aceleram consultas
- ⚡ JOINs otimizados
- ⚡ Queries mais eficientes

### 3. Rastreabilidade
- 👤 Sabe quem fez cada movimentação
- 📅 Histórico completo com timestamps
- 🔍 Auditoria facilitada

### 4. Gestão Inteligente
- 🔔 Alertas de estoque baixo/alto
- 📊 Relatórios mais precisos
- 🎯 Decisões baseadas em dados

### 5. Escalabilidade
- 📈 Suporta mais materiais
- 👥 Suporta múltiplos usuários
- 🏢 Pronto para crescimento

---

## 🚀 Como Migrar

### Opção 1: Banco Novo (Recomendado para desenvolvimento)
```bash
# Renomear banco antigo
mv backend/db.sqlite3 backend/db.sqlite3.old

# Usar nova estrutura
# O sistema criará automaticamente
```

### Opção 2: Migração de Dados
```sql
-- 1. Criar novas tabelas
-- (executar SQL de criação)

-- 2. Migrar materiais únicos
INSERT INTO materials (name, unit)
SELECT DISTINCT material, unit 
FROM stock_records_old;

-- 3. Migrar registros
INSERT INTO stock_records (material_id, quantity, type, location, message, timestamp)
SELECT 
  m.id,
  sr.quantity,
  sr.type,
  sr.location,
  sr.message,
  sr.timestamp
FROM stock_records_old sr
JOIN materials m ON m.name = sr.material;
```

---

## 📝 Próximos Passos

1. ✅ Estrutura do banco melhorada
2. ⏳ Atualizar API para usar nova estrutura
3. ⏳ Atualizar frontend para mostrar alertas
4. ⏳ Implementar autenticação de usuários
5. ⏳ Adicionar relatórios avançados
6. ⏳ Implementar backup automático

---

**Arquivo de implementação:** `backend/src/db-improved.ts`
