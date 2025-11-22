-- Tabela para configurações do site editáveis pelo admin
create table if not exists public.site_settings (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  value text,
  type text default 'text',
  description text,
  updated_at timestamptz default now(),
  updated_by uuid references public.users(id)
);

-- Inserir configurações padrão
insert into public.site_settings (key, value, type, description) values
  ('announcement_text', 'Frete grátis em compras acima de R$ 199', 'text', 'Texto do banner de anúncio no topo do site'),
  ('hero_banner_title', 'Nova Coleção', 'text', 'Título do banner principal'),
  ('hero_banner_subtitle', 'Até 70% OFF + 20% no primeiro pedido', 'text', 'Subtítulo do banner principal'),
  ('site_background_type', 'color', 'text', 'Tipo de fundo do site para desktop (color, image, gif, video)'),
  ('site_background_value', '#f5f5f5', 'text', 'Valor do fundo do site para desktop (cor, URL da imagem/gif ou vídeo)'),
  ('site_background_video_url', '', 'text', 'URL do vídeo de fundo do site para desktop (se aplicável)'),
  ('site_background_type_mobile', 'color', 'text', 'Tipo de fundo do site para mobile (color, image, gif, video)'),
  ('site_background_value_mobile', '#f5f5f5', 'text', 'Valor do fundo do site para mobile (cor, URL da imagem/gif ou vídeo)'),
  ('site_background_video_url_mobile', '', 'text', 'URL do vídeo de fundo do site para mobile (se aplicável)'),
  -- Configurações para os 4 banners solicitados
  ('banner_1_image', '', 'text', 'URL da imagem do primeiro banner'),
  ('banner_1_link', '', 'text', 'Link do primeiro banner'),
  ('banner_2_image', '', 'text', 'URL da imagem do segundo banner'),
  ('banner_2_link', '', 'text', 'Link do segundo banner'),
  ('banner_3_image', '', 'text', 'URL da imagem do terceiro banner'),
  ('banner_3_link', '', 'text', 'Link do terceiro banner'),
  ('banner_4_image', '', 'text', 'URL da imagem do quarto banner'),
  ('banner_4_link', '', 'text', 'Link do quarto banner')
on conflict (key) do nothing;

-- Índice para busca rápida
create index if not exists idx_site_settings_key on public.site_settings(key);