require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Variáveis de ambiente SUPABASE_URL e SUPABASE_KEY não estão configuradas');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function addSizesColumn() {
  try {
    console.log('Adicionando coluna "sizes" à tabela "product_variations"...');
    
    // Primeiro, vamos verificar se a coluna já existe
    const { data: columns, error: columnsError } = await supabase
      .from('product_variations')
      .select('*')
      .limit(1)
      .single();
      
    if (columnsError) {
      console.error('Erro ao acessar tabela product_variations:', columnsError);
      return;
    }
    
    // Verificar se a coluna sizes já existe
    if (typeof columns.sizes !== 'undefined') {
      console.log('Coluna "sizes" já existe na tabela product_variations');
      return;
    }
    
    console.log('Coluna "sizes" não encontrada. Você precisa adicionar a coluna manualmente no Supabase.');
    console.log('Instruções:');
    console.log('1. Acesse o painel do Supabase');
    console.log('2. Vá para a seção "Table Editor"');
    console.log('3. Selecione a tabela "product_variations"');
    console.log('4. Clique em "Add column"');
    console.log('5. Adicione uma coluna chamada "sizes" do tipo "ARRAY" com subtipo "text"');
    console.log('6. Defina o valor padrão como "{}" (array vazio)');
    
  } catch (err) {
    console.error('Erro geral:', err);
  }
}

addSizesColumn();