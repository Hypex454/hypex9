-- Adicionar coluna original_price para produtos com desconto
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS original_price numeric(10,2);

COMMENT ON COLUMN public.products.original_price IS 'Preço original do produto antes do desconto';