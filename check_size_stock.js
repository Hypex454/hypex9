const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: SUPABASE_URL e SUPABASE_KEY devem ser definidos nas variáveis de ambiente');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSizeStockColumn() {
  try {
    console.log('Verificando se a coluna size_stock existe na tabela product_variations...');
    
    // Consultar informações sobre a coluna size_stock
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'product_variations')
      .eq('column_name', 'size_stock');
    
    if (error) {
      console.error('Erro ao consultar informações da coluna:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('Coluna size_stock encontrada:');
      console.log(data[0]);
    } else {
      console.log('Coluna size_stock NÃO encontrada na tabela product_variations');
    }
    
    // Consultar informações sobre todas as colunas da tabela product_variations
    console.log('\nTodas as colunas da tabela product_variations:');
    const { data: allColumns, error: allColumnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'product_variations')
      .order('ordinal_position');
    
    if (allColumnsError) {
      console.error('Erro ao consultar todas as colunas:', allColumnsError);
      return;
    }
    
    allColumns.forEach(column => {
      console.log(`- ${column.column_name} (${column.data_type})`);
    });
  } catch (error) {
    console.error('Erro ao verificar a coluna size_stock:', error);
  }
}

checkSizeStockColumn();