document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('hypex_token');
  const user = JSON.parse(localStorage.getItem('hypex_user') || '{}');

  if (!token || user.role !== 'admin') {
    document.querySelectorAll('.admin-section').forEach(section => {
      section.innerHTML = '<p>Você precisa estar logado como admin para acessar esta área.</p>';
    });
    return;
  }

  // Nav Tabs
  document.querySelectorAll('.admin-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.admin-nav-link').forEach(l => l.classList.remove('active'));
      document.getElementById(section).classList.add('active');
      link.classList.add('active');
    });
  });

  // Load Orders
  const ordersList = document.getElementById('orders-list');
  // Buscar tanto pedidos confirmados quanto pedidos pendentes
  Promise.all([
    fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` }}),
    fetch('/api/orders/pending', { headers: { Authorization: `Bearer ${token}` }})
  ])
    .then(async ([ordersRes, pendingRes]) => {
      const ordersData = await ordersRes.json();
      const pendingData = await pendingRes.json();
      
      let allOrders = [];
      
      // Adicionar pedidos confirmados
      if (ordersData.orders) {
        allOrders = [...allOrders, ...ordersData.orders];
      }
      
      // Adicionar pedidos pendentes com status apropriado
      if (pendingData.orders) {
        const pendingOrders = pendingData.orders.map(order => ({
          ...order,
          status: 'pedido feito', // Pedidos pendentes são considerados "pedido feito"
          pending: true // Marcar como pedido pendente
        }));
        allOrders = [...allOrders, ...pendingOrders];
      }
      
      if (!allOrders.length) {
        ordersList.innerHTML = '<p>Sem pedidos ou acesso negado.</p>';
        return;
      }

      // Organizar pedidos por status
      const ordersByStatus = {
        'pedido feito': [],
        'em separacao': [],
        'enviado': [],
        'entregue': [],
        'pedido cancelado': [],
        'outros': []
      };

      allOrders.forEach(o => {
        const status = o.status || 'pedido feito';
        if (ordersByStatus[status]) {
          ordersByStatus[status].push(o);
        } else {
          ordersByStatus['outros'].push(o);
        }
      });

      // Ordem de exibição: pedido feito primeiro (destacado), depois os outros
      const statusOrder = ['pedido feito', 'em separacao', 'enviado', 'entregue', 'pedido cancelado', 'outros'];
      const statusLabels = {
        'pedido feito': 'Pedidos Feitos',
        'em separacao': 'Em Separação',
        'enviado': 'Enviados',
        'entregue': 'Entregues',
        'pedido cancelado': 'Pedidos Cancelados',
        'outros': 'Outros Status'
      };

      ordersList.innerHTML = '';

      // Renderizar pedidos agrupados por status
      statusOrder.forEach(status => {
        const orders = ordersByStatus[status];
        if (orders.length === 0) return;

        // Criar seção de status
        const statusSection = document.createElement('div');
        statusSection.className = 'orders-status-section';
        if (status === 'pedido feito') {
          statusSection.classList.add('status-highlighted');
        }

        const statusTitle = document.createElement('h4');
        statusTitle.className = 'status-section-title';
        statusTitle.textContent = `${statusLabels[status]} (${orders.length})`;
        statusSection.appendChild(statusTitle);

        const statusContainer = document.createElement('div');
        statusContainer.className = 'status-orders-container';
        statusSection.appendChild(statusContainer);

        orders.forEach(o => {
  const el = document.createElement('div');
  el.className = 'order-card';
  // Destacar pedidos com status "pedido feito"
  if ((o.status || 'pedido feito') === 'pedido feito') {
    el.classList.add('order-highlighted');
  }

  // Monta HTML dos itens (usa name se existir, senão mostra product_id)
  const itemsHtml = (Array.isArray(o.items) ? o.items : []).map(i => {
    const prodName = i.name || i.product_id || 'Produto';
    const qty = Number(i.qty || 1);
    const price = Number(i.price || 0);
    return `<li>${prodName} — ${qty} x R$ ${price.toFixed(2)} <small>(subtotal R$ ${(qty * price).toFixed(2)})</small></li>`;
  }).join('');

  // Formatar endereço do pedido ou do usuário
  function formatAddress(address) {
    if (!address) return '<em class="text-muted">— sem endereço cadastrado —</em>';
    
    // Se for string, retornar como está (pode ser endereço simples)
    if (typeof address === 'string') {
      return address.trim() || '<em class="text-muted">— endereço vazio —</em>';
    }
    
    // Se for objeto, formatar de forma estruturada
    if (typeof address === 'object') {
      const parts = [];
      
      // Verificar se é o novo formato com firstName, lastName, etc.
      if (address.firstName || address.lastName) {
        // Formato novo com dados completos
        const fullName = [address.firstName, address.lastName].filter(Boolean).join(' ');
        if (fullName) parts.push(`<strong>${fullName}</strong>`);
        
        // Endereço completo
        const streetAddress = [address.rua, address.numero].filter(Boolean).join(', ');
        if (streetAddress) parts.push(streetAddress);
        
        if (address.complemento) parts.push(address.complemento);
        
        const cityState = [address.cidade, address.estado].filter(Boolean).join(' - ');
        if (cityState) parts.push(cityState);
        
        if (address.cep) parts.push(`CEP: ${address.cep}`);
        
        // Contato
        if (address.telefone) parts.push(`📞 ${address.telefone}`);
        if (address.email) parts.push(`📧 ${address.email}`);
        
        return parts.join('<br>');
      }
      
      // Formato antigo (compatibilidade)
      // Rua e número
      if (address.street || address.rua) {
        const street = address.street || address.rua;
        const number = address.number || address.numero;
        if (number) {
          parts.push(`${street}, ${number}`);
        } else {
          parts.push(street);
        }
      }
      
      // Complemento
      if (address.complement || address.complemento) {
        parts.push(address.complement || address.complemento);
      }
      
      // Bairro
      if (address.neighborhood || address.bairro) {
        parts.push(address.neighborhood || address.bairro);
      }
      
      // Cidade e Estado
      if (address.city || address.cidade) {
        const city = address.city || address.cidade;
        const state = address.state || address.estado || address.uf;
        if (state) {
          parts.push(`${city} - ${state}`);
        } else {
          parts.push(city);
        }
      }
      
      // CEP
      if (address.zipcode || address.cep || address.zip) {
        const cep = address.zipcode || address.cep || address.zip;
        parts.push(`CEP: ${cep}`);
      }
      
      // Se não encontrou nenhum campo conhecido, tentar exibir como JSON formatado
      if (parts.length === 0) {
        // Tentar outros formatos possíveis
        if (address.address) {
          return formatAddress(address.address);
        }
        return '<em class="text-muted">— formato de endereço não reconhecido —</em>';
      }
      
      return parts.join(', ');
    }
    
    return '<em class="text-muted">— endereço inválido —</em>';
  }

  // Priorizar endereço do pedido, senão usar do usuário
  const deliveryAddress = o.address || o.user_address;
  const formattedAddress = formatAddress(deliveryAddress);

  el.innerHTML = `
    <div class="order-header">
      <h4>Pedido #${o.id.substring(0, 8)}... — <small>${o.status}</small></h4>
      <div class="order-meta">
        <div><strong>Cliente:</strong> ${o.user_name || 'Usuário'} ${o.user_email ? `(${o.user_email})` : ''}</div>
        <div><strong>Total:</strong> R$ ${Number(o.total || 0).toFixed(2)}</div>
        <div><strong>Data:</strong> ${new Date(o.created_at).toLocaleString('pt-BR')}</div>
      </div>
    </div>

    <div class="order-address-section">
      <h5><i class="fas fa-map-marker-alt"></i> Endereço de Entrega</h5>
      <div class="address-display">${formattedAddress}</div>
    </div>

    <div class="order-items">
      <h5><i class="fas fa-shopping-bag"></i> Itens do Pedido</h5>
      <ul>
        ${itemsHtml || '<li>(nenhum item)</li>'}
      </ul>
    </div>

    <div class="admin-actions">
      <select data-order-id="${o.id}" class="status-select">
        <option value="pedido feito">Pedido feito</option>
        <option value="em separacao">Em separação</option>
        <option value="enviado">Enviado</option>
        <option value="entregue">Entregue</option>
        <option value="pedido cancelado">Pedido cancelado</option>
      </select>
      <button data-order-id="${o.id}" class="save-status btn btn-outline">Salvar Status</button>
      ${o.pending ? `<button data-order-id="${o.id}" class="confirm-order btn btn-primary">Confirmar Pedido</button>` : ''}
    </div>
  `;

  // setar o valor atual do select (pois as opções são estáticas)
  const statusSelect = el.querySelector('.status-select');
  if (statusSelect) statusSelect.value = o.status || 'pedido feito';

  statusContainer.appendChild(el);
        });

        ordersList.appendChild(statusSection);
      });

      // Set current statuses
      document.querySelectorAll('.status-select').forEach(sel => {
        const id = sel.getAttribute('data-order-id');
        const order = allOrders.find(x => String(x.id) === String(id));
        if (order) sel.value = order.status;
      });

      document.querySelectorAll('.save-status').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = btn.getAttribute('data-order-id');
          const sel = document.querySelector(`.status-select[data-order-id="${id}"]`);
          const status = sel.value;
          try {
            const res = await fetch(`/api/orders/${id}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ status })
            });
            const json = await res.json();
            if (res.ok) {
              alert('Status atualizado');
              // Recarregar pedidos para reorganizar por status
              location.reload();
            } else {
              throw new Error(json.error || 'Erro');
            }
          } catch (err) {
            alert(err.message);
          }
        });
      });

      // Adicionar evento para o botão de confirmar pedido
      document.querySelectorAll('.confirm-order').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = btn.getAttribute('data-order-id');
          if (!confirm('Tem certeza que deseja confirmar este pedido?')) return;
          
          try {
            const res = await fetch(`/api/orders/${id}/confirm`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json', 
                Authorization: `Bearer ${token}` 
              }
            });
            
            const json = await res.json();
            if (res.ok) {
              alert('Pedido confirmado com sucesso!');
              // Recarregar pedidos para atualizar a lista
              location.reload();
            } else {
              throw new Error(json.error || 'Erro ao confirmar pedido');
            }
          } catch (err) {
            alert(err.message);
          }
        });
      });

    }).catch(err => {
      ordersList.innerHTML = '<p>Erro ao carregar pedidos.</p>';
      console.error(err);
    });

  // Products Management
  const productModal = document.getElementById('product-modal');
  const productForm = document.getElementById('product-form');
  const addProductBtn = document.getElementById('add-product');
  const productsGrid = document.querySelector('#products-list .products-grid');
  let currentProduct = null;

  // Load Products
  async function loadProducts() {
    try {
      const res = await fetch('/api/products', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!data.products) throw new Error('Sem produtos.');

      // Limpar grid antes de adicionar novos produtos
      productsGrid.innerHTML = '';
      
      // Garantir altura mínima do grid
      productsGrid.style.minHeight = '400px';
      
      // Garantir que o grid mantenha seu tamanho independente do conteúdo
      productsGrid.style.width = '100%';
      
      data.products.forEach(p => {
        const el = document.createElement('div');
        el.className = 'product-card';
        const img = p.image || (p.images && p.images.length ? p.images[0] : null) || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400"%3E%3Crect fill="%23f8f9fa" width="300" height="400"/%3E%3C/svg%3E';
        const sizesText = p.sizes && Array.isArray(p.sizes) && p.sizes.length > 0 
          ? p.sizes.join(', ') 
          : 'N/A';
        const typeText = p.type || 'N/A';
        const colorText = p.color || 'N/A';
        const brandText = p.brand || 'N/A';
        const statusText = p.is_active ? 'Ativo' : 'Inativo';
        const statusClass = p.is_active ? 'status-active' : 'status-inactive';
        
        el.innerHTML = `
          <img src="${img}" alt="${p.name}">
          <div class="product-info">
            <h4>${p.name}</h4>
            <p>R$ ${Number(p.price).toFixed(2)}</p>
            <p><small>Em estoque: ${p.stock}</small></p>
            <p><small><strong>Marca:</strong> ${brandText} | <strong>Tipo:</strong> ${typeText} | <strong>Cor:</strong> ${colorText}</small></p>
            <p><small><strong>Tamanhos:</strong> ${sizesText}</small></p>
            <p><small><strong>Status:</strong> <span class="${statusClass}">${statusText}</span></small></p>
            <div class="admin-actions">
              <button class="btn btn-outline edit-product" data-id="${p.id}">Editar</button>
              <button class="btn btn-outline delete-product" data-id="${p.id}">Excluir</button>
            </div>
          </div>
        `;
        productsGrid.appendChild(el);

        // Edit button
        el.querySelector('.edit-product').addEventListener('click', () => editProduct(p));
        
        // Delete button
        el.querySelector('.delete-product').addEventListener('click', async () => {
          if (!confirm('Tem certeza que deseja excluir este produto?')) return;
          try {
            const res = await fetch(`/api/products/${p.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              el.remove();
              alert('Produto excluído com sucesso.');
              
              // Verificar se não há mais produtos e ajustar altura do grid
              if (productsGrid.children.length === 0) {
                productsGrid.style.minHeight = '400px';
              }
            } else {
              throw new Error('Erro ao excluir produto.');
            }
          } catch (err) {
            alert(err.message);
          }
        });
      });
      
      // Se não há produtos, manter altura mínima
      if (data.products.length === 0) {
        productsGrid.innerHTML = '<p>Nenhum produto cadastrado.</p>';
        productsGrid.style.display = 'flex';
        productsGrid.style.alignItems = 'center';
        productsGrid.style.justifyContent = 'center';
      }
    } catch (err) {
      productsGrid.innerHTML = '<p>Erro ao carregar produtos.</p>';
      productsGrid.style.minHeight = '400px';
      productsGrid.style.display = 'flex';
      productsGrid.style.alignItems = 'center';
      productsGrid.style.justifyContent = 'center';
      console.error(err);
    }
  }

  // Product Variations Functions
  let productVariations = [];

  function addVariation() {
    console.log('Adicionando nova variação');
    
    // Generate a temporary ID for new variations
    const variationId = 'new_' + Date.now().toString();
    const variation = {
      id: variationId, // Temporary ID for new variations
      name: '',
      price: '',
      stock: '',
      images: [],
      sizes: [],
      size_stock: {} // Adicionar campo size_stock vazio
    };
    
    productVariations.push(variation);
    renderVariation(variation);
  }

  function removeVariation(id) {
    console.log('Removendo variação com ID:', id);
    
    // Remove from UI
    const variationElement = document.querySelector(`.variation-item[data-variation-id="${id}"]`);
    if (variationElement) {
      variationElement.remove();
    }
    
    // Remove from our array
    const index = productVariations.findIndex(v => v.id === id);
    if (index !== -1) {
      productVariations.splice(index, 1);
      console.log('Variação removida do array. Array atual:', productVariations);
    }
    
    // Se for uma variação existente no banco de dados, também precisamos removê-la do servidor
    if (!id.startsWith('new_')) {
      // Confirmar com o usuário antes de excluir do servidor
      if (confirm('Tem certeza que deseja excluir esta variação? Esta ação não pode ser desfeita.')) {
        fetch(`/api/variations/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        .then(res => {
          if (res.ok) {
            alert('Variação excluída com sucesso!');
          } else {
            // Tentar ler a resposta de erro como JSON
            return res.json().then(errorData => {
              throw new Error(errorData.error || 'Erro ao excluir variação');
            }).catch(() => {
              // Se não conseguir ler como JSON, usar mensagem genérica
              throw new Error('Erro ao excluir variação');
            });
          }
        })
        .catch(err => {
          console.error('Erro ao excluir variação:', err);
          alert('Erro ao excluir variação: ' + err.message);
        });
      }
    }
  }

  function renderVariation(variation) {
    console.log('Renderizando variação:', variation);
    
    const container = document.getElementById('variations-container');
    const variationElement = document.createElement('div');
    variationElement.className = 'variation-item';
    variationElement.dataset.variationId = variation.id;
    
    // Converter size_stock para objeto se for string
    let sizeStock = {};
    if (variation.size_stock) {
      if (typeof variation.size_stock === 'string') {
        try {
          sizeStock = JSON.parse(variation.size_stock);
        } catch (e) {
          console.warn('Erro ao parsear size_stock:', e);
          sizeStock = {};
        }
      } else if (typeof variation.size_stock === 'object') {
        sizeStock = variation.size_stock;
      }
      console.log('sizeStock processado para renderização:', sizeStock);
    }
    
    variationElement.innerHTML = `
    <div style="border: 1px solid #ddd; border-radius: 4px; padding: 1rem; margin-bottom: 1rem; background: #f9f9f9;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <h5 style="margin: 0;">Variação</h5>
        <button type="button" class="btn btn-outline remove-variation" data-variation-id="${variation.id}" style="padding: 0.25rem 0.5rem; font-size: 0.875rem;">
          <i class="fas fa-trash"></i> Remover
        </button>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Nome da Variação</label>
          <input type="text" class="variation-name" data-variation-id="${variation.id}" value="${variation.name}" placeholder="Ex: Camisa Azul M">
        </div>
      </div>
      
      <!-- Checkboxes de tamanho para variações -->
      <div class="form-group">
        <label>Tamanhos Disponíveis para esta Variação <span class="variation-sizes-counter" style="color: #666; font-weight: normal;">(0/8 selecionados)</span></label>
        <div class="variation-sizes-limit-message" style="display: none; padding: 0.5rem; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; margin-bottom: 0.5rem; color: #856404; font-size: 0.875rem;">
          <i class="fas fa-exclamation-triangle"></i> Limite de 8 tamanhos atingido. Desmarque um tamanho para selecionar outro.
        </div>
        <div class="checkbox-group" style="display: flex; flex-wrap: wrap; gap: 1rem;">
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" name="variation_sizes_${variation.id}" value="PP" class="variation-size-checkbox" data-variation-id="${variation.id}" ${variation.sizes && variation.sizes.includes('PP') ? 'checked' : ''}>
            <span>PP</span>
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" name="variation_sizes_${variation.id}" value="P" class="variation-size-checkbox" data-variation-id="${variation.id}" ${variation.sizes && variation.sizes.includes('P') ? 'checked' : ''}>
            <span>P</span>
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" name="variation_sizes_${variation.id}" value="M" class="variation-size-checkbox" data-variation-id="${variation.id}" ${variation.sizes && variation.sizes.includes('M') ? 'checked' : ''}>
            <span>M</span>
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" name="variation_sizes_${variation.id}" value="G" class="variation-size-checkbox" data-variation-id="${variation.id}" ${variation.sizes && variation.sizes.includes('G') ? 'checked' : ''}>
            <span>G</span>
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" name="variation_sizes_${variation.id}" value="GG" class="variation-size-checkbox" data-variation-id="${variation.id}" ${variation.sizes && variation.sizes.includes('GG') ? 'checked' : ''}>
            <span>GG</span>
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" name="variation_sizes_${variation.id}" value="G1" class="variation-size-checkbox" data-variation-id="${variation.id}" ${variation.sizes && variation.sizes.includes('G1') ? 'checked' : ''}>
            <span>G1</span>
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" name="variation_sizes_${variation.id}" value="G2" class="variation-size-checkbox" data-variation-id="${variation.id}" ${variation.sizes && variation.sizes.includes('G2') ? 'checked' : ''}>
            <span>G2</span>
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" name="variation_sizes_${variation.id}" value="G3" class="variation-size-checkbox" data-variation-id="${variation.id}" ${variation.sizes && variation.sizes.includes('G3') ? 'checked' : ''}>
            <span>G3</span>
          </label>
        </div>
      </div>
      
      <!-- Inputs de estoque por tamanho -->
      <div class="form-group">
        <label>Estoque por Tamanho</label>
        <div class="size-stock-inputs" style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.5rem;">
          <div style="display: flex; flex-direction: column; min-width: 80px;">
            <label style="font-size: 0.8rem; margin-bottom: 0.25rem;">PP</label>
            <input type="number" class="size-stock-input" data-variation-id="${variation.id}" data-size="PP" value="${sizeStock.PP || ''}" min="0" placeholder="0" style="width: 60px; padding: 0.25rem;">
          </div>
          <div style="display: flex; flex-direction: column; min-width: 80px;">
            <label style="font-size: 0.8rem; margin-bottom: 0.25rem;">P</label>
            <input type="number" class="size-stock-input" data-variation-id="${variation.id}" data-size="P" value="${sizeStock.P || ''}" min="0" placeholder="0" style="width: 60px; padding: 0.25rem;">
          </div>
          <div style="display: flex; flex-direction: column; min-width: 80px;">
            <label style="font-size: 0.8rem; margin-bottom: 0.25rem;">M</label>
            <input type="number" class="size-stock-input" data-variation-id="${variation.id}" data-size="M" value="${sizeStock.M || ''}" min="0" placeholder="0" style="width: 60px; padding: 0.25rem;">
          </div>
          <div style="display: flex; flex-direction: column; min-width: 80px;">
            <label style="font-size: 0.8rem; margin-bottom: 0.25rem;">G</label>
            <input type="number" class="size-stock-input" data-variation-id="${variation.id}" data-size="G" value="${sizeStock.G || ''}" min="0" placeholder="0" style="width: 60px; padding: 0.25rem;">
          </div>
          <div style="display: flex; flex-direction: column; min-width: 80px;">
            <label style="font-size: 0.8rem; margin-bottom: 0.25rem;">GG</label>
            <input type="number" class="size-stock-input" data-variation-id="${variation.id}" data-size="GG" value="${sizeStock.GG || ''}" min="0" placeholder="0" style="width: 60px; padding: 0.25rem;">
          </div>
          <div style="display: flex; flex-direction: column; min-width: 80px;">
            <label style="font-size: 0.8rem; margin-bottom: 0.25rem;">G1</label>
            <input type="number" class="size-stock-input" data-variation-id="${variation.id}" data-size="G1" value="${sizeStock.G1 || ''}" min="0" placeholder="0" style="width: 60px; padding: 0.25rem;">
          </div>
          <div style="display: flex; flex-direction: column; min-width: 80px;">
            <label style="font-size: 0.8rem; margin-bottom: 0.25rem;">G2</label>
            <input type="number" class="size-stock-input" data-variation-id="${variation.id}" data-size="G2" value="${sizeStock.G2 || ''}" min="0" placeholder="0" style="width: 60px; padding: 0.25rem;">
          </div>
          <div style="display: flex; flex-direction: column; min-width: 80px;">
            <label style="font-size: 0.8rem; margin-bottom: 0.25rem;">G3</label>
            <input type="number" class="size-stock-input" data-variation-id="${variation.id}" data-size="G3" value="${sizeStock.G3 || ''}" min="0" placeholder="0" style="width: 60px; padding: 0.25rem;">
          </div>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Preço (R$)</label>
          <input type="number" class="variation-price" data-variation-id="${variation.id}" value="${variation.price}" min="0" step="0.01" placeholder="Preço da variação">
        </div>
        <div class="form-group">
          <label>Estoque Geral</label>
          <input type="number" class="variation-stock" data-variation-id="${variation.id}" value="${variation.stock}" min="0" placeholder="Quantidade em estoque">
          <small style="color: #666;">Este estoque será usado quando não houver estoque específico por tamanho</small>
        </div>
      </div>
      
      <div class="form-group">
        <label>Imagens da Variação</label>
        <input type="file" class="variation-images" data-variation-id="${variation.id}" multiple accept="image/*">
        <div class="variation-image-preview" data-variation-id="${variation.id}" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; position: relative;">
          ${variation.images && Array.isArray(variation.images) ? variation.images.map((img, index) => `
            <div style="position: relative; display: inline-block;">
              <img src="${img}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
              <button type="button" class="remove-variation-image-btn" data-variation-id="${variation.id}" data-image-url="${img}" style="position: absolute; top: -8px; right: -8px; background: #dc3545; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;">×</button>
            </div>
          `).join('') : ''}
        </div>
      </div>
    </div>
  `;
  
  container.appendChild(variationElement);
  
  // Add event listeners for the new variation
  variationElement.querySelector('.remove-variation').addEventListener('click', (e) => {
    const id = e.target.closest('.remove-variation').dataset.variationId;
    removeVariation(id);
  });
  
  // Add event listeners for input changes
  variationElement.querySelector('.variation-name').addEventListener('input', (e) => {
    const id = e.target.dataset.variationId;
    const variation = productVariations.find(v => v.id === id);
    if (variation) variation.name = e.target.value;
  });
  
  variationElement.querySelector('.variation-price').addEventListener('input', (e) => {
    const id = e.target.dataset.variationId;
    const variation = productVariations.find(v => v.id === id);
    if (variation) variation.price = e.target.value;
  });

  // Add event listener for stock by size
  document.addEventListener('input', function (e) {
    if (e.target.classList.contains('size-stock-input')) {
      const id = e.target.dataset.variationId;
      const size = e.target.dataset.size;
      const variation = productVariations.find(v => v.id === id);
      if (variation) {
        variation.size_stock[size] = parseInt(e.target.value);
        console.log(`Estoque por tamanho atualizado para variação ${id}:`, variation.size_stock);
        console.log(`Chaves de size_stock da variação ${id}:`, Object.keys(variation.size_stock));
      }
    };
  });

  // Add event listener for image upload
  document.addEventListener('change', function (e) {
    if (e.target.classList.contains('image-upload-input')) {
      const id = e.target.dataset.variationId;
      const variation = productVariations.find(v => v.id === id);
      if (variation) {
        variation.image = e.target.files[0];
      }
    }
  });

  
  variationElement.querySelector('.variation-stock').addEventListener('input', (e) => {
    const id = e.target.dataset.variationId;
    const variation = productVariations.find(v => v.id === id);
    if (variation) variation.stock = e.target.value;
  });
  
  // Adicionar event listeners para os inputs de estoque por tamanho
  variationElement.querySelectorAll('.size-stock-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.dataset.variationId;
      const size = e.target.dataset.size;
      const value = e.target.value;
      
      console.log(`Input de estoque alterado - ID: ${id}, Tamanho: ${size}, Valor: ${value}`);
      
      const variation = productVariations.find(v => v.id === id);
      if (variation) {
        if (!variation.size_stock) {
          variation.size_stock = {};
          console.log('Inicializando size_stock como objeto vazio para variação:', id);
        }
        
        if (value === '' || value === '0') {
          delete variation.size_stock[size];
          console.log(`Removendo tamanho ${size} do size_stock da variação ${id}`);
        } else {
          variation.size_stock[size] = parseInt(value) || 0;
          console.log(`Atualizando tamanho ${size} do size_stock da variação ${id} para ${parseInt(value) || 0}`);
        }
        
        console.log(`Estoque por tamanho atualizado para variação ${id}:`, variation.size_stock);
        console.log(`Chaves de size_stock da variação ${id}:`, Object.keys(variation.size_stock));
      }
    });
  });
  
  // Add event listener for image upload
  const imageInput = variationElement.querySelector('.variation-images');
  imageInput.addEventListener('change', (e) => {
    const id = e.target.dataset.variationId;
    const variation = productVariations.find(v => v.id === id);
    if (variation) {
      // Store the selected files in the variation object
      variation.imageFiles = e.target.files;
      // Preview the selected images
      const previewContainer = variationElement.querySelector(`.variation-image-preview[data-variation-id="${id}"]`);
      previewContainer.innerHTML = '';
      
      if (e.target.files.length > 0) {
        Array.from(e.target.files).forEach(file => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target.result;
            img.style.width = '60px';
            img.style.height = '60px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '4px';
            previewContainer.appendChild(img);
          };
          reader.readAsDataURL(file);
        });
      }
    }
  });
  
  // Função para atualizar contador de tamanhos da variação
  function updateVariationSizesCounter(variationId) {
    const checkboxes = variationElement.querySelectorAll(`.variation-size-checkbox[data-variation-id="${variationId}"]`);
    const checked = variationElement.querySelectorAll(`.variation-size-checkbox[data-variation-id="${variationId}"]:checked`);
    const count = checked.length;
    const maxSizes = 8;
    
    const counter = variationElement.querySelector(`.variation-sizes-counter`);
    const limitMessage = variationElement.querySelector(`.variation-sizes-limit-message`);
    
    if (counter) {
      counter.textContent = `(${count}/${maxSizes} selecionados)`;
      if (count >= maxSizes) {
        counter.style.color = '#dc3545';
        counter.style.fontWeight = '600';
      } else {
        counter.style.color = '#666';
        counter.style.fontWeight = 'normal';
      }
    }
    
    if (limitMessage) {
      if (count >= maxSizes) {
        limitMessage.style.display = 'block';
      } else {
        limitMessage.style.display = 'none';
      }
    }
    
    // Desabilitar checkboxes não selecionados quando o limite for atingido
    checkboxes.forEach(cb => {
      if (count >= maxSizes && !cb.checked) {
        cb.disabled = true;
      } else {
        cb.disabled = false;
      }
    });
  }
  
  // Adicionar event listeners para os checkboxes de tamanhos da variação
  variationElement.querySelectorAll('.variation-size-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const id = e.target.dataset.variationId;
      const variation = productVariations.find(v => v.id === id);
      if (variation) {
        const checked = variationElement.querySelectorAll(`.variation-size-checkbox[data-variation-id="${id}"]:checked`);
        const maxSizes = 8;
        
        // Se tentar marcar e já tiver 8 selecionados, desmarcar
        if (e.target.checked && checked.length > maxSizes) {
          e.target.checked = false;
          alert('Você pode selecionar no máximo 8 tamanhos.');
          updateVariationSizesCounter(id); // Atualizar contador mesmo após desmarcar
          return;
        }
        
        // Atualizar array de tamanhos na variação
        variation.sizes = Array.from(checked).map(cb => cb.value);
        updateVariationSizesCounter(id);
      }
    });
  });
  
  // Inicializar contador de tamanhos
  updateVariationSizesCounter(variation.id);
  
  // Add event listeners for remove variation image buttons
  setTimeout(() => {
    variationElement.querySelectorAll('.remove-variation-image-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const variationId = e.target.closest('.remove-variation-image-btn').dataset.variationId;
        const imageUrl = e.target.closest('.remove-variation-image-btn').dataset.imageUrl;
        
        if (!confirm('Tem certeza que deseja remover esta imagem?')) return;
        
        try {
          const res = await fetch(`/api/variations/${variationId}/remove-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              imageUrl: imageUrl,
              deviceType: 'pc' // Para simplificar, assumimos que todas as imagens são PC
            })
          });
          
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Erro ao remover imagem.');
          }
          
          // Remover a imagem do preview
          e.target.closest('div[style*="position: relative"]').remove();
          
          // Atualizar o array de imagens na variação
          const variation = productVariations.find(v => v.id === variationId);
          if (variation && variation.images) {
            variation.images = variation.images.filter(img => img !== imageUrl);
          }
          
          alert('Imagem removida com sucesso!');
        } catch (err) {
          console.error('Erro ao remover imagem:', err);
          alert('Erro ao remover imagem: ' + err.message);
        }
      });
    });
  }, 0);
}

function clearVariations() {
  console.log('Limpando variações');
  productVariations = [];
  document.getElementById('variations-container').innerHTML = '';
  console.log('Variações limpas. Array atual:', productVariations);
}

function loadVariationsForProduct(productId) {
  // Fetch existing variations from the API
  fetch(`/api/variations/product/${productId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(data => {
    if (data.variations && Array.isArray(data.variations)) {
      // Clear existing variations
      clearVariations();
      
      console.log('Variações carregadas do backend:', data.variations);
      
      // Add each variation to the UI
      data.variations.forEach(variation => {
        console.log(`Processando variação ${variation.id}:`, variation);
        
        // Add to our variations array with the proper ID
        productVariations.push({
          id: variation.id,
          name: variation.name,
          color: variation.color || '',
          size: variation.size || '',
          price: variation.price || '',
          stock: variation.stock || '',
          images: variation.images || [],
          sizes: variation.sizes || [], // Adicionar o campo sizes
          size_stock: variation.size_stock || {} // Adicionar o campo size_stock
        });
        
        // Render the variation in the UI
        renderVariation({
          id: variation.id,
          name: variation.name,
          color: variation.color || '',
          size: variation.size || '',
          price: variation.price || '',
          stock: variation.stock || '',
          images: variation.images || [],
          sizes: variation.sizes || [], // Adicionar o campo sizes
          size_stock: variation.size_stock || {} // Adicionar o campo size_stock
        });
      });
    }
  })
  .catch(err => {
    console.error('Erro ao carregar variações:', err);
    // Clear variations on error
    clearVariations();
  });
}

// Função para atualizar contador de tamanhos e validar limite
function updateSizesCounter() {
  const checkboxes = productForm.querySelectorAll('.size-checkbox');
  const checked = productForm.querySelectorAll('.size-checkbox:checked');
  const count = checked.length;
  const maxSizes = 9;
  
  const counter = document.getElementById('sizes-counter');
  const limitMessage = document.getElementById('sizes-limit-message');
  
  if (counter) {
    counter.textContent = `(${count}/${maxSizes} selecionados)`;
    if (count >= maxSizes) {
      counter.style.color = '#dc3545';
      counter.style.fontWeight = '600';
    } else {
      counter.style.color = '#666';
      counter.style.fontWeight = 'normal';
    }
  }
  
  if (limitMessage) {
    if (count >= maxSizes) {
      limitMessage.style.display = 'block';
    } else {
      limitMessage.style.display = 'none';
    }
  }
  
  // Desabilitar checkboxes não selecionados quando o limite for atingido
  checkboxes.forEach(cb => {
    if (count >= maxSizes && !cb.checked) {
      cb.disabled = true;
    } else {
      cb.disabled = false;
    }
  });
}

// Adicionar event listeners para os checkboxes de tamanhos
// Usar delegação de eventos para garantir que funcione mesmo se os elementos forem recriados
productForm.addEventListener('change', (e) => {
  if (e.target.classList.contains('size-checkbox')) {
    const checked = productForm.querySelectorAll('.size-checkbox:checked');
    const maxSizes = 9;
    
    // Se tentar marcar e já tiver 9 selecionados, desmarcar
    if (e.target.checked && checked.length > maxSizes) {
      e.target.checked = false;
      alert('Você pode selecionar no máximo 9 tamanhos.');
      updateSizesCounter(); // Atualizar contador mesmo após desmarcar
      return;
    }
    
    updateSizesCounter();
  }
});

// Atualizar contador quando o formulário for resetado
productForm.addEventListener('reset', () => {
  setTimeout(() => updateSizesCounter(), 0); // Usar setTimeout para garantir que o reset aconteceu
});

// Inicializar contador ao carregar
updateSizesCounter();

// Open modal to add product
addProductBtn.addEventListener('click', () => {
  currentProduct = null;
  productForm.reset();
  productForm.querySelector('[name=id]').value = '';
  
  // Limpar previews de imagens
  const pcPreview = productForm.querySelector('.pc-preview');
  const mobilePreview = productForm.querySelector('.mobile-preview');
  if (pcPreview) pcPreview.innerHTML = '';
  if (mobilePreview) mobilePreview.innerHTML = '';
  
  // Limpar inputs de arquivo
  if (productForm.querySelector('[name=pc_images]')) {
    productForm.querySelector('[name=pc_images]').value = '';
  }
  if (productForm.querySelector('[name=mobile_images]')) {
    productForm.querySelector('[name=mobile_images]').value = '';
  }
  
  updateSizesCounter(); // Resetar contador
  clearVariations(); // Clear variations
  
  // Ensure modal can scroll
  const modalContent = productModal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.scrollTop = 0;
  }
  
  // Garantir que o modal não seja afetado pela lista de produtos
  productModal.style.display = 'flex';
  productModal.style.position = 'fixed';
  productModal.style.zIndex = '1000';
});

// Close modal
document.querySelectorAll('.close-modal').forEach(btn => {
  btn.addEventListener('click', () => {
    productModal.style.display = 'none';
    // Garantir que o modal não afete a lista de produtos ao fechar
    productModal.style.position = 'fixed';
    productModal.style.zIndex = '1000';
  });
});

// Add variation button
document.getElementById('add-variation').addEventListener('click', addVariation);

// Edit product
// Edit product
function editProduct(product) {
  currentProduct = product;
  productForm.reset();
  
  // Preencher o formulário com os dados do produto
  Object.keys(product).forEach(key => {
    // Pular campos do tipo file, pois não podem ter seus valores definidos programaticamente
    if (key === 'pc_images' || key === 'mobile_images') return;
    
    const field = productForm.querySelector(`[name=${key}]`);
    if (field) {
      if (field.type === 'file') {
        // Não definir valor para campos de arquivo
        return;
      } else if (key === 'is_active' || key === 'is_featured') {
        field.checked = product[key];
      } else if (key === 'sizes' && Array.isArray(product[key])) {
        // Marcar os checkboxes de tamanho
        product[key].forEach(size => {
          const checkbox = productForm.querySelector(`[name=sizes][value="${size}"]`);
          if (checkbox) checkbox.checked = true;
        });
      } else {
        field.value = product[key];
      }
    }
  });  
  // Corrigir: definir o ID do produto corretamente para edição
  productForm.querySelector('[name=id]').value = product.id;
  
  // Limpar previews de imagens
  const pcPreview = productForm.querySelector('.pc-preview');
  const mobilePreview = productForm.querySelector('.mobile-preview');
  if (pcPreview) pcPreview.innerHTML = '';
  if (mobilePreview) mobilePreview.innerHTML = '';
  
  // Limpar inputs de arquivo (não podemos definir valores para campos de arquivo, apenas deixar como estão)
  // Campos de arquivo não podem ter seus valores definidos programaticamente por questões de segurança
  
  updateSizesCounter(); // Resetar contador
  clearVariations(); // Clear variations
  // Atualizar contador de tamanhos
  updateSizesCounter();
  
  // Carregar variações do produto
  loadVariationsForProduct(product.id);
  
  
  if (product.images && Array.isArray(product.images.pc)) {
    product.images.pc.forEach(img => {
      const imgEl = document.createElement('img');
      imgEl.src = img;
      imgEl.style.width = '100px';
      imgEl.style.height = '100px';
      imgEl.style.objectFit = 'cover';
      imgEl.style.margin = '0.25rem';
      pcPreview.appendChild(imgEl);
    });
  }
  if (product.images && Array.isArray(product.images.mobile)) {
    product.images.mobile.forEach(img => {
      const imgEl = document.createElement('img');
      imgEl.src = img;
      imgEl.style.width = '60px';
      imgEl.style.height = '60px';
      imgEl.style.objectFit = 'cover';
      imgEl.style.margin = '0.25rem';
      mobilePreview.appendChild(imgEl);
    });
  }
  
  // Garantir que o modal possa rolar
  const modalContent = productModal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.scrollTop = 0;
  }
  
  // Garantir que o modal não seja afetado pela lista de produtos
  productModal.style.display = 'flex';
  productModal.style.position = 'fixed';
  productModal.style.zIndex = '1000';
}

  // Handle form submit
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Formulário de produto submetido');
    
    // Função para lidar com variações do produto
    async function handleVariations(productId) {
      console.log('Processando variações para produto:', productId);
      console.log('Variações atuais:', productVariations);
      
      // Process each variation
      for (const variation of productVariations) {
        console.log('Processando variação:', variation);
        
        // Check if there are image files to upload
        const hasImageFiles = variation.imageFiles && variation.imageFiles.length > 0;
        console.log('Variação tem arquivos de imagem:', hasImageFiles);
        
        if (hasImageFiles) {
          // Create FormData for variation with images
          const variationFormData = new FormData();
          variationFormData.append('product_id', productId);
          variationFormData.append('name', variation.name || '');
          variationFormData.append('color', variation.color || '');
          variationFormData.append('size', variation.size || '');
          variationFormData.append('price', Number(variation.price || 0));
          variationFormData.append('stock', Number(variation.stock || 0));
          
          // Adicionar tamanhos da variação
          if (variation.sizes && Array.isArray(variation.sizes)) {
            variation.sizes.forEach(size => {
              variationFormData.append('sizes', size);
            });
          }
          
          // Adicionar estoque por tamanho
          if (variation.size_stock && Object.keys(variation.size_stock).length > 0) {
            console.log('Adicionando size_stock ao FormData:', variation.size_stock);
            console.log('Chaves de size_stock:', Object.keys(variation.size_stock));
            variationFormData.append('size_stock', JSON.stringify(variation.size_stock));
          } else {
            console.log('size_stock está vazio ou indefinido, não será adicionado ao FormData');
            console.log('Valor de size_stock:', variation.size_stock);
          }
          
          // Add image files (for backward compatibility, we'll add them to both pc_images and mobile_images)
          // In a real implementation, you might want to separate these
          for (let i = 0; i < variation.imageFiles.length; i++) {
            variationFormData.append('pc_images', variation.imageFiles[i]);
            variationFormData.append('mobile_images', variation.imageFiles[i]);
          }
          
          if (variation.id && !variation.id.startsWith('new_')) {
            // Update existing variation with images
            console.log('Atualizando variação existente com imagens:', variation.id);
            const updateRes = await fetch(`/api/variations/${variation.id}`, {
              method: 'PUT',
              headers: { 
                Authorization: `Bearer ${token}` 
              },
              body: variationFormData
            });
            
            if (!updateRes.ok) {
              const errorData = await updateRes.json();
              console.error('Erro ao atualizar variação:', errorData);
              alert(`Erro ao atualizar variação: ${errorData.error || 'Erro desconhecido'}`);
            }
          } else {
            // Create new variation with images
            console.log('Criando nova variação com imagens');
            const createRes = await fetch('/api/variations', {
              method: 'POST',
              headers: { 
                Authorization: `Bearer ${token}` 
              },
              body: variationFormData
            });
            
            if (!createRes.ok) {
              const errorData = await createRes.json();
              console.error('Erro ao criar variação:', errorData);
              alert(`Erro ao criar variação: ${errorData.error || 'Erro desconhecido'}`);
            }
          }
        } else {
          // No images to upload, use JSON
          const variationData = {
            product_id: productId,
            name: variation.name,
            color: variation.color || '',
            size: variation.size || '',
            price: Number(variation.price || 0),
            stock: Number(variation.stock || 0),
            sizes: variation.sizes && Array.isArray(variation.sizes) ? variation.sizes : [], // Adicionar tamanhos da variação
            size_stock: variation.size_stock && Object.keys(variation.size_stock).length > 0 ? variation.size_stock : {} // Adicionar estoque por tamanho
          };
          
          // Log para depuração
          console.log('Enviando dados da variação:', variationData);
          console.log('Chaves de variationData:', Object.keys(variationData));
          
          // Adicionar log específico para size_stock
          console.log('Dados de size_stock sendo enviados:', variationData.size_stock);
          console.log('Chaves de size_stock:', Object.keys(variationData.size_stock));
          
          // Log adicional para verificar se size_stock está vazio
          if (Object.keys(variationData.size_stock).length === 0) {
            console.log('size_stock está vazio');
          }
          
          // Verificar se size_stock está presente em variationData
          if ('size_stock' in variationData) {
            console.log('size_stock está presente em variationData');
          } else {
            console.log('size_stock NÃO está presente em variationData');
          }
          
          if (variation.id && !variation.id.startsWith('new_')) {
            // Update existing variation
            console.log('Atualizando variação existente:', variation.id);
            const updateRes = await fetch(`/api/variations/${variation.id}`, {
              method: 'PUT',
              headers: { 
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}` 
              },
              body: JSON.stringify(variationData)
            });
            
            if (!updateRes.ok) {
              const errorData = await updateRes.json();
              console.error('Erro ao atualizar variação:', errorData);
              alert(`Erro ao atualizar variação: ${errorData.error || 'Erro desconhecido'}`);
            }
          } else {
            // Create new variation
            console.log('Criando nova variação');
            const createRes = await fetch('/api/variations', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}` 
              },
              body: JSON.stringify(variationData)
            });

            if (!createRes.ok) {
              const errorData = await createRes.json();
              console.error('Erro ao criar variação:', errorData);
              alert(`Erro ao criar variação: ${errorData.error || 'Erro desconhecido'}`);
            }
          }
        }
      }
    }    
    const formData = new FormData(productForm);
    const id = formData.get('id');
    const isEdit = id && currentProduct;
    
    console.log('ID do produto:', id);
    console.log('É edição:', isEdit);
    
    // Processar tamanhos selecionados
    const selectedSizes = [];
    productForm.querySelectorAll('[name=sizes]:checked').forEach(cb => {
      selectedSizes.push(cb.value);
    });
    
    console.log('Tamanhos selecionados:', selectedSizes);
    
    // Validar limite de tamanhos antes de enviar
    if (selectedSizes.length > 9) {
      alert('Você pode selecionar no máximo 9 tamanhos. Por favor, desmarque alguns tamanhos.');
      return;
    }
    
    try {
      // Verificar se há novas imagens sendo enviadas
      const pcImageInput = productForm.querySelector('[name=pc_images]');
      const mobileImageInput = productForm.querySelector('[name=mobile_images]');
      const pcImageFiles = pcImageInput ? pcImageInput.files : [];
      const mobileImageFiles = mobileImageInput ? mobileImageInput.files : [];
      const hasNewImages = (pcImageFiles && pcImageFiles.length > 0) || (mobileImageFiles && mobileImageFiles.length > 0);
      
      console.log('Tem novas imagens:', hasNewImages);
      
      // Prepare product data
      const productData = {
        name: formData.get('name'),
        description: formData.get('description'),
        price: Number(formData.get('price') || 0),
        stock: Number(formData.get('stock') || 0),
        type: formData.get('type') || null,
        color: formData.get('color') || null,
        brand: formData.get('brand') || null,
        is_active: formData.get('is_active') === 'true', // Adicionando o campo is_active
        is_featured: formData.get('is_featured') === 'true', // Adicionando o campo is_featured
        sizes: selectedSizes.length > 0 ? selectedSizes : []
      };
      
      console.log('Dados do produto:', productData);
      
      // Adicionar desconto ao produto
      const discountPercent = Number(formData.get('discount') || 0);
      if (discountPercent > 0) {
        // Calcular o preço original com base no desconto
        const currentPrice = productData.price;
        const originalPrice = currentPrice / (1 - discountPercent / 100);
        productData.original_price = Number(originalPrice.toFixed(2));
      }
      
      // Handle main product images upload
      if (hasNewImages) {
        // Create a new FormData object to handle file uploads
        const productFormData = new FormData();
        
        // Add all the product data fields
        Object.keys(productData).forEach(key => {
          if (key === 'sizes') {
            // Handle array field
            productData[key].forEach(size => {
              productFormData.append('sizes', size);
            });
          } else if (key === 'is_active') {
            // Convert boolean to string for FormData
            productFormData.append(key, productData[key].toString());
          } else {
            productFormData.append(key, productData[key]);
          }
        });
        
        // Add PC image files
        if (pcImageFiles.length > 0) {
          for (let i = 0; i < pcImageFiles.length; i++) {
            productFormData.append('pc_images', pcImageFiles[i]);
          }
        }
        
        // Add mobile image files
        if (mobileImageFiles.length > 0) {
          for (let i = 0; i < mobileImageFiles.length; i++) {
            productFormData.append('mobile_images', mobileImageFiles[i]);
          }
        }
        
        if (isEdit) {
          // Update existing product with images
          console.log('Atualizando produto existente com imagens');
          const res = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 
              Authorization: `Bearer ${token}` 
            },
            body: productFormData
          });
          
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Erro ao salvar produto.');
          }
          
          // Handle variations for the existing product
          await handleVariations(id);
        } else {
          // Create new product with images
          console.log('Criando novo produto com imagens');
          const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 
              Authorization: `Bearer ${token}` 
            },
            body: productFormData
          });
          
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Erro ao criar produto.');
          }
          
          const productResult = await res.json();
          const productId = productResult.product.id;
          
          // Handle variations for the new product
          await handleVariations(productId);
        }
      } else {
        // No images to upload, use JSON
        if (isEdit) {
          // Update existing product without images
          console.log('Atualizando produto existente sem imagens');
          const res = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify(productData)
          });
          
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Erro ao salvar produto.');
          }
          
          // Handle variations for the existing product
          await handleVariations(id);
        } else {
          // Create new product without images
          console.log('Criando novo produto sem imagens');
          const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify(productData)
          });
          
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Erro ao criar produto.');
          }
          
          const productResult = await res.json();
          const productId = productResult.product.id;
          
          // Handle variations for the new product
          await handleVariations(productId);
        }
      }
      
      productModal.style.display = 'none';
      
      // Garantir que o modal não afete a lista de produtos ao fechar
      productModal.style.position = 'fixed';
      productModal.style.zIndex = '1000';
      
      loadProducts();
      if (isEdit) {
        alert('Produto atualizado com sucesso!');
      } else {
        alert('Produto criado com sucesso!');
      }
    } catch (err) {
      alert(err.message);
    }
  });

  // Coupons Management
  const couponsList = document.getElementById('coupons-list');

  async function loadCoupons() {
    try {
      const res = await fetch('/api/coupons', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const coupons = data.coupons || [];

      // Sempre mostrar o botão de adicionar cupom
      couponsList.innerHTML = `
        <div class="section-header">
          <button class="btn btn-primary" id="add-coupon">
            <i class="fas fa-plus"></i> Novo Cupom
          </button>
        </div>
        <div class="coupons-grid"></div>
      `;

      const grid = couponsList.querySelector('.coupons-grid');
      
      if (coupons.length === 0) {
        grid.innerHTML = '<p>Nenhum cupom cadastrado. Clique em "Novo Cupom" para adicionar um.</p>';
      } else {
        coupons.forEach(c => {
        const expires = new Date(c.expires_at).toLocaleDateString();
        const el = document.createElement('div');
        el.className = 'coupon-card';
        el.innerHTML = `
          <div class="coupon-info">
            <h4>${c.code}</h4>
            <p>${c.type === 'percentage' ? c.value + '%' : 'R$ ' + Number(c.value).toFixed(2)} de desconto</p>
            <p><small>Expira em: ${expires}</small></p>
            <p><small>Limite de uso: ${c.usage_limit === null || typeof c.usage_limit === 'undefined' ? 'Ilimitado' : c.usage_limit}</small></p>
            <div class="admin-actions">
              <button class="btn btn-outline edit-coupon" data-id="${c.id}">Editar</button>
              <button class="btn btn-outline delete-coupon" data-id="${c.id}">Excluir</button>
            </div>
          </div>
        `;
        grid.appendChild(el);

        // Delete button
        el.querySelector('.delete-coupon').addEventListener('click', async () => {
          if (!confirm('Tem certeza que deseja excluir este cupom?')) return;
          try {
            const res = await fetch(`/api/coupons/${c.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              el.remove();
              alert('Cupom excluído com sucesso.');
            } else {
              throw new Error('Erro ao excluir cupom.');
            }
          } catch (err) {
            alert(err.message);
          }
        });

        // Edit button
        el.querySelector('.edit-coupon').addEventListener('click', () => {
          showCouponModal(c);
        });
      });
      }

      const addBtn = document.getElementById('add-coupon');
      addBtn.addEventListener('click', () => showCouponModal());
    } catch (err) {
      couponsList.innerHTML = `
        <div class="section-header">
          <button class="btn btn-primary" id="add-coupon">
            <i class="fas fa-plus"></i> Novo Cupom
          </button>
        </div>
        <p>Erro ao carregar cupons.</p>
      `;
      const addBtn = document.getElementById('add-coupon');
      if (addBtn) {
        addBtn.addEventListener('click', () => showCouponModal());
      }
      console.error(err);
    }
  }

  function showCouponModal(coupon = null) {
    const modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h4>${coupon ? 'Editar' : 'Novo'} Cupom</h4>
          <button class="close-modal">&times;</button>
        </div>
        <form id="coupon-form" class="admin-form">
          <input type="hidden" name="id" value="${coupon?.id || ''}">
          <div class="form-group">
            <label for="code">Código do Cupom</label>
            <input type="text" id="code" name="code" required value="${coupon?.code || ''}"
              pattern="[A-Za-z0-9]+" title="Apenas letras e números">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="type">Tipo de Desconto</label>
              <select id="type" name="type" required>
                <option value="percentage" ${coupon?.type === 'percentage' ? 'selected' : ''}>Porcentagem</option>
                <option value="fixed" ${coupon?.type === 'fixed' ? 'selected' : ''}>Valor Fixo</option>
              </select>
            </div>
            <div class="form-group">
              <label for="value">Valor do Desconto</label>
              <input type="number" id="value" name="value" required min="0" step="0.01" 
                value="${coupon?.value || ''}">
            </div>
          </div>
          <div class="form-group">
            <label for="expires">Data de Expiração</label>
            <input type="date" id="expires" name="expires_at" required 
              value="${coupon?.expires_at ? coupon.expires_at.split('T')[0] : ''}">
          </div>
          <div class="form-group">
            <label for="usage_limit">Limite de Uso (opcional)</label>
            <input type="number" id="usage_limit" name="usage_limit" min="0" step="1"
              value="${typeof coupon?.usage_limit !== 'undefined' && coupon?.usage_limit !== null ? coupon.usage_limit : ''}">
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Salvar Cupom</button>
            <button type="button" class="btn btn-outline close-modal">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Close modal
    modal.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });

    // Handle form submit
    const form = modal.querySelector('#coupon-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData);
      const isEdit = data.id;

      try {
        // Construir payload apenas com campos válidos
        const payload = {
          code: data.code?.trim(),
          type: data.type,
          value: Number(data.value),
          expires_at: data.expires_at // Já vem no formato YYYY-MM-DD do input type="date"
        };
        
        // Incluir usage_limit apenas se tiver um valor válido
        const usageLimit = data.usage_limit?.trim();
        if (usageLimit && usageLimit !== '' && !isNaN(Number(usageLimit)) && Number(usageLimit) >= 0) {
          payload.usage_limit = Number(usageLimit);
        }
        
        const res = await fetch(isEdit ? `/api/coupons/${data.id}` : '/api/coupons', {
          method: isEdit ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (res.ok) {
          modal.remove();
          loadCoupons();
          alert(isEdit ? 'Cupom atualizado com sucesso!' : 'Cupom criado com sucesso!');
        } else {
          // Mostrar detalhes da validação se disponíveis
          let errorMsg = json.error || 'Erro ao salvar cupom.';
          
          // Se houver mensagens formatadas, usar elas
          if (json.messages && Array.isArray(json.messages) && json.messages.length > 0) {
            errorMsg = json.messages.join('\n');
          } else if (json.details && Array.isArray(json.details) && json.details.length > 0) {
            // Fallback para detalhes não formatados
            const details = json.details.map(d => {
              const field = d.param || d.path || '';
              const msg = d.msg || d.message || '';
              return field ? `${field}: ${msg}` : msg;
            }).join('\n');
            errorMsg = `Erro de validação:\n${details}`;
          }
          
          throw new Error(errorMsg);
        }
      } catch (err) {
        alert(err.message);
        console.error('Erro ao salvar cupom:', err);
      }
    });
  }

  // Load Site Settings
  async function loadSiteSettings() {
    const settingsList = document.getElementById('site-settings-list');
    if (!settingsList) return;

    try {
      const response = await fetch('/api/site-settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Verificar status da resposta
      if (!response.ok) {
        const text = await response.text();
        console.error('Erro HTTP:', response.status, text.substring(0, 500));
        settingsList.innerHTML = `
          <div style="padding: 1rem; background: #fee; border: 1px solid #fcc; border-radius: 4px;">
            <p><strong>Erro ao carregar configurações (Status ${response.status}):</strong></p>
            <p>A tabela 'site_settings' pode não existir no banco de dados.</p>
            <p>Por favor, execute o SQL em <code>sql/add_site_settings_table.sql</code> no Supabase.</p>
            <details style="margin-top: 0.5rem;">
              <summary style="cursor: pointer; color: #666;">Detalhes do erro</summary>
              <pre style="margin-top: 0.5rem; padding: 0.5rem; background: #f5f5f5; border-radius: 4px; overflow-x: auto; font-size: 0.75rem;">${text.substring(0, 500)}</pre>
            </details>
          </div>
        `;
        return;
      }
      
      // Verificar se a resposta é JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Resposta não é JSON. Content-Type:', contentType);
        console.error('Resposta:', text.substring(0, 500));
        settingsList.innerHTML = `
          <div style="padding: 1rem; background: #fee; border: 1px solid #fcc; border-radius: 4px;">
            <p><strong>Erro ao carregar configurações:</strong></p>
            <p>A resposta não é JSON (Content-Type: ${contentType || 'não especificado'}).</p>
            <p>A tabela 'site_settings' pode não existir no banco de dados.</p>
            <p>Por favor, execute o SQL em <code>sql/add_site_settings_table.sql</code> no Supabase.</p>
            <details style="margin-top: 0.5rem;">
              <summary style="cursor: pointer; color: #666;">Detalhes da resposta</summary>
              <pre style="margin-top: 0.5rem; padding: 0.5rem; background: #f5f5f5; border-radius: 4px; overflow-x: auto; font-size: 0.75rem;">${text.substring(0, 500)}</pre>
            </details>
          </div>
        `;
        return;
      }
      
      const data = await response.json();

      if (!data.settings) {
        settingsList.innerHTML = '<p>Erro ao carregar configurações.</p>';
        return;
      }

      const settings = data.settings;
      settingsList.innerHTML = `
        <div class="settings-form">
          <div class="setting-item">
            <label for="announcement_text">
              <strong>Texto do Anúncio (Frete Grátis)</strong>
              <small>Texto exibido no banner superior do site</small>
            </label>
            <input type="text" id="announcement_text" value="${(settings.announcement_text?.value || '').replace(/"/g, '&quot;')}" 
              placeholder="Frete grátis em compras acima de R$ 199">
            <button type="button" class="btn btn-primary save-setting" data-key="announcement_text">Salvar</button>
          </div>

          <div class="setting-item">
            <label for="hero_banner_title">
              <strong>Título do Banner Principal</strong>
              <small>Título exibido no banner hero (ex: "Nova Coleção")</small>
            </label>
            <input type="text" id="hero_banner_title" value="${(settings.hero_banner_title?.value || '').replace(/"/g, '&quot;')}" 
              placeholder="Nova Coleção">
            <button type="button" class="btn btn-primary save-setting" data-key="hero_banner_title">Salvar</button>
          </div>

          <div class="setting-item">
            <label for="hero_banner_subtitle">
              <strong>Subtítulo do Banner Principal</strong>
              <small>Subtítulo exibido no banner hero (ex: "Até 70% OFF + 20% no primeiro pedido")</small>
            </label>
            <input type="text" id="hero_banner_subtitle" value="${(settings.hero_banner_subtitle?.value || '').replace(/"/g, '&quot;')}" 
              placeholder="Até 70% OFF + 20% no primeiro pedido">
            <button type="button" class="btn btn-primary save-setting" data-key="hero_banner_subtitle">Salvar</button>
          </div>
          
          <!-- Seção para configuração dos 4 banners -->
          <div class="setting-item">
            <h3 style="margin: 2rem 0 1rem 0; padding-bottom: 0.5rem; border-bottom: 1px solid #eee;">Banners da Página Inicial</h3>
            <p style="color: #666; margin-bottom: 1.5rem;">Configure os 4 banners que aparecem na página inicial acima da seção de produtos. Dimensões: 400px x 200px.</p>
            
            <!-- Banner 1 -->
            <div class="banner-setting" style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #eee; border-radius: 6px;">
              <h4 style="margin: 0 0 1rem 0;">Banner 1 (Canto Superior Esquerdo)</h4>
              <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem;"><strong>URL da Imagem:</strong></label>
                <input type="text" id="banner_1_image" value="${(settings.banner_1_image?.value || '').replace(/"/g, '&quot;')}" 
                  placeholder="https://exemplo.com/imagem1.jpg" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;">
                ${settings.banner_1_image?.value ? `
                  <div style="margin-bottom: 0.5rem;">
                    <img src="${settings.banner_1_image.value}" alt="Preview Banner 1" 
                      style="max-width: 200px; max-height: 100px; border-radius: 4px; border: 1px solid #ddd;">
                  </div>
                ` : '<p style="color: #999; font-size: 0.9rem;">Nenhuma imagem selecionada</p>'}
              </div>
              <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem;"><strong>Link do Banner:</strong></label>
                <input type="text" id="banner_1_link" value="${(settings.banner_1_link?.value || '').replace(/"/g, '&quot;')}" 
                  placeholder="https://exemplo.com/link1" style="width: 100%; padding: 0.5rem;">
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-primary save-setting" data-key="banner_1_image">Salvar Imagem</button>
                <button type="button" class="btn btn-primary save-setting" data-key="banner_1_link">Salvar Link</button>
              </div>
            </div>
            
            <!-- Banner 2 -->
            <div class="banner-setting" style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #eee; border-radius: 6px;">
              <h4 style="margin: 0 0 1rem 0;">Banner 2 (Canto Superior Direito)</h4>
              <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem;"><strong>URL da Imagem:</strong></label>
                <input type="text" id="banner_2_image" value="${(settings.banner_2_image?.value || '').replace(/"/g, '&quot;')}" 
                  placeholder="https://exemplo.com/imagem2.jpg" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;">
                ${settings.banner_2_image?.value ? `
                  <div style="margin-bottom: 0.5rem;">
                    <img src="${settings.banner_2_image.value}" alt="Preview Banner 2" 
                      style="max-width: 200px; max-height: 100px; border-radius: 4px; border: 1px solid #ddd;">
                  </div>
                ` : '<p style="color: #999; font-size: 0.9rem;">Nenhuma imagem selecionada</p>'}
              </div>
              <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem;"><strong>Link do Banner:</strong></label>
                <input type="text" id="banner_2_link" value="${(settings.banner_2_link?.value || '').replace(/"/g, '&quot;')}" 
                  placeholder="https://exemplo.com/link2" style="width: 100%; padding: 0.5rem;">
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-primary save-setting" data-key="banner_2_image">Salvar Imagem</button>
                <button type="button" class="btn btn-primary save-setting" data-key="banner_2_link">Salvar Link</button>
              </div>
            </div>
            
            <!-- Banner 3 -->
            <div class="banner-setting" style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #eee; border-radius: 6px;">
              <h4 style="margin: 0 0 1rem 0;">Banner 3 (Canto Inferior Esquerdo)</h4>
              <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem;"><strong>URL da Imagem:</strong></label>
                <input type="text" id="banner_3_image" value="${(settings.banner_3_image?.value || '').replace(/"/g, '&quot;')}" 
                  placeholder="https://exemplo.com/imagem3.jpg" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;">
                ${settings.banner_3_image?.value ? `
                  <div style="margin-bottom: 0.5rem;">
                    <img src="${settings.banner_3_image.value}" alt="Preview Banner 3" 
                      style="max-width: 200px; max-height: 100px; border-radius: 4px; border: 1px solid #ddd;">
                  </div>
                ` : '<p style="color: #999; font-size: 0.9rem;">Nenhuma imagem selecionada</p>'}
              </div>
              <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem;"><strong>Link do Banner:</strong></label>
                <input type="text" id="banner_3_link" value="${(settings.banner_3_link?.value || '').replace(/"/g, '&quot;')}" 
                  placeholder="https://exemplo.com/link3" style="width: 100%; padding: 0.5rem;">
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-primary save-setting" data-key="banner_3_image">Salvar Imagem</button>
                <button type="button" class="btn btn-primary save-setting" data-key="banner_3_link">Salvar Link</button>
              </div>
            </div>
            
            <!-- Banner 4 -->
            <div class="banner-setting" style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #eee; border-radius: 6px;">
              <h4 style="margin: 0 0 1rem 0;">Banner 4 (Canto Inferior Direito)</h4>
              <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem;"><strong>URL da Imagem:</strong></label>
                <input type="text" id="banner_4_image" value="${(settings.banner_4_image?.value || '').replace(/"/g, '&quot;')}" 
                  placeholder="https://exemplo.com/imagem4.jpg" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;">
                ${settings.banner_4_image?.value ? `
                  <div style="margin-bottom: 0.5rem;">
                    <img src="${settings.banner_4_image.value}" alt="Preview Banner 4" 
                      style="max-width: 200px; max-height: 100px; border-radius: 4px; border: 1px solid #ddd;">
                  </div>
                ` : '<p style="color: #999; font-size: 0.9rem;">Nenhuma imagem selecionada</p>'}
              </div>
              <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem;"><strong>Link do Banner:</strong></label>
                <input type="text" id="banner_4_link" value="${(settings.banner_4_link?.value || '').replace(/"/g, '&quot;')}" 
                  placeholder="https://exemplo.com/link4" style="width: 100%; padding: 0.5rem;">
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-primary save-setting" data-key="banner_4_image">Salvar Imagem</button>
                <button type="button" class="btn btn-primary save-setting" data-key="banner_4_link">Salvar Link</button>
              </div>
            </div>
            
            <!-- Botão para salvar todos os banners de uma vez -->
            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee;">
              <button type="button" class="btn btn-primary save-all-banners" style="width: 100%; padding: 1rem; font-size: 1.1rem;">
                <i class="fas fa-save"></i> Salvar Todas as Configurações dos Banners
              </button>
            </div>
          </div>

          <!-- Nova seção para configuração de fundo do site -->
          <div class="setting-item">
            <label>
              <strong>Fundo do Site para Desktop</strong>
              <small>Escolha o tipo de fundo e configure o valor para dispositivos desktop</small>
            </label>
            
            <!-- Tipo de fundo para desktop -->
            <div style="margin-bottom: 1rem;">
              <label style="display: block; margin-bottom: 0.5rem;"><strong>Tipo de Fundo:</strong></label>
              <select id="site_background_type" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;">
                <option value="color" ${settings.site_background_type?.value === 'color' ? 'selected' : ''}>Cor Sólida</option>
                <option value="image" ${settings.site_background_type?.value === 'image' ? 'selected' : ''}>Imagem</option>
                <option value="gif" ${settings.site_background_type?.value === 'gif' ? 'selected' : ''}>GIF</option>
                <option value="video" ${settings.site_background_type?.value === 'video' ? 'selected' : ''}>Vídeo</option>
              </select>
            </div>
            
            <!-- Valor do fundo (cor ou URL) para desktop -->
            <div style="margin-bottom: 1rem;">
              <label style="display: block; margin-bottom: 0.5rem;" for="site_background_value"><strong>Valor do Fundo:</strong></label>
              <input type="text" id="site_background_value" value="${(settings.site_background_value?.value || '#f5f5f5').replace(/"/g, '&quot;')}" 
                placeholder="Cor (#f5f5f5) ou URL da imagem/gif" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;">
              
              <!-- Preview da cor para desktop -->
              <div id="color-preview" style="display: ${settings.site_background_type?.value === 'color' || !settings.site_background_type?.value ? 'block' : 'none'}; margin-bottom: 0.5rem;">
                <div style="width: 50px; height: 30px; border: 1px solid #ddd; border-radius: 4px; background-color: ${settings.site_background_value?.value || '#f5f5f5'};"></div>
              </div>
              
              <!-- Preview da imagem/gif para desktop -->
              <div id="image-preview" style="display: ${settings.site_background_type?.value === 'image' || settings.site_background_type?.value === 'gif' ? 'block' : 'none'}; margin-bottom: 0.5rem;">
                ${settings.site_background_value?.value ? `
                  <img src="${settings.site_background_value.value}" alt="Preview" 
                    style="max-width: 100%; max-height: 200px; border-radius: 4px; border: 1px solid #ddd;">
                ` : '<p>Nenhuma imagem selecionada</p>'}
              </div>
            </div>
            
            <!-- Upload de imagem/gif para desktop -->
            <div style="margin-bottom: 1rem;">
              <input type="file" id="site_background_file" accept="image/*" style="margin-bottom: 0.5rem; width: 100%;">
              <button type="button" class="btn btn-outline upload-image" data-key="site_background">Fazer Upload de Imagem/GIF</button>
            </div>
            
            <!-- Upload de vídeo para desktop -->
            <div style="margin-bottom: 1rem;">
              <input type="file" id="site_background_video_file" accept="video/*" style="margin-bottom: 0.5rem; width: 100%;">
              <button type="button" class="btn btn-outline upload-video" data-key="site_background_video">Fazer Upload de Vídeo</button>
            </div>
            
            <!-- URL do vídeo para desktop -->
            <div id="video-url-section" style="display: ${settings.site_background_type?.value === 'video' ? 'block' : 'none'}; margin-bottom: 1rem;">
              <label style="display: block; margin-bottom: 0.5rem;" for="site_background_video_url"><strong>URL do Vídeo:</strong></label>
              <input type="text" id="site_background_video_url" value="${(settings.site_background_video_url?.value || '').replace(/"/g, '&quot;')}" 
                placeholder="https://exemplo.com/video.mp4" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;">
              
              <!-- Preview do vídeo para desktop -->
              ${settings.site_background_video_url?.value ? `
                <video src="${settings.site_background_video_url.value}" controls 
                  style="max-width: 100%; max-height: 200px; border-radius: 4px; border: 1px solid #ddd;"></video>
              ` : '<p>Nenhum vídeo selecionado</p>'}
            </div>
            
            <button type="button" class="btn btn-primary save-setting" data-key="site_background">Salvar Configurações de Fundo para Desktop</button>
          </div>

          <!-- Nova seção para configuração de fundo do site para mobile -->
          <div class="setting-item">
            <label>
              <strong>Fundo do Site para Mobile</strong>
              <small>Escolha o tipo de fundo e configure o valor para dispositivos mobile</small>
            </label>
            
            <!-- Tipo de fundo para mobile -->
            <div style="margin-bottom: 1rem;">
              <label style="display: block; margin-bottom: 0.5rem;"><strong>Tipo de Fundo:</strong></label>
              <select id="site_background_type_mobile" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;">
                <option value="color" ${settings.site_background_type_mobile?.value === 'color' ? 'selected' : ''}>Cor Sólida</option>
                <option value="image" ${settings.site_background_type_mobile?.value === 'image' ? 'selected' : ''}>Imagem</option>
                <option value="gif" ${settings.site_background_type_mobile?.value === 'gif' ? 'selected' : ''}>GIF</option>
                <option value="video" ${settings.site_background_type_mobile?.value === 'video' ? 'selected' : ''}>Vídeo</option>
              </select>
            </div>
            
            <!-- Valor do fundo (cor ou URL) para mobile -->
            <div style="margin-bottom: 1rem;">
              <label style="display: block; margin-bottom: 0.5rem;" for="site_background_value_mobile"><strong>Valor do Fundo:</strong></label>
              <input type="text" id="site_background_value_mobile" value="${(settings.site_background_value_mobile?.value || '#f5f5f5').replace(/"/g, '&quot;')}" 
                placeholder="Cor (#f5f5f5) ou URL da imagem/gif" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;">
              
              <!-- Preview da cor para mobile -->
              <div id="color-preview-mobile" style="display: ${settings.site_background_type_mobile?.value === 'color' || !settings.site_background_type_mobile?.value ? 'block' : 'none'}; margin-bottom: 0.5rem;">
                <div style="width: 50px; height: 30px; border: 1px solid #ddd; border-radius: 4px; background-color: ${settings.site_background_value_mobile?.value || '#f5f5f5'};"></div>
              </div>
              
              <!-- Preview da imagem/gif para mobile -->
              <div id="image-preview-mobile" style="display: ${settings.site_background_type_mobile?.value === 'image' || settings.site_background_type_mobile?.value === 'gif' ? 'block' : 'none'}; margin-bottom: 0.5rem;">
                ${settings.site_background_value_mobile?.value ? `
                  <img src="${settings.site_background_value_mobile.value}" alt="Preview" 
                    style="max-width: 100%; max-height: 200px; border-radius: 4px; border: 1px solid #ddd;">
                ` : '<p>Nenhuma imagem selecionada</p>'}
              </div>
            </div>
            
            <!-- Upload de imagem/gif para mobile -->
            <div style="margin-bottom: 1rem;">
              <input type="file" id="site_background_file_mobile" accept="image/*" style="margin-bottom: 0.5rem; width: 100%;">
              <button type="button" class="btn btn-outline upload-image" data-key="site_background_mobile">Fazer Upload de Imagem/GIF</button>
            </div>
            
            <!-- Upload de vídeo para mobile -->
            <div style="margin-bottom: 1rem;">
              <input type="file" id="site_background_video_file_mobile" accept="video/*" style="margin-bottom: 0.5rem; width: 100%;">
              <button type="button" class="btn btn-outline upload-video" data-key="site_background_video_mobile">Fazer Upload de Vídeo</button>
            </div>
            
            <!-- URL do vídeo para mobile -->
            <div id="video-url-section-mobile" style="display: ${settings.site_background_type_mobile?.value === 'video' ? 'block' : 'none'}; margin-bottom: 1rem;">
              <label style="display: block; margin-bottom: 0.5rem;" for="site_background_video_url_mobile"><strong>URL do Vídeo:</strong></label>
              <input type="text" id="site_background_video_url_mobile" value="${(settings.site_background_video_url_mobile?.value || '').replace(/"/g, '&quot;')}" 
                placeholder="https://exemplo.com/video.mp4" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;">
              
              <!-- Preview do vídeo para mobile -->
              ${settings.site_background_video_url_mobile?.value ? `
                <video src="${settings.site_background_video_url_mobile.value}" controls 
                  style="max-width: 100%; max-height: 200px; border-radius: 4px; border: 1px solid #ddd;"></video>
              ` : '<p>Nenhum vídeo selecionado</p>'}
            </div>
            
            <button type="button" class="btn btn-primary save-setting" data-key="site_background_mobile">Salvar Configurações de Fundo para Mobile</button>
          </div>
        </div>
      `;

      // Event listeners para salvar configurações
      document.querySelectorAll('.save-setting').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const key = btn.getAttribute('data-key');
          let value = '';

          if (key === 'site_background') {
            // Salvar todas as configurações de fundo para desktop
            const type = document.getElementById('site_background_type').value;
            const backgroundValue = document.getElementById('site_background_value').value.trim();
            const videoUrl = document.getElementById('site_background_video_url').value.trim();
            
            // Salvar tipo de fundo
            await saveSetting('site_background_type', type);
            
            // Salvar valor do fundo
            await saveSetting('site_background_value', backgroundValue);
            
            // Salvar URL do vídeo se for do tipo vídeo
            if (type === 'video') {
              await saveSetting('site_background_video_url', videoUrl);
            }
            
            alert('Configurações de fundo para desktop salvas com sucesso!');
            loadSiteSettings(); // Recarregar para atualizar previews
            return;
          } else if (key === 'site_background_mobile') {
            // Salvar todas as configurações de fundo para mobile
            const type = document.getElementById('site_background_type_mobile').value;
            const backgroundValue = document.getElementById('site_background_value_mobile').value.trim();
            const videoUrl = document.getElementById('site_background_video_url_mobile').value.trim();
            
            // Salvar tipo de fundo
            await saveSetting('site_background_type_mobile', type);
            
            // Salvar valor do fundo
            await saveSetting('site_background_value_mobile', backgroundValue);
            
            // Salvar URL do vídeo se for do tipo vídeo
            if (type === 'video') {
              await saveSetting('site_background_video_url_mobile', videoUrl);
            }
            
            alert('Configurações de fundo para mobile salvas com sucesso!');
            loadSiteSettings(); // Recarregar para atualizar previews
            return;
          } else {
            const input = document.getElementById(key);
            value = input ? input.value.trim() : '';
          }

          if (!value) {
            alert('Por favor, preencha o campo antes de salvar.');
            return;
          }

          try {
            const response = await fetch(`/api/site-settings/${key}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ value })
            });

            const result = await response.json();
            if (response.ok) {
              alert('Configuração salva com sucesso!');
              loadSiteSettings(); // Recarregar para atualizar preview
            } else {
              alert(`Erro: ${result.error || 'Falha ao salvar configuração'}`);
            }
          } catch (err) {
            alert(`Erro ao salvar: ${err.message}`);
            console.error('Erro ao salvar configuração:', err);
          }
        });
      });
      
      // Event listener para salvar todos os banners de uma vez
      const saveAllBannersBtn = document.querySelector('.save-all-banners');
      if (saveAllBannersBtn) {
        saveAllBannersBtn.addEventListener('click', async () => {
          try {
            // Salvar todas as configurações dos banners
            const bannerSettings = [
              'banner_1_image', 'banner_1_link',
              'banner_2_image', 'banner_2_link',
              'banner_3_image', 'banner_3_link',
              'banner_4_image', 'banner_4_link'
            ];
            
            for (const key of bannerSettings) {
              const input = document.getElementById(key);
              if (input) {
                const value = input.value.trim();
                await saveSetting(key, value);
              }
            }
            
            alert('Todas as configurações dos banners foram salvas com sucesso!');
            loadSiteSettings(); // Recarregar para atualizar previews
          } catch (err) {
            alert(`Erro ao salvar banners: ${err.message}`);
            console.error('Erro ao salvar banners:', err);
          }
        });
      }

      // Função auxiliar para salvar uma configuração
      async function saveSetting(key, value) {
        const response = await fetch(`/api/site-settings/${key}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ value })
        });
        
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Falha ao salvar configuração');
        }
        
        return await response.json();
      }

      // Event listener para mudanças no tipo de fundo para desktop
      const backgroundTypeSelect = document.getElementById('site_background_type');
      if (backgroundTypeSelect) {
        backgroundTypeSelect.addEventListener('change', function() {
          const type = this.value;
          const colorPreview = document.getElementById('color-preview');
          const imagePreview = document.getElementById('image-preview');
          const videoUrlSection = document.getElementById('video-url-section');
          
          // Mostrar/ocultar seções apropriadas
          if (colorPreview) colorPreview.style.display = type === 'color' ? 'block' : 'none';
          if (imagePreview) imagePreview.style.display = (type === 'image' || type === 'gif') ? 'block' : 'none';
          if (videoUrlSection) videoUrlSection.style.display = type === 'video' ? 'block' : 'none';
        });
      }

      // Event listener para mudanças no tipo de fundo para mobile
      const backgroundTypeSelectMobile = document.getElementById('site_background_type_mobile');
      if (backgroundTypeSelectMobile) {
        backgroundTypeSelectMobile.addEventListener('change', function() {
          const type = this.value;
          const colorPreview = document.getElementById('color-preview-mobile');
          const imagePreview = document.getElementById('image-preview-mobile');
          const videoUrlSection = document.getElementById('video-url-section-mobile');
          
          // Mostrar/ocultar seções apropriadas
          if (colorPreview) colorPreview.style.display = type === 'color' ? 'block' : 'none';
          if (imagePreview) imagePreview.style.display = (type === 'image' || type === 'gif') ? 'block' : 'none';
          if (videoUrlSection) videoUrlSection.style.display = type === 'video' ? 'block' : 'none';
        });
      }

      // Event listener para mudanças no valor da cor para desktop
      const colorValueInput = document.getElementById('site_background_value');
      if (colorValueInput) {
        colorValueInput.addEventListener('input', function() {
          const colorPreview = document.getElementById('color-preview');
          if (colorPreview) {
            const previewBox = colorPreview.querySelector('div');
            if (previewBox) {
              previewBox.style.backgroundColor = this.value;
            }
          }
        });
      }

      // Event listener para mudanças no valor da cor para mobile
      const colorValueInputMobile = document.getElementById('site_background_value_mobile');
      if (colorValueInputMobile) {
        colorValueInputMobile.addEventListener('input', function() {
          const colorPreview = document.getElementById('color-preview-mobile');
          if (colorPreview) {
            const previewBox = colorPreview.querySelector('div');
            if (previewBox) {
              previewBox.style.backgroundColor = this.value;
            }
          }
        });
      }

      // Event listener para upload de imagem para desktop
      document.querySelectorAll('.upload-image').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const key = btn.getAttribute('data-key');
          let fileInputId = '';
          
          if (key === 'site_background') {
            fileInputId = 'site_background_file';
          } else if (key === 'site_background_mobile') {
            fileInputId = 'site_background_file_mobile';
          }
          
          const fileInput = document.getElementById(fileInputId);
          const file = fileInput?.files[0];

          if (!file) {
            alert('Por favor, selecione uma imagem antes de fazer upload.');
            return;
          }

          const formData = new FormData();
          formData.append('image', file);

          try {
            btn.disabled = true;
            btn.textContent = 'Enviando...';

            const response = await fetch(`/api/site-settings/${key === 'site_background' ? 'site_background_value' : key === 'site_background_mobile' ? 'site_background_value_mobile' : key}/upload`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`
              },
              body: formData
            });

            const result = await response.json();
            if (response.ok) {
              alert('Imagem enviada com sucesso!');
              
              // Atualizar o campo de valor com a URL da imagem
              if (key === 'site_background') {
                const valueInput = document.getElementById('site_background_value');
                if (valueInput) {
                  valueInput.value = result.image_url;
                }
              } else if (key === 'site_background_mobile') {
                const valueInput = document.getElementById('site_background_value_mobile');
                if (valueInput) {
                  valueInput.value = result.image_url;
                }
              }
              
              loadSiteSettings(); // Recarregar para atualizar preview
            } else {
              alert(`Erro: ${result.error || 'Falha ao enviar imagem'}`);
            }
          } catch (err) {
            alert(`Erro ao enviar: ${err.message}`);
            console.error('Erro ao enviar imagem:', err);
          } finally {
            btn.disabled = false;
            btn.textContent = 'Fazer Upload';
          }
        });
      });
      
      // Event listener para upload de vídeo para desktop e mobile
      document.querySelectorAll('.upload-video').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const key = btn.getAttribute('data-key');
          let fileInputId = '';
          
          if (key === 'site_background_video') {
            fileInputId = 'site_background_video_file';
          } else if (key === 'site_background_video_mobile') {
            fileInputId = 'site_background_video_file_mobile';
          }
          
          const fileInput = document.getElementById(fileInputId);
          const file = fileInput?.files[0];

          if (!file) {
            alert('Por favor, selecione um vídeo antes de fazer upload.');
            return;
          }

          const formData = new FormData();
          formData.append('video', file);

          try {
            btn.disabled = true;
            btn.textContent = 'Enviando...';

            const response = await fetch('/api/site-settings/site_background_video/upload', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`
              },
              body: formData
            });

            // Verificar se a resposta é JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              const text = await response.text();
              console.error('Resposta não é JSON:', text);
              throw new Error(`Resposta inválida do servidor: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            if (response.ok) {
              alert('Vídeo enviado com sucesso!');
              
              // Atualizar o campo de URL do vídeo
              if (key === 'site_background_video') {
                const videoUrlInput = document.getElementById('site_background_video_url');
                if (videoUrlInput) {
                  videoUrlInput.value = result.video_url;
                }
              } else if (key === 'site_background_video_mobile') {
                const videoUrlInput = document.getElementById('site_background_video_url_mobile');
                if (videoUrlInput) {
                  videoUrlInput.value = result.video_url;
                }
              }
              
              loadSiteSettings(); // Recarregar para atualizar preview
            } else {
              alert(`Erro: ${result.error || 'Falha ao enviar vídeo'}`);
            }
          } catch (err) {
            alert(`Erro ao enviar: ${err.message}`);
            console.error('Erro ao enviar vídeo:', err);
          } finally {
            btn.disabled = false;
            btn.textContent = 'Fazer Upload';
          }
        });
      });

    } catch (err) {
      settingsList.innerHTML = `<p>Erro ao carregar configurações: ${err.message}</p>`;
      console.error('Erro ao carregar configurações:', err);
    }
  }

  // Carregar configurações quando a seção for ativada
  let settingsLoaded = false;
  document.querySelectorAll('.admin-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const section = link.getAttribute('data-section');
      if (section === 'site-settings' && !settingsLoaded) {
        loadSiteSettings();
        settingsLoaded = true;
      }
    });
  });

  // Initial loads
  loadProducts();
  loadCoupons();
  loadBanners();
  
  // Garantir que o grid de produtos tenha altura mínima inicial
  if (productsGrid) {
    productsGrid.style.minHeight = '400px';
    productsGrid.style.width = '100%';
  }
});
