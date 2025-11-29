# 🔐 Como Ativar Autenticação

## ✅ O que já está pronto:

- ✅ Tabela `users` com campo `password_hash`
- ✅ Roles configurados (admin, operador, visualizador)
- ✅ Foreign Keys em `stock_records`
- ✅ Arquivo de configuração (`backend/src/config.ts`)
- ✅ Variáveis de ambiente preparadas

---

## 🚀 Ativação em 5 Passos:

### 1️⃣ Instalar Dependências

```bash
cd backend
npm install bcrypt jsonwebtoken
npm install --save-dev @types/bcrypt @types/jsonwebtoken
```

### 2️⃣ Configurar Variáveis de Ambiente

Edite `.env` (ou crie a partir de `.env.example`):

```env
# Ativar autenticação
AUTH_ENABLED=true

# Gerar chaves secretas seguras:
# openssl rand -base64 32
JWT_SECRET=sua_chave_jwt_super_secreta_aqui
SESSION_SECRET=sua_chave_session_super_secreta_aqui
```

### 3️⃣ Criar Rotas de Autenticação

Crie `backend/src/auth.ts`:

```typescript
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { dbPostgres } from './db';

// Registrar usuário
export async function register(name: string, email: string, password: string, role: string = 'operador') {
  const passwordHash = await bcrypt.hash(password, 10);
  
  // Inserir no banco
  const result = await dbPostgres.pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
    [name, email, passwordHash, role]
  );
  
  return result.rows[0];
}

// Login
export async function login(email: string, password: string) {
  const result = await dbPostgres.pool.query(
    'SELECT * FROM users WHERE email = $1 AND active = true',
    [email]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Usuário não encontrado');
  }
  
  const user = result.rows[0];
  
  if (!user.password_hash) {
    throw new Error('Usuário sem senha configurada');
  }
  
  const valid = await bcrypt.compare(password, user.password_hash);
  
  if (!valid) {
    throw new Error('Senha incorreta');
  }
  
  // Gerar token JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
  
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
}

// Middleware de autenticação
export function authMiddleware(req: any, res: any, next: any) {
  if (!config.auth.enabled) {
    return next(); // Autenticação desativada
  }
  
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Middleware de permissões
export function requireRole(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!config.auth.enabled) {
      return next(); // Autenticação desativada
    }
    
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    
    next();
  };
}
```

### 4️⃣ Adicionar Rotas no Server

Edite `backend/src/server.ts`:

```typescript
import { login, register, authMiddleware, requireRole } from './auth';
import { config } from './config';

// Rotas de autenticação
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await register(name, email, password, role);
    res.json({ ok: true, user });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await login(email, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: String(error) });
  }
});

// Proteger rotas (opcional)
app.post('/api/stock', authMiddleware, requireRole('admin', 'operador'), async (req, res) => {
  // ... código existente
});
```

### 5️⃣ Criar Tela de Login no Frontend

Crie `frontend/login.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Login - BuildStock</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
  <div class="container">
    <div class="row justify-content-center mt-5">
      <div class="col-md-4">
        <div class="card shadow">
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
            <div id="error" class="alert alert-danger mt-3" style="display:none;"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          window.location.href = '/';
        } else {
          document.getElementById('error').textContent = data.error;
          document.getElementById('error').style.display = 'block';
        }
      } catch (error) {
        document.getElementById('error').textContent = 'Erro ao conectar';
        document.getElementById('error').style.display = 'block';
      }
    });
  </script>
</body>
</html>
```

---

## 🔄 Desativar Autenticação

Para desativar novamente:

```env
AUTH_ENABLED=false
```

Ou simplesmente comente/remova a linha do `.env`.

---

## 🧪 Testar

### Criar primeiro usuário admin:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin",
    "email": "admin@buildstock.com",
    "password": "senha123",
    "role": "admin"
  }'
```

### Fazer login:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@buildstock.com",
    "password": "senha123"
  }'
```

### Usar token nas requisições:

```bash
curl http://localhost:5000/api/stock \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

---

## 📋 Checklist de Ativação

- [ ] Instalar bcrypt e jsonwebtoken
- [ ] Configurar AUTH_ENABLED=true no .env
- [ ] Gerar JWT_SECRET e SESSION_SECRET
- [ ] Criar arquivo auth.ts
- [ ] Adicionar rotas de autenticação no server.ts
- [ ] Criar tela de login
- [ ] Testar registro de usuário
- [ ] Testar login
- [ ] Testar rotas protegidas
- [ ] Atualizar frontend para enviar token

---

## 🎯 Resumo

**Status Atual:** ⏸️ Preparado, mas desativado  
**Para Ativar:** Seguir os 5 passos acima  
**Tempo Estimado:** 30-60 minutos  

**Tudo pronto para quando você precisar!** 🔐
