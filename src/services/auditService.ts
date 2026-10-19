import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { companyService } from './companyService.js';
import { logger } from '../lib/logger.js';
import { initDatabase } from '../lib/dbInit.js';

export interface RegisterAuditParams {
  periodLabel: string;
  applicationId?: string;
  applicationName?: string;
  grossVolume: number;
  mpFeeVolume: number;
  commissionVolume: number;
  netPayoutVolume: number;
  transactionsCount?: number;
  issuedBy?: string;
}

export interface ReportValidationResult {
  valid: boolean;
  message: string;
  audit?: {
    code: string;
    periodLabel: string;
    applicationName: string;
    grossVolume: number;
    mpFeeVolume: number;
    commissionVolume: number;
    netPayoutVolume: number;
    transactionsCount: number;
    dataHash: string;
    issuedBy: string;
    issuedAt: Date;
    company: {
      legalName: string;
      tradeName: string;
      cnpj: string;
      email: string;
      phone: string;
      cityState: string;
    };
  };
}

export class AuditService {
  /**
   * Gera um código de autenticação único no padrão CJC-FIN-YYYYMM-XXXXX
   */
  private generateAuditCode(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
    return `CJC-FIN-${yearMonth}-${randomHex}`;
  }

  /**
   * Registra a emissão oficial de um relatório contábil no banco de dados para auditoria pública
   */
  async registerReportAudit(params: RegisterAuditParams) {
    const code = this.generateAuditCode();
    const now = new Date();

    // Gera um hash SHA-256 criptográfico para garantir a integridade dos valores do balancete
    const hashPayload = [
      code,
      params.periodLabel,
      params.applicationName || 'Consolidado Geral',
      params.grossVolume.toFixed(2),
      params.mpFeeVolume.toFixed(2),
      params.commissionVolume.toFixed(2),
      params.netPayoutVolume.toFixed(2),
      now.toISOString(),
    ].join('|');

    const dataHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    const auditData = {
      code,
      periodLabel: params.periodLabel || 'Período Consolidado',
      applicationId: params.applicationId || null,
      applicationName: params.applicationName || 'Consolidado Geral (Todas as Aplicações)',
      grossVolume: Number(params.grossVolume || 0),
      mpFeeVolume: Number(params.mpFeeVolume || 0),
      commissionVolume: Number(params.commissionVolume || 0),
      netPayoutVolume: Number(params.netPayoutVolume || 0),
      transactionsCount: Number(params.transactionsCount || 0),
      dataHash,
      issuedBy: params.issuedBy || 'Administrador do Sistema',
      issuedAt: now,
    };

    let audit;
    try {
      audit = await prisma.reportAudit.create({ data: auditData });
    } catch (error: any) {
      logger.warn('Erro ao registrar auditoria, acionando auto-migração:', error?.message);
      await initDatabase();
      audit = await prisma.reportAudit.create({ data: auditData });
    }

    logger.info(`Relatório contábil registrado para auditoria com código ${code}`);

    return audit;
  }

  /**
   * Valida publicamente a autenticidade de um documento contábil a partir de seu código
   */
  async validateReport(code: string): Promise<ReportValidationResult> {
    const cleanCode = (code || '').trim().toUpperCase();

    if (!cleanCode) {
      return {
        valid: false,
        message: 'Código de autenticação não informado.',
      };
    }

    let audit = null;
    try {
      audit = await prisma.reportAudit.findUnique({
        where: { code: cleanCode },
      });
    } catch (error: any) {
      logger.warn('Erro ao consultar relatório de auditoria, acionando auto-migração:', error?.message);
      await initDatabase();
      audit = await prisma.reportAudit.findUnique({
        where: { code: cleanCode },
      });
    }

    if (!audit) {
      return {
        valid: false,
        message: 'Código de autenticação não localizado. Este documento não foi emitido ou foi alterado.',
      };
    }

    const company = await companyService.getSettings();

    return {
      valid: true,
      message: 'Documento contábil autêntico e verificado pela Central CJC Dev Pays.',
      audit: {
        code: audit.code,
        periodLabel: audit.periodLabel,
        applicationName: audit.applicationName,
        grossVolume: audit.grossVolume,
        mpFeeVolume: audit.mpFeeVolume,
        commissionVolume: audit.commissionVolume,
        netPayoutVolume: audit.netPayoutVolume,
        transactionsCount: audit.transactionsCount,
        dataHash: audit.dataHash,
        issuedBy: audit.issuedBy,
        issuedAt: audit.issuedAt,
        company: {
          legalName: company.companyLegalName,
          tradeName: company.companyTradeName,
          cnpj: company.companyCnpj,
          email: company.companyEmail,
          phone: company.companyPhone,
          cityState: company.companyCityState,
        },
      },
    };
  }
}

export const auditService = new AuditService();
