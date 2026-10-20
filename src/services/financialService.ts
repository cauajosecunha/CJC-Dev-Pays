import { prisma } from '../lib/prisma.js';
import { feeService } from './feeService.js';
import { companyService } from './companyService.js';
import { logger } from '../lib/logger.js';

export interface FinancialFilterParams {
  startDate?: string | Date;
  endDate?: string | Date;
  month?: number;
  year?: number;
  applicationId?: string;
  paymentMethod?: string;
}

export interface AppFinancialBreakdown {
  applicationId: string;
  name: string;
  slug: string;
  establishmentId: string;
  isCommissionExempt: boolean;
  totalTransactions: number;
  approvedTransactions: number;
  grossVolume: number;
  mpFeeVolume: number;
  commissionVolume: number;
  netPayoutVolume: number;
  refundedVolume: number;
  sharePercent: number;
}

export interface MethodFinancialBreakdown {
  method: string;
  label: string;
  count: number;
  grossVolume: number;
  mpFeeVolume: number;
  commissionVolume: number;
  netPayoutVolume: number;
  sharePercent: number;
}

export interface DreData {
  receitaBrutaTotal: number;
  custoMercadoPago: number;
  margemBruta: number;
  repassesLojas: number;
  lucroLiquidoCJC: number;
  estornosRealizados: number;
  resultadoOperacionalFinal: number;
}

export interface AnalyticalTransaction {
  id: string;
  createdAt: Date;
  externalReference: string;
  applicationName: string;
  paymentMethod: string;
  status: string;
  amount: number;
  mpFee: number;
  cjcCommission: number;
  netPayout: number;
  payerName?: string | null;
  payerEmail?: string | null;
}

export interface MerchantSettlementReport {
  periodLabel: string;
  month: number;
  year: number;
  generatedAt: string;
  application: {
    id: string;
    name: string;
    slug: string;
    establishmentId: string;
    logoUrl?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    isCommissionExempt: boolean;
  };
  company: {
    legalName: string;
    tradeName: string;
    cnpj: string;
    stateTaxId: string;
    municipalTaxId: string;
    address: string;
    cityState: string;
    zipCode: string;
    email: string;
    phone: string;
  };
  metrics: {
    totalGross: number;
    totalMpFee: number;
    totalCjcFee: number;
    totalNetPayout: number;
    totalRefunded: number;
    approvedCount: number;
    refundedCount: number;
    totalCount: number;
    ticketMedio: number;
  };
  byMethod: {
    method: string;
    label: string;
    count: number;
    gross: number;
    mpFee: number;
    cjcCommission: number;
    netPayout: number;
  }[];
  transactions: {
    id: string;
    createdAt: Date;
    externalReference: string;
    paymentMethod: string;
    status: string;
    amount: number;
    mpFee: number;
    cjcCommission: number;
    netPayout: number;
    payerName?: string | null;
    payerEmail?: string | null;
  }[];
}

export interface FinancialReportData {
  periodLabel: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  filterAppId: string;
  filterMethod: string;
  kpis: {
    totalGrossVolume: number;
    totalMpFees: number;
    totalCjcCommission: number;
    totalNetPayout: number;
    totalRefunded: number;
    totalCount: number;
    approvedCount: number;
    refundedCount: number;
    ticketMedio: number;
    averageRetentionPercent: number;
  };
  dre: DreData;
  byApplication: AppFinancialBreakdown[];
  byMethod: MethodFinancialBreakdown[];
  transactions: AnalyticalTransaction[];
  company: {
    legalName: string;
    tradeName: string;
    cnpj: string;
    stateTaxId: string;
    municipalTaxId: string;
    address: string;
    cityState: string;
    zipCode: string;
    email: string;
    phone: string;
  };
}

export class FinancialService {
  /**
   * Constrói o relatório financeiro e contábil consolidado
   */
  async getFinancialReport(params: FinancialFilterParams): Promise<FinancialReportData> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let periodLabel = '';

    const targetYear = params.year ?? now.getFullYear();

    if (params.startDate && params.endDate) {
      startDate = new Date(params.startDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(params.endDate);
      endDate.setHours(23, 59, 59, 999);
      periodLabel = `${startDate.toLocaleDateString('pt-BR')} até ${endDate.toLocaleDateString('pt-BR')}`;
    } else if (params.month && params.month >= 1 && params.month <= 12) {
      startDate = new Date(targetYear, params.month - 1, 1, 0, 0, 0, 0);
      endDate = new Date(targetYear, params.month, 0, 23, 59, 59, 999);
      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      periodLabel = `${monthNames[params.month - 1]} de ${targetYear}`;
    } else if (params.year) {
      startDate = new Date(targetYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
      periodLabel = `Ano Consolidado de ${targetYear}`;
    } else {
      // Padrão: Mês Corrente
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      periodLabel = `${monthNames[now.getMonth()]} de ${now.getFullYear()} (Mês Corrente)`;
    }

    const where: any = {
      createdAt: { gte: startDate, lte: endDate },
    };

    if (params.applicationId && params.applicationId !== 'ALL') {
      where.applicationId = params.applicationId;
    }

    if (params.paymentMethod && params.paymentMethod !== 'ALL') {
      where.paymentMethod = params.paymentMethod;
    }

    // Busca taxas da plataforma e aplicações cadastradas
    const [feeSettings, applications, allPaymentsInPeriod] = await Promise.all([
      feeService.getSettings(),
      prisma.application.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          isCommissionExempt: true,
        },
      }),
      prisma.payment.findMany({
        where,
        include: {
          application: {
            select: { id: true, name: true, slug: true, isCommissionExempt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const appMap = new Map<string, { id: string; name: string; slug: string; isCommissionExempt: boolean }>();
    applications.forEach((app) => appMap.set(app.id, app));

    // Cálculos e Agregações
    let totalGrossVolume = 0;
    let totalMpFees = 0;
    let totalCjcCommission = 0;
    let totalNetPayout = 0;
    let totalRefunded = 0;

    let totalCount = allPaymentsInPeriod.length;
    let approvedCount = 0;
    let refundedCount = 0;

    const appBreakdownMap = new Map<string, {
      total: number;
      approved: number;
      gross: number;
      mpFee: number;
      commission: number;
      netPayout: number;
      refunded: number;
    }>();

    const methodBreakdownMap = new Map<string, {
      count: number;
      gross: number;
      mpFee: number;
      commission: number;
      netPayout: number;
    }>();

    const analyticalTransactions: AnalyticalTransaction[] = [];

    for (const p of allPaymentsInPeriod) {
      const appInfo = p.application || appMap.get(p.applicationId) || {
        id: p.applicationId,
        name: 'Aplicação Removida',
        slug: 'desconhecido',
        isCommissionExempt: false,
      };

      const isExempt = Boolean(appInfo.isCommissionExempt);
      const gross = Number(p.amount) || 0;
      const method = (p.paymentMethod || 'PIX').toUpperCase();

      // Métricas por status
      if (p.status === 'REFUNDED') {
        refundedCount++;
        totalRefunded += gross;
      }

      let pMpFee = 0;
      let pCommission = 0;
      let pNetPayout = gross;

      if (p.status === 'APPROVED') {
        approvedCount++;
        totalGrossVolume += gross;

        // Determinação das alíquotas dinâmicas
        let mpFeePct = feeSettings.mpPixFeePercent;
        let commPct = isExempt ? 0 : feeSettings.commissionPixPercent;

        if (method.includes('CREDIT') || method.includes('CREDITO')) {
          mpFeePct = feeSettings.mpCreditFeePercent;
          commPct = isExempt ? 0 : feeSettings.commissionCreditPercent;
        } else if (method.includes('DEBIT') || method.includes('DEBITO')) {
          mpFeePct = feeSettings.mpDebitFeePercent;
          commPct = isExempt ? 0 : feeSettings.commissionDebitPercent;
        }

        // Se o pagamento já tem feeAmount registrado no banco pelo MP, respeita-se o custo real
        pMpFee = Number(p.feeAmount) > 0 ? Number(p.feeAmount) : Number(((gross * mpFeePct) / 100).toFixed(2));
        pCommission = isExempt ? 0 : Number(((gross * commPct) / 100).toFixed(2));
        pNetPayout = Number((gross - (pMpFee + pCommission)).toFixed(2));

        totalMpFees += pMpFee;
        totalCjcCommission += pCommission;
        totalNetPayout += pNetPayout;

        // Acúmulo por método
        const methodStats = methodBreakdownMap.get(method) || { count: 0, gross: 0, mpFee: 0, commission: 0, netPayout: 0 };
        methodStats.count++;
        methodStats.gross += gross;
        methodStats.mpFee += pMpFee;
        methodStats.commission += pCommission;
        methodStats.netPayout += pNetPayout;
        methodBreakdownMap.set(method, methodStats);
      }

      // Acúmulo por aplicação
      const appStats = appBreakdownMap.get(appInfo.id) || {
        total: 0,
        approved: 0,
        gross: 0,
        mpFee: 0,
        commission: 0,
        netPayout: 0,
        refunded: 0,
      };

      appStats.total++;
      if (p.status === 'APPROVED') {
        appStats.approved++;
        appStats.gross += gross;
        appStats.mpFee += pMpFee;
        appStats.commission += pCommission;
        appStats.netPayout += pNetPayout;
      } else if (p.status === 'REFUNDED') {
        appStats.refunded += gross;
      }
      appBreakdownMap.set(appInfo.id, appStats);

      // Adiciona na lista analítica (limitada a 1000 registros para evitar sobrecarga)
      if (analyticalTransactions.length < 1000) {
        analyticalTransactions.push({
          id: p.id,
          createdAt: p.createdAt,
          externalReference: p.externalReference,
          applicationName: appInfo.name,
          paymentMethod: method,
          status: p.status,
          amount: gross,
          mpFee: pMpFee,
          cjcCommission: pCommission,
          netPayout: pNetPayout,
          payerName: p.payerName,
          payerEmail: p.payerEmail,
        });
      }
    }

    // Arredondamentos de precisão financeira
    totalGrossVolume = Number(totalGrossVolume.toFixed(2));
    totalMpFees = Number(totalMpFees.toFixed(2));
    totalCjcCommission = Number(totalCjcCommission.toFixed(2));
    totalNetPayout = Number(totalNetPayout.toFixed(2));
    totalRefunded = Number(totalRefunded.toFixed(2));

    const ticketMedio = approvedCount > 0 ? Number((totalGrossVolume / approvedCount).toFixed(2)) : 0;
    const averageRetentionPercent = totalGrossVolume > 0
      ? Number((((totalMpFees + totalCjcCommission) / totalGrossVolume) * 100).toFixed(2))
      : 0;

    // DRE Sintético
    const margemBruta = Number((totalGrossVolume - totalMpFees).toFixed(2));
    const resultadoOperacionalFinal = Number((totalCjcCommission - totalRefunded).toFixed(2));

    const dre: DreData = {
      receitaBrutaTotal: totalGrossVolume,
      custoMercadoPago: totalMpFees,
      margemBruta,
      repassesLojas: totalNetPayout,
      lucroLiquidoCJC: totalCjcCommission,
      estornosRealizados: totalRefunded,
      resultadoOperacionalFinal,
    };

    // Montagem do Breakdown por Aplicação
    const byApplication: AppFinancialBreakdown[] = applications
      .filter((app) => {
        if (params.applicationId && params.applicationId !== 'ALL') {
          return app.id === params.applicationId;
        }
        return true;
      })
      .map((app) => {
        const stats = appBreakdownMap.get(app.id) || {
          total: 0,
          approved: 0,
          gross: 0,
          mpFee: 0,
          commission: 0,
          netPayout: 0,
          refunded: 0,
        };

        const share = totalGrossVolume > 0 ? Number(((stats.gross / totalGrossVolume) * 100).toFixed(2)) : 0;
        const establishmentId = app.slug.toUpperCase().replace(/[^A-Z0-9]/g, '-');

        return {
          applicationId: app.id,
          name: app.name,
          slug: app.slug,
          establishmentId,
          isCommissionExempt: Boolean(app.isCommissionExempt),
          totalTransactions: stats.total,
          approvedTransactions: stats.approved,
          grossVolume: Number(stats.gross.toFixed(2)),
          mpFeeVolume: Number(stats.mpFee.toFixed(2)),
          commissionVolume: Number(stats.commission.toFixed(2)),
          netPayoutVolume: Number(stats.netPayout.toFixed(2)),
          refundedVolume: Number(stats.refunded.toFixed(2)),
          sharePercent: share,
        };
      })
      .sort((a, b) => b.grossVolume - a.grossVolume);

    // Montagem do Breakdown por Método de Pagamento
    const methodLabels: Record<string, string> = {
      PIX: '💠 Pix Instantâneo',
      CREDIT_CARD: '💳 Cartão de Crédito',
      DEBIT_CARD: '💳 Cartão de Débito',
      BOLETO: '📄 Boleto Bancário',
    };

    const byMethod: MethodFinancialBreakdown[] = Array.from(methodBreakdownMap.entries())
      .map(([mKey, mVal]) => {
        const share = totalGrossVolume > 0 ? Number(((mVal.gross / totalGrossVolume) * 100).toFixed(2)) : 0;
        return {
          method: mKey,
          label: methodLabels[mKey] || mKey,
          count: mVal.count,
          grossVolume: Number(mVal.gross.toFixed(2)),
          mpFeeVolume: Number(mVal.mpFee.toFixed(2)),
          commissionVolume: Number(mVal.commission.toFixed(2)),
          netPayoutVolume: Number(mVal.netPayout.toFixed(2)),
          sharePercent: share,
        };
      })
      .sort((a, b) => b.grossVolume - a.grossVolume);

    const companySettings = await companyService.getSettings();

    return {
      periodLabel,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      generatedAt: now.toISOString(),
      filterAppId: params.applicationId || 'ALL',
      filterMethod: params.paymentMethod || 'ALL',
      kpis: {
        totalGrossVolume,
        totalMpFees,
        totalCjcCommission,
        totalNetPayout,
        totalRefunded,
        totalCount,
        approvedCount,
        refundedCount,
        ticketMedio,
        averageRetentionPercent,
      },
      dre,
      byApplication,
      byMethod,
      transactions: analyticalTransactions,
      company: {
        legalName: companySettings.companyLegalName,
        tradeName: companySettings.companyTradeName,
        cnpj: companySettings.companyCnpj,
        stateTaxId: companySettings.companyStateTaxId,
        municipalTaxId: companySettings.companyMunicipalTaxId,
        address: companySettings.companyAddress,
        cityState: companySettings.companyCityState,
        zipCode: companySettings.companyZipCode,
        email: companySettings.companyEmail,
        phone: companySettings.companyPhone,
      },
    };
  }

  /**
   * Gera o conteúdo CSV completo formatado para Excel (separador ';' e UTF-8 BOM)
   */
  generateFinancialCsv(report: FinancialReportData): string {
    const BOM = '\uFEFF';
    const lines: string[] = [];

    const formatMoney = (val: number) => val.toFixed(2).replace('.', ',');
    const formatPct = (val: number) => `${val.toFixed(2).replace('.', ',')}%`;

    // 1. Cabeçalho Geral
    lines.push('RELATÓRIO FINANCEIRO E CONTÁBIL CONSOLIDADO — CJC DEV PAYS');
    lines.push(`Período de Apuração;${report.periodLabel}`);
    lines.push(`Data de Emissão;${new Date(report.generatedAt).toLocaleString('pt-BR')}`);
    lines.push(`Filtro Aplicação;${report.filterAppId}`);
    lines.push(`Filtro Método;${report.filterMethod}`);
    lines.push('');

    // 2. Indicadores Principais (KPIs)
    lines.push('--- INDICADORES PRINCIPAIS (KPIS) ---');
    lines.push('Indicador;Valor Contábil');
    lines.push(`Faturamento Bruto Transacionado (TPV);R$ ${formatMoney(report.kpis.totalGrossVolume)}`);
    lines.push(`Custo Operacional Mercado Pago;R$ ${formatMoney(report.kpis.totalMpFees)}`);
    lines.push(`Comissão / Lucro Líquido CJC Dev Pays;R$ ${formatMoney(report.kpis.totalCjcCommission)}`);
    lines.push(`Repasse Líquido às Lojas Clientes;R$ ${formatMoney(report.kpis.totalNetPayout)}`);
    lines.push(`Total Estornado / Reembolsado;R$ ${formatMoney(report.kpis.totalRefunded)}`);
    lines.push(`Transações Totais;${report.kpis.totalCount}`);
    lines.push(`Transações Aprovadas;${report.kpis.approvedCount}`);
    lines.push(`Transações Estornadas;${report.kpis.refundedCount}`);
    lines.push(`Ticket Médio por Transação Aprovada;R$ ${formatMoney(report.kpis.ticketMedio)}`);
    lines.push(`Taxa Média de Retenção;${formatPct(report.kpis.averageRetentionPercent)}`);
    lines.push('');

    // 3. Demonstrativo do Resultado do Exercício (DRE Sintético)
    lines.push('--- DEMONSTRATIVO DO RESULTADO (DRE SINTÉTICO) ---');
    lines.push('Linha Contábil;Operação;Valor (R$)');
    lines.push(`(+) Receita Bruta Transacionada;Crédito;R$ ${formatMoney(report.dre.receitaBrutaTotal)}`);
    lines.push(`(-) Custos do Mercado Pago (Adquirência);Débito;(R$ ${formatMoney(report.dre.custoMercadoPago)})`);
    lines.push(`(=) Margem Operacional Bruta;Subtotal;R$ ${formatMoney(report.dre.margemBruta)}`);
    lines.push(`(-) Repasse Contábil às Lojas;Débito;(R$ ${formatMoney(report.dre.repassesLojas)})`);
    lines.push(`(=) Receita Operacional Líquida CJC Dev Pays;Subtotal;R$ ${formatMoney(report.dre.lucroLiquidoCJC)}`);
    lines.push(`(-) Deduções por Estornos / Reembolsos;Débito;(R$ ${formatMoney(report.dre.estornosRealizados)})`);
    lines.push(`(=) RESULTADO FINANCEIRO FINAL;Resultado;R$ ${formatMoney(report.dre.resultadoOperacionalFinal)}`);
    lines.push('');

    // 4. Fechamento Consolidado por Aplicação / Estabelecimento
    lines.push('--- FECHAMENTO CONSOLIDADO POR APLICAÇÃO / ESTABELECIMENTO ---');
    lines.push('Aplicação;ID Estabelecimento;Regime;Transações;Volume Bruto (R$);Custo MP (R$);Comissão CJC (R$);Repasse Líquido (R$);Estornos (R$);Participação (%)');
    for (const app of report.byApplication) {
      lines.push(
        [
          `"${app.name}"`,
          `"${app.establishmentId}"`,
          app.isCommissionExempt ? 'Isenta de Comissão' : 'Padrão',
          app.approvedTransactions,
          formatMoney(app.grossVolume),
          formatMoney(app.mpFeeVolume),
          formatMoney(app.commissionVolume),
          formatMoney(app.netPayoutVolume),
          formatMoney(app.refundedVolume),
          formatPct(app.sharePercent),
        ].join(';')
      );
    }
    lines.push('');

    // 5. Conciliação por Meio de Pagamento
    lines.push('--- CONCILIAÇÃO POR MEIO DE PAGAMENTO ---');
    lines.push('Meio de Pagamento;Transações;Volume Bruto (R$);Custo MP (R$);Comissão CJC (R$);Repasse Líquido (R$);Participação (%)');
    for (const m of report.byMethod) {
      lines.push(
        [
          `"${m.label}"`,
          m.count,
          formatMoney(m.grossVolume),
          formatMoney(m.mpFeeVolume),
          formatMoney(m.commissionVolume),
          formatMoney(m.netPayoutVolume),
          formatPct(m.sharePercent),
        ].join(';')
      );
    }
    lines.push('');

    // 6. Extrato Analítico de Lançamentos
    lines.push('--- EXTRATO ANALÍTICO DE LANÇAMENTOS ---');
    lines.push('Data/Hora;ID Transação;Referência do Pedido;Aplicação;Método;Status;Valor Bruto (R$);Custo MP (R$);Comissão CJC (R$);Líquido Repassado (R$);Pagador');
    for (const tx of report.transactions) {
      lines.push(
        [
          new Date(tx.createdAt).toLocaleString('pt-BR'),
          `"${tx.id}"`,
          `"${tx.externalReference}"`,
          `"${tx.applicationName}"`,
          tx.paymentMethod,
          tx.status,
          formatMoney(tx.amount),
          formatMoney(tx.mpFee),
          formatMoney(tx.cjcCommission),
          formatMoney(tx.netPayout),
          `"${tx.payerName || tx.payerEmail || 'N/A'}"`,
        ].join(';')
      );
    }

    return BOM + lines.join('\r\n');
  }

  /**
   * Constrói o extrato de repasse simplificado para um Lojista Parceiro específico
   */
  async getMerchantSettlementReport(
    applicationId: string,
    month?: number,
    year?: number
  ): Promise<MerchantSettlementReport> {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month && month >= 1 && month <= 12 ? month : now.getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];
    const periodLabel = `${monthNames[targetMonth - 1]} de ${targetYear}`;

    const [application, feeSettings, companySettings, payments] = await Promise.all([
      prisma.application.findUnique({
        where: { id: applicationId },
      }),
      feeService.getSettings(),
      companyService.getSettings(),
      prisma.payment.findMany({
        where: {
          applicationId,
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!application) {
      throw new Error(`Aplicação '${applicationId}' não encontrada.`);
    }

    const isExempt = Boolean(application.isCommissionExempt);

    let totalGross = 0;
    let totalMpFee = 0;
    let totalCjcFee = 0;
    let totalNetPayout = 0;
    let totalRefunded = 0;

    let approvedCount = 0;
    let refundedCount = 0;
    const totalCount = payments.length;

    const methodMap = new Map<string, { count: number; gross: number; mpFee: number; commission: number; netPayout: number }>();
    const analyticalTransactions: AnalyticalTransaction[] = [];

    for (const p of payments) {
      const gross = Number(p.amount) || 0;
      const method = (p.paymentMethod || 'PIX').toUpperCase();

      if (p.status === 'REFUNDED') {
        refundedCount++;
        totalRefunded += gross;
      }

      let pMpFee = 0;
      let pCommission = 0;
      let pNetPayout = gross;

      if (p.status === 'APPROVED') {
        approvedCount++;
        totalGross += gross;

        let mpFeePct = feeSettings.mpPixFeePercent;
        let commPct = isExempt ? 0 : feeSettings.commissionPixPercent;

        if (method.includes('CREDIT') || method.includes('CREDITO')) {
          mpFeePct = feeSettings.mpCreditFeePercent;
          commPct = isExempt ? 0 : feeSettings.commissionCreditPercent;
        } else if (method.includes('DEBIT') || method.includes('DEBITO')) {
          mpFeePct = feeSettings.mpDebitFeePercent;
          commPct = isExempt ? 0 : feeSettings.commissionDebitPercent;
        }

        pMpFee = Number(p.feeAmount) > 0 ? Number(p.feeAmount) : Number(((gross * mpFeePct) / 100).toFixed(2));
        pCommission = isExempt ? 0 : Number(((gross * commPct) / 100).toFixed(2));
        pNetPayout = Number((gross - (pMpFee + pCommission)).toFixed(2));

        totalMpFee += pMpFee;
        totalCjcFee += pCommission;
        totalNetPayout += pNetPayout;

        // Acúmulo por método
        const existingMethod = methodMap.get(method) || { count: 0, gross: 0, mpFee: 0, commission: 0, netPayout: 0 };
        existingMethod.count++;
        existingMethod.gross += gross;
        existingMethod.mpFee += pMpFee;
        existingMethod.commission += pCommission;
        existingMethod.netPayout += pNetPayout;
        methodMap.set(method, existingMethod);

        analyticalTransactions.push({
          id: p.id,
          createdAt: p.createdAt,
          externalReference: p.externalReference,
          applicationName: application.name,
          paymentMethod: method,
          status: p.status,
          amount: gross,
          mpFee: pMpFee,
          cjcCommission: pCommission,
          netPayout: pNetPayout,
          payerName: p.payerName,
          payerEmail: p.payerEmail,
        });
      }
    }

    const methodLabels: Record<string, string> = {
      PIX: 'Pix Instantâneo',
      CREDIT_CARD: 'Cartão de Crédito',
      DEBIT_CARD: 'Cartão de Débito',
      BOLETO: 'Boleto Bancário',
    };

    const byMethod = Array.from(methodMap.entries()).map(([method, data]) => ({
      method,
      label: methodLabels[method] || method,
      count: data.count,
      gross: Number(data.gross.toFixed(2)),
      mpFee: Number(data.mpFee.toFixed(2)),
      cjcCommission: Number(data.commission.toFixed(2)),
      netPayout: Number(data.netPayout.toFixed(2)),
    }));

    const ticketMedio = approvedCount > 0 ? Number((totalGross / approvedCount).toFixed(2)) : 0;

    return {
      periodLabel,
      month: targetMonth,
      year: targetYear,
      generatedAt: new Date().toISOString(),
      application: {
        id: application.id,
        name: application.name,
        slug: application.slug,
        establishmentId: application.slug.toUpperCase().replace(/[^A-Z0-9]/g, '-'),
        logoUrl: application.logoUrl,
        contactEmail: application.contactEmail,
        contactPhone: application.contactPhone,
        isCommissionExempt: application.isCommissionExempt,
      },
      company: {
        legalName: companySettings.companyLegalName,
        tradeName: companySettings.companyTradeName,
        cnpj: companySettings.companyCnpj,
        stateTaxId: companySettings.companyStateTaxId,
        municipalTaxId: companySettings.companyMunicipalTaxId,
        address: companySettings.companyAddress,
        cityState: companySettings.companyCityState,
        zipCode: companySettings.companyZipCode,
        email: companySettings.companyEmail,
        phone: companySettings.companyPhone,
      },
      metrics: {
        totalGross: Number(totalGross.toFixed(2)),
        totalMpFee: Number(totalMpFee.toFixed(2)),
        totalCjcFee: Number(totalCjcFee.toFixed(2)),
        totalNetPayout: Number(totalNetPayout.toFixed(2)),
        totalRefunded: Number(totalRefunded.toFixed(2)),
        approvedCount,
        refundedCount,
        totalCount,
        ticketMedio,
      },
      byMethod,
      transactions: analyticalTransactions,
    };
  }

  /**
   * Exporta o extrato do lojista em formato CSV transparente para Excel
   */
  exportMerchantCsv(report: MerchantSettlementReport): string {
    const BOM = '\uFEFF';
    const lines: string[] = [];

    const formatMoney = (val: number) => val.toFixed(2).replace('.', ',');

    // 1. Cabeçalho Geral
    lines.push('EXTRATO DE REPASSE CONCILIADO — LOJISTA PARCEIRO');
    lines.push(`Processadora / Gateway;${report.company.tradeName || 'CJC Dev Pays'} (${report.company.legalName})`);
    if (report.company.cnpj) lines.push(`CNPJ Processadora;${report.company.cnpj}`);
    lines.push(`Loja Parceira;${report.application.name} (Ref: ${report.application.establishmentId})`);
    if (report.application.contactEmail) lines.push(`E-mail do Responsável;${report.application.contactEmail}`);
    if (report.application.contactPhone) lines.push(`WhatsApp do Responsável;${report.application.contactPhone}`);
    lines.push(`Período de Apuração;${report.periodLabel}`);
    lines.push(`Data de Emissão;${new Date(report.generatedAt).toLocaleString('pt-BR')}`);
    lines.push('');

    // 2. Resumo de Fechamento do Lojista
    lines.push('--- DEMONSTRATIVO DE LIQUIDAÇÃO E REPASSE ---');
    lines.push('Item;Operação;Valor (R$)');
    lines.push(`(+) Faturamento Bruto da Loja;Crédito;R$ ${formatMoney(report.metrics.totalGross)}`);
    lines.push(`(-) Dedução Taxas Mercado Pago (Adquirência);Débito;(R$ ${formatMoney(report.metrics.totalMpFee)})`);
    lines.push(`(-) Intermediação Tecnológica CJC Dev;Débito;(R$ ${formatMoney(report.metrics.totalCjcFee)})`);
    lines.push(`(=) VALOR LÍQUIDO A REPASSAR AO LOJISTA;Repasse Líquido;R$ ${formatMoney(report.metrics.totalNetPayout)}`);
    if (report.metrics.totalRefunded > 0) {
      lines.push(`Total Estornado / Cancelado;Informativo;R$ ${formatMoney(report.metrics.totalRefunded)}`);
    }
    lines.push(`Vendas Aprovadas;Quantidade;${report.metrics.approvedCount}`);
    lines.push(`Ticket Médio por Venda;Média;R$ ${formatMoney(report.metrics.ticketMedio)}`);
    lines.push('');

    // 3. Resumo por Meio de Pagamento
    lines.push('--- VENDAS POR MEIO DE PAGAMENTO ---');
    lines.push('Meio de Pagamento;Qtd Vendas;Faturamento Bruto (R$);Taxa Mercado Pago (R$);Taxa CJC Dev (R$);Repasse Líquido (R$)');
    for (const m of report.byMethod) {
      lines.push([
        `"${m.label}"`,
        m.count,
        formatMoney(m.gross),
        formatMoney(m.mpFee),
        formatMoney(m.cjcCommission),
        formatMoney(m.netPayout),
      ].join(';'));
    }
    lines.push('');

    // 4. Extrato Analítico de Vendas
    lines.push('--- EXTRATO ANALÍTICO DE VENDAS APROVADAS ---');
    lines.push('Data/Hora;ID Transação;Referência do Pedido;Método;Valor da Venda (R$);Taxa Adquirência (R$);Taxa Plataforma (R$);Líquido do Lojista (R$);Cliente/Pagador');
    for (const tx of report.transactions) {
      lines.push([
        new Date(tx.createdAt).toLocaleString('pt-BR'),
        `"${tx.id}"`,
        `"${tx.externalReference}"`,
        tx.paymentMethod,
        formatMoney(tx.amount),
        formatMoney(tx.mpFee),
        formatMoney(tx.cjcCommission),
        formatMoney(tx.netPayout),
        `"${tx.payerName || tx.payerEmail || 'Cliente Final'}"`,
      ].join(';'));
    }

    return BOM + lines.join('\r\n');
  }
}

export const financialService = new FinancialService();
