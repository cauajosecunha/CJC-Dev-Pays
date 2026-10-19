import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../constants/app_colors.dart';
import '../models/payment.dart';
import '../services/api_service.dart';
import '../widgets/app_chip.dart';
import '../widgets/status_badge.dart';

class PaymentDetailScreen extends StatefulWidget {
  final String paymentId;

  const PaymentDetailScreen({super.key, required this.paymentId});

  @override
  State<PaymentDetailScreen> createState() => _PaymentDetailScreenState();
}

class _PaymentDetailScreenState extends State<PaymentDetailScreen> {
  final _api = ApiService();
  final _currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
  final _dateFormat = DateFormat('dd/MM/yyyy HH:mm:ss');

  PaymentModel? _payment;
  bool _isLoading = true;
  String? _errorMessage;
  bool _isRefunding = false;
  bool _isApproving = false;

  @override
  void initState() {
    super.initState();
    _fetchPayment();
  }

  Future<void> _fetchPayment() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final payment = await _api.getPaymentDetails(widget.paymentId);
      if (!mounted) return;
      setState(() {
        _payment = payment;
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

  Future<void> _handleRefund() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Confirmar Estorno'),
        content: Text(
          'Deseja realmente estornar o pagamento de ${_currencyFormat.format(_payment!.amount)}? Esta ação acionará o webhook de reembolso e o estorno no adquirente.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sim, Estornar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isRefunding = true);

    try {
      await _api.refundPayment(widget.paymentId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pagamento estornado com sucesso!'),
          backgroundColor: AppColors.success,
        ),
      );
      _fetchPayment();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao estornar: $e'), backgroundColor: AppColors.danger),
      );
    } finally {
      if (mounted) setState(() => _isRefunding = false);
    }
  }

  Future<void> _handleApprove() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Aprovar Pagamento'),
        content: Text(
          'Deseja aprovar manualmente este pagamento de ${_currencyFormat.format(_payment!.amount)}? O sistema emitirá o evento de aprovação e disparará o webhook para a aplicação.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sim, Aprovar', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isApproving = true);

    try {
      await _api.approveSimulatedPayment(widget.paymentId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pagamento aprovado com sucesso! Webhook disparado.'),
          backgroundColor: AppColors.success,
        ),
      );
      _fetchPayment();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao aprovar: $e'), backgroundColor: AppColors.danger),
      );
    } finally {
      if (mounted) setState(() => _isApproving = false);
    }
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copiado para a área de transferência!'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Detalhes da Transação'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _fetchPayment,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
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
                        ElevatedButton(onPressed: _fetchPayment, child: const Text('Tentar Novamente')),
                      ],
                    ),
                  ),
                )
              : _buildContent(),
    );
  }

  Widget _buildContent() {
    final p = _payment!;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Card with Amount and Status
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: AppColors.cardGradient,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    if (p.application != null)
                      AppChip(name: p.application!.name, slug: p.application!.slug)
                    else
                      const Text('CJC Dev Pays', style: TextStyle(color: AppColors.textMuted)),
                    StatusBadge(status: p.status, fontSize: 12),
                  ],
                ),
                const SizedBox(height: 16),
                const Text(
                  'Valor da Transação',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                ),
                const SizedBox(height: 4),
                Text(
                  _currencyFormat.format(p.amount),
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _buildMiniBadge('Método', p.paymentMethod, Icons.credit_card_rounded),
                    const SizedBox(width: 12),
                    _buildMiniBadge('Líquido', _currencyFormat.format(p.netAmount), Icons.account_balance_wallet_rounded),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // QR Code Pix Section if available
          if (p.qrCode != null && p.qrCode!.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.qr_code_2_rounded, color: AppColors.primary, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Pix Copia e Cola',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                    ],
                  ),
                  if (p.qrCodeBase64 != null && p.qrCodeBase64!.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Image.memory(
                          base64Decode(p.qrCodeBase64!),
                          width: 180,
                          height: 180,
                          fit: BoxFit.contain,
                          errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Text(
                      p.qrCode!,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () => _copyToClipboard(p.qrCode!, 'Código Pix'),
                    icon: const Icon(Icons.copy_rounded, size: 16),
                    label: const Text('Copiar Código Copia e Cola'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Client & Transaction Details Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Informações do Pagamento',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
                const SizedBox(height: 12),
                _buildInfoRow('ID Interno', p.id, canCopy: true),
                _buildInfoRow('ID Mercado Pago', p.mpPaymentId ?? '—', canCopy: p.mpPaymentId != null),
                _buildInfoRow('Referência Externa', p.externalReference ?? '—', canCopy: p.externalReference != null),
                _buildInfoRow('Data de Criação', _dateFormat.format(p.createdAt)),
                if (p.paidAt != null)
                  _buildInfoRow('Data de Pagamento', _dateFormat.format(p.paidAt!)),
                if (p.description != null && p.description!.isNotEmpty)
                  _buildInfoRow('Descrição', p.description!),
                const Divider(height: 24),
                const Text(
                  'Dados do Pagador',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const SizedBox(height: 8),
                _buildInfoRow('Nome', p.payerName ?? 'Não informado'),
                _buildInfoRow('E-mail', p.payerEmail ?? 'Não informado'),
                _buildInfoRow('Documento', p.payerDocument ?? 'Não informado'),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Approve Button if pending (Sandbox / Manual approval)
          if (p.isPending) ...[
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.success,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: _isApproving ? null : _handleApprove,
              icon: _isApproving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                    )
                  : const Icon(Icons.check_circle_rounded),
              label: Text(_isApproving ? 'Processando Aprovação...' : 'Aprovar Pagamento (Simulador)'),
            ),
            const SizedBox(height: 24),
          ],

          // Refund Button if approved
          if (p.isApproved) ...[
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.danger,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: _isRefunding ? null : _handleRefund,
              icon: _isRefunding
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.replay_rounded),
              label: Text(_isRefunding ? 'Processando Estorno...' : 'Estornar Pagamento'),
            ),
            const SizedBox(height: 24),
          ],
        ],
      ),
    );
  }

  Widget _buildMiniBadge(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.primary),
          const SizedBox(width: 6),
          Text(
            '$label: ',
            style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
          ),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {bool canCopy = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          if (canCopy)
            GestureDetector(
              onTap: () => _copyToClipboard(value, label),
              child: const Padding(
                padding: EdgeInsets.only(left: 6),
                child: Icon(Icons.copy_rounded, size: 15, color: AppColors.primary),
              ),
            ),
        ],
      ),
    );
  }
}
