const express = require('express');
const supabase = require('../db/supabaseClient');
const { authRequired, adminRequired } = require('../middleware/auth');
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const efibankService = require('../services/efibank');

const router = express.Router();

// Create checkout: cria pagamento PIX primeiro, sem criar pedido ainda
// O pedido só será criado após confirmação do pagamento via webhook
router.post('/checkout', authRequired, async (req, res) => {
  try {
    // Adicionar log para depuração
    console.log('Dados recebidos no checkout:', JSON.stringify(req.body, null, 2));
    
    const { items, address, coupon_code, shipping } = req.body;
    
    // Validar itens
    if (!items || !Array.isArray(items)) {
      console.log('Erro: Itens inválidos ou não é um array');
      return res.status(400).json({ error: 'Itens inválidos' });
    }
    
    const selected = items.filter(i => i.checked);
    if (!selected.length) {
      console.log('Erro: Nenhum item selecionado');
      return res.status(400).json({ error: 'Selecione ao menos um item para pagar' });
    }
    
    console.log('Itens selecionados:', selected);

    // Validar shipping
    if (!shipping) {
      console.log('Erro: Informações de entrega não fornecidas');
      return res.status(400).json({ error: 'Informações de entrega obrigatórias' });
    }
    
    console.log('Dados de shipping:', shipping);

    // Load product details and calculate total
    const productIds = selected.map(s => s.product_id);
    console.log('IDs dos produtos:', productIds);
    
    const { data: products, error: productsError } = await supabase.from('products').select('*').in('id', productIds);
    
    if (productsError) {
      console.log('Erro ao carregar produtos:', productsError);
      return res.status(500).json({ error: 'Erro ao carregar produtos: ' + productsError.message });
    }
    
    if (!products || products.length === 0) {
      console.log('Erro: Nenhum produto encontrado');
      return res.status(404).json({ error: 'Nenhum produto encontrado' });
    }
    
    console.log('Produtos carregados:', products);
    
    let total = 0;
    const orderItems = [];
    const stockUpdates = [];
    
    // Validar estoque e preparar itens do pedido
    for (const s of selected) {
      const p = products.find(x => x.id === s.product_id);
      if (!p) {
        const errorMsg = `Produto não encontrado: ${s.product_id}`;
        console.log('Erro:', errorMsg);
        throw new Error(errorMsg);
      }
      
      const qty = Number(s.qty || 1);
      let price = p.price || 0;
      let productName = p.name || 'Produto';
      
      // Verificar se há variação selecionada e usar preço da variação
      if (s.variation_id) {
        // Buscar variação para obter preço individual
        const { data: variation } = await supabase
          .from('product_variations')
          .select('price, name')
          .eq('id', s.variation_id)
          .eq('product_id', s.product_id)
          .single();
          
        if (variation) {
          price = variation.price || price;
          productName = variation.name || productName;
        }
      }
      
      const subtotal = price * qty;
      total += subtotal;
      
      // Validar estoque antes de criar o pedido
      // Para variações, verificar estoque da variação
      let stockToCheck = p.stock || 0;
      if (s.variation_id) {
        const { data: variation } = await supabase
          .from('product_variations')
          .select('stock, size_stock')
          .eq('id', s.variation_id)
          .eq('product_id', s.product_id)
          .single();
          
        if (variation) {
          // Verificar estoque por tamanho se disponível
          if (s.size && variation.size_stock && variation.size_stock[s.size] !== undefined) {
            stockToCheck = variation.size_stock[s.size];
          } else {
            stockToCheck = variation.stock || 0;
          }
        }
      }
      
      if (stockToCheck < qty) {
        const errorMsg = `Produto "${productName}" não tem estoque suficiente. Disponível: ${stockToCheck}, Solicitado: ${qty}`;
        console.log('Erro de estoque:', errorMsg);
        throw new Error(errorMsg);
      }
      
      orderItems.push({ 
        product_id: s.product_id, 
        name: productName, 
        qty, 
        price,
        size: s.size,
        variation_id: s.variation_id
      });
      
      // Preparar atualização de estoque
      // Para variações, atualizar estoque da variação
      if (s.variation_id) {
        const { data: variation } = await supabase
          .from('product_variations')
          .select('stock, size_stock')
          .eq('id', s.variation_id)
          .eq('product_id', s.product_id)
          .single();
          
        if (variation) {
          // Atualizar estoque por tamanho se disponível
          if (s.size && variation.size_stock && variation.size_stock[s.size] !== undefined) {
            const newSizeStock = { ...variation.size_stock };
            newSizeStock[s.size] = Math.max(0, (variation.size_stock[s.size] || 0) - qty);
            // Atualizar estoque da variação
            await supabase
              .from('product_variations')
              .update({ size_stock: newSizeStock })
              .eq('id', s.variation_id);
          } else {
            const newStock = Math.max(0, (variation.stock || 0) - qty);
            // Atualizar estoque da variação
            await supabase
              .from('product_variations')
              .update({ stock: newStock })
              .eq('id', s.variation_id);
          }
        }
      } else {
        // Atualizar estoque do produto base
        const newStock = Math.max(0, (p.stock || 0) - qty);
        stockUpdates.push({ id: p.id, newStock, qty });
      }
    }
    
    console.log('Itens do pedido preparados:', orderItems);
    
    // Validar e aplicar cupom se fornecido
    let couponData = null;
    let finalTotal = total;
    let discountAmount = 0;
    
    if (coupon_code) {
      const now = new Date().toISOString();
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', coupon_code.toUpperCase())
        .eq('active', true)
        .gte('expires_at', now)
        .single();
      
      if (couponError || !coupon) {
        console.log('Erro com cupom:', couponError);
        return res.status(400).json({ error: 'Cupom inválido, expirado ou inativo' });
      }
      
      // Verificar limite de uso
      if (coupon.usage_limit !== null && coupon.usage_limit !== undefined && coupon.usage_limit > 0) {
        try {
          // Contar quantas vezes o cupom foi usado
          // Nota: Se a coluna coupon_code não existir, esta query pode falhar
          const { count: usageCount, error: countError } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('coupon_code', coupon.code);
          
          if (countError) {
            // Se o erro for porque a coluna não existe, ignorar a verificação de limite
            if (countError.message && countError.message.includes('coupon_code')) {
              console.warn('Coluna coupon_code não encontrada. Pulando verificação de limite de uso do cupom.');
            } else {
              console.error('Erro ao contar uso do cupom:', countError);
            }
          } else if (usageCount >= coupon.usage_limit) {
            console.log('Erro: Cupom esgotado');
            return res.status(400).json({ error: 'Cupom esgotado (limite de uso atingido)' });
          }
        } catch (err) {
          // Se houver erro ao verificar limite, apenas logar e continuar
          console.warn('Erro ao verificar limite de uso do cupom:', err.message);
        }
      }
      
      // Calcular desconto
      if (coupon.type === 'percentage') {
        discountAmount = total * (coupon.value / 100);
      } else if (coupon.type === 'fixed') {
        discountAmount = Math.min(coupon.value, total);
      }
      
      finalTotal = Math.max(0, total - discountAmount);
      couponData = {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount_amount: discountAmount
      };
    }

    // Validar/calcular frete
    let shippingData = null;
    
    console.log('Validando shipping data...');
    
    // Verificar tipo de entrega
    if (shipping && shipping.type) {
      console.log('Tipo de entrega:', shipping.type);
      if (shipping.type === 'pickup') {
        // Retirada no local - sem custo de frete
        shippingData = {
          type: 'pickup',
          service_name: 'Retirada no Local',
          price: 0,
          address: shipping.address || 'Rua Camboja, nº 133 – Bairro Petrovale, Betim'
        };
        console.log('Shipping data para pickup:', shippingData);
      } else if (shipping.type === 'moto-uber') {
        // Entrega via moto/uber - sem custo de frete (a combinar)
        shippingData = {
          type: 'moto-uber',
          service_name: 'Entrega via Moto/Uber (A combinar)',
          price: 0,
          contact: shipping.contact || '(31) 97507-4666'
        };
        console.log('Shipping data para moto-uber:', shippingData);
      } else if (shipping.type === 'cep') {
        // Entrega via Correios/Transportadora
        // Aceitar tanto o formato novo quanto o antigo
        const price = Number(shipping.price || 0);
        // Permitir frete gratuito (price = 0) para pagamento via cartão
        if (price < 0 || Number.isNaN(price)) {
          console.log('Erro: Valor de frete inválido');
          return res.status(400).json({ error: 'Valor de frete inválido' });
        }
        
        shippingData = {
          type: 'cep',
          cepDestino: String(shipping.cepDestino || '').replace(/\D/g, '') || null,
          service_code: String(shipping.service_code || ''),
          service_name: shipping.service_name || 'Frete',
          price,
          prazo: shipping.prazo ? Number(shipping.prazo) : null,
          company: shipping.company || null
        };
        finalTotal = Math.max(0, finalTotal + price);
        console.log('Shipping data para cep:', shippingData);
      } else {
        console.log('Erro: Tipo de entrega inválido');
        console.log('Shipping recebido:', shipping);
        return res.status(400).json({ error: 'Tipo de entrega inválido' });
      }
    } else {
      console.log('Erro: Informações de entrega obrigatórias');
      console.log('Shipping recebido:', shipping);
      return res.status(400).json({ error: 'Informações de entrega obrigatórias' });
    }

    // Criar pagamento PIX para todas as opções de entrega
    let pixPayment = null;
    
    try {
      const description = `Pedido HYPEX - ${orderItems.length} item(ns)`;
      const metadata = {
        user_id: req.user.id,
        items_count: orderItems.length,
        coupon_code: couponData?.code || null,
        shipping_service: shippingData?.service_name || null,
        shipping_type: shippingData?.type || null,
        shipping_code: shippingData?.service_code || null,
        shipping_price: shippingData?.price || null,
        shipping_cep: shippingData?.cepDestino || null
      };

      console.log('Criando pagamento PIX com amount:', finalTotal);
      pixPayment = await efibankService.createPixCharge({
        amount: finalTotal,
        description,
        metadata
      });

      // Validar resposta do pagamento
      if (!pixPayment || !pixPayment.txid) {
        const errorMsg = 'Resposta inválida do serviço de pagamento: txid não encontrado';
        console.log('Erro:', errorMsg);
        throw new Error(errorMsg);
      }

      // Gerar imagem do QR Code se não vier da API
      if (!pixPayment.qrcode_image && pixPayment.qrcode) {
        pixPayment.qrcode_image = efibankService.generateQRCodeImage(pixPayment.qrcode);
      }

      // Se ainda não temos QR code, tentar buscar usando location
      if (!pixPayment.qrcode && pixPayment.location) {
        console.warn('QR code não veio na resposta inicial. Tentando buscar usando location:', pixPayment.location);
        try {
          const qrcodeFromLocation = await efibankService.getQRCodeByLocation(pixPayment.location);
          if (qrcodeFromLocation) {
            pixPayment.qrcode = qrcodeFromLocation;
            // Gerar imagem do QR Code
            if (!pixPayment.qrcode_image) {
              pixPayment.qrcode_image = efibankService.generateQRCodeImage(pixPayment.qrcode);
            }
          }
        } catch (locationError) {
          console.error('Erro ao buscar QR code por location:', locationError);
          // Continuar mesmo sem QR code, o frontend pode gerar depois usando o txid
        }
      }
    } catch (error) {
      console.error('Erro ao criar pagamento PIX:', error);
      console.error('Stack trace:', error.stack);
      
      // Retornar mensagem de erro mais específica
      let errorMessage = 'Erro ao criar pagamento. Tente novamente.';
      if (error.message) {
        // Se a mensagem contém informações úteis, incluir
        if (error.message.includes('não configurada') || 
            error.message.includes('Credenciais') ||
            error.message.includes('Chave PIX')) {
          errorMessage = error.message;
        } else {
          errorMessage = `Erro ao criar pagamento: ${error.message}`;
        }
      }
      
      return res.status(500).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    // Criar pedido pendente (pending_order) - NÃO cria order ainda
    const pendingOrderPayload = {
      user_id: req.user.id,
      items: orderItems,
      total: finalTotal,
      address: address || null, // Endereço completo do formulário
      payment_id: pixPayment.txid,
      payment_qrcode: pixPayment.qrcode,
      payment_qrcode_image: pixPayment.qrcode_image,
      payment_status: 'pending',
      expires_at: pixPayment.expires_at
    };

    // Adicionar campos de cupom se houver
    if (couponData) {
      pendingOrderPayload.coupon_code = couponData.code;
      pendingOrderPayload.coupon_discount = discountAmount;
    }

    // Adicionar frete
    if (shippingData) {
      pendingOrderPayload.shipping = shippingData;
    }

    console.log('Criando pedido pendente com payload:', pendingOrderPayload);
    
    const { data: pendingOrder, error: pendingOrderError } = await supabase
      .from('pending_orders')
      .insert([pendingOrderPayload])
      .select()
      .single();

    if (pendingOrderError) {
      console.error('Erro ao criar pedido pendente:', pendingOrderError);
      return res.status(500).json({ 
        error: 'Erro ao processar pedido. Tente novamente.',
        details: pendingOrderError.message 
      });
    }

    // Retornar dados do pagamento para o frontend exibir QR Code
    res.json({
      pending_order_id: pendingOrder.id,
      payment: {
        txid: pixPayment.txid,
        qrcode: pixPayment.qrcode,
        qrcode_image: pixPayment.qrcode_image,
        expires_at: pixPayment.expires_at,
        amount: finalTotal,
        status: 'pending'
      },
      order_summary: {
        items_count: orderItems.length,
        subtotal: total,
        discount: discountAmount,
        shipping: shippingData,
        total: finalTotal,
        coupon: couponData
      }
    });
  } catch (err) {
    console.error('Erro no endpoint de checkout:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: list orders
router.get('/', adminRequired, async (req, res) => {
  try {
    // Buscar pedidos
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (ordersError) return res.status(500).json({ error: ordersError.message });
    
    // Buscar informações dos usuários para cada pedido
    const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, address')
      .in('id', userIds);
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      // Continuar mesmo se houver erro ao buscar usuários
    }
    
    // Criar mapa de usuários por ID
    const usersMap = {};
    (users || []).forEach(user => {
      usersMap[user.id] = user;
    });
    
    // Formatar os dados para incluir informações do usuário
    const formattedOrders = orders.map(order => {
      const user = usersMap[order.user_id];
      return {
        ...order,
        user_name: user?.name || 'Usuário',
        user_email: user?.email || '',
        user_address: user?.address || null
      };
    });
    
    res.json({ orders: formattedOrders });
  } catch (err) {
    console.error('Error in GET /api/orders:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: list pending orders
router.get('/pending', adminRequired, async (req, res) => {
  try {
    // Buscar pedidos pendentes
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('pending_orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (pendingError) return res.status(500).json({ error: pendingError.message });
    
    // Buscar informações dos usuários para cada pedido pendente
    const userIds = [...new Set(pendingOrders.map(o => o.user_id).filter(Boolean))];
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, address')
      .in('id', userIds);
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      // Continuar mesmo se houver erro ao buscar usuários
    }
    
    // Criar mapa de usuários por ID
    const usersMap = {};
    (users || []).forEach(user => {
      usersMap[user.id] = user;
    });
    
    // Formatar os dados para incluir informações do usuário
    const formattedOrders = pendingOrders.map(order => {
      const user = usersMap[order.user_id];
      return {
        ...order,
        user_name: user?.name || 'Usuário',
        user_email: user?.email || '',
        user_address: user?.address || null,
        status: 'pedido feito' // Pedidos pendentes são considerados "pedido feito"
      };
    });
    
    res.json({ orders: formattedOrders });
  } catch (err) {
    console.error('Error in GET /api/orders/pending:', err);
    res.status(500).json({ error: err.message });
  }
});

// User: get current user's orders
router.get('/mine', authRequired, async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    
    // Adicionar imagens aos itens do pedido
    if (data && data.length > 0) {
      for (const order of data) {
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            // Se o item já tem uma imagem, pular
            if (item.image) continue;
            
            // Buscar o produto para obter a imagem
            if (item.product_id) {
              try {
                const { data: productData } = await supabase
                  .from('products')
                  .select('images')
                  .eq('id', item.product_id)
                  .single();
                
                if (productData && productData.images && productData.images.length > 0) {
                  // Usar a primeira imagem do produto
                  item.image = productData.images[0];
                }
              } catch (productError) {
                console.warn('Erro ao buscar imagem do produto:', productError);
              }
            }
          }
        }
      }
    }
    
    res.json({ orders: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verificar status de pagamento de um pedido pendente
router.get('/pending/:id/status', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar pedido pendente
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id); // Garantir que é do usuário logado

    if (pendingError) {
      return res.status(500).json({ error: pendingError.message });
    }
    
    // Verificar se encontrou o pedido
    if (!pendingOrders || pendingOrders.length === 0) {
      return res.status(404).json({ error: 'Pedido pendente não encontrado' });
    }
    
    // Usar o primeiro pedido encontrado
    const pendingOrder = pendingOrders[0];

    // Se já está pago, verificar se order foi criado
    if (pendingOrder.payment_status === 'paid') {
      // Buscar order pelo payment.txid (pode estar em payment JSONB)
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, created_at, payment')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Filtrar orders que têm o txid no payment
      const order = orders?.find(o => {
        if (o.payment && typeof o.payment === 'object') {
          return o.payment.txid === pendingOrder.payment_id;
        }
        return false;
      });

      return res.json({
        status: 'paid',
        order_id: order?.id || null,
        order_status: order?.status || null
      });
    }

    // Verificar status no Efí Bank
    if (pendingOrder.payment_id) {
      try {
        const paymentStatus = await efibankService.getPixChargeStatus(pendingOrder.payment_id);
        
        // Atualizar status no banco se mudou
        if (paymentStatus.status === 'paid' && pendingOrder.payment_status !== 'paid') {
          console.log(`[Orders] Pagamento confirmado para pedido pendente ${id}. Criando pedido e diminuindo estoque...`);
          
          // Verificar se o pedido já foi criado (evitar duplicação)
          // Buscar orders recentes do usuário e verificar se algum tem o mesmo txid
          const { data: recentOrders } = await supabase
            .from('orders')
            .select('id, payment')
            .eq('user_id', pendingOrder.user_id)
            .order('created_at', { ascending: false })
            .limit(10);
          
          const existingOrder = recentOrders?.find(o => {
            if (o.payment && typeof o.payment === 'object') {
              return o.payment.txid === pendingOrder.payment_id;
            }
            return false;
          });
          
          if (existingOrder) {
            console.log(`[Orders] Pedido já existe: ${existingOrder.id}. Apenas atualizando status do pending_order.`);
            await supabase
              .from('pending_orders')
              .update({ 
                payment_status: 'paid',
                updated_at: new Date().toISOString()
              })
              .eq('id', id);
            
            return res.json({
              status: 'paid',
              paid_at: paymentStatus.paid_at,
              order_id: existingOrder.id
            });
          }
          
          // Atualizar status do pedido pendente
          await supabase
            .from('pending_orders')
            .update({ 
              payment_status: 'paid',
              updated_at: new Date().toISOString()
            })
            .eq('id', id);

          // Criar o pedido real e diminuir estoque
          const orderPayload = {
            user_id: pendingOrder.user_id,
            items: pendingOrder.items,
            total: pendingOrder.total,
            address: pendingOrder.address,
            status: 'pedido feito',
            payment: {
              txid: pendingOrder.payment_id,
              method: 'pix',
              status: 'paid',
              paid_at: paymentStatus.paid_at || new Date().toISOString()
            },
            payment_confirmed_at: new Date().toISOString()
          };

          // Adicionar campos de cupom se houver
          if (pendingOrder.coupon_code) {
            orderPayload.coupon_code = pendingOrder.coupon_code;
            orderPayload.coupon_discount = pendingOrder.coupon_discount || 0;
          }

          const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert([orderPayload])
            .select()
            .single();

          if (orderError) {
            console.error('Erro ao criar pedido após pagamento:', orderError);
            // Continuar mesmo com erro, mas logar
          } else {
            console.log(`[Orders] Pedido criado com sucesso: ${order.id}`);

            // Diminuir estoque dos produtos
            const productIds = pendingOrder.items.map(item => item.product_id);
            const { data: products } = await supabase
              .from('products')
              .select('id, stock')
              .in('id', productIds);

            if (products) {
              for (const item of pendingOrder.items) {
                const product = products.find(p => p.id === item.product_id);
                if (product) {
                  // Para variações, verificar se há estoque por tamanho
                  if (item.variation_id && item.size) {
                    const { data: variation } = await supabase
                      .from('product_variations')
                      .select('stock, size_stock')
                      .eq('id', item.variation_id)
                      .eq('product_id', item.product_id)
                      .single();
                      
                    if (variation) {
                      // Atualizar estoque por tamanho se disponível
                      if (variation.size_stock && variation.size_stock[item.size] !== undefined) {
                        const newSizeStock = { ...variation.size_stock };
                        newSizeStock[item.size] = Math.max(0, (variation.size_stock[item.size] || 0) - item.qty);
                        const { error: stockError } = await supabase
                          .from('product_variations')
                          .update({ size_stock: newSizeStock })
                          .eq('id', item.variation_id);
                        
                        if (stockError) {
                          console.error(`Erro ao atualizar estoque da variação ${item.variation_id}:`, stockError);
                        } else {
                          console.log(`[Orders] Estoque da variação ${item.variation_id} tamanho ${item.size} atualizado: ${variation.size_stock[item.size]} → ${newSizeStock[item.size]}`);
                        }
                      } else {
                        const newStock = Math.max(0, (variation.stock || 0) - item.qty);
                        const { error: stockError } = await supabase
                          .from('product_variations')
                          .update({ stock: newStock })
                          .eq('id', item.variation_id);
                        
                        if (stockError) {
                          console.error(`Erro ao atualizar estoque da variação ${item.variation_id}:`, stockError);
                        } else {
                          console.log(`[Orders] Estoque da variação ${item.variation_id} atualizado: ${variation.stock} → ${newStock}`);
                        }
                      }
                    }
                  } else {
                    const newStock = Math.max(0, (product.stock || 0) - item.qty);
                    const { error: stockError } = await supabase
                      .from('products')
                      .update({ stock: newStock })
                      .eq('id', product.id);
                    
                    if (stockError) {
                      console.error(`Erro ao atualizar estoque do produto ${product.id}:`, stockError);
                    } else {
                      console.log(`[Orders] Estoque do produto ${product.id} atualizado: ${product.stock} → ${newStock}`);
                    }
                  }
                }
              }
            }

            // Enviar email para admin (opcional)
            try {
              const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT || 587),
                secure: false,
                auth: { 
                  user: process.env.SMTP_USER, 
                  pass: process.env.SMTP_PASS 
                }
              });

              const adminEmail = process.env.ADMIN_EMAIL;
              if (adminEmail && transporter) {
                const itemsText = order.items.map(i => `- ${i.name} x${i.qty} - R$ ${(i.price * i.qty).toFixed(2)}`).join('\n');
                const text = `Novo pedido confirmado #${order.id.substring(0, 8)}\n\n` +
                  `Cliente: ${pendingOrder.user_id}\n` +
                  `Total: R$ ${(order.total || 0).toFixed(2)}\n` +
                  `Endereço: ${JSON.stringify(order.address || {})}\n\n` +
                  `Itens:\n${itemsText}`;
                
                await transporter.sendMail({
                  from: process.env.SMTP_USER,
                  to: adminEmail,
                  subject: `✅ Novo pedido confirmado #${order.id.substring(0, 8)}`,
                  text,
                  html: `<pre>${text}</pre>`
                });
              }
            } catch (emailError) {
              console.error('Erro ao enviar email:', emailError);
              // Não falhar por erro de email
            }
          }
        }

        // Se o pagamento foi confirmado, buscar o order_id criado
        let orderId = null;
        if (paymentStatus.status === 'paid') {
          const { data: latestOrder } = await supabase
            .from('orders')
            .select('id')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          orderId = latestOrder?.id || null;
        }

        return res.json({
          status: paymentStatus.status,
          paid_at: paymentStatus.paid_at,
          order_id: orderId
        });
      } catch (error) {
        console.error('Erro ao verificar status do pagamento:', error);
        // Retornar status do banco mesmo se houver erro na API
        return res.json({
          status: pendingOrder.payment_status,
          error: 'Erro ao verificar status na API'
        });
      }
    }

    res.json({ status: pendingOrder.payment_status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: update order status and delivery estimate
router.put('/:id/status', adminRequired, async (req, res) => {
  const id = req.params.id;
  const { status, delivery_estimate } = req.body;
  
  // Verificar se o pedido existe na tabela de pedidos confirmados
  const { data: confirmedOrder, error: confirmedError } = await supabase
    .from('orders')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  
  if (confirmedError) {
    return res.status(500).json({ error: confirmedError.message });
  }
  
  // Se não encontrou na tabela de pedidos confirmados, verificar na tabela de pedidos pendentes
  if (!confirmedOrder) {
    const { data: pendingOrder, error: pendingError } = await supabase
      .from('pending_orders')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    
    if (pendingError) {
      return res.status(500).json({ error: pendingError.message });
    }
    
    // Se não encontrou em nenhuma das tabelas, retornar erro 404
    if (!pendingOrder) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    // Se encontrou na tabela de pedidos pendentes, retornar erro apropriado
    return res.status(400).json({ error: 'Pedido ainda está pendente e não pode ter seu status atualizado' });
  }
  
  // Atualizar o pedido confirmado
  const { data, error } = await supabase
    .from('orders')
    .update({ status, delivery_estimate })
    .eq('id', id)
    .select()
    .single();
  
  if (error) return res.status(400).json({ error: error.message });
  res.json({ order: data });
});

// Admin: move pending order to confirmed orders
router.post('/:id/confirm', adminRequired, async (req, res) => {
  const id = req.params.id;
  
  try {
    // Buscar o pedido pendente
    const { data: pendingOrder, error: pendingError } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('id', id)
      .single();
    
    if (pendingError) {
      return res.status(500).json({ error: pendingError.message });
    }
    
    if (!pendingOrder) {
      return res.status(404).json({ error: 'Pedido pendente não encontrado' });
    }
    
    // Verificar se o pedido já foi pago
    const isPaid = pendingOrder.payment_status === 'paid';
    
    // Criar o pedido confirmado
    const orderPayload = {
      user_id: pendingOrder.user_id,
      items: pendingOrder.items,
      total: pendingOrder.total,
      address: pendingOrder.address,
      status: 'pedido feito',
      payment: {
        txid: pendingOrder.payment_id || null,
        method: pendingOrder.payment_id ? 'pix' : 'pendente',
        status: isPaid ? 'paid' : 'pending',
        paid_at: isPaid ? new Date().toISOString() : null
      },
      payment_confirmed_at: isPaid ? new Date().toISOString() : null
    };
    
    // Adicionar campos de cupom se houver
    if (pendingOrder.coupon_code) {
      orderPayload.coupon_code = pendingOrder.coupon_code;
      orderPayload.coupon_discount = pendingOrder.coupon_discount || 0;
    }
    
    // Inserir o pedido confirmado
    const { data: confirmedOrder, error: insertError } = await supabase
      .from('orders')
      .insert([orderPayload])
      .select()
      .single();
    
    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }
    
    // Remover o pedido da tabela de pedidos pendentes
    const { error: deleteError } = await supabase
      .from('pending_orders')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      console.error('Erro ao remover pedido pendente:', deleteError);
      // Não retornar erro pois o pedido já foi confirmado
    }
    
    // Diminuir estoque dos produtos apenas se o pedido foi pago
    if (isPaid && pendingOrder.items && Array.isArray(pendingOrder.items)) {
      const productIds = pendingOrder.items.map(item => item.product_id);
      const { data: products } = await supabase
        .from('products')
        .select('id, stock')
        .in('id', productIds);
      
      if (products) {
        for (const item of pendingOrder.items) {
          const product = products.find(p => p.id === item.product_id);
          if (product) {
            // Para variações, verificar se há estoque por tamanho
            if (item.variation_id && item.size) {
              const { data: variation } = await supabase
                .from('product_variations')
                .select('stock, size_stock')
                .eq('id', item.variation_id)
                .eq('product_id', item.product_id)
                .single();
                
              if (variation) {
                // Atualizar estoque por tamanho se disponível
                if (variation.size_stock && variation.size_stock[item.size] !== undefined) {
                  const newSizeStock = { ...variation.size_stock };
                  newSizeStock[item.size] = Math.max(0, (variation.size_stock[item.size] || 0) - (item.qty || 1));
                  const { error: stockError } = await supabase
                    .from('product_variations')
                    .update({ size_stock: newSizeStock })
                    .eq('id', item.variation_id);
                  
                  if (stockError) {
                    console.error(`Erro ao atualizar estoque da variação ${item.variation_id}:`, stockError);
                  } else {
                    console.log(`[Orders] Estoque da variação ${item.variation_id} tamanho ${item.size} atualizado: ${variation.size_stock[item.size]} → ${newSizeStock[item.size]}`);
                  }
                } else {
                  const newStock = Math.max(0, (variation.stock || 0) - (item.qty || 1));
                  const { error: stockError } = await supabase
                    .from('product_variations')
                    .update({ stock: newStock })
                    .eq('id', item.variation_id);
                  
                  if (stockError) {
                    console.error(`Erro ao atualizar estoque da variação ${item.variation_id}:`, stockError);
                  } else {
                    console.log(`[Orders] Estoque da variação ${item.variation_id} atualizado: ${variation.stock} → ${newStock}`);
                  }
                }
              }
            } else {
              const newStock = Math.max(0, (product.stock || 0) - (item.qty || 1));
              const { error: stockError } = await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('id', product.id);
              
              if (stockError) {
                console.error(`Erro ao atualizar estoque do produto ${product.id}:`, stockError);
              } else {
                console.log(`[Orders] Estoque do produto ${product.id} atualizado: ${product.stock} → ${newStock}`);
              }
            }
          }
        }
      }
    }
    
    res.json({ order: confirmedOrder });
  } catch (err) {
    console.error('Erro ao confirmar pedido:', err);
    res.status(500).json({ error: 'Erro interno ao confirmar pedido' });
  }
});

module.exports = router;