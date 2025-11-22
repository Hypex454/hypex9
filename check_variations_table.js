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

async function checkVariationsTable() {
  try {
    console.log('Verificando a estrutura da tabela product_variations...');
    
    // Tentar selecionar uma linha da tabela para verificar a estrutura
    const { data, error } = await supabase
      .from('product_variations')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Erro ao consultar a tabela product_variations:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('Estrutura da tabela product_variations:');
      const columns = Object.keys(data[0]);
      columns.forEach(column => {
        console.log(`- ${column}`);
      });
      
      // Verificar especificamente se a coluna size_stock existe
      if (columns.includes('size_stock')) {
        console.log('\n✓ Coluna size_stock encontrada na tabela product_variations');
      } else {
        console.log('\n✗ Coluna size_stock NÃO encontrada na tabela product_variations');
      }
    } else {
      console.log('Tabela product_variations está vazia ou não existe');
      
      // Tentar criar uma variação de teste para verificar a estrutura
      console.log('\nTentando criar uma variação de teste...');
      const testVariation = {
        product_id: '00000000-0000-0000-0000-000000000000',
        name: 'Teste',
        size_stock: {}
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('product_variations')
        .insert([testVariation])
        .select();
      
      if (insertError) {
        console.error('Erro ao inserir variação de teste:', insertError);
        if (insertError.message.includes("Could not find the 'size_stock' column")) {
          console.log('✗ Confirmação: Coluna size_stock NÃO existe na tabela product_variations');
        }
      } else {
        console.log('✓ Variação de teste criada com sucesso');
        console.log('Estrutura da variação inserida:');
        const columns = Object.keys(insertData[0]);
        columns.forEach(column => {
          console.log(`- ${column}`);
        });
        
        if (columns.includes('size_stock')) {
          console.log('\n✓ Coluna size_stock encontrada na tabela product_variations');
        } else {
          console.log('\n✗ Coluna size_stock NÃO encontrada na tabela product_variations');
        }
        
        // Limpar a variação de teste
        await supabase
          .from('product_variations')
          .delete()
          .eq('id', insertData[0].id);
      }
    }
  } catch (error) {
    console.error('Erro ao verificar a tabela product_variations:', error);
  }
}

checkVariationsTable();