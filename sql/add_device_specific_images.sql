-- Migration: Add device-specific image fields to products and product_variations
-- This script adds support for separate images for PC and mobile devices

-- Add columns for device-specific images to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS pc_images text[] DEFAULT array[]::text[],
ADD COLUMN IF NOT EXISTS mobile_images text[] DEFAULT array[]::text[];

-- Add columns for device-specific images to product_variations table
ALTER TABLE public.product_variations 
ADD COLUMN IF NOT EXISTS pc_images text[] DEFAULT array[]::text[],
ADD COLUMN IF NOT EXISTS mobile_images text[] DEFAULT array[]::text[];

-- Add comments for documentation
COMMENT ON COLUMN public.products.pc_images IS 'Images specifically optimized for PC/desktop devices';
COMMENT ON COLUMN public.products.mobile_images IS 'Images specifically optimized for mobile devices';
COMMENT ON COLUMN public.product_variations.pc_images IS 'Images specifically optimized for PC/desktop devices for this variation';
COMMENT ON COLUMN public.product_variations.mobile_images IS 'Images specifically optimized for mobile devices for this variation';

-- Update existing products to migrate images to both pc_images and mobile_images
-- (This ensures backward compatibility)
UPDATE public.products 
SET pc_images = images, mobile_images = images 
WHERE array_length(images, 1) > 0 AND (array_length(pc_images, 1) IS NULL OR array_length(mobile_images, 1) IS NULL);

-- Update existing variations to migrate images to both pc_images and mobile_images
-- (This ensures backward compatibility)
UPDATE public.product_variations 
SET pc_images = images, mobile_images = images 
WHERE array_length(images, 1) > 0 AND (array_length(pc_images, 1) IS NULL OR array_length(mobile_images, 1) IS NULL);