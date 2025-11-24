// siteBackground.js - Funções para aplicar fundo personalizável do site com suporte a dispositivos específicos

// Função para detectar se é dispositivo móvel
function isMobileDevice() {
  return window.innerWidth <= 768 || 
         navigator.userAgent.match(/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i);
}

// Função para aplicar fundo personalizável do site
async function applySiteBackground() {
  try {
    // Carregar configurações do site
    const response = await fetch('/api/site-settings');
    const data = await response.json();
    const settings = data.settings || {};
    
    // Determinar se é dispositivo móvel
    const isMobile = isMobileDevice();
    
    // Selecionar configurações apropriadas com base no dispositivo
    let backgroundType, backgroundValue, videoUrl;
    
    if (isMobile) {
      // Usar configurações específicas para mobile se existirem
      backgroundType = settings.site_background_type_mobile?.value || settings.site_background_type?.value || 'color';
      backgroundValue = settings.site_background_value_mobile?.value || settings.site_background_value?.value || '#f5f5f5';
      videoUrl = settings.site_background_video_url_mobile?.value || settings.site_background_video_url?.value || '';
    } else {
      // Usar configurações para desktop
      backgroundType = settings.site_background_type?.value || 'color';
      backgroundValue = settings.site_background_value?.value || '#f5f5f5';
      videoUrl = settings.site_background_video_url?.value || '';
    }
    
    // Aplicar o fundo apropriado
    const body = document.body;
    
    // Remover qualquer fundo de vídeo existente
    const existingVideo = document.getElementById('site-background-video');
    if (existingVideo) {
      existingVideo.remove();
    }
    
    // Remover estilos de fundo anteriores
    body.style.backgroundImage = '';
    body.style.backgroundColor = '';
    
    switch (backgroundType) {
      case 'color':
        body.style.backgroundColor = backgroundValue;
        break;
        
      case 'image':
      case 'gif':
        body.style.backgroundImage = `url('${backgroundValue}')`;
        body.style.backgroundSize = 'cover';
        body.style.backgroundPosition = 'center';
        body.style.backgroundRepeat = 'no-repeat';
        body.style.backgroundAttachment = 'fixed';
        break;
        
      case 'video':
        if (videoUrl) {
          // Criar elemento de vídeo para fundo
          const video = document.createElement('video');
          video.id = 'site-background-video';
          video.autoplay = true;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.style.position = 'fixed';
          video.style.top = '0';
          video.style.left = '0';
          video.style.width = '100%';
          video.style.height = '100%';
          video.style.objectFit = 'cover';
          video.style.zIndex = '-1';
          video.style.pointerEvents = 'none';
          
          // Adicionar source ao vídeo
          const source = document.createElement('source');
          source.src = videoUrl;
          source.type = 'video/mp4';
          video.appendChild(source);
          
          // Adicionar vídeo ao body
          body.appendChild(video);
          
          // Adicionar classe para estilizar o conteúdo sobre o vídeo
          body.classList.add('has-background-video');
        }
        break;
        
      default:
        body.style.backgroundColor = '#f5f5f5';
    }
  } catch (error) {
    console.error('Erro ao aplicar fundo do site:', error);
    // Fallback para cor padrão
    document.body.style.backgroundColor = '#f5f5f5';
  }
}

// Função para lidar com redimensionamento da janela
function handleResize() {
  // Debounce para evitar múltiplas chamadas
  clearTimeout(window.resizeTimer);
  window.resizeTimer = setTimeout(() => {
    applySiteBackground();
  }, 250);
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
  applySiteBackground();
  
  // Adicionar listener para redimensionamento
  window.addEventListener('resize', handleResize);
});

// Exportar funções para uso global
window.applySiteBackground = applySiteBackground;
window.isMobileDevice = isMobileDevice;