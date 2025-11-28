const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.sqlite3');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erro ao conectar:', err);
    process.exit(1);
  }
});

console.log('=== VERIFICAÇÃO DO BANCO DE DADOS (ESTRUTURA MELHORADA) ===\n');

// Verificar tabelas
db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, tables) => {
  if (err) {
    console.error('Erro:', err);
    return;
  }

  console.log('📋 TABELAS NO BANCO:');
  console.log('─'.repeat(50));
  tables.forEach(t => console.log(`  • ${t.name}`));
  console.log('─'.repeat(50));
  console.log();

  // Verificar usuários
  db.all('SELECT * FROM users', (err, users) => {
    if (err) {
      console.log('⚠️  Tabela users não existe\n');
    } else {
      console.log('👥 USUÁRIOS:');
      console.log('─'.repeat(80));
      console.log('ID | Nome          | Email                  | Role    | Ativo');
      console.log('─'.repeat(80));
      users.forEach(u => {
        console.log(`${u.id}  | ${u.name.padEnd(13)} | ${u.email.padEnd(22)} | ${u.role.padEnd(7)} | ${u.active ? 'Sim' : 'Não'}`);
      });
      console.log('─'.repeat(80));
      console.log();
    }

    // Verificar materiais
    db.all('SELECT * FROM materials ORDER BY name', (err, materials) => {
      if (err) {
        console.log('⚠️  Tabela materials não existe\n');
      } else {
        console.log('📦 MATERIAIS CADASTRADOS:');
        console.log('─'.repeat(100));
        console.log('ID | Nome          | Unidade | Estoque Mín | Estoque Máx | Ativo');
        console.log('─'.repeat(100));
        materials.forEach(m => {
          console.log(`${m.id.toString().padEnd(2)} | ${(m.name || '').padEnd(13)} | ${(m.unit || 'un').padEnd(7)} | ${(m.min_stock || 0).toString().padEnd(11)} | ${(m.max_stock || '-').toString().padEnd(11)} | ${m.active ? 'Sim' : 'Não'}`);
        });
        console.log('─'.repeat(100));
        console.log();
      }

      // Verificar registros com JOIN
      db.all(`
        SELECT 
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
      `, (err, records) => {
        if (err) {
          console.error('Erro ao buscar registros:', err);
        } else {
          console.log('📋 REGISTROS DE MOVIMENTAÇÃO:');
          console.log('─'.repeat(120));
          console.log('ID | Material      | Qtd      | Unidade | Tipo    | Local           | Usuário    | Data/Hora');
          console.log('─'.repeat(120));
          records.forEach(r => {
            const id = r.id.toString().padEnd(2);
            const material = (r.material || '').padEnd(13);
            const qty = r.quantity.toString().padStart(8);
            const unit = (r.unit || 'un').padEnd(7);
            const type = (r.type || '').padEnd(7);
            const location = (r.location || '-').padEnd(15);
            const user = (r.user_name || 'Sistema').padEnd(10);
            const timestamp = r.timestamp || '';
            
            console.log(`${id} | ${material} | ${qty} | ${unit} | ${type} | ${location} | ${user} | ${timestamp}`);
          });
          console.log('─'.repeat(120));
          console.log(`\nTotal de registros: ${records.length}\n`);
        }

        // Calcular estoque atual
        db.all(`
          SELECT 
            m.name as material,
            SUM(sr.quantity) as total,
            m.unit,
            m.min_stock,
            CASE 
              WHEN SUM(sr.quantity) <= m.min_stock 
              THEN '🔴 BAIXO'
              ELSE '🟢 NORMAL'
            END as status
          FROM materials m
          LEFT JOIN stock_records sr ON m.id = sr.material_id
          WHERE m.active = 1
          GROUP BY m.id, m.name, m.unit, m.min_stock
          ORDER BY m.name
        `, (err, summary) => {
          if (err) {
            console.error('Erro ao calcular estoque:', err);
          } else {
            console.log('📊 ESTOQUE ATUAL:');
            console.log('─'.repeat(80));
            console.log('Material      | Quantidade | Unidade | Mínimo | Status');
            console.log('─'.repeat(80));
            summary.forEach(s => {
              const material = (s.material || '').padEnd(13);
              const total = (s.total || 0).toString().padStart(10);
              const unit = (s.unit || 'un').padEnd(7);
              const min = (s.min_stock || 0).toString().padStart(6);
              const status = s.status || '';
              
              console.log(`${material} | ${total} | ${unit} | ${min} | ${status}`);
            });
            console.log('─'.repeat(80));
          }

          console.log('\n✅ Verificação concluída!\n');
          db.close();
        });
      });
    });
  });
});
