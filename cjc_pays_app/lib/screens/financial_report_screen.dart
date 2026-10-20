import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';
import '../constants/app_colors.dart';
import '../models/application.dart';
import '../models/financial_report.dart';
import '../services/api_service.dart';
import '../services/file_download_service.dart';
import '../services/pdf_generator_service.dart';

class FinancialReportScreen extends StatefulWidget {
  const FinancialReportScreen({super.key});

  @override
  State<FinancialReportScreen> createState() => _FinancialReportScreenState();
}

class _FinancialReportScreenState extends State<FinancialReportScreen> {
  final _api = ApiService();
  final _currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$ ');
  final _percentFormat = NumberFormat.decimalPattern('pt_BR');

  bool _isLoading = true;
  String? _errorMessage;
  FinancialReportModel? _report;
  List<ApplicationModel> _applications = [];

  // Filtro Único Baseado em Mês (Mês Atual Pré-selecionado)
  int? _selectedMonth = DateTime.now().month;
  final int _selectedYear = DateTime.now().year;
  String _selectedAppId = 'ALL';
  String _selectedMethod = 'ALL';

  final List<String> _months = const [
    'Ano Todo',
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];

  @override
  void initState() {
    super.initState();
    _loadApplications();
    _loadReport();
  }

  Future<void> _loadApplications() async {
    try {
      final apps = await _api.getApplications();
      if (mounted) {
        setState(() {
          _applications = apps;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadReport() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final report = await _api.getFinancialReport(
        month: _selectedMonth,
        year: _selectedYear,
        applicationId: _selectedAppId == 'ALL' ? null : _selectedAppId,
        paymentMethod: _selectedMethod == 'ALL' ? null : _selectedMethod,
      );

      if (mounted) {
        setState(() {
          _report = report;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  void _onMonthSelected(int index) {
    setState(() {
      _selectedMonth = index == 0 ? null : index;
    });
    _loadReport();
  }

  /// Baixa o relatório contábil em PDF oficial idêntico ao site
  Future<void> _downloadPdf({bool shareDirectly = false}) async {
    if (_report == null) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            ),
            const SizedBox(width: 12),
            Text(shareDirectly
                ? 'Preparando PDF para compartilhamento...'
                : 'Gerando Relatório Contábil Oficial em PDF...'),
          ],
        ),
        duration: const Duration(seconds: 2),
      ),
    );

    try {
      String? auditCode;
      String? validationUrl;

      // 1. Registra código oficial de auditoria no backend para rastreabilidade
      try {
        String appName = 'Consolidado Geral (Todas as Aplicações)';
        if (_selectedAppId != 'ALL') {
          for (final a in _applications) {
            if (a.id == _selectedAppId) {
              appName = a.name;
              break;
            }
          }
        }

        final auditRes = await _api.registerReportAudit(
          periodLabel: _report!.periodLabel,
          applicationId: _selectedAppId == 'ALL' ? null : _selectedAppId,
          applicationName: appName,
          grossVolume: _report!.kpis.totalGrossVolume,
          mpFeeVolume: _report!.kpis.totalMpFees,
          commissionVolume: _report!.kpis.totalCjcCommission,
          netPayoutVolume: _report!.kpis.totalNetPayout,
          transactionsCount: _report!.kpis.approvedCount,
        );

        final audit = auditRes['audit'] as Map<String, dynamic>?;
        auditCode = audit?['code'] as String?;
        validationUrl = auditRes['validationUrl'] as String?;
      } catch (auditErr) {
        debugPrint('Aviso ao registrar auditoria no backend: $auditErr');
      }

      // 2. Compila o documento A4 exatamente como no site
      final pdfBytes = await PdfGeneratorService.generateAccountingPdf(
        report: _report!,
        auditCode: auditCode,
        validationUrl: validationUrl,
      );

      // 3. Salva no celular com o mesmo padrão de nome do site
      final dateStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final filename = 'cjc-dev-pays-relatorio-financeiro-$dateStr.pdf';
      final file = await FileDownloadService.saveFileToDevice(
        filename: filename,
        bytes: pdfBytes,
      );

      if (!mounted) return;

      if (shareDirectly) {
        await SharePlus.instance.share(
          ShareParams(
            files: [XFile(file.path, mimeType: 'application/pdf')],
            text: 'Relatório Financeiro & Contábil CJC Dev Pays ($filename)',
          ),
        );
      } else {
        _showDownloadSuccessDialog(
          title: 'Relatório PDF Baixado',
          filename: filename,
          filePath: file.path,
          isPdf: true,
          pdfBytes: pdfBytes,
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Falha ao baixar PDF: $e'),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  /// Baixa a planilha CSV oficial do servidor idêntica à do site
  Future<void> _downloadCsv({bool shareDirectly = false}) async {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Row(
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            ),
            SizedBox(width: 12),
            Text('Baixando planilha CSV do servidor...'),
          ],
        ),
        duration: Duration(seconds: 1),
      ),
    );

    try {
      // 1. Obtém a planilha gerada no servidor
      final csv = await _api.downloadFinancialCsv(
        month: _selectedMonth,
        year: _selectedYear,
        applicationId: _selectedAppId == 'ALL' ? null : _selectedAppId,
        paymentMethod: _selectedMethod == 'ALL' ? null : _selectedMethod,
      );

      // 2. Salva no dispositivo com o mesmo padrão de nome do site
      final dateStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final filename = 'cjc-dev-pays-relatorio-financeiro-$dateStr.csv';
      final file = await FileDownloadService.saveFileToDevice(
        filename: filename,
        bytes: utf8.encode(csv),
      );

      if (!mounted) return;

      if (shareDirectly) {
        await SharePlus.instance.share(
          ShareParams(
            files: [XFile(file.path, mimeType: 'text/csv')],
            text: 'Planilha Contábil CJC Dev Pays ($filename)',
          ),
        );
      } else {
        _showDownloadSuccessDialog(
          title: 'Planilha CSV Baixada',
          filename: filename,
          filePath: file.path,
          isPdf: false,
          rawCsv: csv,
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Falha ao baixar CSV: $e'),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  void _showDownloadSuccessDialog({
    required String title,
    required String filename,
    required String filePath,
    required bool isPdf,
    Uint8List? pdfBytes,
    String? rawCsv,
  }) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Row(
          children: [
            Icon(
              isPdf ? Icons.picture_as_pdf_rounded : Icons.table_chart_rounded,
              color: isPdf ? Colors.redAccent : AppColors.primary,
            ),
            const SizedBox(width: 10),
            Text(title, style: const TextStyle(fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Arquivo baixado com sucesso e salvo no armazenamento:',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Icon(
                    isPdf ? Icons.description_rounded : Icons.grid_on_rounded,
                    color: AppColors.primary,
                    size: 26,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          filename,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          filePath.contains('Download') ? '📁 Pasta Downloads do celular' : '📁 Armazenamento local',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Fechar'),
          ),
          if (isPdf && pdfBytes != null)
            OutlinedButton.icon(
              icon: const Icon(Icons.print_rounded, size: 16),
              label: const Text('Visualizar / Imprimir'),
              onPressed: () {
                Navigator.pop(ctx);
                Printing.layoutPdf(
                  onLayout: (format) async => pdfBytes,
                  name: filename,
                );
              },
            ),
          if (!isPdf && rawCsv != null)
            OutlinedButton.icon(
              icon: const Icon(Icons.copy_rounded, size: 16),
              label: const Text('Copiar'),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: rawCsv));
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('✅ Planilha CSV copiada para a área de transferência!'),
                    backgroundColor: AppColors.success,
                  ),
                );
              },
            ),
          ElevatedButton.icon(
            icon: const Icon(Icons.share_rounded, size: 16, color: Colors.black),
            label: Text(
              isPdf ? 'Compartilhar' : 'Abrir / Compartilhar',
              style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () {
              Navigator.pop(ctx);
              SharePlus.instance.share(
                ShareParams(
                  files: [XFile(filePath, mimeType: isPdf ? 'application/pdf' : 'text/csv')],
                  text: 'Relatório Financeiro & Contábil ($filename)',
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  /// Exibe o diálogo para o usuário escolher entre PDF e CSV ao clicar na seta de baixar
  void _showDownloadFormatDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withAlpha(30),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.download_rounded, color: AppColors.primary, size: 24),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Baixar Relatório Financeiro',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        'Período: ${_report?.periodLabel ?? 'Atual'}',
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 6),
                child: Text(
                  'Escolha o formato do arquivo para baixar no seu aparelho:',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                ),
              ),
              const SizedBox(height: 8),
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                tileColor: AppColors.surfaceAlt,
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withAlpha(25),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.picture_as_pdf_rounded, color: Colors.redAccent, size: 24),
                ),
                title: const Text(
                  'Baixar Relatório em PDF (.pdf)',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                subtitle: const Text(
                  'Demonstrativo contábil oficial A4 (idêntico ao site), com DRE, KPIs e QR Code de autenticidade',
                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textMuted),
                onTap: () {
                  Navigator.pop(ctx);
                  _downloadPdf();
                },
              ),
              const SizedBox(height: 10),
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                tileColor: AppColors.surfaceAlt,
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.greenAccent.withAlpha(25),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.table_chart_rounded, color: Colors.greenAccent, size: 24),
                ),
                title: const Text(
                  'Baixar Planilha em CSV (.csv)',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                subtitle: const Text(
                  'Planilha oficial exportada pelo servidor compatível com Microsoft Excel e Google Sheets',
                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textMuted),
                onTap: () {
                  Navigator.pop(ctx);
                  _downloadCsv();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Financeiro & Contábil'),
        actions: [
          IconButton(
            icon: const Icon(Icons.file_download_outlined, color: AppColors.primary),
            tooltip: 'Baixar Relatório (PDF / CSV)',
            onPressed: _showDownloadFormatDialog,
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Atualizar',
            onPressed: _loadReport,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 48),
                        const SizedBox(height: 16),
                        Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: _loadReport,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Tentar Novamente'),
                        ),
                      ],
                    ),
                  ),
                )
              : _report == null
                  ? const Center(child: Text('Nenhum dado disponível'))
                  : RefreshIndicator(
                      onRefresh: _loadReport,
                      color: AppColors.primary,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _buildFilterCard(),
                          const SizedBox(height: 16),
                          _buildKpiGrid(_report!.kpis),
                          const SizedBox(height: 20),
                          _buildDreCard(_report!.dre),
                          const SizedBox(height: 20),
                          _buildMethodsBreakdown(_report!.byMethod),
                          const SizedBox(height: 20),
                          _buildAppsBreakdown(_report!.byApplication),
                          const SizedBox(height: 20),
                          _buildAnalyticalLedger(_report!.transactions),
                          const SizedBox(height: 30),
                        ],
                      ),
                    ),
    );
  }

  Widget _buildFilterCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.filter_list_rounded, size: 18, color: AppColors.primary),
                    SizedBox(width: 8),
                    Text(
                      'Período & Filtros',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withAlpha(25),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary.withAlpha(50)),
                  ),
                  child: Text(
                    _report?.periodLabel ?? 'Período',
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: List.generate(_months.length, (i) {
                  final isSelected = (i == 0 && _selectedMonth == null) || (_selectedMonth == i);
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(_months[i]),
                      selected: isSelected,
                      selectedColor: AppColors.primary,
                      backgroundColor: AppColors.surfaceAlt,
                      labelStyle: TextStyle(
                        color: isSelected ? Colors.black : AppColors.textSecondary,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        fontSize: 12,
                      ),
                      onSelected: (_) => _onMonthSelected(i),
                    ),
                  );
                }),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _selectedAppId,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Aplicação',
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    ),
                    items: [
                      const DropdownMenuItem(value: 'ALL', child: Text('Todas as Lojas')),
                      ..._applications.map(
                        (app) => DropdownMenuItem(
                          value: app.id,
                          child: Text(app.name, overflow: TextOverflow.ellipsis),
                        ),
                      ),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => _selectedAppId = val);
                        _loadReport();
                      }
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _selectedMethod,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Meio',
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'ALL', child: Text('Todos Meios')),
                      DropdownMenuItem(value: 'pix', child: Text('Pix')),
                      DropdownMenuItem(value: 'credit_card', child: Text('Crédito')),
                      DropdownMenuItem(value: 'debit_card', child: Text('Débito')),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => _selectedMethod = val);
                        _loadReport();
                      }
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            const Divider(color: AppColors.border, height: 1),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.picture_as_pdf_rounded, size: 16, color: Colors.black),
                    label: const Text(
                      'Baixar PDF',
                      style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: _downloadPdf,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.table_chart_rounded, size: 16, color: AppColors.primary),
                    label: const Text(
                      'Baixar CSV',
                      style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.primary),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: _downloadCsv,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiGrid(FinancialKpisModel kpis) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildKpiCard(
                title: 'Faturamento Bruto (TPV)',
                value: _currencyFormat.format(kpis.totalGrossVolume),
                subtitle: '${kpis.approvedCount} aprovadas de ${kpis.totalCount}',
                color: AppColors.primary,
                icon: Icons.payments_rounded,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildKpiCard(
                title: 'Custos Mercado Pago',
                value: _currencyFormat.format(kpis.totalMpFees),
                subtitle: 'Taxas de gateway',
                color: AppColors.danger,
                icon: Icons.account_balance_rounded,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildKpiCard(
                title: 'Lucro Líquido CJC',
                value: _currencyFormat.format(kpis.totalCjcCommission),
                subtitle: 'Retenção média: ${_percentFormat.format(kpis.averageRetentionPercent)}%',
                color: AppColors.success,
                icon: Icons.trending_up_rounded,
                isHighlight: true,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildKpiCard(
                title: 'Repasse Líquido Lojas',
                value: _currencyFormat.format(kpis.totalNetPayout),
                subtitle: 'Saldo líquido clientes',
                color: AppColors.warning,
                icon: Icons.store_rounded,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required String subtitle,
    required Color color,
    required IconData icon,
    bool isHighlight = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isHighlight ? color.withAlpha(20) : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isHighlight ? color.withAlpha(100) : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Icon(icon, size: 16, color: color),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isHighlight ? color : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 10),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildDreCard(DreModel dre) {
    final gross = dre.receitaBrutaTotal;
    String getPct(double val) => gross > 0 ? '${(val / gross * 100).toStringAsFixed(1)}%' : '0,0%';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Demonstrativo do Resultado (DRE)',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
                Text(
                  'Sintético',
                  style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _buildDreRow('(+) Receita Bruta (TPV)', _currencyFormat.format(dre.receitaBrutaTotal), '100%', AppColors.primary, isBold: true),
            const Divider(height: 16),
            _buildDreRow('(-) Custos Mercado Pago', '(${_currencyFormat.format(dre.custoMercadoPago)})', getPct(dre.custoMercadoPago), AppColors.danger),
            const Divider(height: 16),
            _buildDreRow('(=) Margem Operacional Bruta', _currencyFormat.format(dre.margemBruta), getPct(dre.margemBruta), AppColors.textPrimary, isBold: true),
            const Divider(height: 16),
            _buildDreRow('(-) Repasses às Lojas', '(${_currencyFormat.format(dre.repassesLojas)})', getPct(dre.repassesLojas), AppColors.warning),
            const Divider(height: 16),
            _buildDreRow('(=) Lucro CJC Dev Pays', _currencyFormat.format(dre.lucroLiquidoCJC), getPct(dre.lucroLiquidoCJC), AppColors.success, isBold: true),
            const Divider(height: 16),
            _buildDreRow('(-) Estornos Realizados', '(${_currencyFormat.format(dre.estornosRealizados)})', getPct(dre.estornosRealizados), AppColors.danger),
            const Divider(height: 16),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.primary.withAlpha(25),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.primary.withAlpha(80)),
              ),
              child: _buildDreRow(
                '★ RESULTADO FINAL',
                _currencyFormat.format(dre.resultadoOperacionalFinal),
                getPct(dre.resultadoOperacionalFinal),
                AppColors.primary,
                isBold: true,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDreRow(String label, String value, String pct, Color color, {bool isBold = false}) {
    return Row(
      children: [
        Expanded(
          flex: 5,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
              color: isBold ? AppColors.textPrimary : AppColors.textSecondary,
            ),
          ),
        ),
        Expanded(
          flex: 2,
          child: Text(
            pct,
            textAlign: TextAlign.right,
            style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontFamily: 'monospace'),
          ),
        ),
        Expanded(
          flex: 4,
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
              color: color,
              fontFamily: 'monospace',
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMethodsBreakdown(List<MethodFinancialModel> methods) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Conciliação por Meio de Pagamento',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 12),
            if (methods.isEmpty)
              const Text('Nenhum dado no período.', style: TextStyle(color: AppColors.textMuted, fontSize: 12))
            else
              ...methods.map(
                (m) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(m.label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          Text(
                            _currencyFormat.format(m.grossVolume),
                            style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimary, fontSize: 13),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('${m.count} txs | Custo MP: ${_currencyFormat.format(m.mpFeeVolume)}', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                          Text('Lucro: ${_currencyFormat.format(m.commissionVolume)}', style: const TextStyle(fontSize: 11, color: AppColors.success, fontWeight: FontWeight.w600)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: (m.sharePercent / 100).clamp(0.0, 1.0),
                          backgroundColor: AppColors.surfaceAlt,
                          valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                          minHeight: 5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppsBreakdown(List<AppFinancialModel> apps) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Fechamento por Aplicação / Loja',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 12),
            if (apps.isEmpty)
              const Text('Nenhuma transação no período.', style: TextStyle(color: AppColors.textMuted, fontSize: 12))
            else
              ...apps.map(
                (app) => Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceAlt,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(app.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: app.isCommissionExempt ? AppColors.textMuted.withAlpha(30) : AppColors.success.withAlpha(30),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              app.isCommissionExempt ? 'Isenta' : 'Comissão Padrão',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: app.isCommissionExempt ? AppColors.textMuted : AppColors.success,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text('Estabelecimento: ${app.establishmentId}', style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Bruto: ${_currencyFormat.format(app.grossVolume)}', style: const TextStyle(fontSize: 11, color: AppColors.textPrimary)),
                          Text('Repasse: ${_currencyFormat.format(app.netPayoutVolume)}', style: const TextStyle(fontSize: 11, color: AppColors.warning, fontWeight: FontWeight.w600)),
                          Text('Lucro: ${_currencyFormat.format(app.commissionVolume)}', style: const TextStyle(fontSize: 11, color: AppColors.success, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildAnalyticalLedger(List<FinancialTransactionModel> txs) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Extrato Analítico',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                Text(
                  '${txs.length} registros',
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (txs.isEmpty)
              const Text('Nenhum lançamento no período.', style: TextStyle(color: AppColors.textMuted, fontSize: 12))
            else
              ...txs.take(15).map(
                (tx) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: tx.status == 'APPROVED' ? AppColors.success.withAlpha(20) : AppColors.danger.withAlpha(20),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Icon(
                          tx.status == 'APPROVED' ? Icons.check_circle_rounded : Icons.cancel_rounded,
                          size: 14,
                          color: tx.status == 'APPROVED' ? AppColors.success : AppColors.danger,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(tx.applicationName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                            Text(
                              '${DateFormat('dd/MM HH:mm').format(tx.createdAt ?? DateTime.now())} • ${tx.paymentMethod}',
                              style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            _currencyFormat.format(tx.amount),
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textPrimary),
                          ),
                          Text(
                            'Lucro: ${_currencyFormat.format(tx.cjcCommission)}',
                            style: const TextStyle(fontSize: 10, color: AppColors.success, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
