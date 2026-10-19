import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../constants/app_colors.dart';
import '../models/application.dart';
import '../models/payment.dart';
import '../services/api_service.dart';
import '../widgets/app_chip.dart';
import '../widgets/status_badge.dart';
import 'payment_detail_screen.dart';

class PaymentsTab extends StatefulWidget {
  const PaymentsTab({super.key});

  @override
  State<PaymentsTab> createState() => _PaymentsTabState();
}

class _PaymentsTabState extends State<PaymentsTab> {
  final _api = ApiService();
  final _currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
  final _dateFormat = DateFormat('dd/MM/yyyy HH:mm');
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  List<PaymentModel> _payments = [];
  bool _isLoading = true;
  bool _isLoadingMore = false;
  String? _errorMessage;
  int _page = 1;
  int _totalPages = 1;
  int _totalCount = 0;

  String? _selectedStatus;
  Timer? _debounce;

  final List<({String label, String? value})> _statusFilters = [
    (label: 'Todos', value: null),
    (label: 'Aprovados', value: 'APPROVED'),
    (label: 'Pendentes', value: 'PENDING'),
    (label: 'Estornados', value: 'REFUNDED'),
    (label: 'Cancelados', value: 'CANCELLED'),
  ];

  @override
  void initState() {
    super.initState();
    _fetchPayments(refresh: true);
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      if (!_isLoading && !_isLoadingMore && _page < _totalPages) {
        _loadMore();
      }
    }
  }

  Future<void> _fetchPayments({bool refresh = false}) async {
    if (refresh) {
      setState(() {
        _page = 1;
        _isLoading = true;
        _errorMessage = null;
      });
    }

    try {
      final res = await _api.getPayments(
        page: _page,
        limit: 20,
        status: _selectedStatus,
        search: _searchController.text.trim(),
      );

      if (!mounted) return;
      setState(() {
        if (refresh) {
          _payments = res.payments;
        } else {
          _payments.addAll(res.payments);
        }
        _totalPages = res.totalPages;
        _totalCount = res.total;
        _isLoading = false;
        _isLoadingMore = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
        _isLoadingMore = false;
      });
    }
  }

  Future<void> _loadMore() async {
    setState(() => _isLoadingMore = true);
    _page++;
    await _fetchPayments(refresh: false);
  }

  void _onSearchChanged(String val) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      _fetchPayments(refresh: true);
    });
  }

  void _onStatusSelected(String? status) {
    setState(() {
      _selectedStatus = status;
    });
    _fetchPayments(refresh: true);
  }

  Future<void> _openPurgeDialog() async {
    List<ApplicationModel> apps = [];
    try {
      apps = await _api.getApplications();
    } catch (_) {}

    if (!mounted) return;

    String? selectedAppId;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: AppColors.surface,
          title: const Row(
            children: [
              Icon(Icons.delete_sweep_rounded, color: AppColors.danger, size: 22),
              SizedBox(width: 8),
              Text('Expurgo de Não Pagos', style: TextStyle(fontSize: 16)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Esta ação remove permanentemente do histórico todas as transações que expiraram sem confirmação de pagamento (status PENDENTE / CANCELADO).',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 16),
              const Text(
                'Filtrar por Aplicação:',
                style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              DropdownButtonFormField<String?>(
                initialValue: selectedAppId,
                dropdownColor: AppColors.surfaceAlt,
                decoration: const InputDecoration(
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  filled: true,
                  fillColor: AppColors.surfaceAlt,
                ),
                items: [
                  const DropdownMenuItem<String?>(
                    value: null,
                    child: Text('Todas as Aplicações', style: TextStyle(fontSize: 13)),
                  ),
                  ...apps.map(
                    (app) => DropdownMenuItem<String?>(
                      value: app.id,
                      child: Text(app.name, style: const TextStyle(fontSize: 13)),
                    ),
                  ),
                ],
                onChanged: (val) {
                  setDialogState(() {
                    selectedAppId = val;
                  });
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Executar Expurgo', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true) return;

    try {
      final deletedCount = await _api.purgeExpiredPayments(appId: selectedAppId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$deletedCount pagamento(s) não pago(s)/expirado(s) removido(s) com sucesso!'),
          backgroundColor: AppColors.success,
        ),
      );
      _fetchPayments(refresh: true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Falha ao expurgar pagamentos: $e'),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  Future<void> _openSimulatePaymentDialog() async {
    List<ApplicationModel> apps = [];
    try {
      apps = await _api.getApplications();
    } catch (_) {}

    if (!mounted) return;

    if (apps.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Nenhuma aplicação cadastrada encontrada para simulação.'),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }

    String selectedAppId = apps.first.id;
    final amountController = TextEditingController(text: '10.00');
    final descController = TextEditingController(text: 'Pagamento Simulado App');
    bool autoApprove = false;
    bool isSubmitting = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => SafeArea(
          child: Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 20,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.science_rounded, color: AppColors.primary, size: 20),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'Simulador Pix (Sandbox)',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, size: 20),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Selecione a Aplicação Destino:',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    initialValue: selectedAppId,
                    dropdownColor: AppColors.surfaceAlt,
                    decoration: const InputDecoration(
                      contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      filled: true,
                      fillColor: AppColors.surfaceAlt,
                    ),
                    items: apps
                        .map((app) => DropdownMenuItem(
                              value: app.id,
                              child: Text(app.name, style: const TextStyle(fontSize: 13)),
                            ))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) setSheetState(() => selectedAppId = val);
                    },
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: amountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Valor (R\$)',
                      hintText: '10.00',
                      prefixIcon: Icon(Icons.attach_money_rounded, color: AppColors.primary, size: 20),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: descController,
                    decoration: const InputDecoration(
                      labelText: 'Descrição (Opcional)',
                      hintText: 'Ex: Teste simulado via Mobile',
                      prefixIcon: Icon(Icons.description_outlined, color: AppColors.primary, size: 20),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Aprovação Imediata', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    subtitle: const Text(
                      'Simula o pagamento e dispara o webhook imediatamente',
                      style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                    value: autoApprove,
                    activeThumbColor: AppColors.primary,
                    onChanged: (val) => setSheetState(() => autoApprove = val),
                  ),
                  const SizedBox(height: 18),
                  ElevatedButton(
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            final rawAmount = double.tryParse(amountController.text.replaceAll(',', '.'));
                            if (rawAmount == null || rawAmount <= 0) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Informe um valor válido maior que zero.'),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                              return;
                            }

                            final messenger = ScaffoldMessenger.of(context);
                            final nav = Navigator.of(context);
                            setSheetState(() => isSubmitting = true);

                            try {
                              final payment = await _api.simulatePayment(
                                applicationId: selectedAppId,
                                amount: rawAmount,
                                description: descController.text.trim(),
                                autoApprove: autoApprove,
                              );

                              if (!mounted) return;
                              if (ctx.mounted) Navigator.pop(ctx);
                              _fetchPayments(refresh: true);

                              messenger.showSnackBar(
                                SnackBar(
                                  content: Text(
                                    autoApprove
                                        ? 'Pagamento simulado criado e aprovado!'
                                        : 'Pagamento Pix simulado gerado com sucesso!',
                                  ),
                                  backgroundColor: AppColors.success,
                                ),
                              );

                              nav.push(
                                MaterialPageRoute(
                                  builder: (_) => PaymentDetailScreen(paymentId: payment.id),
                                ),
                              );
                            } catch (e) {
                              setSheetState(() => isSubmitting = false);
                              if (!mounted) return;
                              messenger.showSnackBar(
                                SnackBar(
                                  content: Text('Falha ao simular pagamento: $e'),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                            }
                          },
                    child: isSubmitting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                          )
                        : const Text('Gerar Pagamento Simulado'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Search & Filter Header
        Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          color: AppColors.surface,
          child: Column(
            children: [
              TextField(
                controller: _searchController,
                onChanged: _onSearchChanged,
                decoration: InputDecoration(
                  hintText: 'Buscar por ID, referência ou cliente...',
                  prefixIcon: const Icon(Icons.search_rounded, color: AppColors.primary, size: 20),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear_rounded, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            _fetchPayments(refresh: true);
                          },
                        )
                      : null,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 34,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _statusFilters.length,
                  separatorBuilder: (context, index) => const SizedBox(width: 8),
                  itemBuilder: (ctx, i) {
                    final item = _statusFilters[i];
                    final isSelected = _selectedStatus == item.value;
                    return ChoiceChip(
                      label: Text(item.label),
                      selected: isSelected,
                      selectedColor: AppColors.primary,
                      backgroundColor: AppColors.surfaceAlt,
                      labelStyle: TextStyle(
                        color: isSelected ? Colors.black : AppColors.textSecondary,
                        fontSize: 11,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                      onSelected: (_) => _onStatusSelected(item.value),
                    );
                  },
                ),
              ),
            ],
          ),
        ),

        // Result count & Action bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          color: AppColors.background,
          child: Row(
            children: [
              Text(
                '$_totalCount transações',
                style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
              ),
              if (_isLoading) ...[
                const SizedBox(width: 8),
                const SizedBox(
                  width: 12,
                  height: 12,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ],
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.delete_sweep_rounded, color: AppColors.danger, size: 20),
                tooltip: 'Expurgar Não Pagos / Expirados',
                visualDensity: VisualDensity.compact,
                onPressed: _openPurgeDialog,
              ),
              IconButton(
                icon: const Icon(Icons.science_rounded, color: AppColors.primary, size: 20),
                tooltip: 'Simulador Pix (Sandbox)',
                visualDensity: VisualDensity.compact,
                onPressed: _openSimulatePaymentDialog,
              ),
              IconButton(
                icon: const Icon(Icons.refresh_rounded, color: AppColors.textSecondary, size: 20),
                tooltip: 'Atualizar Lista',
                visualDensity: VisualDensity.compact,
                onPressed: () => _fetchPayments(refresh: true),
              ),
            ],
          ),
        ),

        // List
        Expanded(
          child: _isLoading && _payments.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : _errorMessage != null && _payments.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.danger),
                            const SizedBox(height: 16),
                            Text(_errorMessage!, textAlign: TextAlign.center),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              onPressed: () => _fetchPayments(refresh: true),
                              child: const Text('Recarregar'),
                            ),
                          ],
                        ),
                      ),
                    )
                  : _payments.isEmpty
                      ? const Center(
                          child: Text(
                            'Nenhuma transação encontrada com os filtros selecionados.',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: () => _fetchPayments(refresh: true),
                          color: AppColors.primary,
                          child: ListView.separated(
                            controller: _scrollController,
                            padding: const EdgeInsets.all(16),
                            itemCount: _payments.length + (_isLoadingMore ? 1 : 0),
                            separatorBuilder: (context, index) => const SizedBox(height: 10),
                            itemBuilder: (ctx, i) {
                              if (i >= _payments.length) {
                                return const Center(
                                  child: Padding(
                                    padding: EdgeInsets.all(16),
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  ),
                                );
                              }

                              final p = _payments[i];
                              return _buildPaymentCard(p);
                            },
                          ),
                        ),
        ),
      ],
    );
  }

  Widget _buildPaymentCard(PaymentModel p) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => PaymentDetailScreen(paymentId: p.id),
            ),
          );
          _fetchPayments(refresh: true);
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Line 1: App + Method & Amount
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      if (p.application != null)
                        AppChip(name: p.application!.name, slug: p.application!.slug)
                      else
                        const AppChip(name: 'CJC Dev Pays'),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          p.paymentMethod,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  Text(
                    _currencyFormat.format(p.amount),
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      letterSpacing: -0.3,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Line 2: Payer Name & Status Badge
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      p.payerName ?? (p.payerEmail ?? 'Cliente não identificado'),
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  StatusBadge(status: p.status, fontSize: 10),
                ],
              ),
              const SizedBox(height: 8),

              // Line 3: External Ref & Date
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    p.externalReference != null ? '#${p.externalReference}' : (p.mpPaymentId ?? '—'),
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontFamily: 'monospace',
                      fontSize: 11,
                    ),
                  ),
                  Text(
                    _dateFormat.format(p.createdAt),
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
