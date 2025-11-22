// cart.js - Gerenciamento do carrinho de compras

// Função para inicializar o carrinho
function initializeCart() {
  console.log('Inicializando carrinho...');
  // Verificar se o carrinho já foi inicializado
  if (window.cartInitialized) {
    console.log('Carrinho já inicializado');
    return;
  }
  window.cartInitialized = true;
  console.log('Carrinho inicializado com sucesso');

  // Função para abrir o modal do carrinho
  function openCartModal() {
    console.log('Tentando abrir o modal do carrinho...');
    const cartModal = document.getElementById('cart-modal');
    console.log('Elemento cart-modal encontrado:', cartModal);
    if (cartModal) {
      console.log('Abrindo modal do carrinho');
      cartModal.classList.add('active');
      document.body.classList.add('modal-open');
      renderCartItems();
    } else {
      console.log('Elemento cart-modal não encontrado');
    }
  }

  // Função para fechar o modal do carrinho
  function closeCartModal() {
    const cartModal = document.getElementById('cart-modal');
    if (cartModal) {
      cartModal.classList.remove('active');
      document.body.classList.remove('modal-open');
    }
  }

  // Função para renderizar os itens do carrinho
  function renderCartItems() {
    const cartItemsContainer = document.getElementById('cart-items');
    if (!cartItemsContainer) return;

    try {
      const cart = JSON.parse(localStorage.getItem('hypex_cart') || '[]');
      
      if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
          <div class="empty-cart">
            <p>Seu carrinho está vazio</p>
            <a href="/" class="btn">Continuar comprando</a>
          </div>
        `;
        updateCartTotals();
        return;
      }

      // Renderizar itens do carrinho
      cartItemsContainer.innerHTML = cart.map(item => {
        // Criar string de variação/atributos
        let attributes = '';
        if (item.size) {
          attributes += `<div class="cart-item-attributes"><strong>Tamanho:</strong> ${item.size}</div>`;
        }
        if (item.variation_id) {
          // Se tiver variação, podemos mostrar informações adicionais
          // Por enquanto, vamos apenas mostrar que é uma variação
          if (!item.size) { // Se não tem tamanho específico, mostrar que é uma variação
            attributes += `<div class="cart-item-attributes"><strong>Variação:</strong> Selecionada</div>`;
          }
        }
        
        // Mostrar método de envio se disponível
        if (item.shipping_method) {
          let shippingText = '';
          if (typeof item.shipping_method === 'string') {
            // Método de envio simples (pickup, moto-uber, etc)
            const methodNames = {
              'pickup': 'Retirada no Local',
              'moto-uber': 'Entrega via Moto/Uber',
              'cep': 'Entrega via Correios'
            };
            shippingText = methodNames[item.shipping_method] || item.shipping_method;
          } else if (typeof item.shipping_method === 'object') {
            // Método de envio com detalhes (frete calculado)
            shippingText = `${item.shipping_method.name} - R$ ${parseFloat(item.shipping_method.price).toFixed(2)}`;
          }
          
          attributes += `<div class="cart-item-attributes"><strong>Envio:</strong> ${shippingText}</div>`;
        }
        
        return `
          <div class="cart-item" data-product-id="${item.product_id}">
            <div class="cart-item-image">
              <img src="${item.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f8f9fa" width="100" height="100"/%3E%3C/svg%3E'}" alt="${item.name}">
            </div>
            <div class="cart-item-details">
              <h4>${item.name}</h4>
              ${attributes}
              <p class="cart-item-price">R$ ${parseFloat(item.price).toFixed(2)}</p>
              <div class="cart-item-quantity">
                <button class="qty-btn minus" data-product-id="${item.product_id}">-</button>
                <span class="qty-value">${item.qty || 1}</span>
                <button class="qty-btn plus" data-product-id="${item.product_id}">+</button>
              </div>
            </div>
            <button class="remove-item" data-product-id="${item.product_id}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `;
      }).join('');

      // Adicionar event listeners para os botões de quantidade
      document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const productId = btn.dataset.productId;
          const isPlus = btn.classList.contains('plus');
          updateCartItemQuantity(productId, isPlus ? 1 : -1);
        });
      });

      // Adicionar event listeners para os botões de remover
      document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const productId = btn.dataset.productId;
          removeCartItem(productId);
        });
      });

      updateCartTotals();
    } catch (error) {
      console.error('Erro ao renderizar itens do carrinho:', error);
      cartItemsContainer.innerHTML = '<p>Erro ao carregar itens do carrinho</p>';
    }
  }

  // Função para atualizar a quantidade de um item no carrinho
  function updateCartItemQuantity(productId, change) {
    try {
      let cart = JSON.parse(localStorage.getItem('hypex_cart') || '[]');
      const itemIndex = cart.findIndex(item => item.product_id === productId);
      
      if (itemIndex !== -1) {
        cart[itemIndex].qty = Math.max(1, (cart[itemIndex].qty || 1) + change);
        
        // Se a quantidade for 0 ou menos, remover o item
        if (cart[itemIndex].qty <= 0) {
          cart.splice(itemIndex, 1);
        }
        
        localStorage.setItem('hypex_cart', JSON.stringify(cart));
        updateCartCount();
        renderCartItems();
      }
    } catch (error) {
      console.error('Erro ao atualizar quantidade do item:', error);
    }
  }

  // Função para remover um item do carrinho
  function removeCartItem(productId) {
    try {
      let cart = JSON.parse(localStorage.getItem('hypex_cart') || '[]');
      cart = cart.filter(item => item.product_id !== productId);
      localStorage.setItem('hypex_cart', JSON.stringify(cart));
      updateCartCount();
      renderCartItems();
    } catch (error) {
      console.error('Erro ao remover item do carrinho:', error);
    }
  }

  // Função para atualizar os totais do carrinho
  function updateCartTotals() {
    try {
      const cart = JSON.parse(localStorage.getItem('hypex_cart') || '[]');
      const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * (item.qty || 1)), 0);
      
      // Verificar se há frete selecionado
      let shippingCost = 0;
      const selectedShipping = localStorage.getItem('selectedShipping');
      if (selectedShipping) {
        try {
          const shipping = JSON.parse(selectedShipping);
          shippingCost = parseFloat(shipping.price) || 0;
        } catch (e) {
          console.error('Erro ao parsear frete selecionado:', e);
        }
      }
      
      // Se não houver frete selecionado no localStorage, verificar se os itens do carrinho têm frete
      if (shippingCost === 0) {
        // Calcular frete com base nos itens do carrinho
        shippingCost = cart.reduce((sum, item) => {
          if (item.shipping_method && typeof item.shipping_method === 'object' && item.shipping_method.price) {
            return sum + (parseFloat(item.shipping_method.price) * (item.qty || 1));
          }
          return sum;
        }, 0);
      }
      
      const total = subtotal + shippingCost;
      
      const subtotalElement = document.getElementById('cart-subtotal-value');
      const totalElement = document.getElementById('cart-total-value');
      const shippingTotalElement = document.getElementById('shipping-total');
      const shippingTotalValueElement = document.getElementById('shipping-total-value');
      
      if (subtotalElement) {
        subtotalElement.textContent = `R$ ${subtotal.toFixed(2)}`;
      }
      
      if (totalElement) {
        totalElement.textContent = `R$ ${total.toFixed(2)}`;
      }
      
      // Mostrar valor do frete se houver
      if (shippingTotalElement && shippingTotalValueElement) {
        if (shippingCost > 0) {
          shippingTotalElement.style.display = 'flex';
          shippingTotalValueElement.textContent = `R$ ${shippingCost.toFixed(2)}`;
        } else {
          shippingTotalElement.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar totais do carrinho:', error);
    }
  }

  // Função para atualizar o contador do carrinho
  function updateCartCount() {
    try {
      const cart = JSON.parse(localStorage.getItem('hypex_cart') || '[]');
      const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
      
      document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = count;
      });
    } catch (error) {
      console.error('Erro ao atualizar contador do carrinho:', error);
    }
  }

  // Event listeners para o botão do carrinho
  const cartButton = document.getElementById('cart-button');
  if (cartButton) {
    // Remover event listeners antigos para evitar duplicação
    cartButton.removeEventListener('click', handleCartButtonClick);
    cartButton.addEventListener('click', handleCartButtonClick);
  }

  // Função para lidar com o clique no botão do carrinho
  function handleCartButtonClick(e) {
    console.log('Botão do carrinho clicado');
    e.preventDefault();
    openCartModal();
  }

  // Event listeners para os botões de fechar o modal
  document.querySelectorAll('.close-modal').forEach(btn => {
    // Remover event listeners antigos para evitar duplicação
    btn.removeEventListener('click', handleCloseModalClick);
    btn.addEventListener('click', handleCloseModalClick);
  });

  // Função para lidar com o clique no botão de fechar modal
  function handleCloseModalClick(e) {
    e.preventDefault();
    closeCartModal();
  }
  
  // Função para fechar o modal do carrinho
  function closeCartModal() {
    const cartModal = document.getElementById('cart-modal');
    if (cartModal) {
      cartModal.classList.remove('active');
      document.body.classList.remove('modal-open');
      
      // Limpar seleção de frete
      localStorage.removeItem('selectedShipping');
    }
  }

  // Fechar modal ao clicar fora
  const cartModal = document.getElementById('cart-modal');
  if (cartModal) {
    // Remover event listeners antigos para evitar duplicação
    cartModal.removeEventListener('click', handleModalClick);
    cartModal.addEventListener('click', handleModalClick);
  }

  // Função para lidar com o clique no modal
  function handleModalClick(e) {
    if (e.target === cartModal) {
      closeCartModal();
    }
  }

  // Atualizar contador do carrinho ao carregar a página
  updateCartCount();

  // Atualizar contador quando o armazenamento local mudar
  window.addEventListener('storage', (e) => {
    if (e.key === 'hypex_cart') {
      updateCartCount();
      if (cartModal && cartModal.classList.contains('active')) {
        renderCartItems();
      }
    }
  });
  
  // Adicionar event listeners para os componentes do carrinho
  initializeCartComponents();
}

// Função para inicializar os componentes do carrinho
function initializeCartComponents() {
  // Aplicar cupom
  const couponInput = document.getElementById('coupon-code-input');
  const applyCouponBtn = document.getElementById('apply-coupon-btn');
  
  if (couponInput && applyCouponBtn) {
    applyCouponBtn.addEventListener('click', applyCoupon);
  }
  
  // Finalizar compra
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', proceedToCheckout);
  }
}

// Função para aplicar cupom
async function applyCoupon() {
  const couponInput = document.getElementById('coupon-code-input');
  const couponMessage = document.getElementById('coupon-message');
  const couponCode = couponInput.value.trim();
  
  if (!couponCode) {
    couponMessage.innerHTML = '<span style="color: #dc3545;">Informe um código de cupom</span>';
    return;
  }
  
  couponMessage.innerHTML = '<span>Verificando...</span>';
  
  try {
    // Simular verificação de cupom
    setTimeout(() => {
      if (couponCode.toLowerCase() === 'desconto10') {
        couponMessage.innerHTML = '<span style="color: #28a745;">Cupom aplicado! 10% de desconto</span>';
        
        // Mostrar desconto no carrinho
        const discountElement = document.getElementById('coupon-discount');
        const discountValueElement = document.getElementById('coupon-discount-value');
        if (discountElement && discountValueElement) {
          discountElement.style.display = 'flex';
          discountValueElement.textContent = '-R$ 10,00';
        }
        
        // Atualizar totais do carrinho
        if (typeof updateCartTotals === 'function') {
          updateCartTotals();
        } else {
          // Se a função não estiver disponível no escopo atual, tentar encontrar o elemento e atualizar manualmente
          try {
            const cart = JSON.parse(localStorage.getItem('hypex_cart') || '[]');
            const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * (item.qty || 1)), 0);
            
            const subtotalElement = document.getElementById('cart-subtotal-value');
            const totalElement = document.getElementById('cart-total-value');
            
            if (subtotalElement) {
              subtotalElement.textContent = `R$ ${subtotal.toFixed(2)}`;
            }
            
            if (totalElement) {
              totalElement.textContent = `R$ ${subtotal.toFixed(2)}`;
            }
          } catch (error) {
            console.error('Erro ao atualizar totais do carrinho:', error);
          }
        }
      } else {
        couponMessage.innerHTML = '<span style="color: #dc3545;">Cupom inválido ou expirado</span>';
      }
    }, 1000);
  } catch (error) {
    couponMessage.innerHTML = '<span style="color: #dc3545;">Erro ao aplicar cupom</span>';
  }
}

// Função para prosseguir para checkout
function proceedToCheckout() {
  try {
    const cart = JSON.parse(localStorage.getItem('hypex_cart') || '[]');
    
    if (cart.length === 0) {
      alert('Seu carrinho está vazio');
      return;
    }
    
    // Obter frete selecionado
    let selectedShipping = null;
    const selectedShippingStr = localStorage.getItem('selectedShipping');
    if (selectedShippingStr) {
      try {
        selectedShipping = JSON.parse(selectedShippingStr);
      } catch (e) {
        console.error('Erro ao parsear frete selecionado:', e);
      }
    }
    
    // Coletar dados para checkout
    const checkoutData = {
      items: cart,
      shipping: {
        type: 'cep' // Valor padrão, será substituído se houver método de envio nos itens
      }
    };
    
    // Verificar se os itens do carrinho têm métodos de envio específicos
    const firstItemWithShipping = cart.find(item => item.shipping_method);
    if (firstItemWithShipping && firstItemWithShipping.shipping_method) {
      if (typeof firstItemWithShipping.shipping_method === 'string') {
        // Método de envio simples
        checkoutData.shipping.type = firstItemWithShipping.shipping_method;
      } else if (typeof firstItemWithShipping.shipping_method === 'object') {
        // Método de envio com detalhes (frete calculado)
        checkoutData.shipping.type = 'cep';
        checkoutData.shipping.service_code = firstItemWithShipping.shipping_method.code;
        checkoutData.shipping.service_name = firstItemWithShipping.shipping_method.name;
        checkoutData.shipping.price = firstItemWithShipping.shipping_method.price;
        checkoutData.shipping.company = firstItemWithShipping.shipping_method.company;
      }
    }
    
    // Adicionar log para depuração
    console.log('Dados de checkout sendo enviados:', checkoutData);
    
    // Salvar dados no localStorage
    localStorage.setItem('hypex_checkout_data', JSON.stringify(checkoutData));
    
    // Redirecionar para página de checkout
    window.location.href = '/pages/checkout.html';
  } catch (error) {
    console.error('Erro ao prosseguir para checkout:', error);
    alert('Erro ao processar pedido');
  }
}

// Função para tentar inicializar o carrinho quando o DOM estiver pronto
function tryInitializeCart() {
  // Verificar se o elemento do carrinho existe na página
  if (document.getElementById('cart-button')) {
    initializeCart();
  }
}

// Inicializar o carrinho quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryInitializeCart);
} else {
  // DOM já está pronto
  tryInitializeCart();
}

// Tentar inicializar o carrinho após um pequeno atraso para garantir que todos os elementos estejam carregados
setTimeout(tryInitializeCart, 100);