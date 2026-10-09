/**
 * CJC-Dev-Pays — Frontend Application Controller & SSE Realtime Client
 */

class CJCPaysApp {
  constructor() {
    this.token = localStorage.getItem('cjc_admin_token');
    this.currentView = 'view-dashboard';
    this.eventSource = null;
    this.appsCache = [];
    this.currentSimulatedPaymentId = null;

    this.init();
  }

  async init() {
    this.bindEvents();
    this.updateDynamicUrls();
    if (this.token) {
      const isValid = await this.validateSession();
      if (isValid) {
        this.showAppLayout();
        this.setupSSE();
        this.loadDashboardData();
        this.loadApplications();
      } else {
        this.showLoginScreen();
      }
    } else {
      this.showLoginScreen();
    }
  }

  updateDynamicUrls() {
    const mpBox = document.getElementById('mp-webhook-url-box');
    if (mpBox) {
      mpBox.innerText = `${window.location.origin}/api/webhooks/mercadopago`;
    }
  }

  showLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    const appLayout = document.getElementById('app-layout');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appLayout) appLayout.style.display = 'none';

    // Limpa alertas e campos anteriores
    const alertBox = document.getElementById('login-error-alert');
    if (alertBox) alertBox.style.display = 'none';
    const userInput = document.getElementById('login-username');
    if (userInput) {
      userInput.value = '';
      userInput.focus();
    }
    const passInput = document.getElementById('login-password');
    if (passInput) passInput.value = '';
  }

  showAppLayout() {
    const loginScreen = document.getElementById('login-screen');
    const appLayout = document.getElementById('app-layout');
    if (loginScreen) loginScreen.style.display = 'none';
    if (appLayout) appLayout.style.display = 'flex';
  }

  async validateSession() {
    try {
      const res = await fetch('/api/admin/metrics', { headers: this.getHeaders() });
      if (res.status === 401) {
        localStorage.removeItem('cjc_admin_token');
        this.token = null;
        return false;
      }
      return res.ok;
    } catch {
      return false;
    }
  }

  bindEvents() {
    // Formulário de Login Administrativo
    document.getElementById('form-login')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    document.getElementById('btn-toggle-login-pass')?.addEventListener('click', () => {
      const input = document.getElementById('login-password');
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    });

    // Navegação lateral
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        if (view) this.navigate(view);
      });
    });

    // Botões de ação do topo
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      this.refreshCurrentView();
      this.showToast('Dados atualizados com sucesso!', 'info');
    });

    document.getElementById('btn-quick-pix')?.addEventListener('click', () => {
      this.navigate('view-simulator');
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      this.logout();
    });

    // Filtros de transações
    document.getElementById('btn-apply-filters')?.addEventListener('click', () => {
      this.loadPayments();
    });

    document.getElementById('filter-search')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.loadPayments();
    });

    // Filtro de webhooks
    document.getElementById('filter-webhook-status')?.addEventListener('change', () => {
      this.loadWebhooks();
    });

    // Nova aplicação
    document.getElementById('btn-new-app')?.addEventListener('click', () => {
      this.openModal('modal-new-app');
    });

    document.getElementById('form-create-app')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.createApplication();
    });

    // Formulário do simulador
    document.getElementById('form-simulate-pix')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.simulatePayment();
    });

    document.getElementById('btn-sim-manual-approve')?.addEventListener('click', () => {
      this.approveCurrentSimulatedPayment();
    });
  }

  async handleLogin() {
    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const alertBox = document.getElementById('login-error-alert');
    const alertText = document.getElementById('login-error-text');
    const submitBtn = document.getElementById('btn-submit-login');

    if (!username || !password) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Autenticando...';
    }

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success && data.token) {
        this.token = data.token;
        localStorage.setItem('cjc_admin_token', this.token);
        this.showToast(`Bem-vindo, ${data.user.name || data.user.username}!`, 'success');
        this.showAppLayout();
        this.setupSSE();
        this.loadDashboardData();
        this.loadApplications();
      } else {
        if (alertBox && alertText) {
          alertText.innerText = data.error || 'Usuário ou senha incorretos.';
          alertBox.style.display = 'flex';
        }
      }
    } catch (e) {
      if (alertBox && alertText) {
        alertText.innerText = 'Erro ao conectar ao servidor.';
        alertBox.style.display = 'flex';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = '🔒 Entrar no Painel';
      }
    }
  }

  logout() {
    localStorage.removeItem('cjc_admin_token');
    this.token = null;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.showToast('Você saiu do painel com sucesso.', 'info');
    this.showLoginScreen();
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
    };
  }

  navigate(viewId) {
    this.currentView = viewId;

    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewId);
    });

    document.querySelectorAll('.view-section').forEach((section) => {
      section.classList.toggle('active', section.id === viewId);
    });

    const titles = {
      'view-dashboard': 'Visão Geral & Métricas',
      'view-payments': 'Transações & Histórico',
      'view-applications': 'Aplicações Conectadas & Chaves',
      'view-webhooks': 'Fila de Webhooks (Fan-Out)',
      'view-simulator': 'Simulador de Cobranças (Sandbox)',
      'view-docs': 'Guia de Integração para Apps PHP',
    };
    const heading = document.getElementById('page-heading');
    if (heading) heading.innerText = titles[viewId] || 'Painel de Controle';

    this.refreshCurrentView();
  }

  refreshCurrentView() {
    if (this.currentView === 'view-dashboard') this.loadDashboardData();
    if (this.currentView === 'view-payments') this.loadPayments();
    if (this.currentView === 'view-applications') this.loadApplications();
    if (this.currentView === 'view-webhooks') this.loadWebhooks();
  }

  setupSSE() {
    if (!this.token) return;
    try {
      this.eventSource = new EventSource(`/api/admin/events/stream?token=${this.token}`);

      this.eventSource.onopen = () => {
        const statusText = document.getElementById('live-status-text');
        if (statusText) statusText.innerText = 'SSE Conectado';
      };

      this.eventSource.addEventListener('payment:created', (e) => {
        const data = JSON.parse(e.data);
        this.showToast(`⚡ Nova cobrança Pix criada: R$ ${data.amount.toFixed(2)} (${data.appName})`, 'info');
        this.refreshCurrentView();
      });

      this.eventSource.addEventListener('payment:updated', (e) => {
        const data = JSON.parse(e.data);
        if (data.status === 'APPROVED') {
          this.showToast(`💰 Pagamento APROVADO! R$ ${data.amount.toFixed(2)} (${data.appName})`, 'success');
        } else {
          this.showToast(`Transação atualizada: ${data.status} (${data.externalReference})`, 'info');
        }
        this.refreshCurrentView();
      });

      this.eventSource.addEventListener('webhook:delivered', (e) => {
        const data = JSON.parse(e.data);
        this.showToast(`✅ Webhook entregue com sucesso para ${data.targetUrl}`, 'success');
        if (this.currentView === 'view-webhooks') this.loadWebhooks();
      });

      this.eventSource.addEventListener('webhook:failed', (e) => {
        const data = JSON.parse(e.data);
        this.showToast(`⚠️ Falha ao entregar webhook para ${data.targetUrl}`, 'warning');
        if (this.currentView === 'view-webhooks') this.loadWebhooks();
      });

      this.eventSource.onerror = () => {
        const statusText = document.getElementById('live-status-text');
        if (statusText) statusText.innerText = 'Reconectando...';
      };
    } catch (e) {
      console.warn('Erro ao configurar SSE:', e);
    }
  }

  // ==================== DASHBOARD & METRICS ====================
  async loadDashboardData() {
    try {
      const res = await fetch('/api/admin/metrics', { headers: this.getHeaders() });
      const data = await res.json();
      if (!data.success) return;

      const { kpis, webhooks, applications, recentPayments } = data;

      // Atualiza KPIs
      document.getElementById('kpi-total-volume').innerText = this.formatCurrency(kpis.totalVolume);
      document.getElementById('kpi-net-volume').innerText = this.formatCurrency(kpis.netVolume);
      document.getElementById('kpi-today-volume').innerText = this.formatCurrency(kpis.todayVolume);
      document.getElementById('kpi-month-volume').innerText = this.formatCurrency(kpis.monthVolume);
      document.getElementById('kpi-approval-rate').innerText = `${kpis.approvalRate}%`;
      document.getElementById('kpi-approved-count').innerText = kpis.approvedCount;
      document.getElementById('kpi-total-count').innerText = kpis.totalCount;
      document.getElementById('kpi-webhook-health').innerText = `${webhooks.healthPct}%`;
      document.getElementById('kpi-webhook-success').innerText = webhooks.success;
      document.getElementById('kpi-webhook-failed').innerText = webhooks.failed;

      // Apps Volume Grid
      const appsContainer = document.getElementById('apps-volume-container');
      if (appsContainer && applications) {
        appsContainer.innerHTML = applications
          .map(
            (app) => `
          <div class="kpi-card glass-panel" style="--card-accent: #3b82f6;">
            <div class="kpi-header">
              <span class="kpi-title">${app.name}</span>
              <span class="badge ${app.isActive ? 'badge-approved' : 'badge-rejected'}">${app.isActive ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div class="kpi-value">${this.formatCurrency(app.approvedVolume)}</div>
            <div class="kpi-subtext">${app.approvedCount} pagamentos aprovados (${app.totalPayments} criados)</div>
          </div>
        `
          )
          .join('');
      }

      // Feed de Pagamentos Recentes
      const recentTbody = document.getElementById('recent-payments-tbody');
      if (recentTbody) {
        if (!recentPayments || recentPayments.length === 0) {
          recentTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 30px;">Nenhum pagamento registrado ainda. Crie uma simulação no Sandbox!</td></tr>`;
        } else {
          recentTbody.innerHTML = recentPayments
            .map(
              (p) => `
            <tr>
              <td>${this.formatDate(p.createdAt)}</td>
              <td><span class="badge badge-app">${p.application.name}</span></td>
              <td><code>${p.externalReference}</code></td>
              <td><span style="font-size: 0.82rem; font-weight: 600;">${p.paymentMethod}</span></td>
              <td style="font-weight: 700; color: #ffffff;">${this.formatCurrency(p.amount)}</td>
              <td>${this.renderStatusBadge(p.status)}</td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick="app.viewPaymentDetails('${p.id}')">🔍 Detalhes</button>
              </td>
            </tr>
          `
            )
            .join('');
        }
      }
    } catch (e) {
      console.error('Erro ao carregar métricas:', e);
    }
  }

  // ==================== TRANSAÇÕES ====================
  async loadPayments() {
    try {
      const search = document.getElementById('filter-search')?.value || '';
      const appId = document.getElementById('filter-app')?.value || 'ALL';
      const status = document.getElementById('filter-status')?.value || 'ALL';

      const url = `/api/admin/payments?search=${encodeURIComponent(search)}&appId=${appId}&status=${status}`;
      const res = await fetch(url, { headers: this.getHeaders() });
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById('all-payments-tbody');
      if (!tbody) return;

      if (!data.payments || data.payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 40px;">Nenhuma transação encontrada com os filtros selecionados.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.payments
        .map(
          (p) => `
        <tr>
          <td>${this.formatDate(p.createdAt)}</td>
          <td><span class="badge badge-app">${p.application?.name || 'Sistema'}</span></td>
          <td><code>${p.externalReference}</code></td>
          <td><span style="color: var(--text-dim); font-size: 0.8rem;">${p.mpPaymentId || 'N/A'}</span></td>
          <td>${p.payerName || p.payerEmail}</td>
          <td style="font-weight: 700; color: #ffffff;">${this.formatCurrency(p.amount)}</td>
          <td>${this.renderStatusBadge(p.status)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.viewPaymentDetails('${p.id}')">🔍 Detalhes</button>
          </td>
        </tr>
      `
        )
        .join('');
    } catch (e) {
      console.error('Erro ao carregar pagamentos:', e);
    }
  }

  async viewPaymentDetails(paymentId) {
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, { headers: this.getHeaders() });
      const data = await res.json();
      if (!data.success || !data.payment) return;

      const p = data.payment;
      const modalBody = document.getElementById('modal-payment-body');
      const modalFooter = document.getElementById('modal-payment-footer');

      modalBody.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Referência Externa:</div>
            <code style="font-size: 1rem; color: var(--accent-cyan); font-weight: 700;">${p.externalReference}</code>
          </div>
          <div>${this.renderStatusBadge(p.status)}</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px;">
          <div><strong>Aplicação:</strong> ${p.application?.name}</div>
          <div><strong>Valor Bruto:</strong> ${this.formatCurrency(p.amount)}</div>
          <div><strong>Taxa Gateway:</strong> ${this.formatCurrency(p.feeAmount || 0)}</div>
          <div><strong>Valor Líquido:</strong> ${this.formatCurrency(p.netReceivedAmount || p.amount)}</div>
          <div><strong>Método:</strong> ${p.paymentMethod}</div>
          <div><strong>ID Mercado Pago:</strong> ${p.mpPaymentId || 'N/A'}</div>
          <div><strong>Pagador:</strong> ${p.payerName || 'N/A'} (${p.payerEmail})</div>
          <div><strong>Documento:</strong> ${p.payerDocument || 'N/A'}</div>
          <div><strong>Criado Em:</strong> ${this.formatDate(p.createdAt)}</div>
          <div><strong>Pago Em:</strong> ${p.paidAt ? this.formatDate(p.paidAt) : 'Pendente'}</div>
        </div>

        ${p.qrCodeBase64 ? `
          <div style="margin-top: 14px; text-align: center;">
            <div style="font-size: 0.85rem; margin-bottom: 6px;">QR Code Pix:</div>
            <div class="qr-preview">
              <img src="data:image/png;base64,${p.qrCodeBase64}" alt="QR Code Pix">
            </div>
            <button class="btn btn-secondary btn-sm" onclick="app.copyToClipboard('${p.qrCode}')">📋 Copiar Código Pix</button>
          </div>
        ` : ''}

        <div style="margin-top: 14px;">
          <strong>Entregas de Webhook (Fan-Out):</strong>
          <div style="margin-top: 6px; font-size: 0.82rem; color: var(--text-muted);">
            ${p.deliveries?.length ? p.deliveries.map(d => `
              <div style="padding: 8px; border: 1px solid var(--border-subtle); border-radius: 6px; margin-bottom: 6px;">
                Status: <strong>${d.status}</strong> [HTTP ${d.httpStatus || 'N/A'}] - Tentativas: ${d.attempts}/${d.maxAttempts}
                <br><span style="color: var(--text-dim);">${d.targetUrl}</span>
              </div>
            `).join('') : 'Nenhum webhook disparado para esta transação.'}
          </div>
        </div>
      `;

      modalFooter.innerHTML = `
        ${p.status === 'APPROVED' ? `
          <button class="btn btn-danger btn-sm" onclick="app.refundPayment('${p.id}')">💸 Estornar / Reembolsar</button>
        ` : ''}
        <button class="btn btn-secondary btn-sm" onclick="app.closeModal('modal-payment-details')">Fechar</button>
      `;

      this.openModal('modal-payment-details');
    } catch (e) {
      console.error('Erro ao abrir detalhes:', e);
    }
  }

  async refundPayment(paymentId) {
    if (!confirm('Tem certeza que deseja solicitar o estorno deste pagamento?')) return;
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Pagamento estornado com sucesso!', 'success');
        this.closeModal('modal-payment-details');
        this.refreshCurrentView();
      } else {
        this.showToast(data.error || 'Falha ao estornar pagamento.', 'warning');
      }
    } catch (e) {
      this.showToast('Erro ao solicitar estorno.', 'warning');
    }
  }

  // ==================== APLICAÇÕES ====================
  async loadApplications() {
    try {
      const res = await fetch('/api/admin/applications', { headers: this.getHeaders() });
      const data = await res.json();
      if (!data.success) return;

      this.appsCache = data.applications || [];

      // Popula selects de filtros
      const filterAppSelect = document.getElementById('filter-app');
      const simAppSelect = document.getElementById('sim-app-select');

      if (filterAppSelect) {
        filterAppSelect.innerHTML = `<option value="ALL">Todas as Apps</option>` +
          this.appsCache.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
      }

      if (simAppSelect) {
        simAppSelect.innerHTML = this.appsCache.map(a => `<option value="${a.id}">${a.name} (${a.slug})</option>`).join('');
      }

      const container = document.getElementById('applications-cards-container');
      if (!container) return;

      container.innerHTML = this.appsCache.map(app => `
        <div class="kpi-card glass-panel" style="padding: 24px; display: flex; flex-direction: column; gap: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1.15rem; font-weight: 700; color: #ffffff;">${app.name}</h3>
            <span class="badge ${app.isActive ? 'badge-approved' : 'badge-rejected'}">${app.isActive ? 'Ativa' : 'Inativa'}</span>
          </div>

          <div style="font-size: 0.85rem; color: var(--text-muted);">
            Slug: <code style="color: var(--accent-cyan);">${app.slug}</code>
          </div>

          <div>
            <div class="form-label">Chave de API (X-Api-Key):</div>
            <div style="display: flex; gap: 8px;">
              <input type="password" value="${app.apiKey}" id="key-input-${app.id}" class="form-control" style="font-size: 0.8rem;" readonly>
              <button class="btn btn-secondary btn-sm" onclick="app.toggleKeyVisibility('${app.id}')">👁️</button>
              <button class="btn btn-secondary btn-sm" onclick="app.copyToClipboard('${app.apiKey}')">📋</button>
            </div>
          </div>

          <div>
            <div class="form-label">Endpoint de Webhook (Destino do Fan-Out):</div>
            <div style="display: flex; gap: 8px;">
              <input type="text" value="${app.webhookUrl || ''}" id="webhook-input-${app.id}" class="form-control" style="font-size: 0.8rem;" placeholder="https://...">
              <button class="btn btn-secondary btn-sm" onclick="app.saveAppWebhook('${app.id}')">💾 Salvar</button>
            </div>
          </div>

          <div>
            <div class="form-label">Segredo HMAC (Assinatura do Webhook):</div>
            <code class="code-box" style="font-size: 0.78rem;">${app.webhookSecret}</code>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 8px;">
            <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="app.pingAppWebhook('${app.id}')">📡 Testar Ping Webhook</button>
            <button class="btn btn-secondary btn-sm" onclick="app.regenerateApiKey('${app.id}')">🔄 Nova Chave</button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.error('Erro ao carregar aplicações:', e);
    }
  }

  toggleKeyVisibility(appId) {
    const input = document.getElementById(`key-input-${appId}`);
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  }

  async saveAppWebhook(appId) {
    const input = document.getElementById(`webhook-input-${appId}`);
    if (!input) return;
    try {
      const res = await fetch(`/api/admin/applications/${appId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ webhookUrl: input.value.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('URL de Webhook atualizada com sucesso!', 'success');
      } else {
        this.showToast(data.error || 'Falha ao salvar URL.', 'warning');
      }
    } catch (e) {
      this.showToast('Erro ao salvar URL de webhook.', 'warning');
    }
  }

  async pingAppWebhook(appId) {
    this.showToast('Disparando teste de conectividade...', 'info');
    try {
      const res = await fetch(`/api/admin/applications/${appId}/ping`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(`✅ ${data.message}`, 'success');
      } else {
        this.showToast(`⚠️ ${data.message}`, 'warning');
      }
    } catch (e) {
      this.showToast('Erro ao disparar ping.', 'warning');
    }
  }

  async regenerateApiKey(appId) {
    if (!confirm('Deseja realmente gerar uma nova chave de API? A chave anterior deixará de funcionar.')) return;
    try {
      const res = await fetch(`/api/admin/applications/${appId}/regenerate-key`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Nova chave gerada com sucesso!', 'success');
        this.loadApplications();
      }
    } catch (e) {
      this.showToast('Erro ao regenerar chave.', 'warning');
    }
  }

  async createApplication() {
    const name = document.getElementById('new-app-name').value.trim();
    const slug = document.getElementById('new-app-slug').value.trim();
    const webhookUrl = document.getElementById('new-app-webhook').value.trim();

    try {
      const res = await fetch('/api/admin/applications', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ name, slug, webhookUrl }),
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(`Aplicação '${name}' cadastrada com sucesso!`, 'success');
        this.closeModal('modal-new-app');
        document.getElementById('form-create-app').reset();
        this.loadApplications();
      } else {
        this.showToast(data.error || 'Falha ao criar aplicação.', 'warning');
      }
    } catch (e) {
      this.showToast('Erro de comunicação.', 'warning');
    }
  }

  // ==================== WEBHOOKS ====================
  async loadWebhooks() {
    try {
      const status = document.getElementById('filter-webhook-status')?.value || 'ALL';
      const res = await fetch(`/api/admin/webhooks/deliveries?status=${status}`, { headers: this.getHeaders() });
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById('webhooks-tbody');
      if (!tbody) return;

      if (!data.deliveries || data.deliveries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 40px;">Nenhum disparo de webhook registrado ainda.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.deliveries.map(d => `
        <tr>
          <td>${this.formatDate(d.createdAt)}</td>
          <td><span class="badge badge-app">${d.application?.name}</span></td>
          <td><code>${d.event}</code></td>
          <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${d.targetUrl}</td>
          <td>${d.attempts}/${d.maxAttempts}</td>
          <td><span style="font-weight: 600; color: ${d.httpStatus >= 200 && d.httpStatus < 300 ? '#34d399' : '#fb7185'}">${d.httpStatus || 'Falha'}</span></td>
          <td><span class="badge ${d.status === 'DELIVERED' ? 'badge-delivered' : 'badge-failed'}">${d.status}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.retryWebhook('${d.id}')">🔄 Reenviar</button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error('Erro ao carregar webhooks:', e);
    }
  }

  async retryWebhook(deliveryId) {
    try {
      this.showToast('Reenviando webhook...', 'info');
      const res = await fetch(`/api/admin/webhooks/deliveries/${deliveryId}/retry`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Webhook reenviado com sucesso!', 'success');
      } else {
        this.showToast(data.message || 'Falha no reenvio.', 'warning');
      }
      this.loadWebhooks();
    } catch (e) {
      this.showToast('Erro ao reenviar webhook.', 'warning');
    }
  }

  // ==================== SIMULADOR SANDBOX ====================
  async simulatePayment() {
    const applicationId = document.getElementById('sim-app-select').value;
    const amount = parseFloat(document.getElementById('sim-amount').value);
    const description = document.getElementById('sim-description').value.trim();
    const autoApprove = document.getElementById('sim-auto-approve').checked;

    try {
      const res = await fetch('/api/admin/simulator/simulate-payment', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ applicationId, amount, description, autoApprove }),
      });
      const data = await res.json();
      if (!data.success) {
        this.showToast(data.error || 'Falha na simulação.', 'warning');
        return;
      }

      const p = data.payment;
      this.currentSimulatedPaymentId = p.id;

      // Exibe área de resultado
      const resultBox = document.getElementById('sim-result-box');
      const qrContainer = document.getElementById('sim-qr-container');
      const copiaColaInput = document.getElementById('sim-copia-cola');
      const approveActionArea = document.getElementById('sim-approve-action-area');

      resultBox.style.display = 'block';
      copiaColaInput.value = p.qrCode || '';

      if (p.qrCodeBase64) {
        qrContainer.innerHTML = `<img src="data:image/png;base64,${p.qrCodeBase64}" alt="QR Code Pix Simulado">`;
      } else {
        qrContainer.innerHTML = `<div style="color: black; font-weight: 600;">QR Code: ${p.externalReference}</div>`;
      }

      if (autoApprove) {
        approveActionArea.style.display = 'none';
        this.showToast('Cobrança simulada criada e aprovada! Webhook disparado.', 'success');
      } else {
        approveActionArea.style.display = 'block';
        this.showToast('Cobrança Pix pendente gerada com sucesso!', 'info');
      }
    } catch (e) {
      this.showToast('Erro ao criar simulação.', 'warning');
    }
  }

  async approveCurrentSimulatedPayment() {
    if (!this.currentSimulatedPaymentId) return;
    try {
      const res = await fetch(`/api/admin/simulator/approve-payment/${this.currentSimulatedPaymentId}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Pagamento aprovado com sucesso! Webhook disparado para a aplicação cliente.', 'success');
        document.getElementById('sim-approve-action-area').style.display = 'none';
        this.refreshCurrentView();
      } else {
        this.showToast(data.error || 'Falha ao aprovar pagamento.', 'warning');
      }
    } catch (e) {
      this.showToast('Erro ao aprovar simulação.', 'warning');
    }
  }

  // ==================== UTILITÁRIOS ====================
  openModal(id) {
    document.getElementById(id)?.classList.add('active');
  }

  closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Copiado para a área de transferência!', 'success');
    });
  }

  formatCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  renderStatusBadge(status) {
    const map = {
      APPROVED: '<span class="badge badge-approved">Aprovado</span>',
      PENDING: '<span class="badge badge-pending">Pendente</span>',
      REJECTED: '<span class="badge badge-rejected">Rejeitado</span>',
      CANCELLED: '<span class="badge badge-rejected">Cancelado</span>',
      REFUNDED: '<span class="badge badge-rejected">Estornado</span>',
    };
    return map[status] || `<span class="badge badge-pending">${status}</span>`;
  }
}

// Inicializa a aplicação
const app = new CJCPaysApp();
window.app = app;
