# 🔐 Autenticação - Preparada mas Opcional

## 📋 Status Atual

✅ **Estrutura pronta** - Tabela `users` criada  
✅ **Foreign Keys** - Relacionamento configurado  
⏸️ **Login desabilitado** - Sistema funciona sem autenticação  
🔓 **Acesso livre** - Todos podem usar o sistema  

---

## 🏗️ Estrutura Preparada

### Tabela `users` (já existe)

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

### Relacionamento com `stock_records`

```sql
CREATE TABLE stock_records (
  ...
  user_id INTEGER,  -- NULL = sem autenticação
  ...
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 🔄 Como Funciona Agora (Sem Autenticação)

### 1. Registro de Movimentação

```typescript
// user_id é NULL por padrão
await insertRecord(
  'Cimento',    // material
  50,           // quantity
  'entrada',    // type
  null,         // userId = null (sem autenticação)
  'Depósito A', // location
  'Compra'      // message
);
```

### 2. Consultas

```sql
-- Mostra "Sistema" quando não há usuário
SELECT 
  sr.*,
  COALESCE(u.name, 'Sistema') as user_name
FROM stock_records sr
LEFT JOIN users u ON sr.user_id = u.id;
```

**Resultado:**
```
id │ material │ quantity │ user_name
───┼──────────┼──────────┼───────────
1  │ Cimento  │ 50       │ Sistema
2  │ Areia    │ 15       │ Sistema
```

---

## 🚀 Quando Implementar Autenticação

### Passo 1: Backend - Adicionar Rotas de Auth

```typescript
// backend/src/auth.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Buscar usuário
  const user = await db.getUserByEmail(email);
  
  // Validar senha
  const valid = await bcrypt.compare(password, user.password_hash);
  
  if (valid) {
    // Gerar token JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      'SECRET_KEY',
      { expiresIn: '24h' }
    );
    
    res.json({ token, user: { id: user.id, name: user.name } });
  } else {
    res.status(401).json({ error: 'Credenciais inválidas' });
  }
});

// Middleware de autenticação
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  
  try {
    const decoded = jwt.verify(token, 'SECRET_KEY');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// Proteger rotas
app.post('/api/stock', authMiddleware, async (req, res) => {
  const userId = req.userId; // Pega do token
  // ... resto do código
});
```

### Passo 2: Adicionar Campo de Senha

```sql
-- Adicionar coluna de senha
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Atualizar usuário padrão com senha
UPDATE users 
SET password_hash = '$2b$10$...' -- hash de 'admin123'
WHERE id = 1;
```

### Passo 3: Frontend - Tela de Login

```typescript
// frontend/src/login.ts
async function login(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (response.ok) {
    // Salvar token
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    // Redirecionar para dashboard
    window.location.href = '/dashboard';
  } else {
    alert('Login falhou: ' + data.error);
  }
}
```

### Passo 4: Frontend - Enviar Token nas Requisições

```typescript
// frontend/src/api.ts
async function submitStock(data: StockData) {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/stock', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` // Envia token
    },
    body: JSON.stringify(data)
  });
  
  return response.json();
}
```

### Passo 5: Frontend - Tela de Login HTML

```html
<!-- frontend/login.html -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>Login - BuildStock</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
  <div class="container">
    <div class="row justify-content-center mt-5">
      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <h3 class="text-center mb-4">🏗️ BuildStock</h3>
            <form id="loginForm">
              <div class="mb-3">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" id="email" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Senha</label>
                <input type="password" class="form-control" id="password" required>
              </div>
              <button type="submit" class="btn btn-primary w-100">Entrar</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
```

---

## 📊 Comparação: Antes e Depois da Autenticação

| Aspecto | 🔓 Sem Autenticação (Atual) | 🔐 Com Autenticação (Futuro) |
|---------|----------------------------|------------------------------|
| **Acesso** | Livre, qualquer um | Apenas usuários cadastrados |
| **user_id** | NULL | ID do usuário logado |
| **Rastreamento** | "Sistema" | Nome do usuário real |
| **Segurança** | Baixa | Alta |
| **Auditoria** | Limitada | Completa |
| **Permissões** | Todos fazem tudo | Por role (admin, operador) |

---

## 🎯 Níveis de Permissão (Quando Implementar)

### 1. Administrador (`role = 'admin'`)
- ✅ Criar/editar/excluir materiais
- ✅ Registrar entradas e saídas
- ✅ Ver todos os relatórios
- ✅ Gerenciar usuários
- ✅ Configurar sistema

### 2. Operador (`role = 'operador'`)
- ✅ Registrar entradas e saídas
- ✅ Ver estoque atual
- ✅ Ver histórico
- ❌ Gerenciar usuários
- ❌ Excluir registros

### 3. Visualizador (`role = 'visualizador'`)
- ✅ Ver estoque atual
- ✅ Ver relatórios
- ❌ Registrar movimentações
- ❌ Editar dados
- ❌ Gerenciar usuários

---

## 🔒 Exemplo de Middleware de Permissões

```typescript
// Verificar se usuário tem permissão
function checkPermission(requiredRole: string) {
  return (req, res, next) => {
    const userRole = req.user.role;
    
    const roleHierarchy = {
      'admin': 3,
      'operador': 2,
      'visualizador': 1
    };
    
    if (roleHierarchy[userRole] >= roleHierarchy[requiredRole]) {
      next();
    } else {
      res.status(403).json({ error: 'Permissão negada' });
    }
  };
}

// Usar nas rotas
app.post('/api/stock', authMiddleware, checkPermission('operador'), ...);
app.delete('/api/stock/:id', authMiddleware, checkPermission('admin'), ...);
app.get('/api/stock', authMiddleware, checkPermission('visualizador'), ...);
```

---

## 📦 Pacotes Necessários (Quando Implementar)

```bash
# Backend
npm install jsonwebtoken bcrypt
npm install --save-dev @types/jsonwebtoken @types/bcrypt

# Frontend (opcional)
npm install jwt-decode
```

---

## 🗂️ Estrutura de Arquivos (Quando Implementar)

```
backend/
├── src/
│   ├── auth.ts           # ← Novo: Lógica de autenticação
│   ├── middleware.ts     # ← Novo: Middlewares (auth, permissions)
│   ├── db-improved.ts    # ✅ Já existe
│   └── server.ts         # Atualizar para usar auth

frontend/
├── login.html            # ← Novo: Tela de login
├── src/
│   ├── auth.ts           # ← Novo: Funções de login/logout
│   └── main.ts           # Atualizar para enviar token
```

---

## ✅ Checklist para Implementar Autenticação

### Backend
- [ ] Instalar `jsonwebtoken` e `bcrypt`
- [ ] Adicionar coluna `password_hash` na tabela `users`
- [ ] Criar arquivo `auth.ts` com login/logout
- [ ] Criar middleware de autenticação
- [ ] Criar middleware de permissões
- [ ] Proteger rotas com middlewares
- [ ] Atualizar `insertRecord` para usar `userId` do token

### Frontend
- [ ] Criar tela de login (`login.html`)
- [ ] Criar funções de autenticação (`auth.ts`)
- [ ] Salvar token no localStorage
- [ ] Enviar token em todas as requisições
- [ ] Redirecionar para login se não autenticado
- [ ] Mostrar nome do usuário logado
- [ ] Adicionar botão de logout

### Testes
- [ ] Testar login com credenciais válidas
- [ ] Testar login com credenciais inválidas
- [ ] Testar acesso sem token
- [ ] Testar acesso com token expirado
- [ ] Testar permissões por role
- [ ] Testar logout

---

## 🎯 Resumo

**Status Atual:**
- ✅ Estrutura do banco pronta
- ✅ Relacionamentos configurados
- ✅ Sistema funciona sem autenticação
- ✅ Fácil de ativar quando necessário

**Quando Implementar:**
- 🔐 Adicionar rotas de login/logout
- 🔐 Criar tela de login
- 🔐 Proteger rotas com middleware
- 🔐 Enviar token nas requisições
- 🔐 Implementar permissões por role

**Vantagens:**
- 🚀 Sistema já funciona
- 🔧 Fácil de adicionar depois
- 📊 Dados já preparados
- 🎯 Sem retrabalho
