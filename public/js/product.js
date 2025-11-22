// Carregar dados do produto
let currentProduct = null;
let selectedSize = null;
let selectedVariation = null;
let isFavorite = false;
let selectedShippingMethod = null; // Nova variável para armazenar o método de envio selecionado
let filteredVariations = []; // Array para armazenar variações filtradas por tamanho

// Função para atualizar contador do carrinho
function updateCartCount() {
  try {
    const cart = JSON.parse(localStorage.getItem('hypex_cart') || '[]');
    const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
    const cartCountEl = document.querySelector('.cart-count');
    if (cartCountEl) {
      cartCountEl.textContent = count;
    }
  } catch (e) {
    console.error('Erro ao atualizar contador do carrinho:', e);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  if (!productId) {
    showError();
    return;
  }

  await loadProduct(productId);
  await checkFavoriteStatus(productId);
  updateCartCount();
  
  // Adicionar event listeners para as opções de entrega
  setupDeliveryOptionsListeners();
});

// Função para configurar os event listeners das opções de entrega
function setupDeliveryOptionsListeners() {
  // Opções de entrega na página do produto
  const deliveryOptions = document.querySelectorAll('input[name="delivery-option"]');
  deliveryOptions.forEach(option => {
    option.addEventListener('change', function() {
      selectedShippingMethod = this.value;
      
      // Mostrar/esconder seções específicas
      const pickupSection = document.getElementById('pickup-section');
      const motoUberSection = document.getElementById('moto-uber-section');
      const cepSection = document.getElementById('cep-section');
      
      // Esconder todas as seções
      if (pickupSection) pickupSection.style.display = 'none';
      if (motoUberSection) motoUberSection.style.display = 'none';
      if (cepSection) cepSection.style.display = 'none';
      
      // Mostrar a seção selecionada
      switch (this.value) {
        case 'pickup':
          if (pickupSection) pickupSection.style.display = 'block';
          break;
        case 'moto-uber':
          if (motoUberSection) motoUberSection.style.display = 'block';
          break;
        case 'cep':
        default:
          if (cepSection) cepSection.style.display = 'block';
          break;
      }
    });
  });
  
  // Botão de calcular frete
  const calcShippingBtn = document.getElementById('calc-shipping-btn');
  if (calcShippingBtn) {
    calcShippingBtn.addEventListener('click', calculateShipping);
  }
  
  // Input de CEP
  const cepInput = document.getElementById('shipping-cep-input');
  if (cepInput) {
    cepInput.addEventListener('input', formatCep);
  }
}

// Função para formatar CEP (apenas números, sem hífen)
function formatCep(e) {
  let value = e.target.value.replace(/\D/g, '');
  // Limitar a 8 dígitos
  value = value.slice(0, 8);
  e.target.value = value;
}

// Função para calcular frete usando a API do Melhor Envio
async function calculateShipping() {
  const cepInput = document.getElementById('shipping-cep-input');
  const shippingResults = document.getElementById('shipping-results');
  const cep = cepInput.value.replace(/\D/g, '');
  
  if (cep.length !== 8) {
    shippingResults.innerHTML = '<span style="color: #dc3545;">CEP inválido</span>';
    return;
  }
  
  shippingResults.innerHTML = '<span>Calculando...</span>';
  
  try {
    // Obter quantidade de itens no carrinho (para este produto)
    const qtdItens = 1; // Como é a página do produto, estamos adicionando 1 item
    
    // Chamar API do Melhor Envio através do nosso backend
    const response = await fetch('/api/shipping/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cepDestino: cep,
        qtdItens: qtdItens,
        pesoPorItemKg: 0.3 // Peso médio por item em kg
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao calcular frete');
    }
    
    // Verificar se há serviços disponíveis
    if (!data.services || data.services.length === 0) {
      shippingResults.innerHTML = '<span style="color: #dc3545;">Nenhuma opção de frete disponível</span>';
      return;
    }
    
    // Ordenar por preço (do menor para o maior)
    const services = data.services.sort((a, b) => a.price - b.price);
    
    // Exibir opções de frete com seleção
    let html = '<div style="margin-top: 1rem;">';
    services.forEach((service, index) => {
      if (!service.error) {
        html += `
          <label style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 0.5rem; cursor: pointer;">
            <div style="display: flex; align-items: center;">
              <input type="radio" name="shipping-option" value="${service.code}" data-price="${service.price}" data-name="${service.name}" data-company="${service.company}" style="margin-right: 0.75rem;">
              <div>
                <strong>${service.name}</strong>
                <div style="font-size: 0.8rem; color: #666;">${service.company}</div>
              </div>
            </div>
            <div style="text-align: right;">
              <strong>R$ ${parseFloat(service.price).toFixed(2)}</strong>
              <div style="font-size: 0.8rem; color: #666;">${service.prazo} dias úteis</div>
            </div>
          </label>
        `;
      }
    });
    html += '</div>';
    
    // Se não houver serviços sem erro
    if (html === '<div style="margin-top: 1rem;"></div>') {
      html = '<span style="color: #dc3545;">Nenhuma opção de frete disponível</span>';
    }
    
    shippingResults.innerHTML = html;
    
    // Adicionar event listener para seleção de transportadora
    setTimeout(() => {
      const shippingOptions = document.querySelectorAll('input[name="shipping-option"]');
      shippingOptions.forEach(option => {
        option.addEventListener('change', function() {
          // Salvar a opção selecionada
          selectedShippingMethod = {
            code: this.value,
            name: this.dataset.name,
            company: this.dataset.company,
            price: parseFloat(this.dataset.price),
            type: 'cep'
          };
        });
      });
      
      // Selecionar automaticamente a primeira opção
      if (shippingOptions.length > 0) {
        shippingOptions[0].checked = true;
        shippingOptions[0].dispatchEvent(new Event('change'));
      }
    }, 100);
  } catch (error) {
    console.error('Erro ao calcular frete:', error);
    shippingResults.innerHTML = `<span style="color: #dc3545;">Erro ao calcular frete: ${error.message}</span>`;
  }
}

async function loadProduct(productId) {
  try {
    const response = await fetch(`/api/products/${productId}`);
    const data = await response.json();

    if (!response.ok || !data.product) {
      showError();
      return;
    }

    currentProduct = data.product;
    renderProduct(data.product);
  } catch (error) {
    console.error('Erro ao carregar produto:', error);
    showError();
  }
}

function renderProduct(product) {
  // Esconder loading e mostrar conteúdo
  const loadingElement = document.getElementById('product-loading');
  const detailElement = document.getElementById('product-detail');
  const errorElement = document.getElementById('product-error');
  
  if (loadingElement) loadingElement.style.display = 'none';
  if (detailElement) detailElement.style.display = 'grid';
  if (errorElement) errorElement.style.display = 'none';

  // Título
  const titleElement = document.getElementById('product-title');
  if (titleElement) titleElement.textContent = product.name;

  // Preço (will be updated based on variation selection)
  const priceElement = document.getElementById('product-price');
  const basePrice = Number(product.price || 0);
  if (priceElement) priceElement.textContent = `R$ ${basePrice.toFixed(2)}`;

  // Desconto (se aplicável)
  const hasDiscount = product.original_price && product.original_price > product.price;
  const discount = hasDiscount ? Math.round((1 - product.price / product.original_price) * 100) : 0;
  
  const originalPriceElement = document.getElementById('product-original-price');
  const discountBadgeElement = document.getElementById('product-discount-badge');
  
  if (hasDiscount && originalPriceElement && discountBadgeElement) {
    originalPriceElement.textContent = `R$ ${Number(product.original_price).toFixed(2)}`;
    originalPriceElement.style.display = 'inline';
    discountBadgeElement.textContent = `-${discount}% OFF`;
    discountBadgeElement.style.display = 'inline';
  } else if (originalPriceElement && discountBadgeElement) {
    originalPriceElement.style.display = 'none';
    discountBadgeElement.style.display = 'none';
  }

  // Estoque (will be updated based on variation selection)
  const stock = Number(product.stock || 0);
  const stockElement = document.getElementById('product-stock');
  if (stockElement) {
    if (stock > 0) {
      stockElement.textContent = `✓ Em estoque (${stock} unidades)`;
      stockElement.className = 'product-stock in-stock';
    } else {
      stockElement.textContent = '✗ Fora de estoque';
      stockElement.className = 'product-stock out-of-stock';
    }
  }

  // Imagens - usar a imagem do produto se existir, senão usar a imagem da primeira variação
  let images = product.images || [];
  let isVariationImage = false;
  
  // Se o produto não tem imagens próprias mas tem variações, usar as imagens da primeira variação
  if (images.length === 0 && product.variations && Array.isArray(product.variations) && product.variations.length > 0) {
    const firstVariation = product.variations[0];
    if (firstVariation.images && firstVariation.images.length > 0) {
      images = firstVariation.images;
      isVariationImage = true;
    }
  }
  
  const mainImageElement = document.getElementById('product-main-image');
  if (mainImageElement) {
    // Sempre atualizar a imagem principal com a primeira imagem disponível
    if (images.length > 0) {
      mainImageElement.src = images[0];
    } else {
      // Se não houver imagens, mostrar imagem padrão
      mainImageElement.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="800"%3E%3Crect fill="%23f8f9fa" width="600" height="800"/%3E%3C/svg%3E';
    }
    mainImageElement.alt = product.name;
  }

  // Container de miniaturas (lado esquerdo)
  const thumbnailsContainer = document.getElementById('product-thumbnails');
  
  // Adicionar controles de navegação para múltiplas imagens
  addImageNavigationControls(images, mainImageElement, thumbnailsContainer);

  // Verificar se o produto tem variações
  const hasVariations = product.variations && Array.isArray(product.variations) && product.variations.length > 0;

  // Variações do produto (se existirem)
  const variationsSpecElement = document.getElementById('product-variations-section');
  const variationsContainer = document.getElementById('product-variations');
  
  if (product.variations && Array.isArray(product.variations) && product.variations.length > 0 && variationsContainer && variationsSpecElement) {
    // Armazenar todas as variações para filtragem
    filteredVariations = [...product.variations];
    
    variationsContainer.innerHTML = product.variations.map(variation => {
      // Get the first image for this variation if available
      const variationImage = variation.images && variation.images.length > 0 ? variation.images[0] : null;
      
      return `
        <div class="variation-option" 
             data-variation-id="${variation.id}"
             data-price="${Number(variation.price || product.price || 0)}"
             data-stock="${Number(variation.stock || 0)}"
             data-color="${variation.color || ''}"
             data-sizes='${JSON.stringify(variation.sizes || [])}'
             data-size-stock='${JSON.stringify(variation.size_stock || {})}'
             style="border: 1px solid #ddd; border-radius: 8px; padding: 0.5rem; margin-bottom: 0.5rem; cursor: pointer; transition: all 0.2s; display: inline-block; margin-right: 0.5rem;">
          ${variationImage ? `<img src="${variationImage}" alt="${variation.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;">` : ''}
        </div>
      `;
    }).join('');

    // Event listeners para variações
    document.querySelectorAll('.variation-option').forEach(option => {
      option.addEventListener('click', () => {
        // Selecionar variação
        const variationOptions = document.querySelectorAll('.variation-option');
        if (variationOptions.length > 0) {
          variationOptions.forEach(o => o.style.border = '1px solid #ddd');
          option.style.border = '2px solid var(--accent)';
        }
        
        selectedVariation = {
          id: option.dataset.variationId,
          price: Number(option.dataset.price),
          stock: Number(option.dataset.stock),
          color: option.dataset.color,
          sizes: JSON.parse(option.dataset.sizes || '[]'),
          size_stock: JSON.parse(option.dataset.sizeStock || '{}')
        };
        
        // Update main image if variation has an image
        const variation = product.variations.find(v => v.id === selectedVariation.id);
        if (variation && variation.images && variation.images.length > 0) {
          updateMainImageDisplay(variation.images, 0);
          // Adicionar controles de navegação para as imagens da variação
          addImageNavigationControls(variation.images, mainImageElement, thumbnailsContainer);
        }
        
        updateProductDetails(); // Update price and stock based on variation selection
      });
    });

    variationsSpecElement.style.display = 'block';
  } else if (variationsSpecElement) {
    variationsSpecElement.style.display = 'none';
  }
  
  // Renderizar todos os tamanhos disponíveis
  renderAllSizes();
  
  // Descrição
  const descriptionTextElement = document.getElementById('product-description-text');
  const descriptionElement = document.getElementById('product-description');
  if (product.description && descriptionTextElement && descriptionElement) {
    descriptionTextElement.textContent = product.description;
    descriptionElement.style.display = 'block';
  }

  // Botão de adicionar ao carrinho
  const addCartBtn = document.getElementById('btn-add-cart');
  if (addCartBtn) {
    if (stock <= 0 && (!product.variations || product.variations.length === 0)) {
      addCartBtn.disabled = true;
      addCartBtn.innerHTML = '<i class="fas fa-ban"></i><span>Fora de Estoque</span>';
    } else {
      addCartBtn.disabled = false;
      addCartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Adicionar ao Carrinho</span>';
    }
  }

  // Configurar event listeners após renderizar
  setupEventListeners();
}

// Função para renderizar todos os tamanhos disponíveis do produto
function renderAllSizes() {
  if (!currentProduct) return;
  
  const sizesSectionElement = document.getElementById('product-variation-sizes-section');
  const sizesContainer = document.getElementById('product-variation-sizes');
  
  // Coletar todos os tamanhos únicos de todas as variações
  const allSizes = new Set();
  
  if (currentProduct.variations && Array.isArray(currentProduct.variations)) {
    currentProduct.variations.forEach(variation => {
      if (variation.sizes && Array.isArray(variation.sizes)) {
        variation.sizes.forEach(size => {
          if (size) allSizes.add(size.toUpperCase());
        });
      }
    });
  }
  
  // Converter para array e ordenar
  const sortedSizes = Array.from(allSizes).sort();
  
  if (sortedSizes.length > 0 && sizesContainer && sizesSectionElement) {
    sizesContainer.innerHTML = sortedSizes.map(size => `
      <span class="size-tag" data-size="${size}">${size}</span>
    `).join('');

    // Event listeners para tamanhos
    sizesContainer.querySelectorAll('.size-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        sizesContainer.querySelectorAll('.size-tag').forEach(t => t.classList.remove('selected'));
        tag.classList.add('selected');
        selectedSize = tag.dataset.size;
        
        // Filtrar variações com base no tamanho selecionado
        filterVariationsBySize(selectedSize);
      });
    });

    sizesSectionElement.style.display = 'block';
  } else if (sizesSectionElement) {
    sizesSectionElement.style.display = 'none';
  }
}

// Função para filtrar variações com base no tamanho selecionado
function filterVariationsBySize(size) {
  if (!currentProduct || !currentProduct.variations) return;
  
  const variationsContainer = document.getElementById('product-variations');
  if (!variationsContainer) return;
  
  // Filtrar variações que têm o tamanho selecionado
  const filtered = currentProduct.variations.filter(variation => 
    variation.sizes && variation.sizes.includes(size)
  );
  
  // Atualizar o array de variações filtradas
  filteredVariations = filtered;
  
  // Atualizar a exibição das variações
  variationsContainer.innerHTML = filtered.map(variation => {
    // Get the first image for this variation if available
    const variationImage = variation.images && variation.images.length > 0 ? variation.images[0] : null;
    
    // Determinar estoque a ser exibido
    let displayStock = variation.stock;
    if (selectedSize && variation.size_stock && variation.size_stock[selectedSize] !== undefined) {
      displayStock = variation.size_stock[selectedSize];
    }
          
    return `
      <div class="variation-option" 
           data-variation-id="${variation.id}"
           data-price="${Number(variation.price || (currentProduct ? currentProduct.price || 0 : 0))}"
           data-stock="${Number(variation.stock || 0)}"
           data-color="${variation.color || ''}"
           data-sizes='${JSON.stringify(variation.sizes || [])}'
           data-size-stock='${JSON.stringify(variation.size_stock || {})}'
           style="border: 1px solid #ddd; border-radius: 8px; padding: 0.5rem; margin-bottom: 0.5rem; cursor: pointer; transition: all 0.2s; display: inline-block; margin-right: 0.5rem;">
        ${variationImage ? `<img src="${variationImage}" alt="${variation.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;">` : ''}
        <div style="margin-top: 0.5rem; font-size: 0.8rem;">
          <div>Estoque: ${displayStock} unid.</div>
          ${variation.color ? `<div>Cor: ${variation.color}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  // Re-adicionar event listeners para as variações filtradas
  document.querySelectorAll('.variation-option').forEach(option => {
    option.addEventListener('click', () => {
      // Selecionar variação
      const variationOptions = document.querySelectorAll('.variation-option');
      if (variationOptions.length > 0) {
        variationOptions.forEach(o => o.style.border = '1px solid #ddd');
        option.style.border = '2px solid var(--accent)';
      }
      
      selectedVariation = {
        id: option.dataset.variationId,
        price: Number(option.dataset.price),
        stock: Number(option.dataset.stock),
        color: option.dataset.color,
        sizes: JSON.parse(option.dataset.sizes || '[]'),
        size_stock: JSON.parse(option.dataset.sizeStock || '{}')
      };
      
      // Update main image if variation has an image
      const variation = filtered.find(v => v.id === selectedVariation.id);
      if (variation && variation.images && variation.images.length > 0) {
        const mainImageElement = document.getElementById('product-main-image');
        const thumbnailsContainer = document.getElementById('product-thumbnails');
        updateMainImageDisplay(variation.images, 0);
        // Adicionar controles de navegação para as imagens da variação
        addImageNavigationControls(variation.images, mainImageElement, thumbnailsContainer);
      }
      
      updateProductDetails(); // Update price and stock based on variation selection
    });
  });
  
  // Selecionar automaticamente a primeira variação filtrada, se houver
  if (filtered.length > 0) {
    const firstOption = document.querySelector('.variation-option');
    if (firstOption) {
      // Disparar o evento de clique na primeira variação
      firstOption.click();
    }
  } else {
    // Limpar seleção se não houver variações para o tamanho
    selectedVariation = null;
    updateProductDetails();
  }
}

// Função para atualizar a exibição da imagem principal
function updateMainImageDisplay(images, activeIndex) {
  const mainImageElement = document.getElementById('product-main-image');
  if (mainImageElement && images.length > 0) {
    mainImageElement.src = images[activeIndex] || images[0];
    
    // Atualizar miniatura ativa
    const thumbnailsContainer = document.getElementById('product-thumbnails');
    if (thumbnailsContainer) {
      thumbnailsContainer.querySelectorAll('.thumbnail').forEach((thumb, index) => {
        thumb.classList.toggle('active', index === activeIndex);
      });
    }
  }
}

// Função para adicionar controles de navegação de imagens
function addImageNavigationControls(images, mainImageElement, thumbnailsContainer) {
  // Remover controles existentes
  const existingControls = document.querySelector('.image-navigation-controls');
  if (existingControls) {
    existingControls.remove();
  }
  
  // Remover miniaturas existentes
  if (thumbnailsContainer) {
    thumbnailsContainer.innerHTML = '';
  }
  
  // Adicionar miniaturas no container esquerdo (mesmo que tenha apenas uma imagem)
  if (images.length > 0 && thumbnailsContainer) {
    thumbnailsContainer.innerHTML = images.map((img, index) => `
      <div class="thumbnail ${index === 0 ? 'active' : ''}" data-index="${index}">
        <img src="${img}" alt="Miniatura ${index + 1}">
      </div>
    `).join('');
    
    // Adicionar event listeners para as miniaturas
    thumbnailsContainer.querySelectorAll('.thumbnail').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const index = parseInt(thumb.dataset.index);
        if (mainImageElement && images[index]) {
          mainImageElement.src = images[index];
          
          // Atualizar classe ativa
          thumbnailsContainer.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
        }
      });
    });
  }
}

// Função para atualizar detalhes do produto com base na seleção
function updateProductDetails() {
  if (!currentProduct) return;

  const priceElement = document.getElementById('product-price');
  const originalPriceElement = document.getElementById('product-original-price');
  const discountBadgeElement = document.getElementById('product-discount-badge');
  const stockElement = document.getElementById('product-stock');

  // Resetar descontos
  if (originalPriceElement) originalPriceElement.style.display = 'none';
  if (discountBadgeElement) discountBadgeElement.style.display = 'none';

  if (selectedVariation) {
    // Usar dados da variação selecionada
    const variationPrice = selectedVariation.price;
    let variationStock = selectedVariation.stock;
    
    // Verificar se há estoque específico para o tamanho selecionado
    if (selectedSize && selectedVariation.size_stock && selectedVariation.size_stock[selectedSize] !== undefined) {
      variationStock = selectedVariation.size_stock[selectedSize];
    }
    
    if (priceElement) priceElement.textContent = `R$ ${variationPrice.toFixed(2)}`;
    
    // Verificar se há desconto em relação ao preço base
    const basePrice = Number(currentProduct.price || 0);
    if (variationPrice < basePrice && variationPrice > 0 && originalPriceElement && discountBadgeElement) {
      const discount = Math.round((1 - variationPrice / basePrice) * 100);
      originalPriceElement.textContent = `R$ ${basePrice.toFixed(2)}`;
      originalPriceElement.style.display = 'inline';
      discountBadgeElement.textContent = `-${discount}% OFF`;
      discountBadgeElement.style.display = 'inline';
    }
    
    // Atualizar estoque
    if (stockElement) {
      if (variationStock > 0) {
        if (selectedSize && selectedVariation.size_stock && selectedVariation.size_stock[selectedSize] !== undefined) {
          stockElement.textContent = `✓ Em estoque (${variationStock} unidades disponíveis para tamanho ${selectedSize})`;
        } else {
          stockElement.textContent = `✓ Em estoque (${variationStock} unidades)`;
        }
        stockElement.className = 'product-stock in-stock';
      } else {
        if (selectedSize) {
          stockElement.textContent = `✗ Fora de estoque para tamanho ${selectedSize}`;
        } else {
          stockElement.textContent = '✗ Fora de estoque';
        }
        stockElement.className = 'product-stock out-of-stock';
      }
    }
    
    // Atualizar botão do carrinho
    const addCartBtn = document.getElementById('btn-add-cart');
    if (addCartBtn) {
      if (variationStock <= 0) {
        addCartBtn.disabled = true;
        addCartBtn.innerHTML = '<i class="fas fa-ban"></i><span>Fora de Estoque</span>';
      } else {
        addCartBtn.disabled = false;
        addCartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Adicionar ao Carrinho</span>';
      }
    }
  } else if (selectedSize) {
    // Usar dados do produto base (tamanho selecionado)
    const basePrice = Number(currentProduct.price || 0);
    
    // Calcular estoque total para o tamanho selecionado
    let totalStock = 0;
    if (currentProduct.variations && Array.isArray(currentProduct.variations)) {
      currentProduct.variations.forEach(variation => {
        // Verificar estoque por tamanho se disponível
        if (variation.size_stock && variation.size_stock[selectedSize] !== undefined) {
          totalStock += variation.size_stock[selectedSize];
        } else if (variation.sizes && variation.sizes.includes(selectedSize) && variation.stock > 0) {
          totalStock += variation.stock;
        }
      });
    }
    
    if (priceElement) priceElement.textContent = `R$ ${basePrice.toFixed(2)}`;
    
    // Verificar desconto base
    if (currentProduct.original_price && currentProduct.original_price > basePrice && originalPriceElement && discountBadgeElement) {
      const discount = Math.round((1 - basePrice / currentProduct.original_price) * 100);
      originalPriceElement.textContent = `R$ ${Number(currentProduct.original_price).toFixed(2)}`;
      originalPriceElement.style.display = 'inline';
      discountBadgeElement.textContent = `-${discount}% OFF`;
      discountBadgeElement.style.display = 'inline';
    }
    
    // Atualizar estoque com a quantidade total disponível para o tamanho selecionado
    if (stockElement) {
      if (totalStock > 0) {
        stockElement.textContent = `✓ Em estoque (${totalStock} unidades disponíveis para tamanho ${selectedSize})`;
        stockElement.className = 'product-stock in-stock';
      } else {
        stockElement.textContent = `✗ Fora de estoque para tamanho ${selectedSize}`;
        stockElement.className = 'product-stock out-of-stock';
      }
    }
    
    // Atualizar botão do carrinho
    const addCartBtn = document.getElementById('btn-add-cart');
    if (addCartBtn) {
      if (totalStock <= 0) {
        addCartBtn.disabled = true;
        addCartBtn.innerHTML = '<i class="fas fa-ban"></i><span>Fora de Estoque</span>';
      } else {
        addCartBtn.disabled = false;
        addCartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Adicionar ao Carrinho</span>';
      }
    }
  } else {
    // Nenhuma variação ou tamanho selecionado, usar dados base
    const basePrice = Number(currentProduct.price || 0);
    const baseStock = Number(currentProduct.stock || 0);
    
    if (priceElement) priceElement.textContent = `R$ ${basePrice.toFixed(2)}`;
    
    // Verificar desconto base
    if (currentProduct.original_price && currentProduct.original_price > basePrice && originalPriceElement && discountBadgeElement) {
      const discount = Math.round((1 - basePrice / currentProduct.original_price) * 100);
      originalPriceElement.textContent = `R$ ${Number(currentProduct.original_price).toFixed(2)}`;
      originalPriceElement.style.display = 'inline';
      discountBadgeElement.textContent = `-${discount}% OFF`;
      discountBadgeElement.style.display = 'inline';
    }
    
    // Atualizar estoque
    if (stockElement) {
      if (baseStock > 0) {
        stockElement.textContent = `✓ Em estoque (${baseStock} unidades)`;
        stockElement.className = 'product-stock in-stock';
      } else {
        stockElement.textContent = '✗ Fora de estoque';
        stockElement.className = 'product-stock out-of-stock';
      }
    }
    
    // Atualizar botão do carrinho
    const addCartBtn = document.getElementById('btn-add-cart');
    if (addCartBtn) {
      if (baseStock <= 0) {
        addCartBtn.disabled = true;
        addCartBtn.innerHTML = '<i class="fas fa-ban"></i><span>Fora de Estoque</span>';
      } else {
        addCartBtn.disabled = false;
        addCartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i><span>Adicionar ao Carrinho</span>';
      }
    }
  }
}

function setupEventListeners() {
  // Botão de adicionar ao carrinho
  const addCartBtn = document.getElementById('btn-add-cart');
  if (addCartBtn) {
    // Remover event listeners anteriores se existirem
    const newAddCartBtn = addCartBtn.cloneNode(true);
    if (addCartBtn.parentNode) {
      addCartBtn.parentNode.replaceChild(newAddCartBtn, addCartBtn);
    }
    
    newAddCartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!currentProduct) {
        console.error('Produto não carregado');
        return;
      }

      // Verificar se o produto tem variações - se tiver, é obrigatório selecionar uma variação
      if (currentProduct.variations && Array.isArray(currentProduct.variations) && currentProduct.variations.length > 0) {
        if (!selectedVariation) {
          alert('Por favor, selecione uma variação do produto antes de adicionar ao carrinho.');
          return;
        }
        
        // Se o produto tem variações, verificar se um tamanho foi selecionado
        if (selectedVariation.sizes && selectedVariation.sizes.length > 0) {
          if (!selectedSize) {
            alert('Por favor, selecione um tamanho antes de adicionar ao carrinho.');
            return;
          }
        }
      } else {
        // Se não tem variações, verificar se o produto tem tamanhos e se um tamanho foi selecionado
        if (currentProduct.sizes && Array.isArray(currentProduct.sizes) && currentProduct.sizes.length > 0) {
          if (!selectedSize) {
            alert('Por favor, selecione um tamanho antes de adicionar ao carrinho.');
            return;
          }
        }
      }
      
      // Verificar se o método de envio foi selecionado
      if (!selectedShippingMethod) {
        alert('Por favor, selecione um método de recebimento antes de adicionar ao carrinho.');
        return;
      }

      // Determinar estoque com base na seleção
      let stock = Number(currentProduct.stock || 0);
      let price = Number(currentProduct.price || 0);
      let variationId = null;
      let variationName = null;
      
      if (selectedVariation) {
        // Verificar se há estoque específico para o tamanho selecionado
        if (selectedSize && selectedVariation.size_stock && selectedVariation.size_stock[selectedSize] !== undefined) {
          stock = selectedVariation.size_stock[selectedSize];
        } else {
          stock = selectedVariation.stock;
        }
        price = selectedVariation.price;
        variationId = selectedVariation.id;
        // Encontrar o nome da variação
        if (currentProduct.variations) {
          const variation = currentProduct.variations.find(v => v.id === variationId);
          if (variation) {
            variationName = variation.name;
          }
        }
      } else if (selectedSize) {
        // Se um tamanho foi selecionado, manter os dados base
      }

      // Verificar se há estoque
      if (stock <= 0) {
        alert('Produto fora de estoque!');
        return;
      }

      // Adicionar ao carrinho
      // Determinar a imagem correta para o produto/variação
      let productImage = null;
      
      if (selectedVariation && currentProduct.variations) {
        // Se uma variação está selecionada, usar a imagem da variação
        const variation = currentProduct.variations.find(v => v.id === variationId);
        if (variation) {
          // Usar a primeira imagem da variação se disponível
          productImage = (variation.images && variation.images.length > 0) ? variation.images[0] : null;
        }
      }
      
      // Se não temos imagem da variação, tentar usar a imagem do produto base
      if (!productImage && currentProduct.images && currentProduct.images.length > 0) {
        productImage = currentProduct.images[0];
      }
      
      // Se ainda não temos imagem, usar placeholder
      if (!productImage) {
        productImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
      }
      
      const productToAdd = {
        id: currentProduct.id,
        name: variationName ? `${currentProduct.name} - ${variationName}` : currentProduct.name,
        price: price,
        image: productImage,
        stock: stock,
        qty: 1,
        checked: true,
        size: selectedSize,
        variation_id: variationId,
        shipping_method: selectedShippingMethod // Adicionar método de envio ao produto
      };

      // Usar a função do app.js se disponível
      if (typeof window.addItemToCart === 'function') {
        window.addItemToCart(productToAdd);
      } else {
        // Fallback se a função não estiver disponível
        try {
          let cart = JSON.parse(localStorage.getItem('hypex_cart') || '[]');
          
          // Verificar se o item já está no carrinho
          const existingItemIndex = cart.findIndex(item => 
            item.product_id === productToAdd.id && 
            item.variation_id === productToAdd.variation_id &&
            item.size === productToAdd.size
          );
          
          if (existingItemIndex >= 0) {
            // Verificar se há estoque suficiente
            if (cart[existingItemIndex].qty >= stock) {
              alert(`Quantidade máxima disponível: ${stock} unidades`);
              return;
            }
            cart[existingItemIndex].qty += 1;
          } else {
            cart.push({
              product_id: productToAdd.id,
              name: productToAdd.name,
              price: productToAdd.price,
              image: productToAdd.image,
              stock: productToAdd.stock,
              qty: 1,
              checked: true,
              size: productToAdd.size,
              variation_id: productToAdd.variation_id,
              shipping_method: productToAdd.shipping_method // Adicionar método de envio
            });
          }
          
          localStorage.setItem('hypex_cart', JSON.stringify(cart));
          alert('Produto adicionado ao carrinho!');
          
          // Atualizar contador do carrinho
          updateCartCount();
        } catch (error) {
          console.error('Erro ao adicionar ao carrinho:', error);
          alert('Erro ao adicionar produto ao carrinho. Por favor, tente novamente.');
        }
      }
    });
  }

  // Botão de favorito
  const favoriteBtn = document.getElementById('btn-favorite');
  if (favoriteBtn && currentProduct) {
    // Remover event listeners anteriores se existirem
    const newFavoriteBtn = favoriteBtn.cloneNode(true);
    if (favoriteBtn.parentNode) {
      favoriteBtn.parentNode.replaceChild(newFavoriteBtn, favoriteBtn);
    }
    
    newFavoriteBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!currentProduct) {
        console.error('Produto não carregado');
        return;
      }

      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          alert('Faça login para adicionar aos favoritos');
          window.location.href = '/pages/auth.html';
          return;
        }

        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ product_id: currentProduct.id })
        });

        if (response.ok) {
          isFavorite = true;
          favoriteBtn.classList.add('active');
          favoriteBtn.innerHTML = '<i class="fas fa-heart"></i>';
          alert('Produto adicionado aos favoritos!');
        } else {
          const error = await response.json();
          alert(error.error || 'Erro ao adicionar aos favoritos');
        }
      } catch (error) {
        console.error('Erro ao adicionar aos favoritos:', error);
        alert('Erro ao adicionar aos favoritos. Por favor, tente novamente.');
      }
    });
  }
}

// Função para verificar se o produto está nos favoritos
async function checkFavoriteStatus(productId) {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const response = await fetch(`/api/favorites/${productId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      isFavorite = data.is_favorite;
      
      const favoriteBtn = document.getElementById('btn-favorite');
      if (favoriteBtn) {
        if (isFavorite) {
          favoriteBtn.classList.add('active');
          favoriteBtn.innerHTML = '<i class="fas fa-heart"></i>';
        } else {
          favoriteBtn.classList.remove('active');
          favoriteBtn.innerHTML = '<i class="far fa-heart"></i>';
        }
      }
    }
  } catch (error) {
    console.error('Erro ao verificar status de favorito:', error);
  }
}

function showError() {
  const loadingElement = document.getElementById('product-loading');
  const detailElement = document.getElementById('product-detail');
  const errorElement = document.getElementById('product-error');
  
  if (loadingElement) loadingElement.style.display = 'none';
  if (detailElement) detailElement.style.display = 'none';
  if (errorElement) errorElement.style.display = 'block';
}