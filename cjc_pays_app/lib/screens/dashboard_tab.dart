import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../constants/app_colors.dart';
import '../models/kpi_metrics.dart';
import '../services/api_service.dart';
import '../widgets/app_chip.dart';
import '../widgets/kpi_card.dart';
import '../widgets/status_badge.dart';
import 'financial_report_screen.dart';
import 'payment_detail_screen.dart';

class DashboardTab extends StatefulWidget {
  final VoidCallback onNavigateToPayments;

  const DashboardTab({super.key, required this.onNavigateToPayments});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  final _api = ApiService();
  final _currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
  final _dateFormat = DateFormat('dd/MM HH:mm');

  DashboardMetrics? _data;
  bool _isLoading = true;
  String? _errorMessage;

  int? _selectedMonth;
  final int _selectedYear = DateTime.now().year;

  final List<String> _months = [
    'Ano Todo',
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];

  @override
  void initState() {
    super.initState();
    _selectedMonth = DateTime.now().month;
    _fetchMetrics();
  }

  Future<void> _fetchMetrics() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final metrics = await _api.getMetrics(
        month: _selectedMonth,
        year: _selectedYear,
      );
      if (!mounted) return;
      setState(() {
        _data = metrics;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  void _onMonthChanged(int index) {
    setState(() {
      _selectedMonth = index == 0 ? null : index;
    });
    _fetchMetrics();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _data == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null && _data == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.danger),
              const SizedBox(height: 16),
              Text(_errorMessage!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: _fetchMetrics, child: const Text('Recarregar')),
            ],
          ),
        ),
      );
    }

    final d = _data!;
    final kpis = d.kpis;
    final webhooks = d.webhooks;

    return RefreshIndicator(
      onRefresh: _fetchMetrics,
      color: AppColors.primary,
      backgroundColor: AppColors.surface,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Month Selector Horizontal Scroll
          SizedBox(
            height: 38,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _months.length,
              separatorBuilder: (context, index) => const SizedBox(width: 8),
              itemBuilder: (ctx, i) {
                final isSelected = (i == 0 && _selectedMonth == null) || (_selectedMonth == i);
                return ChoiceChip(
                  label: Text(_months[i]),
                  selected: isSelected,
                  selectedColor: AppColors.primary,
                  backgroundColor: AppColors.surfaceAlt,
                  labelStyle: TextStyle(
                    color: isSelected ? Colors.black : AppColors.textSecondary,
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  ),
                  onSelected: (_) => _onMonthChanged(i),
                );
              },
            ),
          ),
          const SizedBox(height: 16),

          // 4 KPI Cards Grid
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.25,
            children: [
              KpiCard(
                title: 'Volume Aprovado',
                value: _currencyFormat.format(kpis.totalVolume),
                subtitle: 'Líquido: ${_currencyFormat.format(kpis.netVolume)}',
                icon: Icons.payments_rounded,
                accentColor: AppColors.success,
              ),
              KpiCard(
                title: d.isCurrentMonth ? 'Faturamento Hoje' : 'Transações Aprov.',
                value: d.isCurrentMonth
                    ? _currencyFormat.format(kpis.todayVolume)
                    : '${kpis.approvedCount} pagtos',
                subtitle: 'Mês: ${_currencyFormat.format(kpis.monthVolume)}',
                icon: Icons.calendar_today_rounded,
                accentColor: AppColors.primary,
              ),
              KpiCard(
                title: 'Taxa de Conversão',
                value: '${kpis.approvalRate.toStringAsFixed(1)}%',
                subtitle: '${kpis.approvedCount} de ${kpis.totalCount} cobranças',
                icon: Icons.insights_rounded,
                accentColor: AppColors.warning,
              ),
              KpiCard(
                title: 'Saúde Webhooks',
                value: '${webhooks.healthPct.toStringAsFixed(1)}%',
                subtitle: '${webhooks.success} de ${webhooks.total} entregas',
                icon: Icons.wifi_protected_setup_rounded,
                accentColor: AppColors.secondary,
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Banner de Atalho para Módulo Financeiro & Contábil
          InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const FinancialReportScreen()),
              );
            },
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.primary.withAlpha(35),
                    AppColors.surface,
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.primary.withAlpha(80)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withAlpha(30),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.receipt_long_rounded, color: AppColors.primary, size: 24),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Financeiro & Contábil',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'DRE Sintético, repasses por loja e exportação CSV.',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.primary),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Volume por Aplicação Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Volume por Aplicação',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                '${d.applications.length} ativas',
                style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 12),

          if (d.applications.isEmpty)
            _buildEmptyCard('Nenhuma aplicação encontrada no período.')
          else
            ...d.applications.map((app) {
              final pct = kpis.totalVolume > 0
                  ? (app.approvedVolume / kpis.totalVolume).clamp(0.0, 1.0)
                  : 0.0;
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        AppChip(name: app.name, slug: app.slug),
                        Text(
                          _currencyFormat.format(app.approvedVolume),
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: pct,
                        minHeight: 6,
                        backgroundColor: AppColors.surfaceAlt,
                        valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${app.approvedCount} pagamentos aprovados',
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                        ),
                        Text(
                          '${(pct * 100).toStringAsFixed(1)}% do total',
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),

          const SizedBox(height: 20),

          // Transações Recentes Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Transações Recentes',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              TextButton(
                onPressed: widget.onNavigateToPayments,
                child: const Text('Ver Todas →', style: TextStyle(color: AppColors.primary, fontSize: 13)),
              ),
            ],
          ),
          const SizedBox(height: 8),

          if (d.kpis.totalCount == 0)
            _buildEmptyCard('Nenhum pagamento registrado neste período.')
          else
            _buildRecentPaymentsList(),
        ],
      ),
    );
  }

  Widget _buildRecentPaymentsList() {
    return FutureBuilder<PaymentsResult>(
      future: _api.getPayments(page: 1, limit: 5),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()));
        }

        final payments = snapshot.data?.payments ?? [];
        if (payments.isEmpty) {
          return _buildEmptyCard('Nenhuma transação recente.');
        }

        return Column(
          children: payments.map((p) {
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceAlt,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    p.paymentMethod == 'PIX' ? Icons.pix_rounded : Icons.credit_card_rounded,
                    color: AppColors.primary,
                    size: 20,
                  ),
                ),
                title: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        p.payerName ?? (p.application?.name ?? 'CJC Dev Pays'),
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      _currencyFormat.format(p.amount),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ],
                ),
                subtitle: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _dateFormat.format(p.createdAt),
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                    ),
                    StatusBadge(status: p.status, fontSize: 10),
                  ],
                ),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => PaymentDetailScreen(paymentId: p.id),
                    ),
                  );
                },
              ),
            );
          }).toList(),
        );
      },
    );
  }

  Widget _buildEmptyCard(String message) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Center(
        child: Text(
          message,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
        ),
      ),
    );
  }
}
