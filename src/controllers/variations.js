const express = require('express');
const multer = require('multer');
const supabase = require('../db/supabaseClient');
const { adminRequired } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 10 } });

// Helper: converte variation (com keys) para variation com URLs em images
async function variationWithAccessibleImages(variation) {
  console.log('Convertendo variação para URLs acessíveis:', variation);
  
  const clone = { ...variation };
  if (Array.isArray(clone.images) && clone.images.length) {
    const urls = await Promise.all(clone.images.map(async imgKey => {
      try {
        // Primeiro tenta public URL (sempre funciona, mesmo com anon key)
        const pub = supabase.storage.from('product_images').getPublicUrl(imgKey);
        if (pub?.data?.publicUrl) {
          return pub.data.publicUrl;
        } else if (pub?.publicURL) {
          // Fallback para formato antigo
          return pub.publicURL;
        }
        return null;
      } catch (e) {
        console.error('Erro ao gerar URL para imagem de variação:', imgKey, e);
        return null;
      }
    }));
    clone.images = urls.filter(Boolean);
  } else {
    clone.images = [];
  }
  console.log('Variação convertida:', clone);
  return clone;
}

// Admin: create product variation with image upload support
router.post('/', adminRequired, upload.fields([
  { name: 'pc_images', maxCount: 5 },
  { name: 'mobile_images', maxCount: 5 }
]), async (req, res) => {
  try {
    console.log('Received variation data:', req.body);
    
    // Adicionar log específico para size_stock
    if (req.body.size_stock) {
      console.log('Dados de size_stock recebidos:', req.body.size_stock);
      console.log('Tipo de size_stock:', typeof req.body.size_stock);
    }
    
    const { product_id, name, color, size, price, stock, sizes } = req.body;
    
    // Validar campos obrigatórios
    if (!product_id || !name) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: product_id e name' 
      });
    }
    
    // Processar tamanhos - pode vir como array ou string
    let sizesArray = [];
    if (sizes) {
      if (Array.isArray(sizes)) {
        sizesArray = sizes;
      } else if (typeof sizes === 'string') {
        sizesArray = [sizes];
      }
    }
    
    // Processar estoque por tamanho - pode vir como objeto JSON
    let sizeStockObj = {};
    if (req.body.size_stock) {
      try {
        if (typeof req.body.size_stock === 'string') {
          sizeStockObj = JSON.parse(req.body.size_stock);
        } else if (typeof req.body.size_stock === 'object') {
          sizeStockObj = req.body.size_stock;
        }
        console.log('sizeStockObj processado:', sizeStockObj);
        console.log('Chaves de sizeStockObj:', Object.keys(sizeStockObj));
      } catch (e) {
        console.warn('Erro ao processar size_stock:', e);
      }
    }
    
    // Handle image uploads
    const pcFiles = req.files?.pc_images || [];
    const mobileFiles = req.files?.mobile_images || [];
    const pcImageKeys = [];
    const mobileImageKeys = [];

    // Upload PC images
    for (let i = 0; i < pcFiles.length; i++) {
      const f = pcFiles[i];
      const ext = (f.originalname && f.originalname.split('.').pop()) || 'jpg';
      const key = `variations/${product_id}/pc/${Date.now()}_${i}.${ext}`;

      const result = await supabase.storage.from('product_images').upload(key, f.buffer, { 
        contentType: f.mimetype,
        upsert: true
      });

      if (result.error) {
        console.error('Erro upload imagem PC de variação', result.error);
        if (result.error.statusCode === '403' || 
            result.error.statusCode === '500' || 
            result.error.message?.includes('row-level security') || 
            result.error.message?.includes('policy') ||
            result.error.message?.includes('Internal Server Error')) {
          console.warn('Storage error - Variation will be created without PC images.');
          console.warn('Check that the product_images bucket exists in Supabase Storage');
          break;
        }
        return res.status(500).json({ error: 'Erro ao fazer upload das imagens PC', detail: result.error.message || result.error });
      }

      pcImageKeys.push(key);
    }

    // Upload mobile images
    for (let i = 0; i < mobileFiles.length; i++) {
      const f = mobileFiles[i];
      const ext = (f.originalname && f.originalname.split('.').pop()) || 'jpg';
      const key = `variations/${product_id}/mobile/${Date.now()}_${i}.${ext}`;

      const result = await supabase.storage.from('product_images').upload(key, f.buffer, { 
        contentType: f.mimetype,
        upsert: true
      });

      if (result.error) {
        console.error('Erro upload imagem mobile de variação', result.error);
        if (result.error.statusCode === '403' || 
            result.error.statusCode === '500' || 
            result.error.message?.includes('row-level security') || 
            result.error.message?.includes('policy') ||
            result.error.message?.includes('Internal Server Error')) {
          console.warn('Storage error - Variation will be created without mobile images.');
          console.warn('Check that the product_images bucket exists in Supabase Storage');
          break;
        }
        return res.status(500).json({ error: 'Erro ao fazer upload das imagens mobile', detail: result.error.message || result.error });
      }

      mobileImageKeys.push(key);
    }
    
    // Combine all images for the general images field (PC images first)
    const allImageKeys = [...pcImageKeys, ...mobileImageKeys];
    
    // Construir objeto de inserção
    const variationInsert = { 
      product_id,
      name,
      color: color || null,
      size: size || null,
      price: Number(price || 0),
      stock: Number(stock || 0),
      pc_images: pcImageKeys,
      mobile_images: mobileImageKeys,
      images: allImageKeys, // Use all uploaded image keys
      size_stock: sizeStockObj // Adicionar estoque por tamanho
    };
    
    console.log('Objeto de inserção da variação:', variationInsert);
    
    // Verificar se a coluna 'sizes' existe na tabela antes de tentar inserir
    let sizesColumnExists = true;
    try {
      // Tentar inserir com a coluna sizes para verificar se ela existe
      const testInsert = { ...variationInsert, sizes: [] };
      const { error: testError } = await supabase
        .from('product_variations')
        .insert([testInsert])
        .select()
        .single();
      
      // Se não houver erro, a coluna existe
      if (!testError || !testError.message?.includes("Could not find the 'sizes' column")) {
        // A coluna existe, podemos inserir com sizes
        variationInsert.sizes = sizesArray.length > 0 ? sizesArray : [];
      } else {
        // A coluna não existe
        sizesColumnExists = false;
        console.warn('Coluna "sizes" não encontrada na tabela product_variations');
      }
      
      // Remover o teste de inserção
      if (testError && !testError.message?.includes("Could not find the 'sizes' column")) {
        // Se foi um erro real (não relacionado à coluna), precisamos lidar com isso
        console.error('Erro no teste de inserção:', testError);
      }
    } catch (testErr) {
      console.error('Erro ao testar existência da coluna sizes:', testErr);
      sizesColumnExists = false;
    }
    
    // Verificar se a coluna 'size_stock' existe na tabela antes de tentar inserir
    let sizeStockColumnExists = true;
    try {
      // Tentar inserir com a coluna size_stock para verificar se ela existe
      const testInsert = { ...variationInsert, size_stock: {} };
      const { error: testError } = await supabase
        .from('product_variations')
        .insert([testInsert])
        .select()
        .single();
      
      // Se não houver erro, a coluna existe
      if (!testError || !testError.message?.includes("Could not find the 'size_stock' column")) {
        // A coluna existe, podemos inserir com size_stock
        variationInsert.size_stock = sizeStockObj;
      } else {
        // A coluna não existe
        sizeStockColumnExists = false;
        console.warn('Coluna "size_stock" não encontrada na tabela product_variations');
      }
      
      // Remover o teste de inserção
      if (testError && !testError.message?.includes("Could not find the 'size_stock' column")) {
        // Se foi um erro real (não relacionado à coluna), precisamos lidar com isso
        console.error('Erro no teste de inserção:', testError);
      }
    } catch (testErr) {
      console.error('Erro ao testar existência da coluna size_stock:', testErr);
      sizeStockColumnExists = false;
    }
    
    // Se a coluna não existe, inserir sem ela
    if (!sizesColumnExists) {
      delete variationInsert.sizes;
    } else {
      // Se a coluna existe, adicionar os tamanhos
      variationInsert.sizes = sizesArray.length > 0 ? sizesArray : [];
    }
    
    // Se a coluna size_stock não existe, inserir sem ela
    if (!sizeStockColumnExists) {
      delete variationInsert.size_stock;
    }
    
    // Inserir a variação
    const { data: variation, error } = await supabase
      .from('product_variations')
      .insert([variationInsert])
      .select()
      .single();
      
    if (error) {
      console.error('Erro ao criar variação:', error);
      // Se o erro for relacionado à coluna size_stock, tentar novamente sem ela
      if (error.message?.includes("Could not find the 'size_stock' column")) {
        console.log('Tentando inserir novamente sem a coluna size_stock...');
        delete variationInsert.size_stock;
        const { data: variationRetry, error: retryError } = await supabase
          .from('product_variations')
          .insert([variationInsert])
          .select()
          .single();
          
        if (retryError) {
          console.error('Erro ao criar variação (tentativa 2):', retryError);
          return res.status(400).json({ error: retryError.message });
        }
        
        console.log('Created variation (tentativa 2):', variationRetry);
        const variationWithUrls = await variationWithAccessibleImages(variationRetry);
        return res.json({ variation: variationWithUrls });
      }
      
      return res.status(400).json({ error: error.message });
    }
    
    console.log('Created variation:', variation);
    
    const variationWithUrls = await variationWithAccessibleImages(variation);
    res.json({ variation: variationWithUrls });
  } catch (err) {
    console.error('POST /api/variations error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: get variations for a product
router.get('/product/:product_id', async (req, res) => {
  try {
    const product_id = req.params.product_id;
    
    console.log('Carregando variações para o produto:', product_id);
    
    if (!product_id) {
      return res.status(400).json({ error: 'ID do produto inválido' });
    }
    
    const { data: variations, error } = await supabase
      .from('product_variations')
      .select('*')
      .eq('product_id', product_id)
      .eq('is_active', true)
      .order('color', { ascending: true })
      .order('size', { ascending: true });
      
    if (error) {
      console.error('Erro ao buscar variações:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('Variações encontradas:', variations);
    
    const variationsWithUrls = await Promise.all(
      (variations || []).map(variation => variationWithAccessibleImages(variation))
    );
    
    res.json({ variations: variationsWithUrls });
  } catch (err) {
    console.error('GET /api/variations/product/:product_id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: update product variation with image upload support
router.put('/:id', adminRequired, upload.fields([
  { name: 'pc_images', maxCount: 5 },
  { name: 'mobile_images', maxCount: 5 }
]), async (req, res) => {
  try {
    console.log('Updating variation with ID:', req.params.id);
    console.log('Received update data:', req.body);
    
    // Adicionar log específico para size_stock
    if (req.body.size_stock !== undefined) {
      console.log('Dados de size_stock recebidos na atualização:', req.body.size_stock);
      console.log('Tipo de size_stock:', typeof req.body.size_stock);
    }
    
    const id = req.params.id;
    const { name, color, size, price, stock, is_active, sizes } = req.body;
    
    // Processar tamanhos - pode vir como array ou string
    let sizesArray = [];
    if (sizes) {
      if (Array.isArray(sizes)) {
        sizesArray = sizes;
      } else if (typeof sizes === 'string') {
        sizesArray = [sizes];
      }
    }
    
    // Processar estoque por tamanho - pode vir como objeto JSON
    let sizeStockObj = undefined;
    if (req.body.size_stock !== undefined) {
      try {
        if (typeof req.body.size_stock === 'string') {
          sizeStockObj = JSON.parse(req.body.size_stock);
        } else if (typeof req.body.size_stock === 'object') {
          sizeStockObj = req.body.size_stock;
        }
        console.log('sizeStockObj processado na atualização:', sizeStockObj);
        console.log('Chaves de sizeStockObj:', Object.keys(sizeStockObj));
      } catch (e) {
        console.warn('Erro ao processar size_stock na atualização:', e);
      }
    }
    
    // Construir objeto de mudanças apenas com campos válidos
    const changes = {};
    
    if (name !== undefined) changes.name = name;
    if (color !== undefined) changes.color = color || null;
    if (size !== undefined) changes.size = size || null;
    if (price !== undefined) changes.price = Number(price || 0);
    if (stock !== undefined) changes.stock = Number(stock || 0);
    if (is_active !== undefined) changes.is_active = Boolean(is_active);
    if (sizeStockObj !== undefined) changes.size_stock = sizeStockObj;
    
    console.log('Objeto de mudanças da variação (criação):', changes);
    console.log('Chaves do objeto de mudanças (criação):', Object.keys(changes));
    
    // Handle image uploads
    const pcFiles = req.files?.pc_images || [];
    const mobileFiles = req.files?.mobile_images || [];
    
    if (pcFiles.length > 0 || mobileFiles.length > 0) {
      // Get existing variation to preserve existing images
      const { data: existingVariation } = await supabase
        .from('product_variations')
        .select('pc_images, mobile_images')
        .eq('id', id)
        .single();
      
      let pcImageKeys = existingVariation?.pc_images || [];
      let mobileImageKeys = existingVariation?.mobile_images || [];
      
      // Upload new PC images
      for (let i = 0; i < pcFiles.length; i++) {
        const f = pcFiles[i];
        const ext = (f.originalname && f.originalname.split('.').pop()) || 'jpg';
        const key = `variations/${existingVariation.product_id}/pc/${Date.now()}_${i}.${ext}`;
        
        const result = await supabase.storage.from('product_images').upload(key, f.buffer, {
          contentType: f.mimetype,
          upsert: true
        });
        
        if (result.error) {
          console.error('Erro upload imagem PC de variação', result.error);
          if (result.error.statusCode === '403' || 
              result.error.statusCode === '500' || 
              result.error.message?.includes('row-level security') || 
              result.error.message?.includes('policy') ||
              result.error.message?.includes('Internal Server Error')) {
            console.warn('Storage error - Variation will be updated without PC images.');
            console.warn('Check that the product_images bucket exists in Supabase Storage');
            break;
          }
          return res.status(500).json({ error: 'Erro ao fazer upload das imagens PC', detail: result.error.message || result.error });
        }
        
        pcImageKeys.push(key);
      }
      
      // Upload new mobile images
      for (let i = 0; i < mobileFiles.length; i++) {
        const f = mobileFiles[i];
        const ext = (f.originalname && f.originalname.split('.').pop()) || 'jpg';
        const key = `variations/${existingVariation.product_id}/mobile/${Date.now()}_${i}.${ext}`;
        
        const result = await supabase.storage.from('product_images').upload(key, f.buffer, {
          contentType: f.mimetype,
          upsert: true
        });
        
        if (result.error) {
          console.error('Erro upload imagem mobile de variação', result.error);
          if (result.error.statusCode === '403' || 
              result.error.statusCode === '500' || 
              result.error.message?.includes('row-level security') || 
              result.error.message?.includes('policy') ||
              result.error.message?.includes('Internal Server Error')) {
            console.warn('Storage error - Variation will be updated without mobile images.');
            console.warn('Check that the product_images bucket exists in Supabase Storage');
            break;
          }
          return res.status(500).json({ error: 'Erro ao fazer upload das imagens mobile', detail: result.error.message || result.error });
        }
        
        mobileImageKeys.push(key);
      }
      
      // Update image keys in changes
      changes.pc_images = pcImageKeys;
      changes.mobile_images = mobileImageKeys;
      changes.images = [...pcImageKeys, ...mobileImageKeys];
    }
    
    // Verificar se a coluna 'sizes' existe na tabela antes de tentar atualizar
    let sizesColumnExists = true;
    if (sizes !== undefined || sizeStockObj !== undefined) {
      try {
        // Tentar atualizar com a coluna sizes para verificar se ela existe
        const testChanges = { ...changes, sizes: [] };
        const { error: testError } = await supabase
          .from('product_variations')
          .update(testChanges)
          .eq('id', id)
          .select()
          .single();
        
        // Se não houver erro relacionado à coluna, ela existe
        if (testError && testError.message?.includes("Could not find the 'sizes' column")) {
          sizesColumnExists = false;
          console.warn('Coluna "sizes" não encontrada na tabela product_variations');
        }
        
        // Reverter o teste de atualização
        if (testError && !testError.message?.includes("Could not find the 'sizes' column")) {
          // Se foi um erro real (não relacionado à coluna), precisamos lidar com isso
          console.error('Erro no teste de atualização:', testError);
        }
      } catch (testErr) {
        console.error('Erro ao testar existência da coluna sizes:', testErr);
        sizesColumnExists = false;
      }
    }
    
    // Verificar se a coluna 'size_stock' existe na tabela antes de tentar atualizar
    let sizeStockColumnExists = true;
    if (sizeStockObj !== undefined) {
      try {
        // Tentar atualizar com a coluna size_stock para verificar se ela existe
        const testChanges = { ...changes, size_stock: {} };
        const { error: testError } = await supabase
          .from('product_variations')
          .update(testChanges)
          .eq('id', id)
          .select()
          .single();
        
        // Se não houver erro relacionado à coluna, ela existe
        if (testError && testError.message?.includes("Could not find the 'size_stock' column")) {
          sizeStockColumnExists = false;
          console.warn('Coluna "size_stock" não encontrada na tabela product_variations');
        }
        
        // Reverter o teste de atualização
        if (testError && !testError.message?.includes("Could not find the 'size_stock' column")) {
          // Se foi um erro real (não relacionado à coluna), precisamos lidar com isso
          console.error('Erro no teste de atualização:', testError);
        }
      } catch (testErr) {
        console.error('Erro ao testar existência da coluna size_stock:', testErr);
        sizeStockColumnExists = false;
      }
    }
    
    // Se a coluna existe e estamos tentando atualizar sizes, adicionar ao objeto de mudanças
    if (sizesColumnExists && sizes !== undefined) {
      changes.sizes = sizesArray.length > 0 ? sizesArray : [];
    }
    
    // Se a coluna size_stock existe e estamos tentando atualizar size_stock, adicionar ao objeto de mudanças
    if (sizeStockColumnExists && sizeStockObj !== undefined) {
      changes.size_stock = sizeStockObj;
    }
    
    // Atualizar a variação
    const { data: variation, error } = await supabase
      .from('product_variations')
      .update(changes)
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error('Erro ao atualizar variação:', error);
      // Se o erro for relacionado à coluna size_stock, tentar novamente sem ela
      if (error.message?.includes("Could not find the 'size_stock' column")) {
        console.log('Tentando atualizar novamente sem a coluna size_stock...');
        delete changes.size_stock;
        const { data: variationRetry, error: retryError } = await supabase
          .from('product_variations')
          .update(changes)
          .eq('id', id)
          .select()
          .single();
          
        if (retryError) {
          console.error('Erro ao atualizar variação (tentativa 2):', retryError);
          return res.status(400).json({ error: retryError.message });
        }
        
        const variationWithUrls = await variationWithAccessibleImages(variationRetry);
        return res.json({ variation: variationWithUrls });
      }
      
      return res.status(400).json({ error: error.message });
    }
    
    const variationWithUrls = await variationWithAccessibleImages(variation);
    res.json({ variation: variationWithUrls });
  } catch (err) {
    console.error('PUT /api/variations/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: delete product variation
router.delete('/:id', adminRequired, async (req, res) => {
  try {
    const id = req.params.id;
    
    const { error } = await supabase
      .from('product_variations')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Erro ao excluir variação:', error);
      return res.status(400).json({ error: error.message });
    }
    
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/variations/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: remove variation image
router.post('/:id/remove-image', adminRequired, async (req, res) => {
  try {
    const id = req.params.id;
    const { imageUrl, deviceType } = req.body;
    
    if (!imageUrl || !deviceType) {
      return res.status(400).json({ error: 'imageUrl e deviceType são obrigatórios' });
    }
    
    // Obter a variação atual
    const { data: variation, error: variationError } = await supabase
      .from('product_variations')
      .select('pc_images, mobile_images, images')
      .eq('id', id)
      .single();
      
    if (variationError) {
      console.error('Erro ao buscar variação:', variationError);
      return res.status(400).json({ error: variationError.message });
    }
    
    if (!variation) {
      return res.status(404).json({ error: 'Variação não encontrada' });
    }
    
    // Determinar qual array de imagens atualizar
    let imageArray = [];
    let fieldName = '';
    
    switch (deviceType) {
      case 'pc':
        imageArray = variation.pc_images || [];
        fieldName = 'pc_images';
        break;
      case 'mobile':
        imageArray = variation.mobile_images || [];
        fieldName = 'mobile_images';
        break;
      default:
        return res.status(400).json({ error: 'deviceType inválido. Use "pc" ou "mobile".' });
    }
    
    // Remover a imagem do array
    const updatedImages = imageArray.filter(img => img !== imageUrl);
    
    // Atualizar a variação no banco de dados
    const { data: updatedVariation, error: updateError } = await supabase
      .from('product_variations')
      .update({ [fieldName]: updatedImages })
      .eq('id', id)
      .select()
      .single();
      
    if (updateError) {
      console.error('Erro ao atualizar variação:', updateError);
      return res.status(400).json({ error: updateError.message });
    }
    
    // Tentar remover o arquivo do storage do Supabase
    try {
      // Extrair a key da URL (última parte após o último '/')
      const urlParts = imageUrl.split('/');
      const key = urlParts[urlParts.length - 1];
      const fullPath = `variations/${id}/${deviceType}/${key}`;
      
      const { error: storageError } = await supabase.storage
        .from('product_images')
        .remove([fullPath]);
        
      if (storageError) {
        console.warn('Aviso: não foi possível remover o arquivo do storage:', storageError.message);
      }
    } catch (storageErr) {
      console.warn('Aviso: erro ao tentar remover o arquivo do storage:', storageErr.message);
    }
    
    // Atualizar também o campo images geral se necessário
    let generalImages = updatedVariation.images || [];
    const updatedGeneralImages = generalImages.filter(img => img !== imageUrl);
    
    // Se o campo images foi modificado, atualizar também
    if (generalImages.length !== updatedGeneralImages.length) {
      const { error: generalUpdateError } = await supabase
        .from('product_variations')
        .update({ images: updatedGeneralImages })
        .eq('id', id);
        
      if (generalUpdateError) {
        console.warn('Aviso: não foi possível atualizar o campo images geral:', generalUpdateError.message);
      }
    }
    
    const variationWithUrls = await variationWithAccessibleImages(updatedVariation);
    res.json({ variation: variationWithUrls });
  } catch (err) {
    console.error('POST /api/variations/:id/remove-image error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;