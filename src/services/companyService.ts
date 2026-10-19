import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { initDatabase } from '../lib/dbInit.js';

export interface CompanySettings {
  companyLegalName: string;
  companyTradeName: string;
  companyCnpj: string;
  companyStateTaxId: string;
  companyMunicipalTaxId: string;
  companyAddress: string;
  companyCityState: string;
  companyZipCode: string;
  companyEmail: string;
  companyPhone: string;
  updatedAt?: Date;
}

export class CompanyService {
  private defaultCompany: CompanySettings = {
    companyLegalName: 'CJC Dev Soluções Tecnológicas',
    companyTradeName: 'CJC Dev Pays',
    companyCnpj: '',
    companyStateTaxId: '',
    companyMunicipalTaxId: '',
    companyAddress: '',
    companyCityState: '',
    companyZipCode: '',
    companyEmail: 'financeiro@cjcdev.com.br',
    companyPhone: '',
  };

  /**
   * Obtém as configurações cadastrais e fiscais da empresa
   */
  async getSettings(): Promise<CompanySettings> {
    try {
      const record = await prisma.platformSettings.findUnique({
        where: { id: 'default' },
      });

      if (!record) {
        return this.defaultCompany;
      }

      return {
        companyLegalName: record.companyLegalName || this.defaultCompany.companyLegalName,
        companyTradeName: record.companyTradeName || this.defaultCompany.companyTradeName,
        companyCnpj: record.companyCnpj || '',
        companyStateTaxId: record.companyStateTaxId || '',
        companyMunicipalTaxId: record.companyMunicipalTaxId || '',
        companyAddress: record.companyAddress || '',
        companyCityState: record.companyCityState || '',
        companyZipCode: record.companyZipCode || '',
        companyEmail: record.companyEmail || this.defaultCompany.companyEmail,
        companyPhone: record.companyPhone || '',
        updatedAt: record.updatedAt,
      };
    } catch (error: any) {
      logger.warn('Erro ao buscar dados fiscais da empresa, acionando auto-migração:', error?.message);
      try {
        await initDatabase();
        const record = await prisma.platformSettings.findUnique({
          where: { id: 'default' },
        });
        if (record) {
          return {
            companyLegalName: record.companyLegalName || this.defaultCompany.companyLegalName,
            companyTradeName: record.companyTradeName || this.defaultCompany.companyTradeName,
            companyCnpj: record.companyCnpj || '',
            companyStateTaxId: record.companyStateTaxId || '',
            companyMunicipalTaxId: record.companyMunicipalTaxId || '',
            companyAddress: record.companyAddress || '',
            companyCityState: record.companyCityState || '',
            companyZipCode: record.companyZipCode || '',
            companyEmail: record.companyEmail || this.defaultCompany.companyEmail,
            companyPhone: record.companyPhone || '',
            updatedAt: record.updatedAt,
          };
        }
      } catch (retryError) {
        logger.error('Falha ao obter dados fiscais após auto-migração:', retryError);
      }
      return this.defaultCompany;
    }
  }

  /**
   * Atualiza as configurações cadastrais e fiscais da empresa
   */
  async updateSettings(data: Partial<CompanySettings>): Promise<CompanySettings> {
    const current = await this.getSettings();

    const sanitized = {
      companyLegalName: String(data.companyLegalName ?? current.companyLegalName).trim(),
      companyTradeName: String(data.companyTradeName ?? current.companyTradeName).trim(),
      companyCnpj: String(data.companyCnpj ?? current.companyCnpj).trim(),
      companyStateTaxId: String(data.companyStateTaxId ?? current.companyStateTaxId).trim(),
      companyMunicipalTaxId: String(data.companyMunicipalTaxId ?? current.companyMunicipalTaxId).trim(),
      companyAddress: String(data.companyAddress ?? current.companyAddress).trim(),
      companyCityState: String(data.companyCityState ?? current.companyCityState).trim(),
      companyZipCode: String(data.companyZipCode ?? current.companyZipCode).trim(),
      companyEmail: String(data.companyEmail ?? current.companyEmail).trim(),
      companyPhone: String(data.companyPhone ?? current.companyPhone).trim(),
    };

    let updated;
    try {
      updated = await prisma.platformSettings.upsert({
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
    } catch (error: any) {
      logger.warn('Erro ao atualizar configurações fiscais, acionando auto-migração do SQLite:', error?.message);
      await initDatabase();
      updated = await prisma.platformSettings.upsert({
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
    }

    logger.success('Dados cadastrais e fiscais da empresa atualizados com sucesso.');

    return {
      companyLegalName: updated.companyLegalName,
      companyTradeName: updated.companyTradeName,
      companyCnpj: updated.companyCnpj,
      companyStateTaxId: updated.companyStateTaxId,
      companyMunicipalTaxId: updated.companyMunicipalTaxId,
      companyAddress: updated.companyAddress,
      companyCityState: updated.companyCityState,
      companyZipCode: updated.companyZipCode,
      companyEmail: updated.companyEmail,
      companyPhone: updated.companyPhone,
      updatedAt: updated.updatedAt,
    };
  }
}

export const companyService = new CompanyService();
