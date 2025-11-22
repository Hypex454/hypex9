-- Adicionar coluna is_featured à tabela products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- Adicionar coluna is_active à tabela products (se ainda não existir)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Adicionar coluna original_price à tabela products (se ainda não existir)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2);

-- Atualizar produtos existentes para terem is_active = true por padrão
UPDATE public.products 
SET is_active = TRUE 
WHERE is_active IS NULL;

-- Atualizar produtos existentes para terem is_featured = false por padrão
UPDATE public.products 
SET is_featured = FALSE 
WHERE is_featured IS NULL;