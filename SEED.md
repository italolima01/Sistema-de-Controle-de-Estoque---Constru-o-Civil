# 🌱 Seed - Popular Banco de Dados

## O que é Seed?

Seed é o processo de popular o banco de dados com dados de exemplo para desenvolvimento e testes.

---

## 📦 Dados Incluídos no Seed

### 👥 Usuários (3):
```
1. João Silva    - admin         - joao@buildstock.com
2. Maria Santos  - operador      - maria@buildstock.com
3. Pedro Costa   - visualizador  - pedro@buildstock.com
```

### 📦 Materiais (10):
```
Material  | Unidade | Mín   | Máx    | Descrição
----------|---------|-------|--------|---------------------------
Cimento   | saco    | 20    | 100    | Cimento Portland CP-II
Areia     | m³      | 10    | 50     | Areia média lavada
Brita     | m³      | 10    | 50     | Brita 1
Tijolo    | un      | 2000  | 10000  | Tijolo cerâmico 6 furos
Telha     | un      | 500   | 3000   | Telha cerâmica colonial
Ferro     | kg      | 50    | 500    | Ferro CA-50 8mm
Madeira   | m       | 100   | 500    | Madeira pinus 3x3
Tinta     | lata    | 10    | 100    | Tinta acrílica branca 18L
Cal       | saco    | 15    | 80     | Cal hidratada
Prego     | kg      | 5     | 50     | Prego 18x30
```

### 📝 Registros de Estoque (15):

**Entradas (10):**
- Cimento: 50 sacos
- Areia: 25 m³
- Brita: 20 m³
- Tijolo: 5000 un
- Telha: 1500 un
- Ferro: 200 kg
- Madeira: 300 m
- Tinta: 30 latas
- Cal: 40 sacos
- Prego: 25 kg

**Saídas (5):**
- Cimento: -10 sacos (Obra Residencial)
- Areia: -5 m³ (Obra Residencial)
- Tijolo: -1000 un (Obra Comercial)
- Ferro: -50 kg (Obra Residencial)
- Tinta: -5 latas (Obra Comercial)

**Estoque Final:**
```
Material  | Estoque | Status
----------|---------|--------
Cimento   | 40      | 🟢 Normal
Areia     | 20      | 🟢 Normal
Brita     | 20      | 🟢 Normal
Tijolo    | 4000    | 🟢 Normal
Telha     | 1500    | 🟢 Normal
Ferro     | 150     | 🟢 Normal
Madeira   | 300     | 🟢 Normal
Tinta     | 25      | 🟢 Normal
Cal       | 40      | 🟢 Normal
Prego     | 25      | 🟢 Normal
```

---

## 🚀 Como Usar

### Desenvolvimento Local:

```bash
cd backend

# Popular banco com dados de exemplo
npm run seed

# Limpar banco (mantém usuário Sistema)
npm run reset

# Limpar e popular novamente
npm run reset && npm run seed
```

### Docker:

```bash
# Popular banco no container
npm run seed:docker

# Limpar banco no container
npm run reset:docker

# Limpar e popular
npm run reset:docker && npm run seed:docker
```

Ou diretamente:

```bash
# Popular
docker exec buildstock-backend npm run seed

# Limpar
docker exec buildstock-backend npm run reset
```

---

## ⚠️ Avisos

### Seed não sobrescreve dados existentes:
- ✅ Usa `ON CONFLICT DO NOTHING`
- ✅ Verifica se já tem dados antes
- ✅ Seguro executar múltiplas vezes

### Reset é destrutivo:
- ⚠️ Deleta TODOS os registros de estoque
- ⚠️ Deleta TODOS os materiais
- ⚠️ Deleta usuários (exceto Sistema)
- ⚠️ Não tem confirmação!

---

## 🧪 Casos de Uso

### 1. Desenvolvimento:
```bash
# Começar com dados de exemplo
npm run seed
```

### 2. Testes:
```bash
# Limpar antes de cada teste
npm run reset
npm run seed
# ... executar testes
```

### 3. Demo/Apresentação:
```bash
# Popular com dados realistas
npm run seed
```

### 4. Produção:
```bash
# NÃO executar seed em produção!
# Use apenas em desenvolvimento/staging
```

---

## 🔧 Personalizar Seed

Edite `backend/src/seed.ts` para:

- Adicionar mais usuários
- Adicionar mais materiais
- Ajustar quantidades
- Adicionar mais movimentações
- Simular cenários específicos

---

## 📊 Verificar Dados

### Via Docker:

```bash
# Ver usuários
docker exec buildstock-postgres psql -U postgres -d buildstock -c "SELECT * FROM users;"

# Ver materiais
docker exec buildstock-postgres psql -U postgres -d buildstock -c "SELECT * FROM materials;"

# Ver estoque atual
docker exec buildstock-postgres psql -U postgres -d buildstock -c "
  SELECT 
    m.name, 
    SUM(sr.quantity) as estoque,
    m.unit
  FROM materials m
  LEFT JOIN stock_records sr ON m.id = sr.material_id
  GROUP BY m.id, m.name, m.unit
  ORDER BY m.name;
"
```

### Via API:

```bash
# Resumo
curl http://localhost:5000/api/summary

# Todos os registros
curl http://localhost:5000/api/records

# Dashboard
curl http://localhost:5000/api/dashboard-data
```

---

## 🎯 Resumo

**Comandos:**
- `npm run seed` - Popular banco
- `npm run reset` - Limpar banco
- `npm run seed:docker` - Popular no Docker
- `npm run reset:docker` - Limpar no Docker

**Dados:**
- 3 usuários (+ 1 Sistema)
- 10 materiais com limites configurados
- 15 registros de movimentação
- Estoque realista para testes

**Segurança:**
- ✅ Não sobrescreve dados existentes
- ✅ Verifica antes de executar
- ⚠️ Reset é destrutivo (use com cuidado)

**Pronto para desenvolvimento!** 🌱
