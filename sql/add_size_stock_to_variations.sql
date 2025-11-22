-- Migration: Add size-specific stock to product variations
-- This script adds support for tracking stock by size for each product variation

-- Adicionar coluna para armazenar o estoque por tamanho
-- Esta coluna armazenará um JSON com o estoque de cada tamanho
-- Exemplo: {"PP": 5, "P": 10, "M": 8, "G": 15, "GG": 12}
ALTER TABLE product_variations 
ADD COLUMN size_stock JSONB DEFAULT '{}';

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.product_variations.size_stock IS 'Estoque por tamanho da variação (formato JSON: {"PP": 5, "P": 10, ...})';

-- Verificar se a coluna foi adicionada corretamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'product_variations' 
AND column_name = 'size_stock';

-- Atualizar a função get_product_variations para incluir o estoque por tamanho
CREATE OR REPLACE FUNCTION public.get_product_variations(p_product_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  color text,
  size text,
  price numeric,
  stock int,
  size_stock jsonb,
  images text[],
  is_active boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pv.id,
    pv.name,
    pv.color,
    pv.size,
    pv.price,
    pv.stock,
    pv.size_stock,
    pv.images,
    pv.is_active
  FROM public.product_variations pv
  WHERE pv.product_id = p_product_id
    AND pv.is_active = true
    AND (pv.stock > 0 OR (pv.size_stock IS NOT NULL AND jsonb_array_length(jsonb_object_keys(pv.size_stock)) > 0))
  ORDER BY pv.color, pv.size;
END;
$$ LANGUAGE plpgsql;