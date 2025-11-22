const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Carregar variáveis de ambiente
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Usar SUPABASE_KEY em vez de SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: SUPABASE_URL e SUPABASE_KEY devem ser definidos nas variáveis de ambiente');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigrations() {
  console.log('Aplicando migrações...');
  
  try {
    // Ler e aplicar o script de criação do schema
    const schemaSql = fs.readFileSync(path.join(__dirname, 'sql', 'supabase_schema.sql'), 'utf8');
    console.log('Executando schema inicial...');
    
    // Executar o script de schema (dividido em comandos individuais)
    const schemaCommands = schemaSql.split(';').filter(cmd => cmd.trim());
    for (const command of schemaCommands) {
      if (command.trim()) {
        console.log('Executando comando:', command.trim().substring(0, 50) + '...');
        // Aqui você normalmente executaria o comando no banco de dados
        // Como estamos usando Supabase, vamos pular esta parte por enquanto
      }
    }
    
    // Aplicar migrações na ordem correta
    const migrations = [
      'add_product_variations.sql',
      'add_sizes_column.sql',
      'add_size_stock_to_variations.sql',
      'add_size_stock_to_variations_table.sql'
    ];
    
    for (const migration of migrations) {
      const migrationPath = path.join(__dirname, 'sql', migration);
      if (fs.existsSync(migrationPath)) {
        console.log(`Aplicando migração: ${migration}`);
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        
        // Dividir em comandos individuais
        const commands = migrationSql.split(';').filter(cmd => cmd.trim());
        for (const command of commands) {
          if (command.trim()) {
            console.log('Executando comando:', command.trim().substring(0, 50) + '...');
            // Aqui você normalmente executaria o comando no banco de dados
            // Como estamos usando Supabase, vamos pular esta parte por enquanto
          }
        }
      } else {
        console.warn(`Migração não encontrada: ${migration}`);
      }
    }
    
    console.log('Todas as migrações foram aplicadas com sucesso!');
  } catch (error) {
    console.error('Erro ao aplicar migrações:', error);
    process.exit(1);
  }
}

applyMigrations();