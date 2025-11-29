// Reset - Limpar banco de dados

import { dbPostgres } from './db';

async function reset() {
  console.log('🗑️  Limpando banco de dados...\n');

  try {
    // Deletar registros (ordem importa por causa das Foreign Keys)
    console.log('📝 Deletando registros de estoque...');
    await dbPostgres.query('DELETE FROM stock_records');
    const recordsResult = await dbPostgres.query('SELECT COUNT(*) FROM stock_records');
    console.log(`   ✅ ${recordsResult.rows[0].count} registros restantes\n`);

    console.log('📦 Deletando materiais...');
    await dbPostgres.query('DELETE FROM materials');
    const materialsResult = await dbPostgres.query('SELECT COUNT(*) FROM materials');
    console.log(`   ✅ ${materialsResult.rows[0].count} materiais restantes\n`);

    console.log('👥 Deletando usuários (exceto Sistema)...');
    await dbPostgres.query("DELETE FROM users WHERE email != 'sistema@buildstock.com'");
    const usersResult = await dbPostgres.query('SELECT COUNT(*) FROM users');
    console.log(`   ✅ ${usersResult.rows[0].count} usuário(s) restante(s)\n`);

    // Resetar sequences
    console.log('🔄 Resetando sequences...');
    await dbPostgres.query('ALTER SEQUENCE materials_id_seq RESTART WITH 1');
    await dbPostgres.query('ALTER SEQUENCE stock_records_id_seq RESTART WITH 1');
    console.log('   ✅ Sequences resetadas\n');

    console.log('✅ Banco de dados limpo com sucesso!\n');
    console.log('💡 Execute "npm run seed" para popular com dados de exemplo.\n');

  } catch (error) {
    console.error('\n❌ Erro ao limpar banco:', error);
    throw error;
  } finally {
    await dbPostgres.close();
  }
}

// Executar reset
reset().catch(console.error);
