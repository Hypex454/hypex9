document.addEventListener('DOMContentLoaded', async () => {
  // Verificar se há termo de busca na URL
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('search');
  
  if (searchQuery) {
    // Se houver termo de busca, realizar a busca
    document.getElementById('search-input').value = searchQuery;
    // Redirecionar para a página de pesquisa
    window.location.href = `/pages/pesquisa.html?q=${encodeURIComponent(searchQuery)}`;
  } else {
    await loadProductsFromAPI();
  }
  
  // Aplicar fundo do site com base no dispositivo
  if (typeof applySiteBackground === 'function') {
    applySiteBackground();
  }
  
  // Adicionar evento de pesquisa ao botão de busca
  const searchButton = document.getElementById('search-button');
  const searchInput = document.getElementById('search-input');
  
  if (searchButton && searchInput) {
    // Pesquisar ao clicar no botão
    searchButton.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query) {
        window.location.href = `/pages/pesquisa.html?q=${encodeURIComponent(query)}`;
      }
    });
    
    // Pesquisar ao pressionar Enter
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          window.location.href = `/pages/pesquisa.html?q=${encodeURIComponent(query)}`;
        }
      }
    });
  }
});

// Função para carregar produtos da API
async function loadProductsFromAPI() {
  try {
    const productsGrid = document.getElementById('product-list');
    if (!productsGrid) return;
    
    productsGrid.innerHTML = '<div class="loading">Carregando produtos...</div>';
    
    // Fazer a requisição para a API
    const response = await fetch('/api/products?limit=12&sort=newest');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Erro ao carregar produtos');
    }
    
    // Renderizar produtos
    renderProducts(data.products);
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    const productsGrid = document.getElementById('product-list');
    if (productsGrid) {
      productsGrid.innerHTML = `
        <div class="error-message">
          Ocorreu um erro ao carregar os produtos. Por favor, tente novamente.
        </div>
      `;
    }
  }
}

// Função para renderizar produtos
function renderProducts(products) {
  const productsGrid = document.getElementById('product-list');
  if (!productsGrid) return;
  
  if (!products || products.length === 0) {
    productsGrid.innerHTML = `
      <div class="no-products">
        Nenhum produto encontrado.
      </div>
    `;
    return;
  }
  
  productsGrid.innerHTML = products.map(product => {
    // Calcular porcentagem de desconto
    let discountPercentage = 0;
    if (product.original_price && product.original_price > product.price) {
      discountPercentage = Math.round(((product.original_price - product.price) / product.original_price) * 100);
    }
    
    // Formatar tamanhos
    let sizesText = '';
    if (product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0) {
      sizesText = product.sizes.join(', ');
    } else if (product.variations && Array.isArray(product.variations) && product.variations.length > 0) {
      // Coletar tamanhos únicos das variações
      const allSizes = [];
      product.variations.forEach(variation => {
        if (variation.sizes && Array.isArray(variation.sizes)) {
          allSizes.push(...variation.sizes);
        } else if (variation.size) {
          allSizes.push(variation.size);
        }
      });
      const uniqueSizes = [...new Set(allSizes)];
      if (uniqueSizes.length > 0) {
        sizesText = uniqueSizes.join(', ');
      }
    }
    
    return `
      <div class="product-card" data-product-id="${product.id}">
        <div class="product-image">
          <img src="${product.image || product.images?.[0] || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E'}" alt="${product.name}">
          ${product.variations && Array.isArray(product.variations) && product.variations.length > 0 ? `
            <div class="variations-badge" style="position: absolute; top: 10px; left: 10px; background: #ff0000; color: #ffffff; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; z-index: 2;">
              Várias opções
            </div>
          ` : ''}
          ${discountPercentage > 0 ? `
            <div class="discount-badge" style="position: absolute; top: 10px; right: 10px; background: #ff0000; color: #ffffff; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; z-index: 2;">
              -${discountPercentage}%
            </div>
          ` : ''}
        </div>
        <div class="product-info">
          <h3>${product.name}</h3>
          <div class="product-price">
            ${product.original_price && product.original_price > product.price ? `
              <span class="original-price">R$ ${product.original_price.toFixed(2)}</span>
            ` : ''}
            <span class="current-price">R$ ${product.price.toFixed(2)}</span>
          </div>
          ${sizesText ? `
            <div class="product-sizes" style="margin-top: 5px; font-size: 0.8rem; color: #ffffff;">
              Tamanhos: ${sizesText}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  // Adicionar event listeners para os cards de produto
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const productId = card.dataset.productId;
      window.location.href = `/pages/product.html?id=${productId}`;
    });
  });
}