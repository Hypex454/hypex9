require('dotenv').config();
const supabase = require('./src/db/supabaseClient');

async function checkSchema() {
  try {
    console.log('Verificando esquema da tabela product_variations...');
    
    // Tentar acessar a tabela product_variations diretamente
    const { data, error } = await supabase
      .from('product_variations')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('Erro ao acessar a tabela product_variations:', error);
      return;
    }
    
    console.log('Tabela product_variations acessada com sucesso');
    
    // Se conseguimos acessar os dados, vamos tentar inserir um registro de teste
    // para verificar quais colunas são aceitas
    const testVariation = {
      product_id: 'test-product-id',
      name: 'Test Variation',
      color: 'red',
      size: 'M',
      price: 99.99,
      stock: 10
    };
    
    // Tentar inserir sem a coluna sizes primeiro
    const { data: insertData1, error: insertError1 } = await supabase
      .from('product_variations')
      .insert([testVariation])
      .select()
      .single();
      
    if (insertError1) {
      console.log('Erro ao inserir variação sem coluna sizes:', insertError1.message);
    } else {
      console.log('Inserção sem coluna sizes bem-sucedida');
      // Remover o registro de teste
      await supabase
        .from('product_variations')
        .delete()
        .eq('id', insertData1.id);
    }
    
    // Agora tentar inserir com a coluna sizes
    const testVariationWithSizes = {
      ...testVariation,
      sizes: ['M', 'L']
    };
    
    const { data: insertData2, error: insertError2 } = await supabase
      .from('product_variations')
      .insert([testVariationWithSizes])
      .select()
      .single();
      
    if (insertError2) {
      console.log('Erro ao inserir variação com coluna sizes:', insertError2.message);
      console.log('Provavelmente a coluna "sizes" não existe na tabela product_variations');
    } else {
      console.log('Inserção com coluna sizes bem-sucedida');
      // Remover o registro de teste
      await supabase
        .from('product_variations')
        .delete()
        .eq('id', insertData2.id);
    }
  } catch (err) {
    console.error('Erro geral:', err);
  }
}

checkSchema();