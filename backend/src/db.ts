import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = process.env.NODE_ENV === 'production' 
  ? '/app/data/db.sqlite3'
  : path.join(__dirname, '..', 'db.sqlite3');

export class DatabaseImproved {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Erro ao conectar ao banco:', err);
        process.exit(1);
      }
    });
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Tabela de Usuários
        this.db.run(
          `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT DEFAULT 'operador',
            created_at TEXT DEFAULT (datetime('now')),
            active INTEGER DEFAULT 1
          )`,
          (err) => {
            if (err) console.error('Erro ao criar tabela users:', err);
          }
        );

        // Tabela de Materiais (normalizada)
        this.db.run(
          `CREATE TABLE IF NOT EXISTS materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            unit TEXT DEFAULT 'un',
            min_stock REAL DEFAULT 0,
            max_stock REAL,
            description TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            active INTEGER DEFAULT 1
          )`,
          (err) => {
            if (err) console.error('Erro ao criar tabela materials:', err);
          }
        );

        // Tabela de Registros (melhorada)
        this.db.run(
          `CREATE TABLE IF NOT EXISTS stock_records (
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
          )`,
          (err) => {
            if (err) console.error('Erro ao criar tabela stock_records:', err);
          }
        );

        // Criar índices para performance
        this.db.run(
          `CREATE INDEX IF NOT EXISTS idx_stock_material 
           ON stock_records(material_id)`,
          (err) => {
            if (err) console.error('Erro ao criar índice:', err);
          }
        );

        this.db.run(
          `CREATE INDEX IF NOT EXISTS idx_stock_timestamp 
           ON stock_records(timestamp DESC)`,
          (err) => {
            if (err) console.error('Erro ao criar índice:', err);
          }
        );

        this.db.run(
          `CREATE INDEX IF NOT EXISTS idx_stock_type 
           ON stock_records(type)`,
          (err) => {
            if (err) console.error('Erro ao criar índice:', err);
            else resolve();
          }
        );

        // Inserir usuário padrão (para quando implementar autenticação)
        this.db.run(
          `INSERT OR IGNORE INTO users (id, name, email, role) 
           VALUES (1, 'Sistema', 'sistema@buildstock.com', 'admin')`,
          (err) => {
            if (err) console.error('Erro ao inserir usuário padrão:', err);
          }
        );
      });
    });
  }

  // Validar se há estoque suficiente antes de saída
  async validateStock(materialId: number, quantity: number): Promise<{ valid: boolean; currentStock: number }> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT 
          SUM(quantity) as current_stock
         FROM stock_records 
         WHERE material_id = ?`,
        [materialId],
        (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          const currentStock = row?.current_stock || 0;
          resolve({
            valid: currentStock >= quantity,
            currentStock: currentStock
          });
        }
      );
    });
  }

  // Inserir ou obter material
  async getOrCreateMaterial(name: string, unit: string = 'un'): Promise<number> {
    return new Promise((resolve, reject) => {
      // Tentar buscar material existente
      this.db.get(
        'SELECT id FROM materials WHERE name = ? COLLATE NOCASE',
        [name],
        (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (row) {
            resolve(row.id);
          } else {
            // Criar novo material
            this.db.run(
              'INSERT INTO materials (name, unit) VALUES (?, ?)',
              [name, unit],
              function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
              }
            );
          }
        }
      );
    });
  }

  // Inserir registro com validação
  // userId é opcional - se não informado, usa null (sem autenticação)
  async insertRecord(
    materialName: string,
    quantity: number,
    type: string,
    userId: number | null = null,
    location?: string,
    message?: string,
    unit?: string
  ): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
      // Obter ou criar material
      const materialId = await this.getOrCreateMaterial(materialName, unit || 'un');

      // Validar estoque para saídas
      if (type === 'saida') {
        const stockCheck = await this.validateStock(materialId, quantity);
        if (!stockCheck.valid) {
          return {
            success: false,
            error: `Estoque insuficiente de "${materialName}"! Disponível: ${stockCheck.currentStock.toFixed(2)} ${unit || 'un'}, Solicitado: ${quantity.toFixed(2)} ${unit || 'un'}`
          };
        }
      }

      // Inserir registro
      return new Promise((resolve, reject) => {
        this.db.run(
          `INSERT INTO stock_records 
           (material_id, user_id, quantity, type, location, message) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            materialId,
            userId,
            type === 'saida' ? -Math.abs(quantity) : Math.abs(quantity),
            type,
            location || null,
            message || null
          ],
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({ success: true, id: this.lastID });
            }
          }
        );
      });
    } catch (error) {
      return {
        success: false,
        error: String(error)
      };
    }
  }

  // Obter todos os registros com informações completas
  async getAllRecords(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
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
         LIMIT 1000`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // Obter resumo do estoque
  async getSummary(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT 
          m.id,
          m.name as material,
          SUM(sr.quantity) as total,
          m.unit,
          m.min_stock,
          m.max_stock,
          MAX(sr.timestamp) as last_update,
          CASE 
            WHEN SUM(sr.quantity) <= m.min_stock 
            THEN 'baixo'
            WHEN SUM(sr.quantity) >= COALESCE(m.max_stock, 999999)
            THEN 'alto'
            ELSE 'normal'
          END as status
         FROM materials m
         LEFT JOIN stock_records sr ON m.id = sr.material_id
         WHERE m.active = 1
         GROUP BY m.id, m.name, m.unit, m.min_stock, m.max_stock
         ORDER BY m.name`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // Obter estatísticas do dashboard
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
    return new Promise((resolve, reject) => {
      // Buscar resumo
      this.db.all(
        `SELECT 
          m.name as material,
          SUM(sr.quantity) as total
         FROM materials m
         LEFT JOIN stock_records sr ON m.id = sr.material_id
         WHERE m.active = 1
         GROUP BY m.id, m.name`,
        (err, summary) => {
          if (err) {
            reject(err);
            return;
          }

          // Buscar últimos registros
          this.db.all(
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
             LIMIT 20`,
            (err, latest) => {
              if (err) {
                reject(err);
                return;
              }

              // Buscar estatísticas
              this.db.get(
                `SELECT 
                  COUNT(DISTINCT m.id) as totalMaterials,
                  COUNT(sr.id) as totalRecords,
                  SUM(CASE WHEN sr.type = 'entrada' THEN 1 ELSE 0 END) as totalEntradas,
                  SUM(CASE WHEN sr.type = 'saida' THEN 1 ELSE 0 END) as totalSaidas
                 FROM materials m
                 LEFT JOIN stock_records sr ON m.id = sr.material_id
                 WHERE m.active = 1`,
                (err, stats: any) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  // Contar materiais com estoque baixo
                  this.db.get(
                    `SELECT COUNT(*) as lowStock
                     FROM (
                       SELECT 
                         m.id,
                         SUM(sr.quantity) as total,
                         m.min_stock
                       FROM materials m
                       LEFT JOIN stock_records sr ON m.id = sr.material_id
                       WHERE m.active = 1
                       GROUP BY m.id, m.min_stock
                       HAVING total <= m.min_stock
                     )`,
                    (err, lowStockRow: any) => {
                      if (err) {
                        reject(err);
                        return;
                      }

                      const labels = (summary || []).map((r: any) => r.material);
                      const values = (summary || []).map((r: any) => parseFloat(r.total || 0));

                      resolve({
                        labels,
                        values,
                        latest: latest || [],
                        stats: {
                          totalMaterials: stats?.totalMaterials || 0,
                          totalRecords: stats?.totalRecords || 0,
                          totalEntradas: stats?.totalEntradas || 0,
                          totalSaidas: stats?.totalSaidas || 0,
                          lowStock: lowStockRow?.lowStock || 0
                        }
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  }

  // Obter todos os materiais
  async getAllMaterials(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM materials WHERE active = 1 ORDER BY name',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // Obter todos os usuários
  async getAllUsers(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT id, name, email, role, created_at FROM users WHERE active = 1 ORDER BY name',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // Atualizar limites de estoque de um material
  async updateMaterialLimits(
    materialId: number,
    minStock: number,
    maxStock: number | null
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE materials SET min_stock = ?, max_stock = ? WHERE id = ?',
        [minStock, maxStock, materialId],
        function (err) {
          if (err) {
            reject(err);
          } else if (this.changes === 0) {
            resolve({ success: false, error: 'Material não encontrado' });
          } else {
            resolve({ success: true });
          }
        }
      );
    });
  }

  close(): void {
    this.db.close();
  }
}

export const dbImproved = new DatabaseImproved();
