// Seed - Popular banco de dados com dados de exemplo

import { dbPostgres } from './db';

async function seed() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  try {
    // 1. Verificar se já tem dados
    const checkUsers = await dbPostgres.query('SELECT COUNT(*) FROM users');
    const checkMaterials = await dbPostgres.query('SELECT COUNT(*) FROM materials');
    
    const userCount = parseInt(checkUsers.rows[0].count);
    const materialCount = parseInt(checkMaterials.rows[0].count);

    if (userCount > 1 || materialCount > 0) {
      console.log('⚠️  Banco já possui dados. Deseja continuar? (isso pode criar duplicatas)');
      console.log(`   Usuários: ${userCount}, Materiais: ${materialCount}`);
      console.log('   Para forçar seed, limpe o banco primeiro.\n');
      return;
    }

    // 2. Criar usuários de exemplo
    console.log('👥 Criando usuários...');
    
    const users = [
      { name: 'João Silva', email: 'joao@buildstock.com', role: 'admin' },
      { name: 'Maria Santos', email: 'maria@buildstock.com', role: 'operador' },
      { name: 'Pedro Costa', email: 'pedro@buildstock.com', role: 'visualizador' },
    ];

    for (const user of users) {
      const result = await dbPostgres.query(
        'INSERT INTO users (name, email, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id',
        [user.name, user.email, user.role]
      );
      if (result.rows.length > 0) {
        console.log(`   ✅ ${user.name} (${user.role})`);
      } else {
        console.log(`   ⏭️  ${user.name} já existe`);
      }
    }

    // 3. Criar materiais com limites de estoque
    console.log('\n📦 Criando materiais...');
    
    const materials = [
      { name: 'Cimento', unit: 'saco', min_stock: 20, max_stock: 100, description: 'Cimento Portland CP-II' },
      { name: 'Areia', unit: 'm³', min_stock: 10, max_stock: 50, description: 'Areia média lavada' },
      { name: 'Brita', unit: 'm³', min_stock: 10, max_stock: 50, description: 'Brita 1' },
      { name: 'Tijolo', unit: 'un', min_stock: 2000, max_stock: 10000, description: 'Tijolo cerâmico 6 furos' },
      { name: 'Telha', unit: 'un', min_stock: 500, max_stock: 3000, description: 'Telha cerâmica colonial' },
      { name: 'Ferro', unit: 'kg', min_stock: 50, max_stock: 500, description: 'Ferro CA-50 8mm' },
      { name: 'Madeira', unit: 'm', min_stock: 100, max_stock: 500, description: 'Madeira pinus 3x3' },
      { name: 'Tinta', unit: 'lata', min_stock: 10, max_stock: 100, description: 'Tinta acrílica branca 18L' },
      { name: 'Cal', unit: 'saco', min_stock: 15, max_stock: 80, description: 'Cal hidratada' },
      { name: 'Prego', unit: 'kg', min_stock: 5, max_stock: 50, description: 'Prego 18x30' },
    ];

    for (const material of materials) {
      const result = await dbPostgres.query(
        'INSERT INTO materials (name, unit, min_stock, max_stock, description) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name) DO NOTHING RETURNING id',
        [material.name, material.unit, material.min_stock, material.max_stock, material.description]
      );
      if (result.rows.length > 0) {
        console.log(`   ✅ ${material.name} (${material.unit}) - Min: ${material.min_stock}, Max: ${material.max_stock}`);
      } else {
        console.log(`   ⏭️  ${material.name} já existe`);
      }
    }

    // 4. Criar registros de estoque (entradas iniciais)
    console.log('\n📝 Criando registros de estoque...');
    
    const stockRecords = [
      { material: 'Cimento', quantity: 50, type: 'entrada', location: 'Depósito A', message: 'Estoque inicial' },
      { material: 'Areia', quantity: 25, type: 'entrada', location: 'Pátio', message: 'Estoque inicial' },
      { material: 'Brita', quantity: 20, type: 'entrada', location: 'Pátio', message: 'Estoque inicial' },
      { material: 'Tijolo', quantity: 5000, type: 'entrada', location: 'Depósito B', message: 'Estoque inicial' },
      { material: 'Telha', quantity: 1500, type: 'entrada', location: 'Depósito B', message: 'Estoque inicial' },
      { material: 'Ferro', quantity: 200, type: 'entrada', location: 'Depósito C', message: 'Estoque inicial' },
      { material: 'Madeira', quantity: 300, type: 'entrada', location: 'Depósito C', message: 'Estoque inicial' },
      { material: 'Tinta', quantity: 30, type: 'entrada', location: 'Almoxarifado', message: 'Estoque inicial' },
      { material: 'Cal', quantity: 40, type: 'entrada', location: 'Depósito A', message: 'Estoque inicial' },
      { material: 'Prego', quantity: 25, type: 'entrada', location: 'Almoxarifado', message: 'Estoque inicial' },
      
      // Algumas saídas para simular movimentação
      { material: 'Cimento', quantity: 10, type: 'saida', location: 'Obra Residencial', message: 'Fundação' },
      { material: 'Areia', quantity: 5, type: 'saida', location: 'Obra Residencial', message: 'Contrapiso' },
      { material: 'Tijolo', quantity: 1000, type: 'saida', location: 'Obra Comercial', message: 'Alvenaria' },
      { material: 'Ferro', quantity: 50, type: 'saida', location: 'Obra Residencial', message: 'Estrutura' },
      { material: 'Tinta', quantity: 5, type: 'saida', location: 'Obra Comercial', message: 'Pintura externa' },
    ];

    for (const record of stockRecords) {
      // Buscar ID do material
      const materialResult = await dbPostgres.query(
        'SELECT id FROM materials WHERE name = $1',
        [record.material]
      );

      if (materialResult.rows.length > 0) {
        const materialId = materialResult.rows[0].id;
        const qty = record.type === 'saida' ? -Math.abs(record.quantity) : Math.abs(record.quantity);

        await dbPostgres.query(
          'INSERT INTO stock_records (material_id, user_id, quantity, type, location, message) VALUES ($1, $2, $3, $4, $5, $6)',
          [materialId, 1, qty, record.type, record.location, record.message]
        );

        const icon = record.type === 'entrada' ? '➕' : '➖';
        console.log(`   ${icon} ${record.material}: ${record.quantity} ${record.type} - ${record.location}`);
      }
    }

    // 5. Mostrar resumo
    console.log('\n📊 Resumo do Seed:');
    
    const finalUsers = await dbPostgres.query('SELECT COUNT(*) FROM users');
    const finalMaterials = await dbPostgres.query('SELECT COUNT(*) FROM materials');
    const finalRecords = await dbPostgres.query('SELECT COUNT(*) FROM stock_records');
    
    console.log(`   👥 Usuários: ${finalUsers.rows[0].count}`);
    console.log(`   📦 Materiais: ${finalMaterials.rows[0].count}`);
    console.log(`   📝 Registros: ${finalRecords.rows[0].count}`);

    // 6. Mostrar estoque atual
    console.log('\n📈 Estoque Atual:');
    const summary = await dbPostgres.getSummary();
    
    summary.forEach(item => {
      const statusIcon = item.status === 'baixo' ? '🔴' : item.status === 'alto' ? '🟡' : '🟢';
      console.log(`   ${statusIcon} ${item.material}: ${item.total} ${item.unit}`);
    });

    console.log('\n✅ Seed concluído com sucesso!\n');

  } catch (error) {
    console.error('\n❌ Erro ao executar seed:', error);
    throw error;
  } finally {
    await dbPostgres.close();
  }
}

// Executar seed
seed().catch(console.error);
