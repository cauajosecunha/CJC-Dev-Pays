import { prisma } from '../lib/prisma.js';

export class MetricsService {
  async getDashboardMetrics(month?: number, year?: number) {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();

    const paymentWhere: any = {};
    const webhookWhere: any = {};
    let isCurrentMonth = true;

    if (month && month >= 1 && month <= 12) {
      const startDate = new Date(targetYear, month - 1, 1, 0, 0, 0, 0);
      const endDate = new Date(targetYear, month, 1, 0, 0, 0, 0);

      paymentWhere.createdAt = { gte: startDate, lt: endDate };
      webhookWhere.createdAt = { gte: startDate, lt: endDate };

      isCurrentMonth = targetYear === now.getFullYear() && month === now.getMonth() + 1;
    }

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalCount,
      approvedCount,
      pendingCount,
      rejectedCount,
      totalVolume,
      todayVolume,
      monthVolume,
      deliveriesTotal,
      deliveriesFailed,
      deliveriesSuccess,
      apps,
      recentPayments,
    ] = await Promise.all([
      prisma.payment.count({ where: paymentWhere }),
      prisma.payment.count({ where: { ...paymentWhere, status: 'APPROVED' } }),
      prisma.payment.count({ where: { ...paymentWhere, status: 'PENDING' } }),
      prisma.payment.count({ where: { ...paymentWhere, status: { in: ['REJECTED', 'CANCELLED'] } } }),
      prisma.payment.aggregate({
        _sum: { amount: true, netReceivedAmount: true, feeAmount: true },
        where: { ...paymentWhere, status: 'APPROVED' },
      }),
      isCurrentMonth
        ? prisma.payment.aggregate({
            _sum: { amount: true },
            where: { status: 'APPROVED', createdAt: { gte: startOfToday } },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'APPROVED',
          ...(month
            ? paymentWhere
            : { createdAt: { gte: startOfCurrentMonth } }),
        },
      }),
      prisma.webhookDelivery.count({ where: webhookWhere }),
      prisma.webhookDelivery.count({ where: { ...webhookWhere, status: 'FAILED' } }),
      prisma.webhookDelivery.count({ where: { ...webhookWhere, status: 'DELIVERED' } }),
      prisma.application.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
        },
      }),
      prisma.payment.findMany({
        where: paymentWhere,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          application: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
    ]);

    const approvalRate = totalCount > 0 ? ((approvedCount / totalCount) * 100).toFixed(1) : '100.0';

    // Agrupamento por aplicação no período selecionado
    const [paymentsCountByApp, paymentsByApp] = await Promise.all([
      prisma.payment.groupBy({
        by: ['applicationId'],
        where: paymentWhere,
        _count: { id: true },
      }),
      prisma.payment.groupBy({
        by: ['applicationId'],
        where: { ...paymentWhere, status: 'APPROVED' },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    const appVolumes = apps.map((app) => {
      const stats = paymentsByApp.find((p) => p.applicationId === app.id);
      const totalStat = paymentsCountByApp.find((p) => p.applicationId === app.id);
      return {
        id: app.id,
        name: app.name,
        slug: app.slug,
        isActive: app.isActive,
        totalPayments: totalStat?._count.id || 0,
        approvedVolume: stats?._sum.amount || 0,
        approvedCount: stats?._count.id || 0,
      };
    });

    return {
      selectedMonth: month || null,
      selectedYear: targetYear,
      isCurrentMonth,
      kpis: {
        totalVolume: totalVolume._sum.amount || 0,
        netVolume: totalVolume._sum.netReceivedAmount || 0,
        totalFees: totalVolume._sum.feeAmount || 0,
        todayVolume: todayVolume._sum.amount || 0,
        monthVolume: monthVolume._sum.amount || 0,
        totalCount,
        approvedCount,
        pendingCount,
        rejectedCount,
        approvalRate: Number(approvalRate),
      },
      webhooks: {
        total: deliveriesTotal,
        success: deliveriesSuccess,
        failed: deliveriesFailed,
        healthPct:
          deliveriesTotal > 0
            ? Number(((deliveriesSuccess / deliveriesTotal) * 100).toFixed(1))
            : 100,
      },
      applications: appVolumes,
      recentPayments,
    };
  }
}

export const metricsService = new MetricsService();
