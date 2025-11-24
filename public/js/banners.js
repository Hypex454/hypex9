// banners.js - Funções para gerenciar banners da página inicial

// Função para carregar banners da API
async function loadBanners() {
  try {
    const response = await fetch('/api/site-settings');
    const data = await response.json();
    const settings = data.settings || {};
    
    // Criar container para os banners
    const bannerContainer = document.createElement('div');
    bannerContainer.id = 'homepage-banners';
    bannerContainer.style.display = 'grid';
    bannerContainer.style.gridTemplateColumns = '1fr 1fr';
    bannerContainer.style.gap = '1rem';
    bannerContainer.style.marginBottom = '2rem';
    bannerContainer.style.maxWidth = '810px'; // 400px * 2 + 1rem gap
    bannerContainer.style.marginLeft = 'auto';
    bannerContainer.style.marginRight = 'auto';
    bannerContainer.style.width = '100%';
    
    // Estilos para banners desktop (2x2 grid)
    bannerContainer.style.gridTemplateAreas = `
      "banner1 banner2"
      "banner3 banner4"
    `;
    
    // Adicionar banners ao container
    for (let i = 1; i <= 4; i++) {
      const image = settings[`banner_${i}_image`]?.value || '';
      const link = settings[`banner_${i}_link`]?.value || '#';
      
      if (image) {
        const bannerElement = document.createElement('a');
        bannerElement.href = link;
        bannerElement.target = '_blank';
        bannerElement.style.display = 'block';
        bannerElement.style.width = '400px';
        bannerElement.style.height = '200px';
        bannerElement.style.backgroundImage = `url('${image}')`;
        bannerElement.style.backgroundSize = 'cover';
        bannerElement.style.backgroundPosition = 'center';
        bannerElement.style.backgroundRepeat = 'no-repeat';
        bannerElement.style.borderRadius = '8px';
        bannerElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        bannerElement.style.position = 'relative';
        bannerElement.style.transition = 'transform 0.3s ease';
        bannerElement.setAttribute('data-banner-id', i);
        
        // Efeito de ampliação ao passar o mouse
        bannerElement.addEventListener('mouseenter', function() {
          this.style.transform = 'scale(1.05)';
          this.style.zIndex = '10';
        });
        
        bannerElement.addEventListener('mouseleave', function() {
          this.style.transform = 'scale(1)';
          this.style.zIndex = '1';
        });
        
        // Definir área do grid para cada banner
        switch(i) {
          case 1:
            bannerElement.style.gridArea = 'banner1';
            break;
          case 2:
            bannerElement.style.gridArea = 'banner2';
            break;
          case 3:
            bannerElement.style.gridArea = 'banner3';
            break;
          case 4:
            bannerElement.style.gridArea = 'banner4';
            break;
        }
        
        bannerContainer.appendChild(bannerElement);
      }
    }
    
    // Inserir banners antes da seção de produtos
    const produtosSection = document.getElementById('produtos');
    if (produtosSection && bannerContainer.children.length > 0) {
      produtosSection.parentNode.insertBefore(bannerContainer, produtosSection);
    }
    
    // Adicionar estilos responsivos
    addResponsiveBannerStyles();
  } catch (error) {
    console.error('Erro ao carregar banners:', error);
  }
}

// Função para adicionar estilos responsivos
function addResponsiveBannerStyles() {
  // Remover estilos existentes se houver
  const existingStyles = document.getElementById('banner-responsive-styles');
  if (existingStyles) {
    existingStyles.remove();
  }
  
  // Adicionar novos estilos
  const style = document.createElement('style');
  style.id = 'banner-responsive-styles';
  style.textContent = `
    @media (max-width: 768px) {
      #homepage-banners {
        display: flex !important;
        flex-direction: column !important;
        grid-template-columns: none !important;
        grid-template-rows: none !important;
        grid-template-areas: none !important;
        grid-auto-flow: row !important;
        max-width: 100% !important;
        padding: 0 1rem !important;
        gap: 1rem !important;
      }
      
      #homepage-banners a {
        width: 100% !important;
        height: 150px !important;
        grid-area: auto !important;
      }
    }
    
    /* Estilos para desktop - manter proporção correta */
    @media (min-width: 769px) {
      #homepage-banners {
        display: grid !important;
        max-width: 810px; /* 400px * 2 + 1rem gap */
      }
      
      #homepage-banners a {
        width: 400px;
        height: 200px;
      }
    }
    
    /* Efeito de ampliação para os banners */
    #homepage-banners a {
      transition: transform 0.3s ease;
    }
    
    #homepage-banners a:hover {
      transform: scale(1.05);
      z-index: 10;
    }
  `;
  
  document.head.appendChild(style);
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
  loadBanners();
});

// Exportar funções para uso global
window.loadBanners = loadBanners;