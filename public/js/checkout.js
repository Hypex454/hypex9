// checkout.js - Funções para a página de checkout

document.addEventListener('DOMContentLoaded', () => {
  // Obter dados do pedido do localStorage
  const checkoutData = JSON.parse(localStorage.getItem('hypex_checkout_data') || '{}');
  
  if (!checkoutData.items || !checkoutData.shipping) {
    alert('Dados do pedido não encontrados. Redirecionando...');
    window.location.href = '/';
  }

  // Exibir resumo do pedido
  if (checkoutData.summary) {
    document.getElementById('order-summary').style.display = 'block';
    document.getElementById('summary-subtotal').textContent = `R$ ${Number(checkoutData.summary.subtotal || 0).toFixed(2)}`;
    document.getElementById('summary-shipping').textContent = `R$ ${Number(checkoutData.summary.shipping || 0).toFixed(2)}`;
    document.getElementById('summary-total').textContent = `R$ ${Number(checkoutData.summary.total || 0).toFixed(2)}`;
    
    if (checkoutData.summary.discount > 0) {
      document.getElementById('summary-discount-row').style.display = 'flex';
      document.getElementById('summary-discount').textContent = `-R$ ${Number(checkoutData.summary.discount || 0).toFixed(2)}`;
    }
  }

  // Máscara para CEP
  document.getElementById('cep').addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 5) {
      value = value.slice(0, 5) + '-' + value.slice(5, 8);
    }
    e.target.value = value;
  });

  // Máscara para telefone
  document.getElementById('telefone').addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (value.length > 6) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    } else {
      value = value.replace(/^(\d*)/, '($1');
    }
    e.target.value = value;
  });

  // Buscar endereço por CEP
  document.getElementById('cep').addEventListener('blur', async (e) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          document.getElementById('rua').value = data.logradouro || '';
          document.getElementById('cidade').value = data.localidade || '';
          document.getElementById('estado').value = data.uf || '';
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  });

  // Validação e envio do formulário
  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = document.getElementById('submit-btn');
    
    // Validar campos
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
      if (!field.value.trim()) {
        field.classList.add('error');
        isValid = false;
      } else {
        field.classList.remove('error');
      }
    });
    
    if (!isValid) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    
    // Coletar dados do formulário
    const formData = new FormData(form);
    const addressData = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      cep: formData.get('cep'),
      estado: formData.get('estado'),
      cidade: formData.get('cidade'),
      rua: formData.get('rua'),
      numero: formData.get('numero'),
      complemento: formData.get('complemento'),
      telefone: formData.get('telefone'),
      email: formData.get('email')
    };
    
    // Salvar dados do endereço
    checkoutData.address = addressData;
    localStorage.setItem('hypex_checkout_data', JSON.stringify(checkoutData));
    
    // Fazer requisição para criar pedido
    const token = localStorage.getItem('hypex_token');
    if (!token) {
      alert('Você precisa estar logado para finalizar a compra');
      window.location.href = '/pages/auth.html';
      return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    
    try {
      const response = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: checkoutData.items,
          address: addressData,
          coupon_code: checkoutData.coupon_code || null,
          shipping: checkoutData.shipping
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Salvar dados do pagamento
        localStorage.setItem('hypex_pending_payment', JSON.stringify({
          pending_order_id: data.pending_order_id,
          payment: data.payment,
          order_summary: data.order_summary,
          delivery_type: checkoutData.shipping.type
        }));
        
        // Limpar dados do checkout
        localStorage.removeItem('hypex_checkout_data');
        
        // Redirecionar para pagamento
        window.location.href = `/pages/payment.html?pending_order_id=${data.pending_order_id}`;
      } else {
        throw new Error(data.error || 'Erro ao processar pedido');
      }
    } catch (error) {
      alert('Erro ao processar pedido: ' + error.message);
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Prosseguir para Pagamento';
    }
  });
});