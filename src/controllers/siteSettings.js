const express = require('express');
const supabase = require('../db/supabaseClient');
const { adminRequired } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();


// Configurar multer para upload de imagens
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Apenas imagens são permitidas (JPEG, PNG, GIF, WEBP)'));
  }
});

// Configurar multer para upload de vídeos
const videoStorage = multer.memoryStorage();
const videoUpload = multer({ 
  storage: videoStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// GET: Obter todas as configurações do site (público)
router.get('/', async (req, res) => {
  try {
    console.log('[Site Settings] Buscando configurações...');
    const { data: settings, error } = await supabase
      .from('site_settings')
      .select('key, value, type')
      .order('key');

    if (error) {
      console.error('[Site Settings] Erro do Supabase:', error);
      // Se a tabela não existe, retornar objeto vazio em vez de erro
      if (error.code === '42P01' || error.code === 'PGRST116' || error.message?.includes('does not exist') || error.message?.includes('relation') || error.message?.includes('não existe')) {
        console.warn('[Site Settings] Tabela site_settings não existe. Execute o SQL em sql/add_site_settings_table.sql');
        return res.json({ settings: {} });
      }
      return res.status(500).json({ error: error.message, code: error.code });
    }

    // Converter array em objeto para facilitar o uso
    const settingsObj = {};
    (settings || []).forEach(setting => {
      settingsObj[setting.key] = {
        value: setting.value,
        type: setting.type
      };
    });
    
    // Garantir que todas as configurações de fundo existam
    if (!settingsObj.site_background_type) {
      settingsObj.site_background_type = { value: 'color', type: 'text' };
    }
    if (!settingsObj.site_background_value) {
      settingsObj.site_background_value = { value: '#f5f5f5', type: 'text' };
    }
    if (!settingsObj.site_background_video_url) {
      settingsObj.site_background_video_url = { value: '', type: 'text' };
    }

    console.log('[Site Settings] Configurações carregadas:', Object.keys(settingsObj).length);
    res.json({ settings: settingsObj });
  } catch (err) {
    console.error('[Site Settings] Erro inesperado:', err);
    // Se for erro de tabela não encontrada, retornar objeto vazio
    if (err.message?.includes('does not exist') || err.message?.includes('relation') || err.message?.includes('não existe') || err.code === '42P01') {
      console.warn('[Site Settings] Tabela site_settings não existe. Execute o SQL em sql/add_site_settings_table.sql');
      return res.json({ settings: {} });
    }
    res.status(500).json({ error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  }
});

// GET: Obter uma configuração específica (público)
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { data: setting, error } = await supabase
      .from('site_settings')
      .select('key, value, type')
      .eq('key', key)
      .single();

    if (error || !setting) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }

    res.json({ setting });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Atualizar configuração (admin)
router.put('/:key', adminRequired, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Valor é obrigatório' });
    }

    const { data: setting, error: updateError } = await supabase
      .from('site_settings')
      .update({ 
        value: value,
        updated_at: new Date().toISOString(),
        updated_by: req.user.id
      })
      .eq('key', key)
      .select()
      .single();

    if (updateError) {
      // Se não existe, criar
      if (updateError.code === 'PGRST116') {
        const { data: newSetting, error: createError } = await supabase
          .from('site_settings')
          .insert([{
            key,
            value,
            type: 'text',
            updated_by: req.user.id
          }])
          .select()
          .single();

        if (createError) {
          return res.status(500).json({ error: createError.message });
        }

        return res.json({ setting: newSetting, message: 'Configuração criada com sucesso' });
      }

      return res.status(500).json({ error: updateError.message });
    }

    res.json({ setting, message: 'Configuração atualizada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Upload de imagem para background (admin)
router.post('/:key/upload', adminRequired, upload.single('image'), async (req, res) => {
  try {
    const { key } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada' });
    }

    // Verificar se a configuração existe e é do tipo image
    const { data: setting } = await supabase
      .from('site_settings')
      .select('key, type')
      .eq('key', key)
      .single();

    if (!setting) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }

    // Upload para Supabase Storage
    // Don't use subfolder - upload directly to bucket root to avoid path issues
    const fileName = `${key}_${Date.now()}${path.extname(req.file.originalname)}`;
    const filePath = fileName; // No subfolder

    console.log('Attempting upload - File:', filePath, 'Size:', req.file.buffer.length);

    // Use the default supabase client (with service role key if available)
    // This bypasses RLS policies which might be causing issues
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('product_images')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadError) {
      console.error('Erro ao fazer upload:', uploadError);
      console.error('Upload error details:', JSON.stringify(uploadError, null, 2));
      console.error('File path:', filePath);
      console.error('File size:', req.file.buffer.length, 'bytes');
      console.error('Content type:', req.file.mimetype);
      
      // Check if it's an RLS policy error
      if (uploadError.statusCode === '403' || uploadError.message?.includes('row-level security')) {
        return res.status(403).json({ 
          error: 'Upload bloqueado pelas políticas de segurança do Supabase Storage.',
          hint: 'Configure as políticas RLS do bucket product_images no painel do Supabase.',
          details: uploadError.message
        });
      }
      
      return res.status(500).json({ 
        error: 'Erro ao fazer upload da imagem', 
        detail: uploadError.message || uploadError,
        path: filePath
      });
    }

    // Obter URL pública da imagem
    const { data: { publicUrl } } = supabase.storage
      .from('product_images')
      .getPublicUrl(filePath);

    // Atualizar configuração com a URL da imagem
    const { data: updatedSetting, error: updateError } = await supabase
      .from('site_settings')
      .update({ 
        value: publicUrl,
        type: 'image',
        updated_at: new Date().toISOString(),
        updated_by: req.user.id
      })
      .eq('key', key)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ 
      setting: updatedSetting, 
      image_url: publicUrl,
      message: 'Imagem enviada com sucesso' 
    });
  } catch (err) {
    console.error('[Site Settings] Erro no upload:', err);
    res.status(500).json({ error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  }
});

// POST: Upload de vídeo para background (admin)
router.post('/site_background_video/upload', adminRequired, videoUpload.single('video'), async (req, res) => {
  try {
    console.log('[Site Settings] Iniciando upload de vídeo');
    console.log('[Site Settings] Headers recebidos:', req.headers);
    console.log('[Site Settings] Body recebido:', req.body);
    
    if (!req.file) {
      console.log('[Site Settings] Nenhum arquivo recebido');
      return res.status(400).json({ error: 'Nenhum vídeo enviado' });
    }

    console.log('[Site Settings] Arquivo recebido:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.buffer.length
    });

    // Verificar tipo de arquivo (apenas vídeos)
    const allowedTypes = /mp4|webm|ogg|avi|mov|wmv/;
    const extname = allowedTypes.test(path.extname(req.file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(req.file.mimetype);
    
    if (!mimetype || !extname) {
      console.log('[Site Settings] Tipo de arquivo inválido:', req.file.mimetype, path.extname(req.file.originalname));
      return res.status(400).json({ error: 'Apenas vídeos são permitidos (MP4, WebM, OGG, AVI, MOV, WMV)' });
    }

    // Upload para Supabase Storage
    const fileName = `site_background_video_${Date.now()}${path.extname(req.file.originalname)}`;
    const filePath = fileName;

    console.log('[Site Settings] Attempting video upload - File:', filePath, 'Size:', req.file.buffer.length);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('product_images')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadError) {
      console.error('[Site Settings] Erro ao fazer upload do vídeo:', uploadError);
      return res.status(500).json({ 
        error: 'Erro ao fazer upload do vídeo', 
        detail: uploadError.message || uploadError,
        path: filePath
      });
    }

    console.log('[Site Settings] Upload concluído com sucesso:', uploadData);

    // Obter URL pública do vídeo
    const { data: publicUrlData } = supabase.storage
      .from('product_images')
      .getPublicUrl(filePath);
    
    const publicUrl = publicUrlData?.publicUrl || publicUrlData?.data?.publicUrl;
    
    console.log('[Site Settings] Public URL gerada:', publicUrl);

    if (!publicUrl) {
      console.error('[Site Settings] Não foi possível gerar URL pública para o vídeo');
      return res.status(500).json({ error: 'Não foi possível gerar URL para o vídeo enviado' });
    }

    // Atualizar configuração com a URL do vídeo
    const { data: updatedSetting, error: updateError } = await supabase
      .from('site_settings')
      .update({ 
        value: publicUrl,
        type: 'video',
        updated_at: new Date().toISOString(),
        updated_by: req.user.id
      })
      .eq('key', 'site_background_video_url')
      .select()
      .single();

    if (updateError) {
      console.log('[Site Settings] Erro ao atualizar configuração, tentando criar...');
      // Se não existe, criar
      if (updateError.code === 'PGRST116') {
        const { data: newSetting, error: createError } = await supabase
          .from('site_settings')
          .insert([{
            key: 'site_background_video_url',
            value: publicUrl,
            type: 'video',
            updated_by: req.user.id
          }])
          .select()
          .single();

        if (createError) {
          console.error('[Site Settings] Erro ao criar configuração:', createError);
          return res.status(500).json({ error: createError.message });
        }

        console.log('[Site Settings] Configuração criada com sucesso');
        return res.json({ 
          setting: newSetting, 
          video_url: publicUrl,
          message: 'Vídeo enviado com sucesso' 
        });
      }
      
      console.error('[Site Settings] Erro ao atualizar configuração:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    console.log('[Site Settings] Configuração atualizada com sucesso');
    res.json({ 
      setting: updatedSetting, 
      video_url: publicUrl,
      message: 'Vídeo enviado com sucesso' 
    });
  } catch (err) {
    console.error('[Site Settings] Erro no upload de vídeo:', err);
    res.status(500).json({ error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  }
});

// Garantir que todas as configurações existam
router.get('/initialize', adminRequired, async (req, res) => {
  try {
    // Verificar se as configurações já existem
    const { data: existingSettings } = await supabase
      .from('site_settings')
      .select('key');
    
    const existingKeys = existingSettings?.map(s => s.key) || [];
    
    // Configurações padrão
    const defaultSettings = [
      { key: 'announcement_text', value: 'Frete grátis em compras acima de R$ 199', type: 'text' },
      { key: 'hero_banner_title', value: 'Nova Coleção', type: 'text' },
      { key: 'hero_banner_subtitle', value: 'Até 70% OFF + 20% no primeiro pedido', type: 'text' },
      { key: 'site_background_type', value: 'color', type: 'text' },
      { key: 'site_background_value', value: '#f5f5f5', type: 'text' },
      { key: 'site_background_video_url', value: '', type: 'text' },
      { key: 'site_background_type_mobile', value: 'color', type: 'text' },
      { key: 'site_background_value_mobile', value: '#f5f5f5', type: 'text' },
      { key: 'site_background_video_url_mobile', value: '', type: 'text' },
      // Configurações para os 4 banners solicitados
      { key: 'banner_1_image', value: '', type: 'text', description: 'URL da imagem do primeiro banner' },
      { key: 'banner_1_link', value: '', type: 'text', description: 'Link do primeiro banner' },
      { key: 'banner_2_image', value: '', type: 'text', description: 'URL da imagem do segundo banner' },
      { key: 'banner_2_link', value: '', type: 'text', description: 'Link do segundo banner' },
      { key: 'banner_3_image', value: '', type: 'text', description: 'URL da imagem do terceiro banner' },
      { key: 'banner_3_link', value: '', type: 'text', description: 'Link do terceiro banner' },
      { key: 'banner_4_image', value: '', type: 'text', description: 'URL da imagem do quarto banner' },
      { key: 'banner_4_link', value: '', type: 'text', description: 'Link do quarto banner' }
    ];
    
    // Inserir apenas as configurações que não existem
    const settingsToInsert = defaultSettings.filter(s => !existingKeys.includes(s.key));
    
    if (settingsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('site_settings')
        .insert(settingsToInsert);
      
      if (insertError) {
        console.error('Erro ao inserir configurações padrão:', insertError);
        return res.status(500).json({ error: 'Erro ao inicializar configurações' });
      }
    }
    
    res.json({ message: 'Configurações inicializadas com sucesso' });
  } catch (err) {
    console.error('Erro ao inicializar configurações:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;