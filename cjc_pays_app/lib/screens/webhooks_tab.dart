import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../constants/app_colors.dart';
import '../models/webhook_delivery.dart';
import '../services/api_service.dart';
import '../widgets/status_badge.dart';
import 'webhook_detail_screen.dart';

class WebhooksTab extends StatefulWidget {
  const WebhooksTab({super.key});

  @override
  State<WebhooksTab> createState() => _WebhooksTabState();
}

class _WebhooksTabState extends State<WebhooksTab> {
  final _api = ApiService();
  final _dateFormat = DateFormat('dd/MM HH:mm:ss');
  final _scrollController = ScrollController();

  List<WebhookDeliveryModel> _deliveries = [];
  bool _isLoading = true;
  bool _isLoadingMore = false;
  String? _errorMessage;
  int _page = 1;
  int _totalPages = 1;
  int _totalCount = 0;

  String? _selectedStatus;

  final List<({String label, String? value})> _statusFilters = [
    (label: 'Todos', value: null),
    (label: 'Entregues', value: 'DELIVERED'),
    (label: 'Pendentes', value: 'PENDING'),
    (label: 'Falhas', value: 'FAILED'),
  ];

  @override
  void initState() {
    super.initState();
    _fetchDeliveries(refresh: true);
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      if (!_isLoading && !_isLoadingMore && _page < _totalPages) {
        _loadMore();
      }
    }
  }

  Future<void> _fetchDeliveries({bool refresh = false}) async {
    if (refresh) {
      setState(() {
        _page = 1;
        _isLoading = true;
        _errorMessage = null;
      });
    }

    try {
      final res = await _api.getDeliveries(
        page: _page,
        limit: 20,
        status: _selectedStatus,
      );

      if (!mounted) return;
      setState(() {
        if (refresh) {
          _deliveries = res.deliveries;
        } else {
          _deliveries.addAll(res.deliveries);
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
    await _fetchDeliveries(refresh: false);
  }

  void _onStatusSelected(String? status) {
    setState(() {
      _selectedStatus = status;
    });
    _fetchDeliveries(refresh: true);
  }

  Future<void> _quickRetry(String id) async {
    try {
      final res = await _api.retryDelivery(id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message']?.toString() ?? 'Webhook reenviado!'),
          backgroundColor: AppColors.success,
        ),
      );
      _fetchDeliveries(refresh: true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao reenviar: $e'), backgroundColor: AppColors.danger),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Status Filter Chips
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          color: AppColors.surface,
          child: SizedBox(
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
        ),

        // Count bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: AppColors.background,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$_totalCount notificações na fila',
                style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
              ),
              if (_isLoading)
                const SizedBox(
                  width: 12,
                  height: 12,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
            ],
          ),
        ),

        // List
        Expanded(
          child: _isLoading && _deliveries.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : _errorMessage != null && _deliveries.isEmpty
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
                              onPressed: () => _fetchDeliveries(refresh: true),
                              child: const Text('Recarregar'),
                            ),
                          ],
                        ),
                      ),
                    )
                  : _deliveries.isEmpty
                      ? const Center(
                          child: Text(
                            'Nenhum webhook encontrado nesta categoria.',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: () => _fetchDeliveries(refresh: true),
                          color: AppColors.primary,
                          child: ListView.separated(
                            controller: _scrollController,
                            padding: const EdgeInsets.all(16),
                            itemCount: _deliveries.length + (_isLoadingMore ? 1 : 0),
                            separatorBuilder: (context, index) => const SizedBox(height: 10),
                            itemBuilder: (ctx, i) {
                              if (i >= _deliveries.length) {
                                return const Center(
                                  child: Padding(
                                    padding: EdgeInsets.all(16),
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  ),
                                );
                              }

                              final d = _deliveries[i];
                              return _buildDeliveryCard(d);
                            },
                          ),
                        ),
        ),
      ],
    );
  }

  Widget _buildDeliveryCard(WebhookDeliveryModel d) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => WebhookDetailScreen(deliveryId: d.id),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Line 1: App + Event & Status
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          d.application?.name ?? 'Hub',
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        d.event,
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontFamily: 'monospace',
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                  StatusBadge(status: d.status, fontSize: 10),
                ],
              ),
              const SizedBox(height: 10),

              // Line 2: URL
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.border),
                ),
                child: Text(
                  d.targetUrl,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Line 3: Attempts, HTTP Code, Date & Quick Retry
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Text(
                        '${d.attempts}/${d.maxAttempts} tent.',
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                      ),
                      const SizedBox(width: 8),
                      if (d.responseStatus != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: d.responseStatus! >= 200 && d.responseStatus! < 300
                                ? AppColors.successBg.withValues(alpha: 0.5)
                                : AppColors.dangerBg.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '${d.responseStatus}',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: d.responseStatus! >= 200 && d.responseStatus! < 300
                                  ? AppColors.success
                                  : AppColors.danger,
                            ),
                          ),
                        ),
                    ],
                  ),
                  Row(
                    children: [
                      Text(
                        _dateFormat.format(d.createdAt),
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        icon: const Icon(Icons.bolt_rounded, size: 18, color: AppColors.primary),
                        tooltip: 'Reenviar agora',
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () => _quickRetry(d.id),
                      ),
                    ],
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
