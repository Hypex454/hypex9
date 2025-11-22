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

async function checkSupabaseFunctions() {
  try {
    console.log('Verificando funções disponíveis no Supabase...');
    
    // Consultar as funções RPC disponíveis
    const { data, error } = await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_type')
      .eq('routine_schema', 'public')
      .order('routine_name');
    
    if (error) {
      console.error('Erro ao consultar funções:', error);
      return;
    }
    
    console.log('Funções disponíveis:');
    if (data && data.length > 0) {
      data.forEach(func => {
        console.log(`- ${func.routine_name} (${func.routine_type})`);
      });
    } else {
      console.log('Nenhuma função encontrada');
    }
  } catch (error) {
    console.error('Erro ao verificar funções do Supabase:', error);
  }
}

checkSupabaseFunctions();