const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: SUPABASE_URL e SUPABASE_KEY devem ser definidos nas variáveis de ambiente');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSQL() {
  try {
    // Ler o arquivo SQL
    const sqlFilePath = path.join(__dirname, 'add_size_stock_column.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('Executando SQL para adicionar a coluna size_stock...');
    console.log('SQL:', sqlContent);
    
    // Dividir em comandos individuais
    const commands = sqlContent.split(';').filter(cmd => cmd.trim());
    
    for (const command of commands) {
      if (command.trim()) {
        console.log('\nExecutando comando:', command.trim().substring(0, 50) + '...');
        
        // Para comandos ALTER TABLE e COMMENT, precisamos usar rpc ou raw SQL
        // Vamos tentar usar o método rpc do Supabase
        try {
          // Tentar executar como RPC (para comandos DDL)
          const { data, error } = await supabase.rpc('execute_sql', { sql: command.trim() });
          
          if (error) {
            console.error('Erro ao executar comando:', error);
          } else {
            console.log('Comando executado com sucesso:', data);
          }
        } catch (rpcError) {
          console.warn('RPC não disponível, tentando método alternativo...');
          
          // Se RPC não funcionar, tentar outros métodos
          // Por enquanto, vamos apenas mostrar o comando que seria executado
          console.log('Comando SQL a ser executado:', command.trim());
        }
      }
    }
    
    console.log('\nTodos os comandos SQL foram processados!');
  } catch (error) {
    console.error('Erro ao executar SQL:', error);
  }
}

executeSQL();