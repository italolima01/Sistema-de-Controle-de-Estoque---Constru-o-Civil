// Configurações da aplicação

export const config = {
  // Autenticação
  auth: {
    enabled: process.env.AUTH_ENABLED === 'true', // false por padrão
    jwtSecret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    sessionSecret: process.env.SESSION_SECRET || 'change-this-session-secret',
  },

  // Banco de dados
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'buildstock',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },

  // Servidor
  server: {
    port: parseInt(process.env.PORT || '5000'),
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
  },

  // Logs
  logs: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE,
  },
};

// Log de configuração (apenas em desenvolvimento)
if (config.server.nodeEnv === 'development') {
  console.log('📋 Configurações:');
  console.log(`   - Autenticação: ${config.auth.enabled ? '✅ Ativada' : '⏸️  Desativada'}`);
  console.log(`   - Ambiente: ${config.server.nodeEnv}`);
  console.log(`   - Porta: ${config.server.port}`);
  console.log(`   - Banco: ${config.database.host}:${config.database.port}/${config.database.name}`);
}
