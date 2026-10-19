/**
 * CJC Dev Pays — Minimalist Client Controller, Drawer Menu, Payments & Applications CRUD
 */

class CJCPaysApp {
  constructor() {
    this.token = localStorage.getItem('cjc_admin_token');
    this.user = JSON.parse(localStorage.getItem('cjc_admin_user') || 'null');
    this.currentView = 'dashboard-view';
    this.eventSource = null;
    this.applicationsCache = [];

    // Paginação e filtros da tela de transações
    this.paymentsPage = 1;
    this.paymentsTotalPages = 1;
    this.paymentsLimit = 20;
    this.paymentsFilters = { search: '', appId: 'ALL', status: 'ALL' };

    // Paginação e filtros da fila de webhooks
    this.webhooksPage = 1;
    this.webhooksTotalPages = 1;
    this.webhooksLimit = 20;
    this.webhooksFilters = { search: '', appId: 'ALL', status: 'ALL' };
    this.currentWebhookPayload = '';

    // Filtro mensal do Dashboard
    this.dashboardMonth = String(new Date().getMonth() + 1);
    this.dashboardYear = new Date().getFullYear();

    // Filtros e estado do Módulo Financeiro & Contábil (Filtro único baseado em Mês)
    this.financialFilters = {
      month: String(new Date().getMonth() + 1), // Mês atual pré-selecionado (1 a 12)
      year: new Date().getFullYear(),
      applicationId: '',
      paymentMethod: '',
    };
    this.financialReportCache = null;

    this.init();
  }

  async init() {
    this.bindEvents();

    if (this.token) {
      const isValid = await this.validateSession();
      if (isValid) {
        this.showAppShell();
      } else {
        this.showLogin();
      }
    } else {
      this.showLogin();
    }
  }

  // ==================== CONTROLE DE TELAS & SESSÃO ====================
  showLogin() {
    document.getElementById('login-view').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';

    setTimeout(() => {
      const email = document.getElementById('login-email');
      const pass = document.getElementById('login-password');
      if (email) email.value = '';
      if (pass) pass.value = '';
    }, 50);

    const alertBox = document.getElementById('login-alert');
    if (alertBox) alertBox.style.display = 'none';

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  showAppShell() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app-shell').style.display = 'flex';

    if (this.user) {
      const name = this.user.name || this.user.username || 'Administrador';
      const email = this.user.email || 'admin@cjcdev.com';
      const initials =
        name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase() || 'AD';

      // Atualiza Topbar
      document.getElementById('user-display-name').innerText = name;
      document.getElementById('user-display-email').innerText = email;
      document.getElementById('user-avatar').innerText = initials;

      // Atualiza Drawer
      document.getElementById('drawer-user-name').innerText = name;
      document.getElementById('drawer-user-email').innerText = email;
      document.getElementById('drawer-user-avatar').innerText = initials;
    }

    this.setupSSE();
    this.navigate(this.currentView);
  }

  async validateSession() {
    try {
      const res = await fetch('/api/admin/metrics', { headers: this.getHeaders() });
      if (res.status === 401) {
        this.clearSession();
        return false;
      }
      return res.ok;
    } catch {
      return false;
    }
  }

  clearSession() {
    localStorage.removeItem('cjc_admin_token');
    localStorage.removeItem('cjc_admin_user');
    this.token = null;
    this.user = null;
  }

  logout() {
    this.clearSession();
    this.closeDrawer();
    this.showToast('Sessão encerrada com sucesso.', 'info');
    this.showLogin();
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
    };
  }

  // ==================== NAVEGAÇÃO & DRAWER HAMBÚRGUER ====================
  openDrawer() {
    document.getElementById('drawer-menu')?.classList.add('open');
    document.getElementById('drawer-overlay')?.classList.add('active');
  }

  closeDrawer() {
    document.getElementById('drawer-menu')?.classList.remove('open');
    document.getElementById('drawer-overlay')?.classList.remove('active');
  }

  navigate(viewId) {
    this.currentView = viewId;

    // Atualiza visibilidade dos painéis
    document.querySelectorAll('.view-panel').forEach((el) => {
      el.style.display = el.id === viewId ? 'flex' : 'none';
      el.classList.toggle('active', el.id === viewId);
    });

    // Atualiza links do menu lateral
    document.querySelectorAll('.drawer-nav-item').forEach((item) => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewId);
    });

    // Atualiza tag no Topbar
    const titles = {
      'dashboard-view': 'Visão Geral',
      'payments-view': 'Transações',
      'applications-view': 'Aplicações & Chaves',
      'financial-view': 'Financeiro & Contábil',
      'webhooks-view': 'Fila de Webhooks',
      'users-view': 'Administradores',
      'fees-view': 'Taxas & Comissões',
    };
    const tag = document.getElementById('topbar-current-page-tag');
    if (tag) {
      tag.innerText = titles[viewId] || 'Central de Pagamentos';
    }

    this.closeDrawer();

    if (viewId === 'dashboard-view') {
      this.loadMetrics();
    } else if (viewId === 'payments-view') {
      this.populateAppFilterOptions();
      this.loadAllPayments();
    } else if (viewId === 'applications-view') {
      this.loadApplicationsCRUD();
    } else if (viewId === 'financial-view') {
      this.populateFinancialAppOptions();
      this.syncFinancialMonthUI();
      this.loadFinancialReport();
    } else if (viewId === 'webhooks-view') {
      this.populateWebhooksAppFilterOptions();
      this.loadAllWebhooks();
    } else if (viewId === 'users-view') {
      this.loadAdminUsersCRUD();
    } else if (viewId === 'fees-view') {
      this.loadFeeSettings();
    }
  }

  // ==================== BIND DE EVENTOS ====================
  bindEvents() {
    // Login
    document.getElementById('form-login')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    document.getElementById('btn-toggle-password')?.addEventListener('click', () => {
      const pass = document.getElementById('login-password');
      if (pass) pass.type = pass.type === 'password' ? 'text' : 'password';
    });

    // Menu Hambúrguer e Drawer
    document.getElementById('btn-toggle-menu')?.addEventListener('click', () => {
      this.openDrawer();
    });

    document.getElementById('btn-close-drawer')?.addEventListener('click', () => {
      this.closeDrawer();
    });

    document.getElementById('drawer-overlay')?.addEventListener('click', () => {
      this.closeDrawer();
    });

    // Tecla ESC fecha modais e drawer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeDrawer();
        this.closeModal('modal-payment-details');
        this.closeModal('modal-create-app');
        this.closeModal('modal-edit-app');
        this.closeModal('modal-webhook-details');
        this.closeModal('modal-create-user');
        this.closeModal('modal-edit-user');
      }
    });

    // Clique no backdrop fecha o modal ativo
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.closeModal(backdrop.id);
        }
      });
    });

    // Navegação nos itens do menu
    document.querySelectorAll('.drawer-nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        if (view) this.navigate(view);
      });
    });

    // Logouts
    document.getElementById('btn-logout')?.addEventListener('click', () => this.logout());
    document.getElementById('btn-drawer-logout')?.addEventListener('click', () => this.logout());

    // Atualização dinâmica contínua do Dashboard (fallback de sincronização a cada 30s)
    setInterval(() => {
      if (this.currentView === 'dashboard-view' && !document.hidden && this.token) {
        this.loadMetrics();
      }
    }, 30000);

    // Dashboard Filtro Mensal
    const monthSelect = document.getElementById('dashboard-month-filter');
    if (monthSelect) {
      monthSelect.value = this.dashboardMonth;
      monthSelect.addEventListener('change', (e) => {
        this.dashboardMonth = e.target.value;
        this.loadMetrics();
        const selectedText = monthSelect.options[monthSelect.selectedIndex]?.text || '';
        this.showToast(`Filtrando dados por: ${selectedText}`, 'info');
      });
    }

    // Eventos da Tela de Transações
    document.getElementById('btn-refresh-payments')?.addEventListener('click', () => {
      this.loadAllPayments();
      this.showToast('Transações atualizadas!', 'info');
    });

    const handlePurgeExpired = async () => {
      const confirmed = confirm('Deseja realmente remover do histórico todas as transações não pagas / expiradas?');
      if (!confirmed) return;

      try {
        const res = await fetch('/api/admin/payments/expired', {
          method: 'DELETE',
          headers: this.getHeaders(),
        });
        const data = await res.json();
        if (data.success) {
          this.showToast(data.message || 'Pagamentos expirados removidos!', 'success');
          this.loadAllPayments();
          this.loadMetrics();
        } else {
          this.showToast(data.error || 'Erro ao remover pagamentos expirados', 'error');
        }
      } catch (err) {
        this.showToast('Erro de comunicação com o servidor', 'error');
      }
    };

    ['btn-purge-expired', 'btn-purge-expired-filters', 'btn-purge-expired-overview'].forEach((btnId) => {
      document.getElementById(btnId)?.addEventListener('click', handlePurgeExpired);
    });

    document.getElementById('btn-apply-filters')?.addEventListener('click', () => {
      this.applyPaymentsFilters();
    });

    document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
      this.clearPaymentsFilters();
    });

    document.getElementById('filter-search')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.applyPaymentsFilters();
    });

    document.getElementById('btn-prev-page')?.addEventListener('click', () => {
      this.prevPaymentsPage();
    });

    document.getElementById('btn-next-page')?.addEventListener('click', () => {
      this.nextPaymentsPage();
    });

    // Modal de Detalhes do Pagamento
    document.getElementById('btn-close-modal')?.addEventListener('click', () => this.closeModal('modal-payment-details'));
    document.getElementById('btn-modal-close-action')?.addEventListener('click', () => this.closeModal('modal-payment-details'));

    // Modal Nova Aplicação
    document.getElementById('btn-open-create-app')?.addEventListener('click', () => {
      this.openCreateAppModal();
    });
    document.getElementById('btn-close-create-modal')?.addEventListener('click', () => this.closeModal('modal-create-app'));
    document.getElementById('btn-cancel-create-app')?.addEventListener('click', () => this.closeModal('modal-create-app'));

    // Auto-slugify e preview do ID do Estabelecimento ao digitar o nome da nova aplicação
    const updateEstabPreview = (slug) => {
      const preview = document.getElementById('new-app-estab-preview');
      if (preview) {
        preview.textContent = (slug || 'MINHA-LOJA').toUpperCase().replace(/[^A-Z0-9]/g, '-');
      }
    };

    document.getElementById('new-app-name')?.addEventListener('input', (e) => {
      const slugInput = document.getElementById('new-app-slug');
      if (slugInput && !slugInput.dataset.manualEdited) {
        const slug = this.slugify(e.target.value);
        slugInput.value = slug;
        updateEstabPreview(slug);
      }
    });
    document.getElementById('new-app-slug')?.addEventListener('input', (e) => {
      e.target.dataset.manualEdited = 'true';
      updateEstabPreview(e.target.value);
    });

    document.getElementById('form-create-app')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreateApp();
    });

    // Modal Editar Aplicação
    document.getElementById('btn-close-edit-modal')?.addEventListener('click', () => this.closeModal('modal-edit-app'));
    document.getElementById('btn-cancel-edit-app')?.addEventListener('click', () => this.closeModal('modal-edit-app'));
    document.getElementById('form-edit-app')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleEditApp();
    });

    // Eventos da Fila de Webhooks
    document.getElementById('btn-refresh-webhooks')?.addEventListener('click', () => {
      this.loadAllWebhooks();
      this.showToast('Fila de webhooks atualizada!', 'info');
    });

    document.getElementById('btn-apply-webhooks-filters')?.addEventListener('click', () => {
      this.applyWebhooksFilters();
    });

    document.getElementById('btn-clear-webhooks-filters')?.addEventListener('click', () => {
      this.clearWebhooksFilters();
    });

    document.getElementById('filter-webhooks-search')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.applyWebhooksFilters();
    });

    document.getElementById('btn-prev-webhooks-page')?.addEventListener('click', () => {
      this.prevWebhooksPage();
    });

    document.getElementById('btn-next-webhooks-page')?.addEventListener('click', () => {
      this.nextWebhooksPage();
    });

    // Modal de Inspeção de Webhook
    document.getElementById('btn-close-webhook-modal')?.addEventListener('click', () => this.closeModal('modal-webhook-details'));
    document.getElementById('btn-modal-close-webhook')?.addEventListener('click', () => this.closeModal('modal-webhook-details'));

    // Delegação de eventos dinâmica para Fila de Webhooks (imune a bloqueios de CSP)
    document.getElementById('webhooks-tbody')?.addEventListener('click', (e) => {
      const inspectBtn = e.target.closest('.btn-inspect-webhook, [data-action="inspect-webhook"]');
      if (inspectBtn) {
        e.preventDefault();
        const id = inspectBtn.getAttribute('data-delivery-id');
        if (id) {
          this.viewWebhookDetails(id, inspectBtn);
        }
        return;
      }

      const retryBtn = e.target.closest('.btn-retry-webhook, [data-action="retry-webhook"]');
      if (retryBtn) {
        e.preventDefault();
        const id = retryBtn.getAttribute('data-delivery-id');
        if (id) {
          this.retryWebhookDelivery(id);
        }
        return;
      }
    });

    // Delegação de eventos dinâmica para Tabelas de Pagamento
    ['payments-tbody', 'all-payments-tbody'].forEach((tbodyId) => {
      document.getElementById(tbodyId)?.addEventListener('click', (e) => {
        const detailBtn = e.target.closest('.btn-details-payment, [data-action="inspect-payment"]');
        if (detailBtn) {
          e.preventDefault();
          const id = detailBtn.getAttribute('data-payment-id');
          if (id) {
            this.viewPaymentDetails(id);
          }
        }
      });
    });

    // Delegação de cliques internos no Modal de Webhook
    document.getElementById('modal-webhook-footer')?.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-action="close-modal"]');
      if (closeBtn) {
        e.preventDefault();
        this.closeModal('modal-webhook-details');
        return;
      }
      const retryBtn = e.target.closest('[data-action="retry-delivery-modal"]');
      if (retryBtn) {
        e.preventDefault();
        const id = retryBtn.getAttribute('data-delivery-id');
        if (id) this.retryWebhookDelivery(id, true);
        return;
      }
    });

    document.getElementById('modal-webhook-body')?.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('[data-action="copy-payload"]');
      if (copyBtn) {
        e.preventDefault();
        this.copyCurrentWebhookPayload();
      }
    });

    // Modal Criar Administrador
    document.getElementById('btn-open-create-user')?.addEventListener('click', () => this.openCreateUserModal());
    document.getElementById('btn-close-create-user-modal')?.addEventListener('click', () => this.closeModal('modal-create-user'));
    document.getElementById('btn-cancel-create-user')?.addEventListener('click', () => this.closeModal('modal-create-user'));
    document.getElementById('btn-toggle-new-user-pass')?.addEventListener('click', () => {
      const pass = document.getElementById('new-user-password');
      if (pass) pass.type = pass.type === 'password' ? 'text' : 'password';
    });
    document.getElementById('form-create-user')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreateUser();
    });

    // Modal Editar Administrador
    document.getElementById('btn-close-edit-user-modal')?.addEventListener('click', () => this.closeModal('modal-edit-user'));
    document.getElementById('btn-cancel-edit-user')?.addEventListener('click', () => this.closeModal('modal-edit-user'));
    document.getElementById('btn-toggle-edit-user-pass')?.addEventListener('click', () => {
      const pass = document.getElementById('edit-user-password');
      if (pass) pass.type = pass.type === 'password' ? 'text' : 'password';
    });
    document.getElementById('form-edit-user')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleEditUser();
    });

    // Configurações de Taxas & Comissões
    document.getElementById('btn-refresh-fees')?.addEventListener('click', () => this.loadFeeSettings());
    document.getElementById('btn-save-fees')?.addEventListener('click', () => this.handleSaveFees());
    document.getElementById('form-fees-settings')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveFees();
    });
    [
      'simulation-amount',
      'fee-mp-pix',
      'fee-mp-credit',
      'fee-mp-debit',
      'fee-comm-pix',
      'fee-comm-credit',
      'fee-comm-debit',
    ].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () => this.updateLiveFeeSimulation());
    });

    // Eventos do Módulo Financeiro & Contábil (Filtro Único Baseado em Mêses)
    document.querySelectorAll('.btn-month-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const month = e.currentTarget.getAttribute('data-month');
        if (month) this.setFinancialMonth(month);
      });
    });

    document.getElementById('fin-filter-year')?.addEventListener('change', (e) => {
      this.financialFilters.year = e.target.value;
      this.loadFinancialReport();
    });

    document.getElementById('fin-filter-app')?.addEventListener('change', (e) => {
      this.financialFilters.applicationId = e.target.value;
      this.loadFinancialReport();
    });

    document.getElementById('fin-filter-method')?.addEventListener('change', (e) => {
      this.financialFilters.paymentMethod = e.target.value;
      this.loadFinancialReport();
    });

    document.getElementById('btn-refresh-financial')?.addEventListener('click', () => {
      this.loadFinancialReport();
      this.showToast('Dados contábeis atualizados!', 'info');
    });

    document.getElementById('btn-export-financial-csv')?.addEventListener('click', () => {
      this.exportFinancialCsv();
    });

    document.getElementById('btn-print-financial')?.addEventListener('click', () => {
      this.printFinancialReport();
    });
  }

  slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
  }

  // ==================== LOGIN ====================
  async handleLogin() {
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const alertBox = document.getElementById('login-alert');
    const alertText = document.getElementById('login-alert-text');
    const submitBtn = document.getElementById('btn-submit-login');

    if (!email || !password) return;

    if (alertBox) alertBox.style.display = 'none';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Autenticando...';
    }

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success && data.token) {
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('cjc_admin_token', this.token);
        localStorage.setItem('cjc_admin_user', JSON.stringify(this.user));

        this.showToast(`Bem-vindo, ${data.user.name || data.user.email}!`, 'success');
        this.showAppShell();
      } else {
        if (alertBox && alertText) {
          alertText.innerText = data.error || 'Credenciais inválidas.';
          alertBox.style.display = 'flex';
        }
      }
    } catch (e) {
      if (alertBox && alertText) {
        alertText.innerText = 'Falha ao conectar com o servidor.';
        alertBox.style.display = 'flex';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Entrar no Dashboard';
      }
    }
  }

  // ==================== TEMPO REAL (SSE) ====================
  setupSSE() {
    if (!this.token) return;
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      this.eventSource = new EventSource(`/api/admin/events/stream?token=${this.token}`);

      const badgeText = document.getElementById('sse-status-text');
      const badge = document.getElementById('sse-badge');

      this.eventSource.onopen = () => {
        if (badgeText) badgeText.innerText = 'Tempo Real Ativo';
        if (badge) badge.style.opacity = '1';
      };

      this.eventSource.addEventListener('payment:created', (e) => {
        const data = JSON.parse(e.data);
        this.showToast(`⚡ Nova cobrança Pix criada: R$ ${data.amount.toFixed(2)} (${data.appName})`, 'info');
        if (this.currentView === 'dashboard-view') this.loadMetrics();
        if (this.currentView === 'payments-view') this.loadAllPayments();
      });

      this.eventSource.addEventListener('payment:updated', (e) => {
        const data = JSON.parse(e.data);
        if (data.status === 'APPROVED') {
          this.showToast(`💰 Pagamento APROVADO! R$ ${data.amount.toFixed(2)} (${data.appName})`, 'success');
        } else {
          this.showToast(`Transação atualizada: ${data.status} (${data.externalReference})`, 'info');
        }
        if (this.currentView === 'dashboard-view') this.loadMetrics();
        if (this.currentView === 'payments-view') this.loadAllPayments();
      });

      this.eventSource.addEventListener('webhook:delivered', (e) => {
        const data = JSON.parse(e.data);
        this.showToast(`✅ Webhook entregue para ${data.targetUrl}`, 'success');
        if (this.currentView === 'dashboard-view') this.loadMetrics();
        if (this.currentView === 'webhooks-view') this.loadAllWebhooks();
      });

      this.eventSource.addEventListener('webhook:failed', (e) => {
        const data = JSON.parse(e.data);
        this.showToast(`⚠️ Falha na entrega de webhook para ${data.targetUrl}`, 'warning');
        if (this.currentView === 'webhooks-view') this.loadAllWebhooks();
      });

      this.eventSource.onerror = () => {
        if (badgeText) badgeText.innerText = 'Reconectando...';
        if (badge) badge.style.opacity = '0.7';
      };
    } catch (err) {
      console.warn('Erro ao inicializar SSE:', err);
    }
  }

  // ==================== DADOS DO DASHBOARD ====================
  async loadMetrics() {
    try {
      const params = new URLSearchParams();
      if (this.dashboardMonth && this.dashboardMonth !== 'ALL') {
        params.append('month', this.dashboardMonth);
      }
      if (this.dashboardYear) {
        params.append('year', this.dashboardYear);
      }
      const qs = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(`/api/admin/metrics${qs}`, { headers: this.getHeaders() });

      if (res.status === 401) {
        this.clearSession();
        this.showLogin();
        return;
      }

      const data = await res.json();
      if (!data.success) return;

      const { kpis, webhooks, applications, recentPayments, isCurrentMonth } = data;

      // KPIs
      if (kpis) {
        document.getElementById('kpi-total-volume').innerText = this.formatCurrency(kpis.totalVolume);
        document.getElementById('kpi-net-volume').innerText = this.formatCurrency(kpis.netVolume);

        // Adaptação dos rótulos de faturamento conforme o mês selecionado
        const todayLabel = document.getElementById('kpi-today-label');
        const todayMeta = document.getElementById('kpi-today-meta');
        if (isCurrentMonth) {
          if (todayLabel) todayLabel.innerText = 'Faturamento Hoje';
          document.getElementById('kpi-today-volume').innerText = this.formatCurrency(kpis.todayVolume);
          if (todayMeta) {
            todayMeta.innerHTML = `Acumulado no mês: <strong id="kpi-month-volume">${this.formatCurrency(kpis.monthVolume)}</strong>`;
          }
        } else {
          if (todayLabel) todayLabel.innerText = 'Total do Mês';
          document.getElementById('kpi-today-volume').innerText = this.formatCurrency(kpis.monthVolume);
          if (todayMeta) {
            todayMeta.innerHTML = `Líquido no mês: <strong id="kpi-month-volume">${this.formatCurrency(kpis.netVolume)}</strong>`;
          }
        }

        document.getElementById('kpi-approval-rate').innerText = `${kpis.approvalRate}%`;
        document.getElementById('kpi-approved-count').innerText = kpis.approvedCount;
        document.getElementById('kpi-total-count').innerText = kpis.totalCount;
      }

      if (webhooks) {
        document.getElementById('kpi-webhook-health').innerText = `${webhooks.healthPct}%`;
        document.getElementById('kpi-webhook-success').innerText = webhooks.success;
        document.getElementById('kpi-webhook-failed').innerText = webhooks.failed;
      }

      // Apps Volume Grid
      const appsContainer = document.getElementById('apps-container');
      if (appsContainer && applications) {
        if (applications.length === 0) {
          appsContainer.innerHTML = `<div class="card empty-state" style="padding: 24px; color: var(--text-muted);">Nenhuma aplicação cadastrada.</div>`;
        } else {
          appsContainer.innerHTML = applications
            .map(
              (app) => `
            <div class="app-card">
              <div class="app-card-header">
                <div>
                  <div class="app-name">${app.name}</div>
                  <div class="app-slug">${app.slug}</div>
                </div>
                <span class="badge ${app.isActive ? 'badge-approved' : 'badge-rejected'}">
                  ${app.isActive ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <div class="app-stats-row">
                <span class="app-volume-label">${app.approvedCount} pagamentos aprovados (${app.totalPayments} total)</span>
                <span class="app-volume-value">${this.formatCurrency(app.approvedVolume)}</span>
              </div>
            </div>
          `
            )
            .join('');
        }
      }

      // Transações Recentes
      const tbody = document.getElementById('payments-tbody');
      if (tbody) {
        if (!recentPayments || recentPayments.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" class="table-empty-cell">Nenhuma transação registrada no momento.</td></tr>`;
        } else {
          tbody.innerHTML = recentPayments
            .map(
              (p) => `
            <tr>
              <td class="col-date">${this.formatDate(p.createdAt)}</td>
              <td class="col-app"><span class="badge badge-app">${p.application?.name || 'Sistema'}</span></td>
              <td class="col-ref"><code>${p.externalReference}</code></td>
              <td class="col-method" style="font-size: 0.8rem; font-weight: 500;">${p.paymentMethod}</td>
              <td class="col-amount" style="font-weight: 600; color: #ffffff;">${this.formatCurrency(p.amount)}</td>
              <td class="col-status">${this.renderStatusBadge(p.status, p.statusDetail)}</td>
              <td class="col-action" style="text-align: right;">
                <button type="button" class="btn btn-secondary btn-sm btn-details-payment" data-action="inspect-payment" data-payment-id="${p.id}" onclick="app.viewPaymentDetails('${p.id}')">
                  Detalhes
                </button>
              </td>
            </tr>
          `
            )
            .join('');
        }
      }
    } catch (e) {
      console.error('Erro ao carregar dados do dashboard:', e);
    }
  }

  // ==================== TELA DE TRANSAÇÕES ====================
  async populateAppFilterOptions() {
    const filterSelect = document.getElementById('filter-app');
    if (!filterSelect) return;

    if (!this.applicationsCache || this.applicationsCache.length === 0) {
      try {
        const res = await fetch('/api/admin/applications', { headers: this.getHeaders() });
        const data = await res.json();
        if (data.success) {
          this.applicationsCache = data.applications || [];
        }
      } catch (e) {
        console.warn('Erro ao carregar lista de apps para filtro:', e);
      }
    }

    const currentVal = filterSelect.value || 'ALL';
    filterSelect.innerHTML =
      `<option value="ALL">Todas as Aplicações</option>` +
      this.applicationsCache.map((app) => `<option value="${app.id}">${app.name}</option>`).join('');
    filterSelect.value = currentVal;
  }

  applyPaymentsFilters() {
    this.paymentsFilters.search = document.getElementById('filter-search')?.value.trim() || '';
    this.paymentsFilters.appId = document.getElementById('filter-app')?.value || 'ALL';
    this.paymentsFilters.status = document.getElementById('filter-status')?.value || 'ALL';
    this.paymentsPage = 1;
    this.loadAllPayments();
  }

  clearPaymentsFilters() {
    const searchInput = document.getElementById('filter-search');
    const appSelect = document.getElementById('filter-app');
    const statusSelect = document.getElementById('filter-status');

    if (searchInput) searchInput.value = '';
    if (appSelect) appSelect.value = 'ALL';
    if (statusSelect) statusSelect.value = 'ALL';

    this.paymentsFilters = { search: '', appId: 'ALL', status: 'ALL' };
    this.paymentsPage = 1;
    this.loadAllPayments();
  }

  prevPaymentsPage() {
    if (this.paymentsPage > 1) {
      this.paymentsPage--;
      this.loadAllPayments();
    }
  }

  nextPaymentsPage() {
    if (this.paymentsPage < this.paymentsTotalPages) {
      this.paymentsPage++;
      this.loadAllPayments();
    }
  }

  async loadAllPayments() {
    const tbody = document.getElementById('all-payments-tbody');
    const infoEl = document.getElementById('pagination-info');
    const pageLabel = document.getElementById('pagination-page-label');
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');

    if (!tbody) return;

    try {
      const { search, appId, status } = this.paymentsFilters;
      const url = `/api/admin/payments?page=${this.paymentsPage}&limit=${this.paymentsLimit}&search=${encodeURIComponent(search)}&appId=${appId}&status=${status}`;

      const res = await fetch(url, { headers: this.getHeaders() });
      if (res.status === 401) {
        this.clearSession();
        this.showLogin();
        return;
      }

      const data = await res.json();
      if (!data.success) {
        tbody.innerHTML = `<tr><td colspan="9" class="table-empty-cell">Erro ao carregar transações.</td></tr>`;
        return;
      }

      const { payments, pagination } = data;
      this.paymentsTotalPages = pagination.totalPages || 1;
      this.paymentsPage = pagination.page || 1;

      // Renderiza Tabela
      if (!payments || payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="table-empty-cell">Nenhuma transação encontrada com os filtros selecionados.</td></tr>`;
      } else {
        tbody.innerHTML = payments
          .map(
            (p) => `
          <tr>
            <td class="col-date">${this.formatDate(p.createdAt)}</td>
            <td class="col-app"><span class="badge badge-app">${p.application?.name || 'Sistema'}</span></td>
            <td class="col-ref"><code>${p.externalReference}</code></td>
            <td class="col-mpid"><span style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted);">${p.mpPaymentId ? '#' + p.mpPaymentId : '—'}</span></td>
            <td class="col-payer">
              <div style="font-weight: 500; color: var(--text-primary); font-size: 0.86rem;">${p.payerName || 'N/A'}</div>
              <div style="font-size: 0.74rem; color: var(--text-muted);">${p.payerEmail || ''}</div>
            </td>
            <td class="col-method" style="font-size: 0.8rem; font-weight: 500;">${p.paymentMethod}</td>
            <td class="col-amount" style="font-weight: 600; color: #ffffff;">${this.formatCurrency(p.amount)}</td>
            <td class="col-status">${this.renderStatusBadge(p.status, p.statusDetail)}</td>
            <td class="col-action" style="text-align: right;">
              <button type="button" class="btn btn-secondary btn-sm btn-details-payment" data-action="inspect-payment" data-payment-id="${p.id}" onclick="app.viewPaymentDetails('${p.id}')">
                Detalhes
              </button>
            </td>
          </tr>
        `
          )
          .join('');
      }

      // Atualiza Paginação
      const total = pagination.total || 0;
      const start = total === 0 ? 0 : (this.paymentsPage - 1) * this.paymentsLimit + 1;
      const end = Math.min(this.paymentsPage * this.paymentsLimit, total);

      if (infoEl) infoEl.innerText = `Exibindo ${start} a ${end} de ${total} transações`;
      if (pageLabel) pageLabel.innerText = `Página ${this.paymentsPage} de ${this.paymentsTotalPages}`;
      if (prevBtn) prevBtn.disabled = this.paymentsPage <= 1;
      if (nextBtn) nextBtn.disabled = this.paymentsPage >= this.paymentsTotalPages;
    } catch (e) {
      console.error('Erro ao carregar transações:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="table-empty-cell">Erro de comunicação com o servidor.</td></tr>`;
    }
  }

  // ==================== CRUD DE APLICAÇÕES ====================
  async loadApplicationsCRUD() {
    const container = document.getElementById('crud-apps-container');
    if (!container) return;

    try {
      const res = await fetch('/api/admin/applications', { headers: this.getHeaders() });
      if (res.status === 401) {
        this.clearSession();
        this.showLogin();
        return;
      }

      const data = await res.json();
      if (!data.success) {
        this.showToast(data.error || 'Falha ao listar aplicações.', 'warning');
        return;
      }

      this.applicationsCache = data.applications || [];

      if (this.applicationsCache.length === 0) {
        container.innerHTML = `
          <div class="card empty-state" style="padding: 40px; text-align: center; color: var(--text-muted); grid-column: 1 / -1;">
            <p style="font-size: 1.1rem; margin-bottom: 12px;">Nenhuma aplicação cadastrada ainda.</p>
            <button class="btn btn-primary btn-sm" onclick="app.openCreateAppModal()">➕ Criar Primeira Aplicação</button>
          </div>
        `;
        return;
      }

      container.innerHTML = this.applicationsCache
        .map(
          (app) => `
        <div class="crud-app-card" id="app-card-${app.id}">
          <div class="crud-app-header">
            <div>
              <h3 class="crud-app-title">${app.name}</h3>
              <div style="margin-top: 3px;">
                <code style="font-size: 0.76rem;">slug: ${app.slug}</code>
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              ${app.isCommissionExempt ? '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">🛡️ Isenta de Comissão</span>' : ''}
              <span class="badge ${app.isActive ? 'badge-approved' : 'badge-rejected'}">
                ${app.isActive ? 'Ativa' : 'Inativa'}
              </span>
            </div>
          </div>

          <!-- Chave de API -->
          <div class="crud-field-box">
            <span class="crud-field-label">Chave de API (X-Api-Key)</span>
            <div class="input-action-group">
              <input 
                type="password" 
                id="key-input-${app.id}" 
                class="input-control" 
                value="${app.apiKey}" 
                readonly
              >
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                onclick="app.toggleKeyVisibility('${app.id}')" 
                title="Mostrar/Ocultar Chave"
              >
                👁️
              </button>
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                onclick="app.copyToClipboard('${app.apiKey}')" 
                title="Copiar Chave de API"
              >
                📋
              </button>
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                onclick="app.regenerateApiKey('${app.id}')" 
                title="Regenerar Chave de API"
              >
                🔄
              </button>
            </div>
          </div>

          <!-- Endpoint de Webhook -->
          <div class="crud-field-box">
            <span class="crud-field-label">Endpoint de Webhook (Fan-Out)</span>
            <div class="input-action-group">
              <input 
                type="url" 
                id="webhook-input-${app.id}" 
                class="input-control" 
                placeholder="https://meusite.com/webhook.php" 
                value="${app.webhookUrl || ''}"
              >
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                onclick="app.saveInlineWebhook('${app.id}')" 
                title="Salvar Webhook"
              >
                💾
              </button>
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                onclick="app.pingWebhook('${app.id}')" 
                title="Testar Conexão (Ping)"
              >
                📡
              </button>
            </div>
          </div>

          <!-- Segredo HMAC -->
          <div class="crud-field-box">
            <span class="crud-field-label">Segredo HMAC (X-CJC-Signature)</span>
            <div class="input-action-group">
              <div class="code-secret-box" title="${app.webhookSecret}">
                ${app.webhookSecret}
              </div>
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                onclick="app.copyToClipboard('${app.webhookSecret}')" 
                title="Copiar Segredo HMAC"
              >
                📋
              </button>
            </div>
          </div>

          <!-- ID do Estabelecimento (Automático) -->
          <div class="crud-field-box">
            <div class="crud-field-header">
              <span class="crud-field-label">ID do Estabelecimento Contábil</span>
              <span style="font-size: 0.7rem; color: var(--accent-cyan); font-weight: 500;">Automático</span>
            </div>
            <div class="input-action-group">
              <input 
                type="text" 
                class="input-control" 
                value="${app.establishmentId || app.slug.toUpperCase().replace(/[^A-Z0-9]/g, '-')}" 
                readonly 
                style="font-family: var(--font-mono); font-weight: 600; color: var(--accent-cyan);"
              >
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                onclick="app.copyToClipboard('${app.establishmentId || app.slug.toUpperCase().replace(/[^A-Z0-9]/g, '-')}')" 
                title="Copiar ID do Estabelecimento"
              >
                📋
              </button>
            </div>
          </div>

          <!-- Bloco de Integração .env da Loja -->
          <div class="crud-field-box crud-env-box">
            <div class="crud-env-header">
              <span class="crud-field-label crud-env-label">Configuração .env desta Loja</span>
              <button 
                type="button" 
                class="btn btn-primary btn-sm btn-copy-env" 
                onclick="app.copyEnvSnippet('${app.apiKey}', '${app.webhookSecret}')" 
                title="Copiar variáveis para o .env da loja"
              >
                📋 Copiar .env
              </button>
            </div>
            <pre class="crud-env-pre">CJC_PAYS_BASE_URL=https://pays.cjcdev.site
CJC_PAYS_API_KEY=${app.apiKey}
CJC_PAYS_WEBHOOK_SECRET=${app.webhookSecret}</pre>
          </div>

          <!-- Rodapé de Ações do Card -->
          <div class="crud-app-actions-bar">
            <div class="crud-app-counters">
              <span>💳 ${app._count?.payments || 0} pagamentos</span> • 
              <span>🔀 ${app._count?.deliveries || 0} entregas</span>
            </div>
            <div class="crud-app-buttons">
              <button 
                type="button" 
                class="btn btn-warning btn-sm" 
                onclick="app.clearApplicationTransactions('${app.id}')"
                title="Limpar transações de teste desta aplicação"
              >
                🧹 Limpar Transações
              </button>
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                onclick="app.openEditAppModal('${app.id}')"
              >
                ✏️ Editar
              </button>
              <button 
                type="button" 
                class="btn btn-danger btn-sm" 
                onclick="app.deleteApplication('${app.id}')"
              >
                🗑️ Excluir
              </button>
            </div>
          </div>
        </div>
      `
        )
        .join('');
    } catch (e) {
      console.error('Erro ao listar aplicações:', e);
      this.showToast('Erro ao carregar aplicações.', 'warning');
    }
  }

  toggleKeyVisibility(appId) {
    const input = document.getElementById(`key-input-${appId}`);
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  }

  openCreateAppModal() {
    const form = document.getElementById('form-create-app');
    if (form) form.reset();
    const slugInput = document.getElementById('new-app-slug');
    if (slugInput) delete slugInput.dataset.manualEdited;
    const exemptCheckbox = document.getElementById('new-app-exempt-commission');
    if (exemptCheckbox) exemptCheckbox.checked = false;

    this.openModal('modal-create-app');
    document.getElementById('new-app-name')?.focus();
  }

  async handleCreateApp() {
    const name = document.getElementById('new-app-name')?.value.trim();
    const slug = document.getElementById('new-app-slug')?.value.trim();
    const webhookUrl = document.getElementById('new-app-webhook')?.value.trim();
    const isCommissionExempt = Boolean(document.getElementById('new-app-exempt-commission')?.checked);
    const submitBtn = document.getElementById('btn-submit-create-app');

    if (!name || !slug) {
      this.showToast('Nome e slug são obrigatórios.', 'warning');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Cadastrando...';
    }

    try {
      const res = await fetch('/api/admin/applications', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name,
          slug,
          webhookUrl: webhookUrl || undefined,
          isCommissionExempt,
        }),
      });

      const data = await res.json();

      if (data.success) {
        this.showToast(`Aplicação '${name}' criada com sucesso!`, 'success');
        this.closeModal('modal-create-app');
        this.loadApplicationsCRUD();
      } else {
        this.showToast(data.error || 'Falha ao criar aplicação.', 'warning');
      }
    } catch (e) {
      this.showToast('Erro ao comunicar com o servidor.', 'warning');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Cadastrar Aplicação';
      }
    }
  }

  openEditAppModal(appId) {
    const app = this.applicationsCache.find((a) => a.id === appId);
    if (!app) return;

    document.getElementById('edit-app-id').value = app.id;
    document.getElementById('edit-app-name').value = app.name;
    document.getElementById('edit-app-webhook').value = app.webhookUrl || '';
    document.getElementById('edit-app-active').checked = Boolean(app.isActive);
    const exemptCheckbox = document.getElementById('edit-app-exempt-commission');
    if (exemptCheckbox) exemptCheckbox.checked = Boolean(app.isCommissionExempt);

    this.openModal('modal-edit-app');
    document.getElementById('edit-app-name')?.focus();
  }

  async handleEditApp() {
    const appId = document.getElementById('edit-app-id')?.value;
    const name = document.getElementById('edit-app-name')?.value.trim();
    const webhookUrl = document.getElementById('edit-app-webhook')?.value.trim();
    const isActive = document.getElementById('edit-app-active')?.checked;
    const isCommissionExempt = Boolean(document.getElementById('edit-app-exempt-commission')?.checked);
    const submitBtn = document.getElementById('btn-submit-edit-app');

    if (!appId || !name) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Salvando...';
    }

    try {
      const res = await fetch(`/api/admin/applications/${appId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name,
          webhookUrl: webhookUrl || null,
          isActive,
          isCommissionExempt,
        }),
      });

      const data = await res.json();

      if (data.success) {
        this.showToast('Aplicação atualizada com sucesso!', 'success');
        this.closeModal('modal-edit-app');
        this.loadApplicationsCRUD();
      } else {
        this.showToast(data.error || 'Falha ao atualizar.', 'warning');
      }
    } catch (e) {
      this.showToast('Erro ao atualizar aplicação.', 'warning');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Salvar Alterações';
      }
    }
  }

  async deleteApplication(appId) {
    const targetApp = this.applicationsCache.find((a) => a.id === appId);
    const appName = targetApp ? targetApp.name : 'esta aplicação';

    const confirmDelete = confirm(`Tem certeza que deseja excluir a aplicação "${appName}"?\n\nTodas as chaves e registros associados serão removidos.`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/applications/${appId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      const data = await res.json();

      if (data.success) {
        this.showToast(`Aplicação '${appName}' excluída com sucesso!`, 'info');
        this.loadApplicationsCRUD();
      } else {
        this.showToast(data.error || 'Falha ao excluir aplicação.', 'warning');
      }
    } catch (e) {
      this.showToast('Erro ao excluir aplicação.', 'warning');
    }
  }

  async clearApplicationTransactions(appId) {
    const targetApp = this.applicationsCache.find((a) => a.id === appId);
    const appName = targetApp ? targetApp.name : 'esta aplicação';
    const paymentsCount = targetApp?._count?.payments || 0;
    const deliveriesCount = targetApp?._count?.deliveries || 0;

    if (paymentsCount === 0 && deliveriesCount === 0) {
      this.showToast(`A aplicação "${appName}" não possui transações para limpar.`, 'info');
      return;
    }

    const confirmClear = confirm(
      `Deseja realmente limpar as transações da aplicação "${appName}"?\n\n` +
      `Serão removidos permanentemente:\n` +
      `• ${paymentsCount} registro(s) de pagamento\n` +
      `• ${deliveriesCount} log(s) de entrega de webhook associados\n\n` +
      `Esta ação é recomendada para limpar testes e NÃO pode ser desfeita.`
    );
    if (!confirmClear) return;

    try {
      const res = await fetch(`/api/admin/applications/${appId}/transactions`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        // Resposta não JSON (ex: erro de gateway/proxy)
      }

      if (res.ok && data?.success) {
        this.showToast(data.message || `Transações de '${appName}' limpas com sucesso!`, 'success');
        this.loadApplicationsCRUD();
        this.loadMetrics();
        if (this.currentView === 'payments-view') {
          this.loadAllPayments();
        }
        if (this.currentView === 'webhooks-view') {
          this.loadAllWebhooks();
        }
      } else {
        this.showToast(data?.error || `Falha ao limpar transações (HTTP ${res.status}).`, 'warning');
      }
    } catch (e) {
      console.error('Erro ao limpar transações:', e);
      this.showToast('Erro ao limpar transações da aplicação.', 'warning');
    }
  }

  async saveInlineWebhook(appId) {
    const input = document.getElementById(`webhook-input-${appId}`);
    if (!input) return;

    const webhookUrl = input.value.trim();

    try {
      const res = await fetch(`/api/admin/applications/${appId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ webhookUrl: webhookUrl || null }),
      });

      const data = await res.json();
      if (data.success) {
        this.showToast('URL de Webhook salva com sucesso!', 'success');
      } else {
        this.showToast(data.error || 'Falha ao salvar URL.', 'warning');
      }
    } catch (e) {
      this.showToast('Erro ao salvar URL de webhook.', 'warning');
    }
  }

  async regenerateApiKey(appId) {
    const confirmRegen = confirm('Atenção: Gerar uma nova chave invalidará a chave anterior imediatamente. Deseja continuar?');
    if (!confirmRegen) return;

    try {
      const res = await fetch(`/api/admin/applications/${appId}/regenerate-key`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      const data = await res.json();
      if (data.success) {
        this.showToast('Nova Chave de API gerada com sucesso!', 'success');
        this.loadApplicationsCRUD();
      } else {
        this.showToast(data.error || 'Falha ao regenerar chave.', 'warning');
      }
    } catch (e) {
      this.showToast('Erro ao regenerar chave.', 'warning');
    }
  }

  async pingWebhook(appId) {
    this.showToast('Disparando ping de conectividade...', 'info');

    try {
      const res = await fetch(`/api/admin/applications/${appId}/ping`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      const data = await res.json();
      if (data.success) {
        this.showToast(`✅ ${data.message}`, 'success');
      } else {
        this.showToast(`⚠️ ${data.message || 'Endpoint não respondeu com 200.'}`, 'warning');
      }
    } catch (e) {
      this.showToast('Erro ao testar conectividade do webhook.', 'warning');
    }
  }

  // ==================== MODAL DE PAGAMENTO (DETALHES & ESTORNO) ====================
  async viewPaymentDetails(paymentId) {
    if (!paymentId) {
      this.showToast('Identificador de pagamento inválido.', 'warning');
      return;
    }

    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, { headers: this.getHeaders() });
      if (res.status === 401) {
        this.clearSession();
        this.showLogin();
        this.showToast('Sessão expirada. Faça login novamente.', 'warning');
        return;
      }

      const data = await res.json();
      if (!data.success || !data.payment) {
        this.showToast(data.error || 'Não foi possível carregar os detalhes do pagamento.', 'warning');
        return;
      }

      const p = data.payment;
      const modalBody = document.getElementById('modal-payment-body');
      const modalFooter = document.getElementById('modal-payment-footer');
      if (!modalBody) return;

      modalBody.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid var(--border-subtle);">
          <div>
            <div class="modal-row-label">Referência do Pedido</div>
            <code style="font-size: 0.95rem; font-weight: 600; color: var(--accent-cyan);">${p.externalReference}</code>
          </div>
          <div>${this.renderStatusBadge(p.status, p.statusDetail)}</div>
        </div>

        <div class="modal-grid">
          <div>
            <div class="modal-row-label">Aplicação</div>
            <div class="modal-row-val">${p.application?.name || 'N/A'}</div>
          </div>
          <div>
            <div class="modal-row-label">Método de Pagamento</div>
            <div class="modal-row-val">${p.paymentMethod}</div>
          </div>
          <div>
            <div class="modal-row-label">Valor Bruto</div>
            <div class="modal-row-val" style="color: #ffffff; font-weight: 600;">${this.formatCurrency(p.amount)}</div>
          </div>
          <div>
            <div class="modal-row-label">Valor Líquido</div>
            <div class="modal-row-val">${this.formatCurrency(p.netReceivedAmount || p.amount)}</div>
          </div>
          <div>
            <div class="modal-row-label">Pagador</div>
            <div class="modal-row-val">${p.payerName || 'N/A'}</div>
          </div>
          <div>
            <div class="modal-row-label">E-mail do Pagador</div>
            <div class="modal-row-val">${p.payerEmail || 'N/A'}</div>
          </div>
          <div>
            <div class="modal-row-label">Data de Criação</div>
            <div class="modal-row-val">${this.formatDate(p.createdAt)}</div>
          </div>
          <div>
            <div class="modal-row-label">ID Mercado Pago</div>
            <div class="modal-row-val"><code>${p.mpPaymentId || 'N/A'}</code></div>
          </div>
        </div>

        ${
          p.qrCodeBase64
            ? `
          <div style="text-align: center; padding-top: 10px; border-top: 1px solid var(--border-subtle);">
            <div class="modal-row-label">QR Code Pix Oficial:</div>
            <div class="qr-box">
              <img src="data:image/png;base64,${p.qrCodeBase64}" alt="QR Code Pix">
            </div>
            <div style="margin-top: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="app.copyToClipboard('${p.qrCode}')">
                📋 Copiar Código Pix Copia-e-Cola
              </button>
            </div>
          </div>
        `
            : ''
        }

        ${
          p.deliveries && p.deliveries.length > 0
            ? `
          <div style="padding-top: 12px; border-top: 1px solid var(--border-subtle);">
            <div class="modal-row-label" style="margin-bottom: 8px;">Entregas de Webhooks Fan-Out:</div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${p.deliveries
                .map(
                  (d) => `
                <div style="padding: 8px 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); font-size: 0.8rem;">
                  <div style="display: flex; justify-content: space-between;">
                    <span>Status: <strong>${d.status}</strong> [HTTP ${d.httpStatus || 'N/A'}]</span>
                    <span>Tentativas: ${d.attempts}/${d.maxAttempts}</span>
                  </div>
                  <div style="color: var(--text-muted); font-size: 0.74rem; margin-top: 2px;">${d.targetUrl}</div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        `
            : ''
        }
      `;

      if (modalFooter) {
        modalFooter.innerHTML = `
          ${
            p.status === 'APPROVED'
              ? `
            <button type="button" class="btn btn-danger btn-sm" onclick="app.refundPayment('${p.id}')">
              💸 Estornar Pagamento
            </button>
          `
              : ''
          }
          <button type="button" class="btn btn-secondary btn-sm" onclick="app.closeModal('modal-payment-details')">Fechar</button>
        `;
      }

      this.openModal('modal-payment-details');
    } catch (e) {
      console.error('Erro ao abrir detalhes:', e);
    }
  }

  async refundPayment(paymentId) {
    const confirmRefund = confirm(
      'Tem certeza que deseja solicitar o estorno deste pagamento?\n\nO valor será estornado e o webhook informando o estorno será disparado à aplicação dona.'
    );
    if (!confirmRefund) return;

    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      const data = await res.json();
      if (data.success) {
        this.showToast('Pagamento estornado com sucesso!', 'success');
        this.closeModal('modal-payment-details');
        if (this.currentView === 'dashboard-view') this.loadMetrics();
        if (this.currentView === 'payments-view') this.loadAllPayments();
      } else {
        this.showToast(data.error || 'Falha ao estornar pagamento.', 'warning');
      }
    } catch (e) {
      this.showToast('Erro ao solicitar estorno do pagamento.', 'warning');
    }
  }

  openModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('active');
      el.style.display = 'flex';
    }
  }

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active');
      el.style.display = 'none';
    }
  }

  // ==================== UTILITÁRIOS ====================
  copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Copiado para a área de transferência!', 'success');
    });
  }

  copyEnvSnippet(apiKey, webhookSecret) {
    const origin = window.location.origin.includes('localhost')
      ? 'https://pays.cjcdev.site'
      : window.location.origin;
    const content = `CJC_PAYS_BASE_URL=${origin}\nCJC_PAYS_API_KEY=${apiKey}\nCJC_PAYS_WEBHOOK_SECRET=${webhookSecret}`;
    this.copyToClipboard(content);
    this.showToast('Configuração .env copiada para a área de transferência!', 'success');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  formatCurrency(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  renderStatusBadge(status, statusDetail) {
    if (status === 'CANCELLED' && (statusDetail === 'expired' || statusDetail === 'cancelled_expired')) {
      return '<span class="badge badge-rejected" title="Não pago - Expirado após 30 minutos">Não Pago (Expirado)</span>';
    }
    const map = {
      APPROVED: '<span class="badge badge-approved">Aprovado</span>',
      PENDING: '<span class="badge badge-pending">Pendente</span>',
      REJECTED: '<span class="badge badge-rejected">Rejeitado</span>',
      CANCELLED: '<span class="badge badge-rejected">Não Pago / Cancelado</span>',
      REFUNDED: '<span class="badge badge-rejected">Estornado</span>',
    };
    return map[status] || `<span class="badge badge-pending">${status}</span>`;
  }

  // ==================== FILA DE WEBHOOKS ====================
  async populateWebhooksAppFilterOptions() {
    const filterSelect = document.getElementById('filter-webhooks-app');
    if (!filterSelect) return;

    if (!this.applicationsCache || this.applicationsCache.length === 0) {
      try {
        const res = await fetch('/api/admin/applications', { headers: this.getHeaders() });
        const data = await res.json();
        if (data.success) {
          this.applicationsCache = data.applications || [];
        }
      } catch (e) {
        console.warn('Erro ao carregar lista de apps para filtro de webhooks:', e);
      }
    }

    const currentVal = filterSelect.value || 'ALL';
    filterSelect.innerHTML =
      `<option value="ALL">Todas as Aplicações</option>` +
      this.applicationsCache.map((app) => `<option value="${app.id}">${app.name}</option>`).join('');
    filterSelect.value = currentVal;
  }

  applyWebhooksFilters() {
    this.webhooksFilters.search = document.getElementById('filter-webhooks-search')?.value.trim() || '';
    this.webhooksFilters.appId = document.getElementById('filter-webhooks-app')?.value || 'ALL';
    this.webhooksFilters.status = document.getElementById('filter-webhooks-status')?.value || 'ALL';
    this.webhooksPage = 1;
    this.loadAllWebhooks();
  }

  clearWebhooksFilters() {
    const searchInput = document.getElementById('filter-webhooks-search');
    const appSelect = document.getElementById('filter-webhooks-app');
    const statusSelect = document.getElementById('filter-webhooks-status');

    if (searchInput) searchInput.value = '';
    if (appSelect) appSelect.value = 'ALL';
    if (statusSelect) statusSelect.value = 'ALL';

    this.webhooksFilters = { search: '', appId: 'ALL', status: 'ALL' };
    this.webhooksPage = 1;
    this.loadAllWebhooks();
  }

  prevWebhooksPage() {
    if (this.webhooksPage > 1) {
      this.webhooksPage--;
      this.loadAllWebhooks();
    }
  }

  nextWebhooksPage() {
    if (this.webhooksPage < this.webhooksTotalPages) {
      this.webhooksPage++;
      this.loadAllWebhooks();
    }
  }

  renderWebhookStatusBadge(status) {
    if (status === 'DELIVERED') return `<span class="badge badge-delivered">● Entregue</span>`;
    if (status === 'PENDING') return `<span class="badge badge-pending">⏳ Pendente</span>`;
    if (status === 'FAILED') return `<span class="badge badge-failed">✕ Falha</span>`;
    return `<span class="badge">${status}</span>`;
  }

  renderHttpStatusBadge(status) {
    if (!status) return `<span class="http-badge http-err">—</span>`;
    if (status >= 200 && status < 300) return `<span class="http-badge http-2xx">${status}</span>`;
    if (status >= 400 && status < 500) return `<span class="http-badge http-4xx">${status}</span>`;
    return `<span class="http-badge http-5xx">${status}</span>`;
  }

  async loadAllWebhooks() {
    const tbody = document.getElementById('webhooks-tbody');
    const infoEl = document.getElementById('webhooks-pagination-info');
    const pageLabel = document.getElementById('webhooks-pagination-page-label');
    const prevBtn = document.getElementById('btn-prev-webhooks-page');
    const nextBtn = document.getElementById('btn-next-webhooks-page');

    if (!tbody) return;

    try {
      const { search, appId, status } = this.webhooksFilters;
      const url = `/api/admin/webhooks/deliveries?page=${this.webhooksPage}&limit=${this.webhooksLimit}&search=${encodeURIComponent(search)}&appId=${appId}&status=${status}`;

      const res = await fetch(url, { headers: this.getHeaders() });
      if (res.status === 401) {
        this.clearSession();
        this.showLogin();
        return;
      }

      const data = await res.json();
      if (!data.success) {
        tbody.innerHTML = `<tr><td colspan="9" class="table-empty-cell">Erro ao carregar fila de webhooks.</td></tr>`;
        return;
      }

      const { deliveries, pagination } = data;
      this.webhooksTotalPages = pagination.totalPages || 1;
      this.webhooksPage = pagination.page || 1;

      // Renderiza Tabela
      if (!deliveries || deliveries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="table-empty-cell">Nenhuma entrega de webhook encontrada com os filtros selecionados.</td></tr>`;
      } else {
        tbody.innerHTML = deliveries
          .map(
            (d) => `
          <tr>
            <td class="col-date">${this.formatDate(d.createdAt)}</td>
            <td class="col-app"><span class="badge badge-app">${d.application?.name || 'Sistema'}</span></td>
            <td class="col-event"><code>${d.event}</code></td>
            <td class="col-ref"><code style="font-size: 0.76rem;">${d.payment?.externalReference || '—'}</code></td>
            <td class="col-url">
              <span class="webhook-url-text" title="${d.targetUrl}">
                ${d.targetUrl}
              </span>
            </td>
            <td class="col-attempts"><span style="font-size: 0.8rem; font-weight: 500; font-family: var(--font-mono);">${d.attempts}/${d.maxAttempts}</span></td>
            <td class="col-http">${this.renderHttpStatusBadge(d.httpStatus)}</td>
            <td class="col-status">${this.renderWebhookStatusBadge(d.status)}</td>
            <td class="col-action" style="text-align: right; white-space: nowrap;">
              <button type="button" class="btn btn-secondary btn-sm btn-inspect-webhook" data-action="inspect-webhook" data-delivery-id="${d.id}" onclick="app.viewWebhookDetails('${d.id}', this)" title="Inspecionar Payload e Resposta">
                Inspecionar
              </button>
              <button type="button" class="btn btn-ghost btn-sm btn-retry-webhook" data-action="retry-webhook" data-delivery-id="${d.id}" onclick="app.retryWebhookDelivery('${d.id}')" title="Forçar reenvio agora">
                ⚡
              </button>
            </td>
          </tr>
        `
          )
          .join('');
      }

      // Atualiza Paginação
      const total = pagination.total || 0;
      const start = total === 0 ? 0 : (this.webhooksPage - 1) * this.webhooksLimit + 1;
      const end = Math.min(this.webhooksPage * this.webhooksLimit, total);

      if (infoEl) infoEl.innerText = `Exibindo ${start} a ${end} de ${total} entregas`;
      if (pageLabel) pageLabel.innerText = `Página ${this.webhooksPage} de ${this.webhooksTotalPages}`;
      if (prevBtn) prevBtn.disabled = this.webhooksPage <= 1;
      if (nextBtn) nextBtn.disabled = this.webhooksPage >= this.webhooksTotalPages;
    } catch (e) {
      console.error('Erro ao carregar fila de webhooks:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="table-empty-cell">Erro de comunicação com o servidor.</td></tr>`;
    }
  }

  // ==================== MODAL DE DETALHES DE WEBHOOK ====================
  async viewWebhookDetails(deliveryId, btnEl = null) {
    if (!deliveryId) {
      this.showToast('Identificador de entrega de webhook inválido.', 'warning');
      return;
    }

    const button = btnEl || (window.event?.target?.closest ? window.event.target.closest('button') : null);
    const originalText = button ? button.innerText : null;
    if (button) {
      button.disabled = true;
      button.innerText = 'Carregando...';
    }

    try {
      const res = await fetch(`/api/admin/webhooks/deliveries/${deliveryId}`, { headers: this.getHeaders() });
      if (res.status === 401) {
        this.clearSession();
        this.showLogin();
        this.showToast('Sessão expirada. Faça login novamente.', 'warning');
        return;
      }

      const data = await res.json();
      if (!data.success || !data.delivery) {
        this.showToast(data.error || 'Não foi possível carregar os detalhes do webhook.', 'warning');
        return;
      }

      const d = data.delivery;
      const modalBody = document.getElementById('modal-webhook-body');
      const modalFooter = document.getElementById('modal-webhook-footer');
      if (!modalBody) {
        this.showToast('Erro interno: contêiner do modal não localizado.', 'danger');
        return;
      }

      let formattedPayload = d.payload;
      try {
        if (typeof d.payload === 'string') {
          formattedPayload = JSON.stringify(JSON.parse(d.payload), null, 2);
        } else if (typeof d.payload === 'object' && d.payload !== null) {
          formattedPayload = JSON.stringify(d.payload, null, 2);
        }
      } catch (err) {}

      this.currentWebhookPayload = formattedPayload;

      modalBody.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid var(--border-subtle);">
          <div>
            <div class="modal-row-label">Evento Notificado</div>
            <code style="font-size: 0.95rem; font-weight: 600; color: var(--accent-cyan);">${this.escapeHtml(d.event)}</code>
          </div>
          <div>${this.renderWebhookStatusBadge(d.status)}</div>
        </div>

        <div class="modal-grid">
          <div>
            <div class="modal-row-label">Aplicação Destinatária</div>
            <div class="modal-row-val">${this.escapeHtml(d.application?.name || 'N/A')} (${this.escapeHtml(d.application?.slug || '')})</div>
          </div>
          <div>
            <div class="modal-row-label">Pedido / Referência</div>
            <div class="modal-row-val"><code>${this.escapeHtml(d.payment?.externalReference || 'N/A')}</code></div>
          </div>
          <div>
            <div class="modal-row-label">Código HTTP Recebido</div>
            <div class="modal-row-val">${this.renderHttpStatusBadge(d.httpStatus)}</div>
          </div>
          <div>
            <div class="modal-row-label">Tentativas Realizadas</div>
            <div class="modal-row-val">${d.attempts} de ${d.maxAttempts} máximas</div>
          </div>
          <div>
            <div class="modal-row-label">Data do Primeiro Envio</div>
            <div class="modal-row-val">${this.formatDate(d.createdAt)}</div>
          </div>
          <div>
            <div class="modal-row-label">Última Atualização</div>
            <div class="modal-row-val">${this.formatDate(d.updatedAt)}</div>
          </div>
          <div style="grid-column: 1 / -1;">
            <div class="modal-row-label">Endpoint de Destino (URL)</div>
            <div class="modal-row-val"><code style="word-break: break-all;">${this.escapeHtml(d.targetUrl)}</code></div>
          </div>
          ${
            d.nextRetryAt
              ? `
            <div style="grid-column: 1 / -1;">
              <div class="modal-row-label">Próxima Tentativa Agendada (Backoff):</div>
              <div class="modal-row-val" style="color: #fbbf24;">⏰ ${this.formatDate(d.nextRetryAt)}</div>
            </div>
          `
              : ''
          }
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span class="modal-row-label">Carga Útil Entregue (JSON Payload Assinado):</span>
            <button type="button" class="btn btn-ghost btn-sm" data-action="copy-payload" onclick="app.copyCurrentWebhookPayload()">
              📋 Copiar JSON
            </button>
          </div>
          <pre class="code-box-preview"><code>${this.escapeHtml(formattedPayload)}</code></pre>
        </div>

        <div>
          <div class="modal-row-label" style="margin-bottom: 6px;">Resposta do Servidor (Body):</div>
          <pre class="code-box-preview" style="max-height: 120px;"><code>${this.escapeHtml(d.responseBody || 'Nenhuma resposta retornada.')}</code></pre>
        </div>
      `;

      if (modalFooter) {
        modalFooter.innerHTML = `
          <button type="button" class="btn btn-primary btn-sm" data-action="retry-delivery-modal" data-delivery-id="${d.id}" onclick="app.retryWebhookDelivery('${d.id}', true)">
            ⚡ Reenviar Agora
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="close-modal" onclick="app.closeModal('modal-webhook-details')">Fechar</button>
        `;
      }

      this.openModal('modal-webhook-details');
    } catch (e) {
      console.error('Erro ao inspecionar webhook:', e);
      this.showToast('Erro de comunicação ao carregar detalhes do webhook.', 'warning');
    } finally {
      if (button) {
        button.disabled = false;
        button.innerText = originalText || 'Inspecionar';
      }
    }
  }

  copyCurrentWebhookPayload() {
    if (!this.currentWebhookPayload) {
      this.showToast('Nenhum payload disponível para cópia.', 'warning');
      return;
    }
    this.copyToClipboard(this.currentWebhookPayload);
  }

  async retryWebhookDelivery(deliveryId, keepModalOpen = false) {
    this.showToast('Enviando requisição de reprocessamento...', 'info');

    try {
      const res = await fetch(`/api/admin/webhooks/deliveries/${deliveryId}/retry`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      const data = await res.json();
      if (data.success) {
        this.showToast('✅ Webhook reenviado com sucesso!', 'success');
      } else {
        this.showToast(`⚠️ ${data.message || data.error || 'Falha ao reenviar webhook.'}`, 'warning');
      }

      if (keepModalOpen) {
        this.viewWebhookDetails(deliveryId);
      }
      this.loadAllWebhooks();
    } catch (e) {
      this.showToast('Erro ao disparar reenvio do webhook.', 'warning');
    }
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const text = typeof str === 'string' ? str : String(str);
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==================== CRUD DE ADMINISTRADORES ====================
  async loadAdminUsersCRUD() {
    const container = document.getElementById('crud-users-container');
    if (!container) return;

    try {
      const res = await fetch('/api/admin/users', { headers: this.getHeaders() });
      if (res.status === 401) {
        this.clearSession();
        this.showLogin();
        return;
      }

      const data = await res.json();
      if (!data.success) {
        this.showToast(data.error || 'Falha ao listar administradores.', 'warning');
        return;
      }

      const users = data.users || [];
      if (users.length === 0) {
        container.innerHTML = `
          <div class="card empty-state" style="padding: 40px; text-align: center; color: var(--text-muted); grid-column: 1 / -1;">
            <p style="font-size: 1.1rem; margin-bottom: 12px;">Nenhum administrador cadastrado.</p>
            <button class="btn btn-primary btn-sm" onclick="app.openCreateUserModal()">➕ Cadastrar Administrador</button>
          </div>
        `;
        return;
      }

      container.innerHTML = users
        .map((u) => {
          const isCurrentUser = this.user && this.user.id === u.id;
          const initials = (u.name || 'Admin')
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

          const safeUserJson = JSON.stringify(u).replace(/"/g, '&quot;');

          return `
            <div class="crud-app-card user-card">
              <div class="crud-app-header">
                <div style="display: flex; align-items: center; gap: 14px;">
                  <div class="avatar" style="width: 44px; height: 44px; font-size: 1rem; flex-shrink: 0;">${initials}</div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <h3 class="crud-app-title">${this.escapeHtml(u.name)}</h3>
                      ${isCurrentUser ? '<span class="badge badge-approved">Você (Sessão Ativa)</span>' : ''}
                    </div>
                    <div style="font-size: 0.83rem; color: var(--text-secondary); margin-top: 3px;">
                      ${this.escapeHtml(u.email)}
                      ${
                        u.username
                          ? `<span style="font-family: var(--font-mono); color: var(--accent-cyan); font-size: 0.78rem; margin-left: 6px;">@${this.escapeHtml(u.username)}</span>`
                          : ''
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div class="crud-app-actions-bar">
                <div class="crud-app-counters">
                  <span>Membro desde: <strong>${this.formatDate(u.createdAt)}</strong></span>
                </div>
                <div class="crud-app-buttons">
                  <button class="btn btn-secondary btn-sm" onclick="app.openEditUserModal(${safeUserJson})">
                    ✏️ Editar
                  </button>
                  <button 
                    class="btn btn-danger btn-sm" 
                    onclick="app.deleteUser('${u.id}', '${this.escapeHtml(u.name)}')"
                    ${isCurrentUser ? 'disabled title="Você não pode excluir sua própria conta conectada"' : ''}
                  >
                    🗑️ Excluir
                  </button>
                </div>
              </div>
            </div>
          `;
        })
        .join('');
    } catch (e) {
      console.error('Erro ao carregar administradores:', e);
      if (container) {
        container.innerHTML = `<div class="card empty-state" style="padding: 24px; color: var(--text-muted); grid-column: 1 / -1;">Erro de conexão ao carregar usuários.</div>`;
      }
    }
  }

  openCreateUserModal() {
    const form = document.getElementById('form-create-user');
    if (form) form.reset();
    const passInput = document.getElementById('new-user-password');
    if (passInput) passInput.type = 'password';
    this.openModal('modal-create-user');
  }

  async handleCreateUser() {
    const name = document.getElementById('new-user-name')?.value.trim();
    const email = document.getElementById('new-user-email')?.value.trim();
    const username = document.getElementById('new-user-username')?.value.trim() || undefined;
    const password = document.getElementById('new-user-password')?.value;
    const submitBtn = document.getElementById('btn-submit-create-user');

    if (!name || !email || !password) {
      this.showToast('Por favor, preencha todos os campos obrigatórios.', 'warning');
      return;
    }

    if (password.length < 6) {
      this.showToast('A senha deve conter pelo menos 6 caracteres.', 'warning');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Salvando...';
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ name, email, username, password }),
      });

      const data = await res.json();
      if (data.success) {
        this.showToast('✅ Novo administrador cadastrado com sucesso!', 'success');
        this.closeModal('modal-create-user');
        this.loadAdminUsersCRUD();
      } else {
        this.showToast(data.error || 'Falha ao cadastrar administrador.', 'warning');
      }
    } catch (e) {
      this.showToast('Erro ao conectar com o servidor.', 'warning');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Criar Administrador';
      }
    }
  }

  openEditUserModal(user) {
    if (!user) return;
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-user-name').value = user.name || '';
    document.getElementById('edit-user-email').value = user.email || '';
    document.getElementById('edit-user-username').value = user.username || '';
    const pass = document.getElementById('edit-user-password');
    if (pass) {
      pass.value = '';
      pass.type = 'password';
    }
    this.openModal('modal-edit-user');
  }

  async handleEditUser() {
    const id = document.getElementById('edit-user-id')?.value;
    const name = document.getElementById('edit-user-name')?.value.trim();
    const email = document.getElementById('edit-user-email')?.value.trim();
    const username = document.getElementById('edit-user-username')?.value.trim();
    const password = document.getElementById('edit-user-password')?.value;
    const submitBtn = document.getElementById('btn-submit-edit-user');

    if (!id || !name || !email) {
      this.showToast('Nome e e-mail são obrigatórios.', 'warning');
      return;
    }

    if (password && password.length < 6) {
      this.showToast('A nova senha deve ter no mínimo 6 caracteres.', 'warning');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Salvando...';
    }

    try {
      const body = { name, email, username: username || null };
      if (password) body.password = password;

      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        this.showToast('✅ Administrador atualizado com sucesso!', 'success');
        this.closeModal('modal-edit-user');

        // Se o usuário atual editou seu próprio perfil, atualiza na barra superior
        if (this.user && this.user.id === id) {
          this.user.name = data.user.name;
          this.user.email = data.user.email;
          this.user.username = data.user.username;
          localStorage.setItem('cjc_admin_user', JSON.stringify(this.user));
          this.showAppShell();
        }

        this.loadAdminUsersCRUD();
      } else {
        this.showToast(data.error || 'Falha ao atualizar administrador.', 'warning');
      }
    } catch (e) {
      this.showToast('Erro ao atualizar dados do administrador.', 'warning');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Salvar Alterações';
      }
    }
  }

  async deleteUser(userId, userName) {
    const confirmDelete = confirm(`Deseja realmente remover o administrador "${userName}"?\n\nEsta ação revogará imediatamente o acesso deste usuário ao painel.`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      const data = await res.json();
      if (data.success) {
        this.showToast('✅ Administrador removido com sucesso!', 'success');
        this.loadAdminUsersCRUD();
      } else {
        this.showToast(data.error || 'Falha ao remover administrador.', 'warning');
      }
    } catch (e) {
      this.showToast('Erro ao solicitar remoção do usuário.', 'warning');
    }
  }

  // ==================== CONFIGURAÇÃO DE TAXAS & COMISSÕES ====================
  async loadFeeSettings() {
    try {
      const amount = parseFloat(document.getElementById('simulation-amount')?.value) || 100;
      const res = await fetch(`/api/admin/settings/fees?amount=${amount}`, {
        headers: this.getHeaders(),
      });
      if (res.status === 401) {
        this.clearSession();
        this.showLogin();
        return;
      }
      const data = await res.json();
      if (data.success && data.settings) {
        const s = data.settings;
        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.value = Number(val).toFixed(2);
        };
        setVal('fee-mp-pix', s.mpPixFeePercent);
        setVal('fee-mp-credit', s.mpCreditFeePercent);
        setVal('fee-mp-debit', s.mpDebitFeePercent);
        setVal('fee-comm-pix', s.commissionPixPercent);
        setVal('fee-comm-credit', s.commissionCreditPercent);
        setVal('fee-comm-debit', s.commissionDebitPercent);

        if (data.simulation) {
          this.renderFeeSimulation(data.simulation);
        } else {
          this.updateLiveFeeSimulation();
        }
      }
    } catch (e) {
      console.error('Erro ao carregar taxas:', e);
      this.showToast('Erro ao carregar configurações de taxas.', 'warning');
    }
  }

  updateLiveFeeSimulation() {
    const amount = Math.max(0.01, parseFloat(document.getElementById('simulation-amount')?.value) || 100);
    const mpPix = parseFloat(document.getElementById('fee-mp-pix')?.value) || 0;
    const mpCredit = parseFloat(document.getElementById('fee-mp-credit')?.value) || 0;
    const mpDebit = parseFloat(document.getElementById('fee-mp-debit')?.value) || 0;
    const commPix = parseFloat(document.getElementById('fee-comm-pix')?.value) || 0;
    const commCredit = parseFloat(document.getElementById('fee-comm-credit')?.value) || 0;
    const commDebit = parseFloat(document.getElementById('fee-comm-debit')?.value) || 0;

    const calc = (mName, mpPercent, commPercent) => {
      const mpAmount = (amount * mpPercent) / 100;
      const commAmount = (amount * commPercent) / 100;
      const totalFee = mpAmount + commAmount;
      const net = Math.max(0, amount - totalFee);
      return {
        paymentMethod: mName,
        amount,
        mpFeePercent: mpPercent,
        mpFeeAmount: mpAmount,
        commissionPercent: commPercent,
        commissionAmount: commAmount,
        totalFeeAmount: totalFee,
        netReceivedAmount: net,
      };
    };

    const simData = {
      simulatedAmount: amount,
      regular: {
        PIX: calc('PIX', mpPix, commPix),
        CREDIT_CARD: calc('CREDIT_CARD', mpCredit, commCredit),
        DEBIT_CARD: calc('DEBIT_CARD', mpDebit, commDebit),
      },
      exempt: {
        PIX: calc('PIX', mpPix, 0),
        CREDIT_CARD: calc('CREDIT_CARD', mpCredit, 0),
        DEBIT_CARD: calc('DEBIT_CARD', mpDebit, 0),
      },
    };

    this.renderFeeSimulation(simData);
  }

  renderFeeSimulation(sim) {
    const tbody = document.getElementById('fees-simulation-tbody');
    if (!tbody || !sim) return;

    const formatCurrency = (val) =>
      Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const methods = [
      { key: 'PIX', label: '💠 Pix Instantâneo', icon: '💠' },
      { key: 'CREDIT_CARD', label: '💳 Cartão de Crédito', icon: '💳' },
      { key: 'DEBIT_CARD', label: '💳 Cartão de Débito', icon: '💳' },
    ];

    let html = '';

    methods.forEach((m) => {
      const reg = sim.regular?.[m.key];
      const ex = sim.exempt?.[m.key];

      if (reg) {
        html += `
          <tr>
            <td rowspan="2" style="font-weight: 600; color: var(--text-primary); vertical-align: middle; border-bottom: 2px solid var(--border-subtle);">
              ${m.label}
            </td>
            <td>
              <span class="badge" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8;">Padrão</span>
            </td>
            <td style="color: #f87171;">
              ${reg.mpFeePercent.toFixed(2)}% <span style="font-size: 0.76rem; color: var(--text-muted);">(${formatCurrency(reg.mpFeeAmount)})</span>
            </td>
            <td style="color: #38bdf8; font-weight: 600;">
              +${reg.commissionPercent.toFixed(2)}% <span style="font-size: 0.76rem; color: var(--text-muted);">(${formatCurrency(reg.commissionAmount)})</span>
            </td>
            <td style="color: #f59e0b; font-weight: 600;">
              ${(reg.mpFeePercent + reg.commissionPercent).toFixed(2)}% <span style="font-size: 0.76rem; color: var(--text-muted);">(${formatCurrency(reg.totalFeeAmount)})</span>
            </td>
            <td style="color: #22c55e; font-weight: 700;">
              ${formatCurrency(reg.netReceivedAmount)}
            </td>
          </tr>
        `;
      }

      if (ex) {
        html += `
          <tr style="border-bottom: 2px solid var(--border-subtle); background: rgba(16, 185, 129, 0.02);">
            <td>
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">🛡️ Isenta</span>
            </td>
            <td style="color: #f87171;">
              ${ex.mpFeePercent.toFixed(2)}% <span style="font-size: 0.76rem; color: var(--text-muted);">(${formatCurrency(ex.mpFeeAmount)})</span>
            </td>
            <td style="color: #94a3b8; font-style: italic;">
              0.00% <span style="font-size: 0.76rem; color: var(--text-muted);">(R$ 0,00)</span>
            </td>
            <td style="color: #f59e0b; font-weight: 600;">
              ${ex.mpFeePercent.toFixed(2)}% <span style="font-size: 0.76rem; color: var(--text-muted);">(${formatCurrency(ex.totalFeeAmount)})</span>
            </td>
            <td style="color: #22c55e; font-weight: 700;">
              ${formatCurrency(ex.netReceivedAmount)}
            </td>
          </tr>
        `;
      }
    });

    tbody.innerHTML = html;
  }

  async handleSaveFees() {
    const submitBtn = document.getElementById('btn-save-fees');
    const mpPixFeePercent = parseFloat(document.getElementById('fee-mp-pix')?.value);
    const mpCreditFeePercent = parseFloat(document.getElementById('fee-mp-credit')?.value);
    const mpDebitFeePercent = parseFloat(document.getElementById('fee-mp-debit')?.value);
    const commissionPixPercent = parseFloat(document.getElementById('fee-comm-pix')?.value);
    const commissionCreditPercent = parseFloat(document.getElementById('fee-comm-credit')?.value);
    const commissionDebitPercent = parseFloat(document.getElementById('fee-comm-debit')?.value);

    if (
      [
        mpPixFeePercent,
        mpCreditFeePercent,
        mpDebitFeePercent,
        commissionPixPercent,
        commissionCreditPercent,
        commissionDebitPercent,
      ].some(isNaN)
    ) {
      this.showToast('Por favor, preencha todos os campos com percentuais válidos.', 'warning');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Salvando...';
    }

    try {
      const res = await fetch('/api/admin/settings/fees', {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({
          mpPixFeePercent,
          mpCreditFeePercent,
          mpDebitFeePercent,
          commissionPixPercent,
          commissionCreditPercent,
          commissionDebitPercent,
        }),
      });

      const data = await res.json();
      if (data.success) {
        this.showToast('✅ Taxas e comissões atualizadas com sucesso!', 'success');
        if (data.simulation) {
          this.renderFeeSimulation(data.simulation);
        } else {
          this.updateLiveFeeSimulation();
        }
      } else {
        this.showToast(data.error || 'Falha ao salvar taxas.', 'warning');
      }
    } catch (e) {
      this.showToast('Erro de comunicação ao salvar taxas.', 'warning');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>💾</span> Salvar Configurações';
      }
    }
  }

  // ==================== MÓDULO FINANCEIRO & CONTÁBIL ====================
  async populateFinancialAppOptions() {
    const select = document.getElementById('fin-filter-app');
    if (!select) return;

    if (!this.applicationsCache || this.applicationsCache.length === 0) {
      try {
        const res = await fetch('/api/admin/applications', { headers: this.getHeaders() });
        const data = await res.json();
        if (data.success) {
          this.applicationsCache = data.applications || [];
        }
      } catch (e) {
        console.error('Erro ao buscar aplicações para filtro financeiro:', e);
      }
    }

    const currentVal = select.value;
    select.innerHTML = '<option value="">Todas as Aplicações</option>';
    if (this.applicationsCache) {
      this.applicationsCache.forEach((app) => {
        const opt = document.createElement('option');
        opt.value = app.id;
        opt.textContent = `${app.name} (${app.establishmentId})`;
        select.appendChild(opt);
      });
    }
    if (currentVal) select.value = currentVal;
  }

  setFinancialMonth(month) {
    this.financialFilters.month = String(month);

    // Atualiza classes ativas nas pílulas de meses
    document.querySelectorAll('.btn-month-pill').forEach((pill) => {
      pill.classList.toggle('active', pill.getAttribute('data-month') === String(month));
    });

    this.loadFinancialReport();
  }

  syncFinancialMonthUI() {
    const currentMonth = this.financialFilters.month || String(new Date().getMonth() + 1);
    document.querySelectorAll('.btn-month-pill').forEach((pill) => {
      pill.classList.toggle('active', pill.getAttribute('data-month') === String(currentMonth));
    });
    const yearSelect = document.getElementById('fin-filter-year');
    if (yearSelect && this.financialFilters.year) {
      yearSelect.value = String(this.financialFilters.year);
    }
    const appSelect = document.getElementById('fin-filter-app');
    if (appSelect) {
      appSelect.value = this.financialFilters.applicationId || '';
    }
    const methodSelect = document.getElementById('fin-filter-method');
    if (methodSelect) {
      methodSelect.value = this.financialFilters.paymentMethod || '';
    }
  }

  buildFinancialQueryString() {
    const params = new URLSearchParams();
    if (this.financialFilters.month && this.financialFilters.month !== 'ALL') {
      params.append('month', this.financialFilters.month);
    }
    if (this.financialFilters.year) {
      params.append('year', this.financialFilters.year);
    }
    if (this.financialFilters.applicationId) {
      params.append('applicationId', this.financialFilters.applicationId);
    }
    if (this.financialFilters.paymentMethod) {
      params.append('paymentMethod', this.financialFilters.paymentMethod);
    }
    return params.toString();
  }

  async loadFinancialReport() {
    const qs = this.buildFinancialQueryString();
    const url = `/api/admin/financial/report${qs ? `?${qs}` : ''}`;

    const badge = document.getElementById('fin-period-badge');
    if (badge) badge.innerText = 'Carregando demonstrativo contábil...';

    try {
      const res = await fetch(url, { headers: this.getHeaders() });
      if (res.status === 401) {
        this.clearSession();
        this.showLogin();
        return;
      }

      const data = await res.json();
      if (!data.success || !data.report) {
        this.showToast(data.error || 'Falha ao carregar relatório financeiro.', 'warning');
        return;
      }

      const report = data.report;
      this.financialReportCache = report;
      this.renderFinancialReport(report);
    } catch (e) {
      console.error('Erro ao carregar relatório financeiro:', e);
      this.showToast('Erro de comunicação com o servidor ao carregar dados contábeis.', 'warning');
    }
  }

  renderFinancialReport(report) {
    // 1. Rótulo do Período
    const badge = document.getElementById('fin-period-badge');
    if (badge) badge.innerText = report.periodLabel || 'Período Consolidado';

    // 2. Indicadores Principais (KPIs)
    const { kpis, dre } = report;
    const elGross = document.getElementById('fin-kpi-gross-volume');
    if (elGross) elGross.innerText = this.formatCurrency(kpis.totalGrossVolume);

    const elApproved = document.getElementById('fin-kpi-approved-count');
    if (elApproved) elApproved.innerText = `${kpis.approvedCount} aprovadas de ${kpis.totalCount} no total`;

    const elMpFees = document.getElementById('fin-kpi-mp-fees');
    if (elMpFees) elMpFees.innerText = this.formatCurrency(kpis.totalMpFees);

    const elCjcComm = document.getElementById('fin-kpi-cjc-commission');
    if (elCjcComm) elCjcComm.innerText = this.formatCurrency(kpis.totalCjcCommission);

    const elRetention = document.getElementById('fin-kpi-retention-rate');
    if (elRetention) elRetention.innerText = `Taxa média retida: ${kpis.averageRetentionPercent.toFixed(2)}%`;

    const elNetPayout = document.getElementById('fin-kpi-net-payout');
    if (elNetPayout) elNetPayout.innerText = this.formatCurrency(kpis.totalNetPayout);

    const elTicket = document.getElementById('fin-kpi-ticket-medio');
    if (elTicket) elTicket.innerText = this.formatCurrency(kpis.ticketMedio);

    const elRefunds = document.getElementById('fin-kpi-refunds-summary');
    if (elRefunds) elRefunds.innerText = `${kpis.refundedCount} estorno(s) (${this.formatCurrency(kpis.totalRefunded)})`;

    // 3. DRE Sintético
    const gross = dre.receitaBrutaTotal || 0;
    const calcPct = (val) => (gross > 0 ? ((val / gross) * 100).toFixed(2) + '%' : '0,00%');

    const dreGross = document.getElementById('fin-dre-gross');
    if (dreGross) dreGross.innerText = this.formatCurrency(dre.receitaBrutaTotal);

    const dreMp = document.getElementById('fin-dre-mp');
    if (dreMp) dreMp.innerText = `(${this.formatCurrency(dre.custoMercadoPago)})`;
    const drePctMp = document.getElementById('fin-dre-pct-mp');
    if (drePctMp) drePctMp.innerText = calcPct(dre.custoMercadoPago);

    const dreMargin = document.getElementById('fin-dre-gross-margin');
    if (dreMargin) dreMargin.innerText = this.formatCurrency(dre.margemBruta);
    const drePctMargin = document.getElementById('fin-dre-pct-gross-margin');
    if (drePctMargin) drePctMargin.innerText = calcPct(dre.margemBruta);

    const drePayout = document.getElementById('fin-dre-payout');
    if (drePayout) drePayout.innerText = `(${this.formatCurrency(dre.repassesLojas)})`;
    const drePctPayout = document.getElementById('fin-dre-pct-payout');
    if (drePctPayout) drePctPayout.innerText = calcPct(dre.repassesLojas);

    const dreCjc = document.getElementById('fin-dre-cjc');
    if (dreCjc) dreCjc.innerText = this.formatCurrency(dre.lucroLiquidoCJC);
    const drePctCjc = document.getElementById('fin-dre-pct-cjc');
    if (drePctCjc) drePctCjc.innerText = calcPct(dre.lucroLiquidoCJC);

    const dreRefund = document.getElementById('fin-dre-refund');
    if (dreRefund) dreRefund.innerText = `(${this.formatCurrency(dre.estornosRealizados)})`;
    const drePctRefund = document.getElementById('fin-dre-pct-refund');
    if (drePctRefund) drePctRefund.innerText = calcPct(dre.estornosRealizados);

    const dreFinal = document.getElementById('fin-dre-final');
    if (dreFinal) dreFinal.innerText = this.formatCurrency(dre.resultadoOperacionalFinal);
    const drePctFinal = document.getElementById('fin-dre-pct-final');
    if (drePctFinal) drePctFinal.innerText = calcPct(dre.resultadoOperacionalFinal);

    // 4. Conciliação por Meio de Pagamento
    const methodsTbody = document.getElementById('fin-table-methods-body');
    if (methodsTbody) {
      if (!report.byMethod || report.byMethod.length === 0) {
        methodsTbody.innerHTML = `<tr><td colspan="7" class="table-empty-cell">Nenhum meio transacionado no período selecionado.</td></tr>`;
      } else {
        methodsTbody.innerHTML = report.byMethod
          .map(
            (m) => `
          <tr>
            <td><strong>${m.label}</strong></td>
            <td>${m.count}</td>
            <td style="font-weight: 600; color: #ffffff;">${this.formatCurrency(m.grossVolume)}</td>
            <td class="text-danger">${this.formatCurrency(m.mpFeeVolume)}</td>
            <td class="text-success font-semibold">${this.formatCurrency(m.commissionVolume)}</td>
            <td class="text-warning">${this.formatCurrency(m.netPayoutVolume)}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden;">
                  <div style="width: ${Math.min(m.sharePercent, 100)}%; height: 100%; background: var(--accent-cyan);"></div>
                </div>
                <span style="font-size: 0.76rem; font-family: var(--font-mono); color: var(--text-muted);">${m.sharePercent.toFixed(1)}%</span>
              </div>
            </td>
          </tr>
        `
          )
          .join('');
      }
    }

    // 5. Fechamento Consolidado por Aplicação / Estabelecimento
    const appsTbody = document.getElementById('fin-table-apps-body');
    if (appsTbody) {
      if (!report.byApplication || report.byApplication.length === 0) {
        appsTbody.innerHTML = `<tr><td colspan="10" class="table-empty-cell">Nenhuma transação no período selecionado.</td></tr>`;
      } else {
        appsTbody.innerHTML = report.byApplication
          .map(
            (app) => `
          <tr>
            <td><strong>${app.name}</strong></td>
            <td><code>${app.establishmentId}</code></td>
            <td>
              ${
                app.isCommissionExempt
                  ? `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid rgba(148,163,184,0.3);">Isenta de Comissão</span>`
                  : `<span class="badge badge-approved">Padrão com Lucro</span>`
              }
            </td>
            <td>${app.approvedTransactions} / ${app.totalTransactions}</td>
            <td style="font-weight: 600; color: #ffffff;">${this.formatCurrency(app.grossVolume)}</td>
            <td class="text-danger">${this.formatCurrency(app.mpFeeVolume)}</td>
            <td class="text-success font-semibold">${this.formatCurrency(app.commissionVolume)}</td>
            <td class="text-warning font-semibold">${this.formatCurrency(app.netPayoutVolume)}</td>
            <td class="text-danger">${this.formatCurrency(app.refundedVolume)}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden;">
                  <div style="width: ${Math.min(app.sharePercent, 100)}%; height: 100%; background: #10b981;"></div>
                </div>
                <span style="font-size: 0.76rem; font-family: var(--font-mono); color: var(--text-muted);">${app.sharePercent.toFixed(1)}%</span>
              </div>
            </td>
          </tr>
        `
          )
          .join('');
      }
    }

    // 6. Extrato Analítico de Lançamentos
    const txTbody = document.getElementById('fin-table-transactions-body');
    const txCountBadge = document.getElementById('fin-transactions-count-badge');
    if (txCountBadge) {
      txCountBadge.innerText = `${report.transactions?.length || 0} lançamentos`;
    }

    if (txTbody) {
      if (!report.transactions || report.transactions.length === 0) {
        txTbody.innerHTML = `<tr><td colspan="10" class="table-empty-cell">Nenhum lançamento no período selecionado.</td></tr>`;
      } else {
        txTbody.innerHTML = report.transactions
          .slice(0, 100)
          .map(
            (tx) => `
          <tr>
            <td style="font-size: 0.78rem; white-space: nowrap;">${this.formatDate(tx.createdAt)}</td>
            <td><code>${tx.externalReference}</code></td>
            <td><span class="badge badge-app">${tx.applicationName}</span></td>
            <td>${tx.paymentMethod}</td>
            <td>${this.renderStatusBadge(tx.status)}</td>
            <td style="font-weight: 600; color: #ffffff;">${this.formatCurrency(tx.amount)}</td>
            <td class="text-danger">${this.formatCurrency(tx.mpFee)}</td>
            <td class="text-success font-semibold">${this.formatCurrency(tx.cjcCommission)}</td>
            <td class="text-warning">${this.formatCurrency(tx.netPayout)}</td>
            <td style="font-size: 0.8rem; color: var(--text-secondary);">${tx.payerName || tx.payerEmail || 'N/A'}</td>
          </tr>
        `
          )
          .join('');
      }
    }
  }

  async exportFinancialCsv() {
    this.showToast('Gerando planilha contábil...', 'info');
    const qs = this.buildFinancialQueryString();
    const url = `/api/admin/financial/export/csv${qs ? `?${qs}` : ''}`;

    try {
      const res = await fetch(url, { headers: this.getHeaders() });
      if (res.status === 401) {
        this.clearSession();
        this.showLogin();
        return;
      }

      if (!res.ok) {
        this.showToast('Falha ao exportar CSV contábil.', 'warning');
        return;
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `cjc-dev-pays-relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      this.showToast('📥 Planilha CSV exportada com sucesso!', 'success');
    } catch (e) {
      console.error('Erro ao exportar CSV:', e);
      this.showToast('Erro de comunicação ao exportar arquivo.', 'warning');
    }
  }

  async printFinancialReport() {
    this.showToast('Preparando demonstrativo contábil para impressão/PDF...', 'info');

    // 1. Abre a nova janela imediatamente para garantir que não haja bloqueio de popups
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.showToast('Por favor, permita popups neste site para abrir o relatório contábil.', 'warning');
      return;
    }

    // Carregamento temporário elegante
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Gerando Relatório Contábil...</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background: #0f172a;
              color: #f8fafc;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
            }
            .loader-box {
              text-align: center;
              padding: 32px;
              background: #1e293b;
              border: 1px solid #334155;
              border-radius: 12px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.4);
              max-width: 420px;
            }
            .spinner {
              width: 44px;
              height: 44px;
              border: 3px solid rgba(56, 189, 248, 0.2);
              border-top-color: #38bdf8;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
              margin: 0 auto 16px auto;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="loader-box">
            <div class="spinner"></div>
            <h3 style="margin: 0 0 8px 0; font-size: 1.15rem; color: #ffffff;">Gerando Relatório Contábil Oficial</h3>
            <p style="margin: 0; font-size: 0.85rem; color: #94a3b8;">Consultando a base de dados e compilando o demonstrativo em padrão executivo A4...</p>
          </div>
        </body>
      </html>
    `);

    try {
      // 2. Garante que os dados contábeis estejam disponíveis
      let report = this.financialReportCache;
      if (!report) {
        const qs = this.buildFinancialQueryString();
        const res = await fetch(`/api/admin/financial/report${qs ? `?${qs}` : ''}`, { headers: this.getHeaders() });
        if (res.status === 401) {
          this.clearSession();
          this.showLogin();
          printWindow.close();
          return;
        }
        if (!res.ok) {
          throw new Error('Falha na resposta do servidor');
        }
        const data = await res.json();
        report = data.report;
        this.financialReportCache = report;
      }

      if (!report) {
        throw new Error('Relatório indisponível');
      }

      // 3. Identifica a loja filtrada se aplicável
      let appFilterName = 'Todas as Aplicações (Consolidado Geral)';
      if (this.financialFilters.applicationId && this.applicationsCache) {
        const found = this.applicationsCache.find((a) => a.id === this.financialFilters.applicationId);
        if (found) appFilterName = `${found.name} (${found.slug})`;
      }

      // 4. Monta o documento HTML completo com estilos formais para A4
      const reportHtml = this.buildPrintableFinancialReportHtml(report, appFilterName);

      // 5. Injeta no documento da janela de impressão
      printWindow.document.open();
      printWindow.document.write(reportHtml);
      printWindow.document.close();

      this.showToast('✅ Relatório contábil gerado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao gerar relatório contábil impresso:', err);
      this.showToast('Erro ao obter dados do relatório contábil.', 'warning');
      if (printWindow && !printWindow.closed) {
        printWindow.document.body.innerHTML = `
          <div style="font-family: sans-serif; text-align: center; padding: 40px; color: #ef4444;">
            <h3>Falha ao carregar relatório contábil</h3>
            <p>Ocorreu um erro ao comunicar com a base de dados. Por favor, tente novamente.</p>
            <button onclick="window.close()" style="padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;">Fechar</button>
          </div>
        `;
      }
    }
  }

  buildPrintableFinancialReportHtml(report, appFilterName) {
    const { kpis, dre } = report;
    const now = new Date();
    const emissionDateStr = now.toLocaleDateString('pt-BR');
    const emissionTimeStr = now.toLocaleTimeString('pt-BR');
    const docId = `CJC-FIN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const gross = dre.receitaBrutaTotal || 0;
    const calcPct = (val) => (gross > 0 ? ((val / gross) * 100).toFixed(2).replace('.', ',') + '%' : '0,00%');
    const formatMoney = (val) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatPct = (val) => Number(val || 0).toFixed(2).replace('.', ',') + '%';

    const methodLabels = {
      pix: 'Pix Instantâneo',
      credit_card: 'Cartão de Crédito',
      debit_card: 'Cartão de Débito',
      ticket: 'Boleto Bancário',
      account_money: 'Saldo Mercado Pago',
    };

    const statusLabels = {
      approved: 'Aprovada',
      pending: 'Pendente',
      in_process: 'Processamento',
      refunded: 'Estornada',
      charged_back: 'Chargeback',
      cancelled: 'Cancelada',
      rejected: 'Recusada',
    };

    // Linhas do Meio de Pagamento
    const methodsRows = (report.byMethod || [])
      .map(
        (m) => `
        <tr>
          <td><strong>${m.label || methodLabels[m.method] || m.method}</strong></td>
          <td class="text-center">${m.count}</td>
          <td class="text-center font-mono">${formatPct(m.sharePercent)}</td>
          <td class="text-right font-semibold">${formatMoney(m.grossVolume)}</td>
          <td class="text-right text-danger">${formatMoney(m.mpFeeVolume)}</td>
          <td class="text-right text-success font-semibold">${formatMoney(m.commissionVolume)}</td>
          <td class="text-right font-semibold">${formatMoney(m.netPayoutVolume)}</td>
        </tr>
      `
      )
      .join('');

    // Linhas de Lojas / Aplicações
    const appsRows = (report.byApplication || [])
      .map(
        (app) => `
        <tr>
          <td><strong>${app.name}</strong></td>
          <td class="font-mono text-center">${app.establishmentId}</td>
          <td class="text-center">
            ${
              app.isCommissionExempt
                ? '<span class="report-badge badge-neutral">Isenta (0%)</span>'
                : '<span class="report-badge badge-active">Padrão com Lucro</span>'
            }
          </td>
          <td class="text-center">${app.approvedTransactions} / ${app.totalTransactions}</td>
          <td class="text-right font-semibold">${formatMoney(app.grossVolume)}</td>
          <td class="text-right text-danger">${formatMoney(app.mpFeeVolume)}</td>
          <td class="text-right text-success font-semibold">${formatMoney(app.commissionVolume)}</td>
          <td class="text-right font-semibold">${formatMoney(app.netPayoutVolume)}</td>
          <td class="text-right text-muted">${formatMoney(app.refundedVolume)}</td>
        </tr>
      `
      )
      .join('');

    // Linhas do Livro Razão Analítico (Transações)
    const txRows = (report.transactions || [])
      .map(
        (tx, index) => `
        <tr>
          <td class="text-center text-muted font-mono" style="font-size: 7pt;">${index + 1}</td>
          <td class="text-center font-mono" style="font-size: 7.2pt; white-space: nowrap;">${new Date(tx.createdAt).toLocaleString('pt-BR')}</td>
          <td class="font-mono" style="font-size: 7.2pt;">${tx.externalReference || tx.id.slice(0, 8)}</td>
          <td>${tx.applicationName}</td>
          <td>${methodLabels[tx.paymentMethod] || tx.paymentMethod}</td>
          <td class="text-center font-semibold" style="font-size: 7.2pt;">${statusLabels[tx.status] || tx.status}</td>
          <td class="text-right font-semibold">${formatMoney(tx.amount)}</td>
          <td class="text-right text-danger">${formatMoney(tx.mpFee)}</td>
          <td class="text-right text-success">${formatMoney(tx.cjcCommission)}</td>
          <td class="text-right font-semibold">${formatMoney(tx.netPayout)}</td>
        </tr>
      `
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Contábil - ${report.periodLabel} - CJC Dev Pays</title>
  <style>
    /* Configurações Globais de Página A4 */
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 15mm 10mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 8pt;
      line-height: 1.35;
    }

    /* Barra Superior Interativa (Oculta na Impressão/PDF) */
    .screen-toolbar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      z-index: 99999;
    }
    .toolbar-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .toolbar-icon {
      font-size: 22px;
    }
    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-tool {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
      border: none;
    }
    .btn-tool-primary {
      background: #0284c7;
      color: #ffffff;
    }
    .btn-tool-primary:hover {
      background: #0369a1;
    }
    .btn-tool-secondary {
      background: #334155;
      color: #f8fafc;
      border: 1px solid #475569;
    }
    .btn-tool-secondary:hover {
      background: #475569;
    }
    .btn-tool-close {
      background: transparent;
      color: #94a3b8;
      border: 1px solid #334155;
    }
    .btn-tool-close:hover {
      color: #ffffff;
      background: #ef4444;
      border-color: #ef4444;
    }

    /* Folha do Relatório A4 */
    .report-sheet {
      max-width: 210mm;
      margin: 20px auto 40px auto;
      background: #ffffff;
      padding: 16mm 14mm;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border-radius: 4px;
    }

    /* Regras Estritas de Impressão */
    @media print {
      body {
        background: #ffffff !important;
      }
      .screen-toolbar {
        display: none !important;
      }
      .report-sheet {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
    }

    /* Seções e Tipografia Contábil */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .company-brand {
      font-size: 15pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .company-brand span {
      color: #0284c7;
    }
    .company-sub {
      font-size: 7.2pt;
      color: #475569;
      margin-top: 2px;
    }
    .header-meta {
      text-align: right;
      font-size: 7.2pt;
      color: #475569;
    }
    .header-doc-badge {
      display: inline-block;
      background: #f1f5f9;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 7pt;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .report-title-block {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #0284c7;
      padding: 10px 14px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 2px;
    }
    .report-main-title {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }
    .report-main-subtitle {
      font-size: 7.5pt;
      color: #64748b;
      margin: 2px 0 0 0;
    }

    /* Grid de KPIs */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-box {
      border: 1px solid #cbd5e1;
      background: #ffffff;
      padding: 8px 10px;
      border-radius: 3px;
    }
    .kpi-label {
      font-size: 6.8pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
      letter-spacing: 0.3px;
    }
    .kpi-value {
      font-size: 11.5pt;
      font-weight: 800;
      color: #0f172a;
      margin: 2px 0;
    }
    .kpi-foot {
      font-size: 6.8pt;
      color: #64748b;
    }

    /* Tabelas Contábeis */
    .section-title {
      font-size: 8.5pt;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
      margin: 16px 0 6px 0;
      padding-bottom: 3px;
      border-bottom: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .section-title span.count-info {
      font-size: 7pt;
      color: #64748b;
      font-weight: normal;
      text-transform: none;
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 7.6pt;
    }
    .report-table thead {
      display: table-header-group;
    }
    .report-table tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .report-table th {
      background: #f1f5f9;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
      font-weight: 700;
      font-size: 6.8pt;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .report-table td {
      border: 1px solid #e2e8f0;
      padding: 4px 6px;
      color: #1e293b;
    }
    .report-table tbody tr:nth-child(even) td {
      background: #f8fafc;
    }
    .report-table tfoot tr td {
      background: #f1f5f9;
      border-top: 2px solid #94a3b8;
      font-weight: 800;
      color: #0f172a;
      padding: 6px;
    }

    /* Linhas Especiais do DRE */
    .dre-row-revenue td {
      background: #f8fafc;
      font-weight: 700;
      color: #0f172a;
    }
    .dre-row-subtotal td {
      background: #f1f5f9;
      font-weight: 700;
      border-top: 1px solid #94a3b8;
      border-bottom: 1px solid #94a3b8;
    }
    .dre-row-highlight td {
      background: #ecfdf5 !important;
      font-weight: 800;
      color: #065f46;
    }
    .dre-row-final td {
      background: #f0fdf4 !important;
      font-weight: 800;
      font-size: 8.5pt;
      border-top: 2px solid #059669;
      border-bottom: 2px solid #059669;
      color: #047857;
    }

    /* Utilitários Tipográficos */
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .text-success { color: #047857; }
    .text-danger { color: #b91c1c; }
    .text-muted { color: #64748b; }

    .report-badge {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-active {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }
    .badge-neutral {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
    }

    .page-break-avoid {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Termo de Encerramento e Assinaturas */
    .audit-footer {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px dashed #cbd5e1;
    }
    .audit-text {
      font-size: 6.8pt;
      color: #475569;
      line-height: 1.4;
      text-align: justify;
      margin-bottom: 24px;
    }
    .signatures-grid {
      display: flex;
      justify-content: space-between;
      gap: 32px;
      margin-top: 28px;
    }
    .signature-item {
      flex: 1;
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #0f172a;
      width: 80%;
      margin: 0 auto 5px auto;
    }
    .signature-role {
      font-size: 7.2pt;
      font-weight: 700;
      color: #0f172a;
    }
    .signature-sub {
      font-size: 6.5pt;
      color: #64748b;
    }
    .report-bottom-bar {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 6.5pt;
      color: #94a3b8;
    }
  </style>
</head>
<body>

  <!-- Barra Superior Interativa para Tela -->
  <div class="screen-toolbar">
    <div class="toolbar-info">
      <div class="toolbar-icon">📑</div>
      <div>
        <div style="font-weight: 700; font-size: 14px;">Relatório Financeiro & Contábil Oficial</div>
        <div style="font-size: 11px; color: #94a3b8;">Formatado para papel A4 • Texto vetorial de alta definição</div>
      </div>
    </div>
    <div class="toolbar-actions">
      <button class="btn-tool btn-tool-primary" onclick="window.print()">
        <span>🖨️</span> Salvar como PDF / Imprimir
      </button>
      <button class="btn-tool btn-tool-secondary" onclick="if(window.opener && window.opener.app) { window.opener.app.exportFinancialCsv(); } else { alert('Para baixar o CSV, utilize o botão no painel principal.'); }">
        <span>📥</span> Baixar Planilha (CSV)
      </button>
      <button class="btn-tool btn-tool-close" onclick="window.close()">
        <span>✖</span> Fechar
      </button>
    </div>
  </div>

  <!-- Folha de Impressão A4 -->
  <div class="report-sheet">

    <!-- Cabeçalho Institucional -->
    <header class="report-header">
      <div>
        <div class="company-brand">CJC <span>DEV PAYS</span></div>
        <div class="company-sub">Central Unificada de Pagamentos & Split Financeiro Inteligente</div>
        <div class="company-sub">CNPJ: 54.321.987/0001-00 • Pays.cjcdev.site • Ambiente Produção</div>
      </div>
      <div class="header-meta">
        <div class="header-doc-badge">Documento Oficial</div>
        <div><strong>Autenticação:</strong> <span class="font-mono">${docId}</span></div>
        <div><strong>Emissão:</strong> ${emissionDateStr} às ${emissionTimeStr}</div>
        <div><strong>Operador:</strong> Administrador do Sistema</div>
      </div>
    </header>

    <!-- Bloco de Título do Relatório -->
    <div class="report-title-block">
      <div>
        <h1 class="report-main-title">DEMONSTRATIVO DE FECHAMENTO FINANCEIRO & CONTÁBIL</h1>
        <p class="report-main-subtitle">Prestação de contas contábil, conciliação do Mercado Pago e apuração de comissões</p>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 9pt; font-weight: 800; color: #0284c7;">${report.periodLabel}</div>
        <div style="font-size: 7.2pt; color: #475569;">Filtro: ${appFilterName}</div>
      </div>
    </div>

    <!-- Seção 1: Resumo Executivo / KPIs -->
    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-label">Volume Bruto Transacionado (GMV)</div>
        <div class="kpi-value">${formatMoney(kpis.totalGrossVolume)}</div>
        <div class="kpi-foot">${kpis.approvedCount} aprovadas de ${kpis.totalCount} cobranças</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Custos do Mercado Pago (Adquirente)</div>
        <div class="kpi-value text-danger">${formatMoney(kpis.totalMpFees)}</div>
        <div class="kpi-foot">Tarifas de processamento e bandeiras</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Margem Bruta da Operação</div>
        <div class="kpi-value">${formatMoney(kpis.totalGrossVolume - kpis.totalMpFees)}</div>
        <div class="kpi-foot">Volume após dedução do custo MP</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Comissões Retidas (Lucro CJC Dev)</div>
        <div class="kpi-value text-success">${formatMoney(kpis.totalCjcCommission)}</div>
        <div class="kpi-foot">Taxa média retida: ${kpis.averageRetentionPercent.toFixed(2)}%</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Repasse Líquido às Lojas</div>
        <div class="kpi-value">${formatMoney(kpis.totalNetPayout)}</div>
        <div class="kpi-foot">Montante a transferir aos estabelecimentos</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Estornos e Devoluções</div>
        <div class="kpi-value text-muted">${formatMoney(kpis.totalRefunded)}</div>
        <div class="kpi-foot">${kpis.refundedCount} estorno(s) • Ticket médio: ${formatMoney(kpis.ticketMedio)}</div>
      </div>
    </div>

    <!-- Seção 2: DRE Sintético Contábil -->
    <div class="page-break-avoid">
      <div class="section-title">
        <span>Demonstrativo do Resultado do Exercício (DRE Sintético)</span>
        <span class="count-info">Padrão Contábil IFRS / CFC</span>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 70px;" class="text-center">Código</th>
            <th>Descrição da Conta Contábil</th>
            <th style="width: 100px;" class="text-center">Natureza</th>
            <th style="width: 130px;" class="text-right">Valor Consolidado</th>
            <th style="width: 100px;" class="text-right">% Rec. Bruta</th>
          </tr>
        </thead>
        <tbody>
          <tr class="dre-row-revenue">
            <td class="text-center font-mono">1.0</td>
            <td><strong>(+) RECEITA OPERACIONAL BRUTA (Cobranças Aprovadas)</strong></td>
            <td class="text-center">Crédito (+)</td>
            <td class="text-right">${formatMoney(dre.receitaBrutaTotal)}</td>
            <td class="text-right font-mono">100,00%</td>
          </tr>
          <tr>
            <td class="text-center font-mono">2.0</td>
            <td>(-) CUSTO DOS SERVIÇOS PRESTADOS (Taxas do Adquirente Mercado Pago)</td>
            <td class="text-center text-danger">Débito (-)</td>
            <td class="text-right text-danger">(${formatMoney(dre.custoMercadoPago)})</td>
            <td class="text-right font-mono text-danger">${calcPct(dre.custoMercadoPago)}</td>
          </tr>
          <tr class="dre-row-subtotal">
            <td class="text-center font-mono">3.0</td>
            <td><strong>(=) MARGEM BRUTA DA OPERAÇÃO (Subtotal Operacional)</strong></td>
            <td class="text-center">Saldo (=)</td>
            <td class="text-right font-bold">${formatMoney(dre.margemBruta)}</td>
            <td class="text-right font-mono font-bold">${calcPct(dre.margemBruta)}</td>
          </tr>
          <tr>
            <td class="text-center font-mono">4.0</td>
            <td>(-) REPASSE LÍQUIDO A ESTABELECIMENTOS / LOJAS CONECTADAS</td>
            <td class="text-center text-danger">Débito (-)</td>
            <td class="text-right">(${formatMoney(dre.repassesLojas)})</td>
            <td class="text-right font-mono">${calcPct(dre.repassesLojas)}</td>
          </tr>
          <tr class="dre-row-highlight">
            <td class="text-center font-mono">5.0</td>
            <td><strong>(=) RECEITA LÍQUIDA DE INTERMEDIAÇÃO (Comissões CJC Dev Pays)</strong></td>
            <td class="text-center">Receita Líquida</td>
            <td class="text-right font-bold">${formatMoney(dre.lucroLiquidoCJC)}</td>
            <td class="text-right font-mono font-bold">${calcPct(dre.lucroLiquidoCJC)}</td>
          </tr>
          <tr>
            <td class="text-center font-mono">6.0</td>
            <td>(-) ESTORNOS E DEVOLUÇÕES OPERACIONAIS</td>
            <td class="text-center text-muted">Débito (-)</td>
            <td class="text-right text-muted">(${formatMoney(dre.estornosRealizados)})</td>
            <td class="text-right font-mono text-muted">${calcPct(dre.estornosRealizados)}</td>
          </tr>
          <tr class="dre-row-final">
            <td class="text-center font-mono">7.0</td>
            <td><strong>(=) RESULTADO OPERACIONAL LÍQUIDO FINAL (SUPERÁVIT)</strong></td>
            <td class="text-center">Resultado (=)</td>
            <td class="text-right">${formatMoney(dre.resultadoOperacionalFinal)}</td>
            <td class="text-right font-mono">${calcPct(dre.resultadoOperacionalFinal)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Seção 3: Conciliação por Meio de Pagamento -->
    <div class="page-break-avoid">
      <div class="section-title">
        <span>Conciliação Consolidada por Meio de Pagamento</span>
        <span class="count-info">Pix, Cartão de Crédito e Débito</span>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th>Meio de Pagamento</th>
            <th style="width: 80px;" class="text-center">Qtd. Vendas</th>
            <th style="width: 80px;" class="text-center">Partic. (%)</th>
            <th style="width: 120px;" class="text-right">Volume Bruto</th>
            <th style="width: 110px;" class="text-right">Custo Mercado Pago</th>
            <th style="width: 110px;" class="text-right">Lucro CJC Dev</th>
            <th style="width: 120px;" class="text-right">Repasse Líquido</th>
          </tr>
        </thead>
        <tbody>
          ${methodsRows || '<tr><td colspan="7" class="text-center text-muted" style="padding: 10px;">Nenhum meio transacionado no período.</td></tr>'}
        </tbody>
        <tfoot>
          <tr>
            <td>TOTAL GERAL CONSOLIDADO</td>
            <td class="text-center">${kpis.approvedCount}</td>
            <td class="text-center font-mono">100,00%</td>
            <td class="text-right">${formatMoney(kpis.totalGrossVolume)}</td>
            <td class="text-right text-danger">${formatMoney(kpis.totalMpFees)}</td>
            <td class="text-right text-success">${formatMoney(kpis.totalCjcCommission)}</td>
            <td class="text-right">${formatMoney(kpis.totalNetPayout)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Seção 4: Fechamento por Loja / Estabelecimento -->
    <div class="page-break-avoid">
      <div class="section-title">
        <span>Demonstrativo de Fechamento por Estabelecimento / Loja</span>
        <span class="count-info">Liquidação e regimes tarifários</span>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th>Loja / Aplicação</th>
            <th style="width: 90px;" class="text-center">ID Estabelec.</th>
            <th style="width: 110px;" class="text-center">Regime</th>
            <th style="width: 80px;" class="text-center">Aprov./Total</th>
            <th style="width: 100px;" class="text-right">Volume Bruto</th>
            <th style="width: 90px;" class="text-right">Custo MP</th>
            <th style="width: 90px;" class="text-right">Comissão CJC</th>
            <th style="width: 100px;" class="text-right">Líquido Loja</th>
            <th style="width: 80px;" class="text-right">Estornos</th>
          </tr>
        </thead>
        <tbody>
          ${appsRows || '<tr><td colspan="9" class="text-center text-muted" style="padding: 10px;">Nenhum estabelecimento transacionou no período.</td></tr>'}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4">TOTAL CONSOLIDADO DAS LOJAS</td>
            <td class="text-right">${formatMoney(kpis.totalGrossVolume)}</td>
            <td class="text-right text-danger">${formatMoney(kpis.totalMpFees)}</td>
            <td class="text-right text-success">${formatMoney(kpis.totalCjcCommission)}</td>
            <td class="text-right">${formatMoney(kpis.totalNetPayout)}</td>
            <td class="text-right text-muted">${formatMoney(kpis.totalRefunded)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Seção 5: Livro Razão Analítico (Extrato Completo do Banco de Dados) -->
    <div style="margin-top: 18px;">
      <div class="section-title">
        <span>Livro Razão Analítico de Lançamentos</span>
        <span class="count-info">${report.transactions?.length || 0} lançamentos do banco de dados</span>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 30px;" class="text-center">#</th>
            <th style="width: 105px;" class="text-center">Data / Hora</th>
            <th style="width: 80px;">Ref. Pedido</th>
            <th>Aplicação</th>
            <th style="width: 85px;">Meio</th>
            <th style="width: 70px;" class="text-center">Status</th>
            <th style="width: 80px;" class="text-right">Bruto</th>
            <th style="width: 70px;" class="text-right">Custo MP</th>
            <th style="width: 70px;" class="text-right">Lucro CJC</th>
            <th style="width: 80px;" class="text-right">Líquido Loja</th>
          </tr>
        </thead>
        <tbody>
          ${txRows || '<tr><td colspan="10" class="text-center text-muted" style="padding: 14px;">Nenhuma transação individual registrada no período selecionado.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Seção 6: Termo de Encerramento e Assinaturas -->
    <div class="audit-footer page-break-avoid">
      <div class="audit-text">
        <strong>TERMO DE AUDITORIA E ENCERRAMENTO CONTÁBIL:</strong> Certificamos para os devidos fins de prestação de contas fiscais e societárias que as informações, somatórios e conciliações detalhados neste relatório foram extraídos diretamente da base de dados transacional da Central CJC Dev Pays. Os valores representam com fidedignidade as movimentações financeiras, retenções adquirentes do Mercado Pago e comissões da plataforma registradas no período de apuração indicado.
      </div>
      <div class="signatures-grid">
        <div class="signature-item">
          <div class="signature-line"></div>
          <div class="signature-role">CJC DEV PAYS - GESTÃO FINANCEIRA</div>
          <div class="signature-sub">Administração da Plataforma</div>
        </div>
        <div class="signature-item">
          <div class="signature-line"></div>
          <div class="signature-role">RESPONSÁVEL / ESTABELECIMENTO</div>
          <div class="signature-sub">Conferência e De Acordo</div>
        </div>
      </div>
      <div class="report-bottom-bar">
        <div>Central CJC Dev Pays • Gateway & Split de Pagamentos • pays.cjcdev.site</div>
        <div>Página gerada em ${emissionDateStr} às ${emissionTimeStr} • Autenticação: ${docId}</div>
      </div>
    </div>

  </div>

  <script>
    // Dispara a caixa de diálogo de impressão nativa (Salvar como PDF) após carregamento
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 400);
    });
  </script>
</body>
</html>`;
  }
}

// Inicialização
const app = new CJCPaysApp();
window.app = app;
