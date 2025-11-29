import { Pool, PoolClient } from 'pg';

// Configuração do PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'buildstock',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20, // Máximo de conexões no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export class DatabasePostgres {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async init(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Criar extensões úteis
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

      // Tabela de Usuários
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          role VARCHAR(50) DEFAULT 'operador',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          active BOOLEAN DEFAULT true
        )
      `);

      // Tabela de Materiais
      await client.query(`
        CREATE TABLE IF NOT EXISTS materials (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          unit VARCHAR(50) DEFAULT 'un',
          min_stock DECIMAL(10,2) DEFAULT 0,
          max_stock DECIMAL(10,2),
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          active BOOLEAN DEFAULT true
        )
      `);

      // Tabela de Registros
      await client.query(`
        CREATE TABLE IF NOT EXISTS stock_records (
          id SERIAL PRIMARY KEY,
          material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          quantity DECIMAL(10,2) NOT NULL,
          type VARCHAR(20) NOT NULL CHECK(type IN ('entrada', 'saida')),
          location VARCHAR(255),
          message TEXT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Criar índices
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_stock_material 
        ON stock_records(material_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_stock_timestamp 
        ON stock_records(timestamp DESC)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_stock_type 
        ON stock_records(type)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_materials_name 
        ON materials(LOWER(name))
      `);

      // Inserir usuário padrão
      await client.query(`
        INSERT INTO users (id, name, email, role) 
        VALUES (1, 'Sistema', 'sistema@buildstock.com', 'admin')
        ON CONFLICT (email) DO NOTHING
      `);

      console.log('✓ Banco de dados PostgreSQL inicializado');
    } finally {
      client.release();
    }
  }

  async validateStock(materialId: number, quantity: number): Promise<{ valid: boolean; currentStock: number }> {
    const result = await this.pool.query(
      `SELECT COALESCE(SUM(quantity), 0) as current_stock
       FROM stock_records 
       WHERE material_id = $1`,
      [materialId]
    );

    const currentStock = parseFloat(result.rows[0]?.current_stock || '0');
    return {
      valid: currentStock >= quantity,
      currentStock: currentStock
    };
  }

  async getOrCreateMaterial(name: string, unit: string = 'un'): Promise<number> {
    const client = await this.pool.connect();
    try {
      // Buscar material existente (case-insensitive)
      const result = await client.query(
        'SELECT id FROM materials WHERE LOWER(name) = LOWER($1)',
        [name]
      );

      if (result.rows.length > 0) {
        return result.rows[0].id;
      }

      // Criar novo material
      const insertResult = await client.query(
        'INSERT INTO materials (name, unit) VALUES ($1, $2) RETURNING id',
        [name, unit]
      );

      return insertResult.rows[0].id;
    } finally {
      client.release();
    }
  }

  async insertRecord(
    materialName: string,
    quantity: number,
    type: string,
    userId: number | null = null,
    location?: string,
    message?: string,
    unit?: string
  ): Promise<{ success: boolean; id?: number; error?: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Obter ou criar material
      const materialId = await this.getOrCreateMaterial(materialName, unit || 'un');

      // Validar estoque para saídas
      if (type === 'saida') {
        const stockCheck = await this.validateStock(materialId, quantity);
        if (!stockCheck.valid) {
          await client.query('ROLLBACK');
          return {
            success: false,
            error: `Estoque insuficiente de "${materialName}"! Disponível: ${stockCheck.currentStock.toFixed(2)} ${unit || 'un'}, Solicitado: ${quantity.toFixed(2)} ${unit || 'un'}`
          };
        }
      }

      // Inserir registro
      const result = await client.query(
        `INSERT INTO stock_records 
         (material_id, user_id, quantity, type, location, message) 
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          materialId,
          userId,
          type === 'saida' ? -Math.abs(quantity) : Math.abs(quantity),
          type,
          location || null,
          message || null
        ]
      );

      await client.query('COMMIT');
      return { success: true, id: result.rows[0].id };
    } catch (error) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: String(error)
      };
    } finally {
      client.release();
    }
  }

  async getAllRecords(): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT 
        sr.id,
        m.name as material,
        sr.quantity,
        m.unit,
        sr.type,
        sr.location,
        sr.message,
        sr.timestamp,
        COALESCE(u.name, 'Sistema') as user_name
       FROM stock_records sr
       JOIN materials m ON sr.material_id = m.id
       LEFT JOIN users u ON sr.user_id = u.id
       ORDER BY sr.timestamp DESC 
       LIMIT 1000`
    );

    // Converter quantity de string para número
    return result.rows.map(row => ({
      ...row,
      quantity: parseFloat(row.quantity)
    }));
  }

  async getSummary(): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT 
        m.id,
        m.name as material,
        COALESCE(SUM(sr.quantity), 0) as total,
        m.unit,
        m.min_stock,
        m.max_stock,
        MAX(sr.timestamp) as last_update,
        CASE 
          WHEN COALESCE(SUM(sr.quantity), 0) <= m.min_stock THEN 'baixo'
          WHEN COALESCE(SUM(sr.quantity), 0) >= COALESCE(m.max_stock, 999999) THEN 'alto'
          ELSE 'normal'
        END as status
       FROM materials m
       LEFT JOIN stock_records sr ON m.id = sr.material_id
       WHERE m.active = true
       GROUP BY m.id, m.name, m.unit, m.min_stock, m.max_stock
       ORDER BY m.name`
    );

    // Converter valores numéricos de string para número
    return result.rows.map(row => ({
      ...row,
      total: parseFloat(row.total),
      min_stock: parseFloat(row.min_stock),
      max_stock: row.max_stock ? parseFloat(row.max_stock) : null
    }));
  }

  async getDashboardData(): Promise<{
    labels: string[];
    values: number[];
    latest: any[];
    stats: {
      totalMaterials: number;
      totalRecords: number;
      totalEntradas: number;
      totalSaidas: number;
      lowStock: number;
    };
  }> {
    // Buscar resumo
    const summaryResult = await this.pool.query(
      `SELECT 
        m.name as material,
        COALESCE(SUM(sr.quantity), 0) as total
       FROM materials m
       LEFT JOIN stock_records sr ON m.id = sr.material_id
       WHERE m.active = true
       GROUP BY m.id, m.name`
    );

    // Buscar últimos registros
    const latestResult = await this.pool.query(
      `SELECT 
        sr.id,
        m.name as material,
        sr.quantity,
        m.unit,
        sr.type,
        sr.location,
        sr.message,
        sr.timestamp,
        COALESCE(u.name, 'Sistema') as user_name
       FROM stock_records sr
       JOIN materials m ON sr.material_id = m.id
       LEFT JOIN users u ON sr.user_id = u.id
       ORDER BY sr.timestamp DESC 
       LIMIT 20`
    );

    // Buscar estatísticas
    const statsResult = await this.pool.query(
      `SELECT 
        COUNT(DISTINCT m.id) as total_materials,
        COUNT(sr.id) as total_records,
        SUM(CASE WHEN sr.type = 'entrada' THEN 1 ELSE 0 END) as total_entradas,
        SUM(CASE WHEN sr.type = 'saida' THEN 1 ELSE 0 END) as total_saidas
       FROM materials m
       LEFT JOIN stock_records sr ON m.id = sr.material_id
       WHERE m.active = true`
    );

    // Contar materiais com estoque baixo
    const lowStockResult = await this.pool.query(
      `SELECT COUNT(*) as low_stock
       FROM (
         SELECT 
           m.id,
           COALESCE(SUM(sr.quantity), 0) as total,
           m.min_stock
         FROM materials m
         LEFT JOIN stock_records sr ON m.id = sr.material_id
         WHERE m.active = true
         GROUP BY m.id, m.min_stock
         HAVING COALESCE(SUM(sr.quantity), 0) <= m.min_stock
       ) sub`
    );

    const labels = summaryResult.rows.map((r: any) => r.material);
    const values = summaryResult.rows.map((r: any) => parseFloat(r.total || '0'));

    // Converter quantity de string para número no latest
    const latest = latestResult.rows.map(row => ({
      ...row,
      quantity: parseFloat(row.quantity)
    }));

    return {
      labels,
      values,
      latest,
      stats: {
        totalMaterials: parseInt(statsResult.rows[0]?.total_materials || '0'),
        totalRecords: parseInt(statsResult.rows[0]?.total_records || '0'),
        totalEntradas: parseInt(statsResult.rows[0]?.total_entradas || '0'),
        totalSaidas: parseInt(statsResult.rows[0]?.total_saidas || '0'),
        lowStock: parseInt(lowStockResult.rows[0]?.low_stock || '0')
      }
    };
  }

  async getAllMaterials(): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT * FROM materials WHERE active = true ORDER BY name'
    );
    return result.rows;
  }

  async getAllUsers(): Promise<any[]> {
    const result = await this.pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE active = true ORDER BY name'
    );
    return result.rows;
  }

  async updateMaterialLimits(
    materialId: number,
    minStock: number,
    maxStock: number | null
  ): Promise<{ success: boolean; error?: string }> {
    const result = await this.pool.query(
      'UPDATE materials SET min_stock = $1, max_stock = $2 WHERE id = $3',
      [minStock, maxStock, materialId]
    );

    if (result.rowCount === 0) {
      return { success: false, error: 'Material não encontrado' };
    }

    return { success: true };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // Métodos públicos para acesso direto ao pool (para seed e reset)
  async query(text: string, params?: any[]): Promise<any> {
    return this.pool.query(text, params);
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }
}

export const dbPostgres = new DatabasePostgres();
