-- Migration: Add size_stock column to product_variations table
-- This script adds the size_stock column to track stock by size for each product variation

-- Adicionar coluna size_stock à tabela product_variations
ALTER TABLE public.product_variations 
ADD COLUMN IF NOT EXISTS size_stock JSONB DEFAULT '{}';

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.product_variations.size_stock IS 'Estoque por tamanho da variação (formato JSON: {"PP": 5, "P": 10, ...})';

-- Verificar se a coluna foi adicionada corretamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'product_variations' 
AND column_name = 'size_stock';