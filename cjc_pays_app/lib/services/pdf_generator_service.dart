import 'dart:typed_data';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../models/financial_report.dart';
import '../models/merchant_settlement_report.dart';

class PdfGeneratorService {
  static final _currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$ ');
  static final _percentFormat = NumberFormat.decimalPattern('pt_BR');
  static final _dateFormat = DateFormat('dd/MM/yyyy HH:mm');

  /// Gera os bytes do documento PDF contábil padrão A4
  static Future<Uint8List> generateAccountingPdf({
    required FinancialReportModel report,
    String? auditCode,
    String? validationUrl,
  }) async {
    final pdf = pw.Document(
      title: 'Balancete Contábil - ${report.periodLabel}',
      author: 'CJC Dev Pays',
    );

    final fontRegular = await PdfGoogleFonts.robotoRegular();
    final fontBold = await PdfGoogleFonts.robotoBold();
    final fontMono = await PdfGoogleFonts.robotoMonoRegular();

    final company = report.company ??
        CompanyReportModel(
          legalName: 'CJC Dev Soluções Tecnológicas',
          tradeName: 'CJC Dev Pays',
          cnpj: '58.291.402/0001-83',
          stateTaxId: 'Isento',
          municipalTaxId: '849.201-9',
          address: 'Av. Paulista, 1000 - Bela Vista',
          cityState: 'São Paulo - SP',
          zipCode: '01310-100',
          email: 'financeiro@cjcdev.com.br',
          phone: '+55 (11) 99887-6655',
        );

    final resolvedAuditCode = auditCode ??
        'CJC-FIN-${DateTime.now().year}${String.fromCharCode(65 + DateTime.now().month % 26)}-AUTO';
    final resolvedValidationUrl = validationUrl ??
        'https://pays.cjcdev.site/validar.html?codigo=$resolvedAuditCode';

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(24),
        theme: pw.ThemeData.withFont(
          base: fontRegular,
          bold: fontBold,
        ),
        header: (context) => _buildHeader(
          context: context,
          report: report,
          company: company,
          auditCode: resolvedAuditCode,
          validationUrl: resolvedValidationUrl,
          fontBold: fontBold,
          fontRegular: fontRegular,
          fontMono: fontMono,
        ),
        footer: (context) => _buildFooter(
          context: context,
          auditCode: resolvedAuditCode,
          validationUrl: resolvedValidationUrl,
          fontMono: fontMono,
          fontRegular: fontRegular,
        ),
        build: (context) => [
          pw.SizedBox(height: 12),
          _buildKpisGrid(report, fontBold, fontRegular),
          pw.SizedBox(height: 16),
          _buildDreSection(report, fontBold, fontRegular),
          pw.SizedBox(height: 16),
          _buildAppsSection(report, fontBold, fontRegular),
          pw.SizedBox(height: 16),
          _buildMethodsSection(report, fontBold, fontRegular),
          if (report.transactions.isNotEmpty) ...[
            pw.SizedBox(height: 16),
            _buildTransactionsSection(report, fontBold, fontRegular, fontMono),
          ],
        ],
      ),
    );

    return pdf.save();
  }

  /// Constrói o cabeçalho oficial do relatório com dados fiscais e QR Code de validação
  static pw.Widget _buildHeader({
    required pw.Context context,
    required FinancialReportModel report,
    required CompanyReportModel company,
    required String auditCode,
    required String validationUrl,
    required pw.Font fontBold,
    required pw.Font fontRegular,
    required pw.Font fontMono,
  }) {
    return pw.Container(
      decoration: const pw.BoxDecoration(
        border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey300, width: 1.5)),
      ),
      padding: const pw.EdgeInsets.only(bottom: 12),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          // Lado Esquerdo: Identificação da Empresa e Logotipo
          pw.Expanded(
            flex: 6,
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Row(
                  children: [
                    pw.Container(
                      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      decoration: pw.BoxDecoration(
                        color: PdfColors.blue900,
                        borderRadius: pw.BorderRadius.circular(4),
                      ),
                      child: pw.Text(
                        'CJC DEV PAYS',
                        style: pw.TextStyle(
                          font: fontBold,
                          color: PdfColors.white,
                          fontSize: 10,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                    ),
                    pw.SizedBox(width: 8),
                    pw.Text(
                      'CENTRAL DE PAGAMENTOS',
                      style: pw.TextStyle(
                        font: fontBold,
                        color: PdfColors.grey700,
                        fontSize: 8,
                        letterSpacing: 1.1,
                      ),
                    ),
                  ],
                ),
                pw.SizedBox(height: 6),
                pw.Text(
                  company.legalName.toUpperCase(),
                  style: pw.TextStyle(
                    font: fontBold,
                    fontSize: 12,
                    color: PdfColors.black,
                  ),
                ),
                pw.SizedBox(height: 2),
                pw.Text(
                  'Nome Fantasia: ${company.tradeName} • CNPJ: ${company.cnpj.isNotEmpty ? company.cnpj : 'Cadastrado'}',
                  style: pw.TextStyle(fontSize: 8.5, color: PdfColors.grey800),
                ),
                pw.Text(
                  'IE: ${company.stateTaxId.isNotEmpty ? company.stateTaxId : 'Isento'} • IM: ${company.municipalTaxId.isNotEmpty ? company.municipalTaxId : 'Isento'}',
                  style: pw.TextStyle(fontSize: 8, color: PdfColors.grey700),
                ),
                pw.Text(
                  'Endereço: ${company.address.isNotEmpty ? '${company.address}, ${company.cityState}' : 'Central Operacional CJC Dev'}',
                  style: pw.TextStyle(fontSize: 8, color: PdfColors.grey700),
                ),
                pw.Text(
                  'Contato: ${company.email} ${company.phone.isNotEmpty ? '• ${company.phone}' : ''}',
                  style: pw.TextStyle(fontSize: 8, color: PdfColors.grey700),
                ),
              ],
            ),
          ),
          pw.SizedBox(width: 12),
          // Lado Direito: Caixa de Auditoria com QR Code e Metadados
          pw.Expanded(
            flex: 4,
            child: pw.Container(
              padding: const pw.EdgeInsets.all(8),
              decoration: pw.BoxDecoration(
                color: PdfColors.grey100,
                borderRadius: pw.BorderRadius.circular(6),
                border: pw.Border.all(color: PdfColors.grey400, width: 0.8),
              ),
              child: pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(
                          'BALANCETE CONTÁBIL',
                          style: pw.TextStyle(
                            font: fontBold,
                            fontSize: 9,
                            color: PdfColors.blue900,
                          ),
                        ),
                        pw.SizedBox(height: 2),
                        pw.Text(
                          'Período: ${report.periodLabel}',
                          style: pw.TextStyle(
                            font: fontBold,
                            fontSize: 8.5,
                            color: PdfColors.black,
                          ),
                        ),
                        pw.Text(
                          'Emissão: ${_dateFormat.format(DateTime.now())}',
                          style: const pw.TextStyle(fontSize: 7.5, color: PdfColors.grey700),
                        ),
                        pw.SizedBox(height: 4),
                        pw.Container(
                          padding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                          decoration: pw.BoxDecoration(
                            color: PdfColors.grey200,
                            borderRadius: pw.BorderRadius.circular(3),
                          ),
                          child: pw.Text(
                            auditCode,
                            style: pw.TextStyle(
                              font: fontMono,
                              fontSize: 7.5,
                              fontWeight: pw.FontWeight.bold,
                              color: PdfColors.blue900,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  pw.SizedBox(width: 6),
                  pw.BarcodeWidget(
                    barcode: pw.Barcode.qrCode(),
                    data: validationUrl,
                    width: 44,
                    height: 44,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Constrói o rodapé com carimbo de autenticidade e paginação
  static pw.Widget _buildFooter({
    required pw.Context context,
    required String auditCode,
    required String validationUrl,
    required pw.Font fontMono,
    required pw.Font fontRegular,
  }) {
    return pw.Container(
      decoration: const pw.BoxDecoration(
        border: pw.Border(top: pw.BorderSide(color: PdfColors.grey300, width: 1)),
      ),
      padding: const pw.EdgeInsets.only(top: 8),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(
                'Documento emitido eletronicamente pela Central CJC Dev Pays • Autenticidade verificável em: $validationUrl',
                style: const pw.TextStyle(fontSize: 7, color: PdfColors.grey700),
              ),
              pw.Text(
                'Chave de Autenticação Digital: $auditCode',
                style: pw.TextStyle(font: fontMono, fontSize: 7, color: PdfColors.blue900),
              ),
            ],
          ),
          pw.Text(
            'Página ${context.pageNumber} de ${context.pagesCount}',
            style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700),
          ),
        ],
      ),
    );
  }

  /// Quadro de KPIs Executivos
  static pw.Widget _buildKpisGrid(
    FinancialReportModel report,
    pw.Font fontBold,
    pw.Font fontRegular,
  ) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          '1. RESUMO EXECUTIVO (INDICADORES CHAVE)',
          style: pw.TextStyle(font: fontBold, fontSize: 10, color: PdfColors.blue900),
        ),
        pw.SizedBox(height: 6),
        pw.Row(
          children: [
            _buildKpiBox(
              'FATURAMENTO BRUTO',
              _currencyFormat.format(report.kpis.totalGrossVolume),
              '${report.kpis.approvedCount} vendas aprovadas',
              PdfColors.blue50,
              PdfColors.blue900,
              fontBold,
              fontRegular,
            ),
            pw.SizedBox(width: 8),
            _buildKpiBox(
              'TAXAS MERCADO PAGO',
              _currencyFormat.format(report.kpis.totalMpFees),
              'Custo de Adquirência',
              PdfColors.red50,
              PdfColors.red900,
              fontBold,
              fontRegular,
            ),
            pw.SizedBox(width: 8),
            _buildKpiBox(
              'MARGEM LÍQUIDA CJC',
              _currencyFormat.format(report.kpis.totalCjcCommission),
              'Lucro da Plataforma',
              PdfColors.green50,
              PdfColors.green900,
              fontBold,
              fontRegular,
            ),
            pw.SizedBox(width: 8),
            _buildKpiBox(
              'REPASSE LÍQUIDO LOJAS',
              _currencyFormat.format(report.kpis.totalNetPayout),
              'Crédito aos Parceiros',
              PdfColors.purple50,
              PdfColors.purple900,
              fontBold,
              fontRegular,
            ),
          ],
        ),
      ],
    );
  }

  static pw.Widget _buildKpiBox(
    String title,
    String value,
    String subtitle,
    PdfColor bgColor,
    PdfColor textColor,
    pw.Font fontBold,
    pw.Font fontRegular,
  ) {
    return pw.Expanded(
      child: pw.Container(
        padding: const pw.EdgeInsets.all(8),
        decoration: pw.BoxDecoration(
          color: bgColor,
          borderRadius: pw.BorderRadius.circular(5),
          border: pw.Border.all(color: textColor, width: 0.6),
        ),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(
              title,
              style: pw.TextStyle(
                fontSize: 6.5,
                fontWeight: pw.FontWeight.bold,
                color: PdfColors.grey800,
              ),
            ),
            pw.SizedBox(height: 3),
            pw.Text(
              value,
              style: pw.TextStyle(
                font: fontBold,
                fontSize: 10,
                color: textColor,
              ),
            ),
            pw.SizedBox(height: 2),
            pw.Text(
              subtitle,
              style: const pw.TextStyle(fontSize: 6.5, color: PdfColors.grey700),
            ),
          ],
        ),
      ),
    );
  }

  /// Demonstrativo do Resultado do Exercício (DRE Sintético)
  static pw.Widget _buildDreSection(
    FinancialReportModel report,
    pw.Font fontBold,
    pw.Font fontRegular,
  ) {
    final dre = report.dre;
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          '2. DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE SINTÉTICO)',
          style: pw.TextStyle(font: fontBold, fontSize: 10, color: PdfColors.blue900),
        ),
        pw.SizedBox(height: 6),
        pw.Container(
          decoration: pw.BoxDecoration(
            borderRadius: pw.BorderRadius.circular(5),
            border: pw.Border.all(color: PdfColors.grey300, width: 0.8),
          ),
          child: pw.Table(
            columnWidths: {
              0: const pw.FlexColumnWidth(7),
              1: const pw.FlexColumnWidth(3),
            },
            border: const pw.TableBorder(
              horizontalInside: pw.BorderSide(color: PdfColors.grey200, width: 0.5),
            ),
            children: [
              _buildDreRow(
                '(+) RECEITA OPERACIONAL BRUTA (Volume Total de Vendas)',
                _currencyFormat.format(dre.receitaBrutaTotal),
                isHeader: true,
                fontBold: fontBold,
              ),
              _buildDreRow(
                '(-) Deduções Operacionais (Taxas & Encargos Adquirente Mercado Pago)',
                '- ${_currencyFormat.format(dre.custoMercadoPago)}',
                textColor: PdfColors.red900,
              ),
              _buildDreRow(
                '(=) MARGEM OPERACIONAL BRUTA',
                _currencyFormat.format(dre.margemBruta),
                isSubtotal: true,
                fontBold: fontBold,
              ),
              _buildDreRow(
                '(-) Repasses Líquidos às Lojas & Estabelecimentos Parceiros',
                '- ${_currencyFormat.format(dre.repassesLojas)}',
                textColor: PdfColors.blue900,
              ),
              _buildDreRow(
                '(=) RECEITA LÍQUIDA DA PLATAFORMA (Comissões CJC Dev)',
                _currencyFormat.format(dre.lucroLiquidoCJC),
                isSubtotal: true,
                fontBold: fontBold,
                textColor: PdfColors.green900,
              ),
              if (dre.estornosRealizados > 0)
                _buildDreRow(
                  '(-) Estornos e Devoluções Efetivadas no Período',
                  '- ${_currencyFormat.format(dre.estornosRealizados)}',
                  textColor: PdfColors.orange900,
                ),
              _buildDreRow(
                '(=) RESULTADO OPERACIONAL FINAL REALIZADO',
                _currencyFormat.format(dre.resultadoOperacionalFinal),
                isTotal: true,
                fontBold: fontBold,
                textColor: PdfColors.green900,
              ),
            ],
          ),
        ),
      ],
    );
  }

  static pw.TableRow _buildDreRow(
    String label,
    String value, {
    bool isHeader = false,
    bool isSubtotal = false,
    bool isTotal = false,
    PdfColor? textColor,
    pw.Font? fontBold,
  }) {
    final bgColor = isTotal
        ? PdfColors.green50
        : (isHeader ? PdfColors.grey100 : (isSubtotal ? PdfColors.grey50 : PdfColors.white));

    return pw.TableRow(
      decoration: pw.BoxDecoration(color: bgColor),
      children: [
        pw.Padding(
          padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          child: pw.Text(
            label,
            style: pw.TextStyle(
              font: (isHeader || isSubtotal || isTotal) ? fontBold : null,
              fontSize: isTotal ? 9.5 : (isHeader || isSubtotal ? 8.5 : 8),
              fontWeight: (isHeader || isSubtotal || isTotal) ? pw.FontWeight.bold : pw.FontWeight.normal,
              color: textColor ?? PdfColors.black,
            ),
          ),
        ),
        pw.Padding(
          padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          child: pw.Text(
            value,
            textAlign: pw.TextAlign.right,
            style: pw.TextStyle(
              font: (isHeader || isSubtotal || isTotal) ? fontBold : null,
              fontSize: isTotal ? 9.5 : (isHeader || isSubtotal ? 8.5 : 8),
              fontWeight: (isHeader || isSubtotal || isTotal) ? pw.FontWeight.bold : pw.FontWeight.normal,
              color: textColor ?? PdfColors.black,
            ),
          ),
        ),
      ],
    );
  }

  /// Tabela de Aplicações e Parceiros
  static pw.Widget _buildAppsSection(
    FinancialReportModel report,
    pw.Font fontBold,
    pw.Font fontRegular,
  ) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          '3. DETALHAMENTO POR APLICAÇÃO / PARCEIRO INTEGRADO',
          style: pw.TextStyle(font: fontBold, fontSize: 10, color: PdfColors.blue900),
        ),
        pw.SizedBox(height: 6),
        pw.Table(
          columnWidths: {
            0: const pw.FlexColumnWidth(3.5),
            1: const pw.FlexColumnWidth(1.2),
            2: const pw.FlexColumnWidth(2.0),
            3: const pw.FlexColumnWidth(1.8),
            4: const pw.FlexColumnWidth(1.8),
            5: const pw.FlexColumnWidth(2.0),
          },
          border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.6),
          children: [
            pw.TableRow(
              decoration: const pw.BoxDecoration(color: PdfColors.grey200),
              children: [
                _buildTableCell('Aplicação / Status', isHeader: true, fontBold: fontBold),
                _buildTableCell('Vendas', isHeader: true, fontBold: fontBold, align: pw.TextAlign.center),
                _buildTableCell('Volume Bruto', isHeader: true, fontBold: fontBold, align: pw.TextAlign.right),
                _buildTableCell('Taxa MP', isHeader: true, fontBold: fontBold, align: pw.TextAlign.right),
                _buildTableCell('Comissão CJC', isHeader: true, fontBold: fontBold, align: pw.TextAlign.right),
                _buildTableCell('Repasse Líquido', isHeader: true, fontBold: fontBold, align: pw.TextAlign.right),
              ],
            ),
            ...report.byApplication.map((app) {
              return pw.TableRow(
                children: [
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(5),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(app.name, style: pw.TextStyle(font: fontBold, fontSize: 8)),
                        pw.Text(
                          app.isCommissionExempt ? '🛡️ Isenta de Comissão' : 'Cobrança Padrão',
                          style: pw.TextStyle(
                            fontSize: 6.5,
                            color: app.isCommissionExempt ? PdfColors.green900 : PdfColors.grey700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _buildTableCell(
                    '${app.approvedTransactions} / ${app.totalTransactions}',
                    align: pw.TextAlign.center,
                  ),
                  _buildTableCell(_currencyFormat.format(app.grossVolume), align: pw.TextAlign.right),
                  _buildTableCell(_currencyFormat.format(app.mpFeeVolume), align: pw.TextAlign.right),
                  _buildTableCell(
                    app.isCommissionExempt ? 'R\$ 0,00 (0%)' : _currencyFormat.format(app.commissionVolume),
                    align: pw.TextAlign.right,
                  ),
                  _buildTableCell(
                    _currencyFormat.format(app.netPayoutVolume),
                    align: pw.TextAlign.right,
                    fontBold: fontBold,
                  ),
                ],
              );
            }),
          ],
        ),
      ],
    );
  }

  /// Tabela por Meio de Pagamento
  static pw.Widget _buildMethodsSection(
    FinancialReportModel report,
    pw.Font fontBold,
    pw.Font fontRegular,
  ) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          '4. DISCRIMINAÇÃO POR MÉTODO DE PAGAMENTO',
          style: pw.TextStyle(font: fontBold, fontSize: 10, color: PdfColors.blue900),
        ),
        pw.SizedBox(height: 6),
        pw.Table(
          columnWidths: {
            0: const pw.FlexColumnWidth(3.5),
            1: const pw.FlexColumnWidth(1.2),
            2: const pw.FlexColumnWidth(2.0),
            3: const pw.FlexColumnWidth(1.8),
            4: const pw.FlexColumnWidth(1.8),
            5: const pw.FlexColumnWidth(1.5),
          },
          border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.6),
          children: [
            pw.TableRow(
              decoration: const pw.BoxDecoration(color: PdfColors.grey200),
              children: [
                _buildTableCell('Meio de Pagamento', isHeader: true, fontBold: fontBold),
                _buildTableCell('Qtd', isHeader: true, fontBold: fontBold, align: pw.TextAlign.center),
                _buildTableCell('Volume Bruto', isHeader: true, fontBold: fontBold, align: pw.TextAlign.right),
                _buildTableCell('Taxas MP', isHeader: true, fontBold: fontBold, align: pw.TextAlign.right),
                _buildTableCell('Margem CJC', isHeader: true, fontBold: fontBold, align: pw.TextAlign.right),
                _buildTableCell('Part. %', isHeader: true, fontBold: fontBold, align: pw.TextAlign.right),
              ],
            ),
            ...report.byMethod.map((method) {
              return pw.TableRow(
                children: [
                  _buildTableCell(method.label),
                  _buildTableCell(method.count.toString(), align: pw.TextAlign.center),
                  _buildTableCell(_currencyFormat.format(method.grossVolume), align: pw.TextAlign.right),
                  _buildTableCell(_currencyFormat.format(method.mpFeeVolume), align: pw.TextAlign.right),
                  _buildTableCell(_currencyFormat.format(method.commissionVolume), align: pw.TextAlign.right),
                  _buildTableCell('${_percentFormat.format(method.sharePercent)}%', align: pw.TextAlign.right),
                ],
              );
            }),
          ],
        ),
      ],
    );
  }

  /// Tabela Analítica de Transações
  static pw.Widget _buildTransactionsSection(
    FinancialReportModel report,
    pw.Font fontBold,
    pw.Font fontRegular,
    pw.Font fontMono,
  ) {
    final list = report.transactions.take(200).toList();

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(
          '5. DEMONSTRATIVO ANALÍTICO DE TRANSAÇÕES (${list.length} lançamentos)',
          style: pw.TextStyle(font: fontBold, fontSize: 10, color: PdfColors.blue900),
        ),
        pw.SizedBox(height: 6),
        pw.Table(
          columnWidths: {
            0: const pw.FlexColumnWidth(1.8),
            1: const pw.FlexColumnWidth(2.5),
            2: const pw.FlexColumnWidth(2.2),
            3: const pw.FlexColumnWidth(1.5),
            4: const pw.FlexColumnWidth(1.8),
            5: const pw.FlexColumnWidth(1.5),
            6: const pw.FlexColumnWidth(1.8),
          },
          border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
          children: [
            pw.TableRow(
              decoration: const pw.BoxDecoration(color: PdfColors.grey200),
              children: [
                _buildTableCell('Data/Hora', isHeader: true, fontBold: fontBold),
                _buildTableCell('Referência Externa', isHeader: true, fontBold: fontBold),
                _buildTableCell('Aplicação', isHeader: true, fontBold: fontBold),
                _buildTableCell('Meio', isHeader: true, fontBold: fontBold),
                _buildTableCell('Valor Bruto', isHeader: true, fontBold: fontBold, align: pw.TextAlign.right),
                _buildTableCell('Custo MP', isHeader: true, fontBold: fontBold, align: pw.TextAlign.right),
                _buildTableCell('Líquido', isHeader: true, fontBold: fontBold, align: pw.TextAlign.right),
              ],
            ),
            ...list.map((tx) {
              final dateStr = tx.createdAt != null
                  ? _dateFormat.format(tx.createdAt!)
                  : '-';
              return pw.TableRow(
                children: [
                  _buildTableCell(dateStr),
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(4),
                    child: pw.Text(
                      tx.externalReference,
                      style: pw.TextStyle(font: fontMono, fontSize: 6.5),
                    ),
                  ),
                  _buildTableCell(tx.applicationName),
                  _buildTableCell(tx.paymentMethod),
                  _buildTableCell(_currencyFormat.format(tx.amount), align: pw.TextAlign.right),
                  _buildTableCell(_currencyFormat.format(tx.mpFee), align: pw.TextAlign.right),
                  _buildTableCell(_currencyFormat.format(tx.netPayout), align: pw.TextAlign.right),
                ],
              );
            }),
          ],
        ),
      ],
    );
  }

  static pw.Widget _buildTableCell(
    String text, {
    bool isHeader = false,
    pw.Font? fontBold,
    pw.TextAlign align = pw.TextAlign.left,
  }) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(horizontal: 5, vertical: 4),
      child: pw.Text(
        text,
        textAlign: align,
        style: pw.TextStyle(
          font: isHeader ? fontBold : null,
          fontSize: isHeader ? 7.5 : 7,
          fontWeight: isHeader ? pw.FontWeight.bold : pw.FontWeight.normal,
          color: isHeader ? PdfColors.black : PdfColors.grey800,
        ),
      ),
    );
  }

  /// Dispara o spooler de impressão nativo com pré-visualização e opção "Salvar como PDF"
  static Future<void> printOrSavePdf({
    required FinancialReportModel report,
    String? auditCode,
    String? validationUrl,
  }) async {
    final pdfBytes = await generateAccountingPdf(
      report: report,
      auditCode: auditCode,
      validationUrl: validationUrl,
    );

    final cleanPeriod = report.periodLabel.replaceAll(' ', '-').toLowerCase();
    await Printing.layoutPdf(
      onLayout: (format) async => pdfBytes,
      name: 'balancete-contabil-$cleanPeriod.pdf',
    );
  }

  /// Compartilha o arquivo PDF diretamente através da folha de compartilhamento nativa
  static Future<void> sharePdf({
    required FinancialReportModel report,
    String? auditCode,
    String? validationUrl,
  }) async {
    final pdfBytes = await generateAccountingPdf(
      report: report,
      auditCode: auditCode,
      validationUrl: validationUrl,
    );

    final cleanPeriod = report.periodLabel.replaceAll(' ', '-').toLowerCase();
    await Printing.sharePdf(
      bytes: pdfBytes,
      filename: 'balancete-contabil-$cleanPeriod.pdf',
    );
  }

  // ==================== EXTRATO DE REPASSE DO LOJISTA PARCEIRO ====================

  /// Gera os bytes do PDF executivo do Extrato do Lojista Parceiro
  static Future<Uint8List> generateMerchantSettlementPdf({
    required MerchantSettlementReportModel report,
  }) async {
    final pdf = pw.Document(
      title: 'Extrato de Repasse - ${report.application.name} - ${report.periodLabel}',
      author: 'CJC Dev Pays',
    );

    final fontRegular = await PdfGoogleFonts.robotoRegular();
    final fontBold = await PdfGoogleFonts.robotoBold();

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(24),
        theme: pw.ThemeData.withFont(
          base: fontRegular,
          bold: fontBold,
        ),
        header: (context) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text(
                      report.company.tradeName.isNotEmpty ? report.company.tradeName : 'CJC Dev Pays',
                      style: pw.TextStyle(font: fontBold, fontSize: 15, color: PdfColors.blueGrey900),
                    ),
                    pw.SizedBox(height: 2),
                    pw.Text(
                      '${report.company.legalName} • CNPJ: ${report.company.cnpj.isNotEmpty ? report.company.cnpj : "00.000.000/0001-00"}',
                      style: pw.TextStyle(font: fontRegular, fontSize: 8.5, color: PdfColors.grey700),
                    ),
                    if (report.company.address.isNotEmpty)
                      pw.Text(
                        '${report.company.address} • ${report.company.cityState}',
                        style: pw.TextStyle(font: fontRegular, fontSize: 8, color: PdfColors.grey600),
                      ),
                  ],
                ),
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: [
                    pw.Text(
                      'EXTRATO DE REPASSE',
                      style: pw.TextStyle(font: fontBold, fontSize: 13, color: PdfColors.cyan700),
                    ),
                    pw.SizedBox(height: 2),
                    pw.Text(
                      report.periodLabel,
                      style: pw.TextStyle(font: fontBold, fontSize: 9, color: PdfColors.blueGrey900),
                    ),
                    pw.Text(
                      'Emissão: ${_dateFormat.format(DateTime.now())}',
                      style: pw.TextStyle(font: fontRegular, fontSize: 7.5, color: PdfColors.grey600),
                    ),
                  ],
                ),
              ],
            ),
            pw.Divider(color: PdfColors.cyan700, thickness: 1.5),
            pw.SizedBox(height: 4),
          ],
        ),
        footer: (context) => pw.Column(
          children: [
            pw.Divider(color: PdfColors.grey300, thickness: 0.8),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text(
                  'Documento de prestação de contas emitido por ${report.company.legalName}',
                  style: pw.TextStyle(font: fontRegular, fontSize: 7.5, color: PdfColors.grey600),
                ),
                pw.Text(
                  'Página ${context.pageNumber} de ${context.pagesCount}',
                  style: pw.TextStyle(font: fontRegular, fontSize: 7.5, color: PdfColors.grey600),
                ),
              ],
            ),
          ],
        ),
        build: (context) => [
          // Card de identificação da Loja Parceira
          pw.Container(
            padding: const pw.EdgeInsets.all(10),
            decoration: pw.BoxDecoration(
              color: PdfColors.grey100,
              borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
              border: pw.Border.all(color: PdfColors.grey300),
            ),
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text(
                      'Loja Parceira: ${report.application.name}',
                      style: pw.TextStyle(font: fontBold, fontSize: 11, color: PdfColors.blueGrey900),
                    ),
                    pw.SizedBox(height: 2),
                    pw.Text(
                      'ID Estabelecimento: ${report.application.establishmentId}  •  Slug: ${report.application.slug}',
                      style: pw.TextStyle(font: fontRegular, fontSize: 8.5, color: PdfColors.grey700),
                    ),
                    pw.Text(
                      'Regime: ${report.application.isCommissionExempt ? "Isenta de Comissão CJC" : "Padrão com Intermediação"}',
                      style: pw.TextStyle(font: fontBold, fontSize: 8, color: report.application.isCommissionExempt ? PdfColors.green800 : PdfColors.blueGrey800),
                    ),
                  ],
                ),
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: [
                    if (report.application.contactEmail != null && report.application.contactEmail!.isNotEmpty)
                      pw.Text(
                        'E-mail: ${report.application.contactEmail}',
                        style: pw.TextStyle(font: fontRegular, fontSize: 8, color: PdfColors.grey700),
                      ),
                    if (report.application.contactPhone != null && report.application.contactPhone!.isNotEmpty)
                      pw.Text(
                        'WhatsApp: ${report.application.contactPhone}',
                        style: pw.TextStyle(font: fontRegular, fontSize: 8, color: PdfColors.grey700),
                      ),
                  ],
                ),
              ],
            ),
          ),
          pw.SizedBox(height: 12),

          // Demonstrativo de Liquidação em Destaque
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: pw.BoxDecoration(
              color: PdfColors.green50,
              borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
              border: pw.Border.all(color: PdfColors.green700, width: 1.5),
            ),
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceAround,
              children: [
                _buildSettleStat('Faturamento Bruto', _currencyFormat.format(report.metrics.totalGross), fontBold, fontRegular, PdfColors.blue800),
                _buildSettleStat('Custos Mercado Pago', '- ${_currencyFormat.format(report.metrics.totalMpFee)}', fontBold, fontRegular, PdfColors.red700),
                _buildSettleStat('Taxa CJC Dev', '- ${_currencyFormat.format(report.metrics.totalCjcFee)}', fontBold, fontRegular, PdfColors.amber800),
                _buildSettleStat('Líquido a Repassar', _currencyFormat.format(report.metrics.totalNetPayout), fontBold, fontRegular, PdfColors.green800, isHighlight: true),
              ],
            ),
          ),
          pw.SizedBox(height: 14),

          // Tabela: Resumo por Meio de Pagamento
          pw.Text(
            'DEMONSTRATIVO POR MEIO DE PAGAMENTO',
            style: pw.TextStyle(font: fontBold, fontSize: 9.5, color: PdfColors.blueGrey900),
          ),
          pw.SizedBox(height: 4),
          pw.TableHelper.fromTextArray(
            headers: ['Meio de Pagamento', 'Vendas', 'Faturamento Bruto', 'Custo MP', 'Taxa CJC', 'Líquido da Loja'],
            data: report.byMethod.map((m) => [
              m.label,
              m.count.toString(),
              _currencyFormat.format(m.gross),
              '- ${_currencyFormat.format(m.mpFee)}',
              '- ${_currencyFormat.format(m.cjcCommission)}',
              _currencyFormat.format(m.netPayout),
            ]).toList(),
            headerStyle: pw.TextStyle(font: fontBold, fontSize: 7.5, color: PdfColors.blueGrey900),
            cellStyle: pw.TextStyle(font: fontRegular, fontSize: 7.5),
            headerDecoration: const pw.BoxDecoration(color: PdfColors.grey200),
            cellAlignment: pw.Alignment.centerLeft,
            cellAlignments: {
              1: pw.Alignment.center,
              2: pw.Alignment.centerRight,
              3: pw.Alignment.centerRight,
              4: pw.Alignment.centerRight,
              5: pw.Alignment.centerRight,
            },
          ),
          pw.SizedBox(height: 14),

          // Tabela: Relação de Vendas Aprovadas
          pw.Text(
            'RELAÇÃO ANALÍTICA DE VENDAS APROVADAS (${report.metrics.approvedCount})',
            style: pw.TextStyle(font: fontBold, fontSize: 9.5, color: PdfColors.blueGrey900),
          ),
          pw.SizedBox(height: 4),
          if (report.transactions.isEmpty)
            pw.Padding(
              padding: const pw.EdgeInsets.symmetric(vertical: 16),
              child: pw.Center(
                child: pw.Text('Nenhuma venda aprovada registrada neste período.', style: pw.TextStyle(font: fontRegular, fontSize: 8.5, color: PdfColors.grey600)),
              ),
            )
          else
            pw.TableHelper.fromTextArray(
              headers: ['Data/Hora', 'Pedido', 'Método', 'Valor Venda', 'Custo MP', 'Taxa CJC', 'Líquido', 'Cliente'],
              data: report.transactions.map((tx) => [
                _dateFormat.format(tx.createdAt),
                tx.externalReference,
                tx.paymentMethod,
                _currencyFormat.format(tx.amount),
                '- ${_currencyFormat.format(tx.mpFee)}',
                '- ${_currencyFormat.format(tx.cjcCommission)}',
                _currencyFormat.format(tx.netPayout),
                tx.payerName ?? tx.payerEmail ?? 'Cliente Final',
              ]).toList(),
              headerStyle: pw.TextStyle(font: fontBold, fontSize: 7, color: PdfColors.blueGrey900),
              cellStyle: pw.TextStyle(font: fontRegular, fontSize: 7),
              headerDecoration: const pw.BoxDecoration(color: PdfColors.grey200),
              cellAlignment: pw.Alignment.centerLeft,
              cellAlignments: {
                3: pw.Alignment.centerRight,
                4: pw.Alignment.centerRight,
                5: pw.Alignment.centerRight,
                6: pw.Alignment.centerRight,
              },
            ),
        ],
      ),
    );

    return pdf.save();
  }

  static pw.Widget _buildSettleStat(String label, String value, pw.Font fontBold, pw.Font fontRegular, PdfColor color, {bool isHighlight = false}) {
    return pw.Column(
      children: [
        pw.Text(label.toUpperCase(), style: pw.TextStyle(font: fontRegular, fontSize: 6.5, color: PdfColors.grey700)),
        pw.SizedBox(height: 2),
        pw.Text(
          value,
          style: pw.TextStyle(
            font: fontBold,
            fontSize: isHighlight ? 12 : 9.5,
            color: color,
          ),
        ),
      ],
    );
  }

  /// Dispara a impressão/PDF do extrato do lojista
  static Future<void> printOrSaveMerchantPdf({
    required MerchantSettlementReportModel report,
  }) async {
    final pdfBytes = await generateMerchantSettlementPdf(report: report);
    final cleanSlug = report.application.slug.toLowerCase();
    await Printing.layoutPdf(
      onLayout: (format) async => pdfBytes,
      name: 'extrato-repasse-$cleanSlug-${report.year}-${report.month}.pdf',
    );
  }

  /// Compartilha o PDF do extrato do lojista
  static Future<void> shareMerchantPdf({
    required MerchantSettlementReportModel report,
  }) async {
    final pdfBytes = await generateMerchantSettlementPdf(report: report);
    final cleanSlug = report.application.slug.toLowerCase();
    await Printing.sharePdf(
      bytes: pdfBytes,
      filename: 'extrato-repasse-$cleanSlug-${report.year}-${report.month}.pdf',
    );
  }
}
