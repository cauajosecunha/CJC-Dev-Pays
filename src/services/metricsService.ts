import { prisma } from '../lib/prisma.js';

export class MetricsService {
  async getDashboardMetrics() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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
      appsWithCounts,
      recentPayments,
    ] = await Promise.all([
      prisma.payment.count(),
      prisma.payment.count({ where: { status: 'APPROVED' } }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.payment.count({ where: { status: { in: ['REJECTED', 'CANCELLED'] } } }),
      prisma.payment.aggregate({
        _sum: { amount: true, netReceivedAmount: true, feeAmount: true },
        where: { status: 'APPROVED' },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'APPROVED', paidAt: { gte: startOfToday } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'APPROVED', paidAt: { gte: startOfMonth } },
      }),
      prisma.webhookDelivery.count(),
      prisma.webhookDelivery.count({ where: { status: 'FAILED' } }),
      prisma.webhookDelivery.count({ where: { status: 'DELIVERED' } }),
      prisma.application.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          _count: {
            select: { payments: true },
          },
        },
      }),
      prisma.payment.findMany({
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

    // Agrupamento por aplicação de valores aprovados
    const paymentsByApp = await prisma.payment.groupBy({
      by: ['applicationId'],
      where: { status: 'APPROVED' },
      _sum: { amount: true },
      _count: { id: true },
    });

    const appVolumes = appsWithCounts.map((app) => {
      const stats = paymentsByApp.find((p) => p.applicationId === app.id);
      return {
        id: app.id,
        name: app.name,
        slug: app.slug,
        isActive: app.isActive,
        totalPayments: app._count.payments,
        approvedVolume: stats?._sum.amount || 0,
        approvedCount: stats?._count.id || 0,
      };
    });

    return {
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
