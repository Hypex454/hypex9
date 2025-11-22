-- Adicionar coluna 'sizes' à tabela 'product_variations'
-- Esta coluna armazenará os tamanhos disponíveis para cada variação de produto

ALTER TABLE product_variations 
ADD COLUMN sizes TEXT[] DEFAULT '{}';

-- Verificar se a coluna foi adicionada corretamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'product_variations' 
AND column_name = 'sizes';