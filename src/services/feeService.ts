import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface FeeSettings {
  mpPixFeePercent: number;
  mpCreditFeePercent: number;
  mpDebitFeePercent: number;
  commissionPixPercent: number;
  commissionCreditPercent: number;
  commissionDebitPercent: number;
  updatedAt?: Date;
}

export interface FeeCalculationResult {
  paymentMethod: string;
  amount: number;
  mpFeePercent: number;
  mpFeeAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  isCommissionExempt: boolean;
  totalFeeAmount: number;
  netReceivedAmount: number;
}

export class FeeService {
  private defaultSettings: FeeSettings = {
    mpPixFeePercent: 0.99,
    mpCreditFeePercent: 4.99,
    mpDebitFeePercent: 1.99,
    commissionPixPercent: 1.00,
    commissionCreditPercent: 2.00,
    commissionDebitPercent: 1.50,
  };

  /**
   * Obtém as taxas configuradas no banco (ou padrão)
   */
  async getSettings(): Promise<FeeSettings> {
    try {
      const record = await prisma.platformSettings.findUnique({
        where: { id: 'default' },
      });

      if (!record) {
        return this.defaultSettings;
      }

      return {
        mpPixFeePercent: record.mpPixFeePercent,
        mpCreditFeePercent: record.mpCreditFeePercent,
        mpDebitFeePercent: record.mpDebitFeePercent,
        commissionPixPercent: record.commissionPixPercent,
        commissionCreditPercent: record.commissionCreditPercent,
        commissionDebitPercent: record.commissionDebitPercent,
        updatedAt: record.updatedAt,
      };
    } catch (error) {
      logger.error('Erro ao buscar taxas da plataforma:', error);
      return this.defaultSettings;
    }
  }

  /**
   * Atualiza as taxas da plataforma
   */
  async updateSettings(data: Partial<FeeSettings>): Promise<FeeSettings> {
    const current = await this.getSettings();

    const sanitized: FeeSettings = {
      mpPixFeePercent: Number(data.mpPixFeePercent ?? current.mpPixFeePercent),
      mpCreditFeePercent: Number(data.mpCreditFeePercent ?? current.mpCreditFeePercent),
      mpDebitFeePercent: Number(data.mpDebitFeePercent ?? current.mpDebitFeePercent),
      commissionPixPercent: Number(data.commissionPixPercent ?? current.commissionPixPercent),
      commissionCreditPercent: Number(data.commissionCreditPercent ?? current.commissionCreditPercent),
      commissionDebitPercent: Number(data.commissionDebitPercent ?? current.commissionDebitPercent),
    };

    const updated = await prisma.platformSettings.upsert({
      where: { id: 'default' },
      update: {
        ...sanitized,
        updatedAt: new Date(),
      },
      create: {
        id: 'default',
        ...sanitized,
        updatedAt: new Date(),
      },
    });

    logger.success('Taxas da plataforma atualizadas com sucesso.');
    return updated;
  }

  /**
   * Calcula as taxas para um pagamento com base no método e na isenção da aplicação
   */
  async calculateFees(params: {
    amount: number;
    paymentMethod: string;
    isCommissionExempt: boolean;
  }): Promise<FeeCalculationResult> {
    const settings = await this.getSettings();
    const method = (params.paymentMethod || 'PIX').toUpperCase();
    const amount = Number(params.amount) || 0;

    let mpFeePercent = settings.mpPixFeePercent;
    let commissionPercent = settings.commissionPixPercent;

    if (method.includes('CREDIT') || method.includes('CREDITO')) {
      mpFeePercent = settings.mpCreditFeePercent;
      commissionPercent = settings.commissionCreditPercent;
    } else if (method.includes('DEBIT') || method.includes('DEBITO')) {
      mpFeePercent = settings.mpDebitFeePercent;
      commissionPercent = settings.commissionDebitPercent;
    }

    if (params.isCommissionExempt) {
      commissionPercent = 0;
    }

    const mpFeeAmount = Number(((amount * mpFeePercent) / 100).toFixed(2));
    const commissionAmount = params.isCommissionExempt ? 0 : Number(((amount * commissionPercent) / 100).toFixed(2));
    const totalFeeAmount = Number((mpFeeAmount + commissionAmount).toFixed(2));
    const netReceivedAmount = Number((amount - totalFeeAmount).toFixed(2));

    return {
      paymentMethod: method,
      amount,
      mpFeePercent,
      mpFeeAmount,
      commissionPercent,
      commissionAmount,
      isCommissionExempt: params.isCommissionExempt,
      totalFeeAmount,
      netReceivedAmount,
    };
  }

  /**
   * Simula o detalhamento financeiro para um valor em todos os métodos
   */
  async simulateBreakdown(amount: number) {
    const numAmount = Number(amount) || 100;
    const methods = ['PIX', 'CREDIT_CARD', 'DEBIT_CARD'];

    const regular: Record<string, FeeCalculationResult> = {};
    const exempt: Record<string, FeeCalculationResult> = {};

    for (const m of methods) {
      regular[m] = await this.calculateFees({
        amount: numAmount,
        paymentMethod: m,
        isCommissionExempt: false,
      });
      exempt[m] = await this.calculateFees({
        amount: numAmount,
        paymentMethod: m,
        isCommissionExempt: true,
      });
    }

    return {
      simulatedAmount: numAmount,
      regular,
      exempt,
    };
  }
}

export const feeService = new FeeService();
