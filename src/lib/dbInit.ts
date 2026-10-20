import { prisma } from './prisma.js';
import { logger } from './logger.js';
import bcrypt from 'bcryptjs';

/**
 * Inicializa e sincroniza automaticamente a estrutura do banco SQLite em runtime.
 * Garante que colunas adicionadas recentemente (ex: email em admin_users) existam
 * mesmo que o banco de produção não tenha executado 'prisma db push' manualmente.
 */
export async function initDatabase(): Promise<void> {
  try {
    // 1. Inspecionar colunas existentes na tabela admin_users
    const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info(admin_users)');
    const columnNames = columns.map((c) => c.name);

    if (columns.length === 0) {
      logger.info('Criando tabela `admin_users` no SQLite...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id TEXT PRIMARY KEY NOT NULL,
          email TEXT NOT NULL DEFAULT 'admin@cjcdev.com',
          username TEXT,
          passwordHash TEXT NOT NULL,
          name TEXT NOT NULL,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_key ON admin_users(email);');
      await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS admin_users_username_key ON admin_users(username);');
      logger.success('Tabela `admin_users` criada com sucesso.');
    } else if (!columnNames.includes('email')) {
      logger.info('Migração automática: Adicionando coluna `email` na tabela `admin_users`...');
      await prisma.$executeRawUnsafe("ALTER TABLE admin_users ADD COLUMN email TEXT DEFAULT 'admin@cjcdev.com';");
      await prisma.$executeRawUnsafe("UPDATE admin_users SET email = 'admin@cjcdev.com' WHERE email IS NULL OR email = '';");
      try {
        await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_key ON admin_users(email);');
      } catch (idxErr) {
        logger.warn('Aviso ao criar índice admin_users_email_key:', idxErr);
      }
      logger.success('Coluna `email` migrada e índice garantido em `admin_users`.');
    }

    // 2. Garantir que exista ao menos 1 usuário administrador se o banco estiver vazio
    const adminCount = await prisma.adminUser.count();
    if (adminCount === 0) {
      const defaultEmail = 'admin@cjcdev.com';
      const defaultUsername = 'admin';
      const defaultPassword = 'admin123';
      const defaultHash = await bcrypt.hash(defaultPassword, 10);

      await prisma.adminUser.create({
        data: {
          email: defaultEmail,
          username: defaultUsername,
          passwordHash: defaultHash,
          name: 'Administrador CJC',
        } as any,
      });
      logger.success(`Usuário administrador inicial criado (${defaultEmail}).`);
      logger.warn('⚠️ AVISO DE SEGURANÇA: Administrador inicial criado com a senha padrão "admin123". Altere imediatamente no painel!');
    }

    // 3. Garantir colunas na tabela applications
    const appColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info(applications)');
    const appColumnNames = appColumns.map((c) => c.name);

    if (appColumns.length > 0 && !appColumnNames.includes('isCommissionExempt')) {
      logger.info('Migração automática: Adicionando coluna `isCommissionExempt` na tabela `applications`...');
      await prisma.$executeRawUnsafe('ALTER TABLE applications ADD COLUMN isCommissionExempt BOOLEAN NOT NULL DEFAULT 0;');
      logger.success('Coluna `isCommissionExempt` adicionada com sucesso em `applications`.');
    }

    if (appColumns.length > 0 && !appColumnNames.includes('logoUrl')) {
      logger.info('Migração automática: Adicionando coluna `logoUrl` na tabela `applications`...');
      await prisma.$executeRawUnsafe('ALTER TABLE applications ADD COLUMN logoUrl TEXT;');
      logger.success('Coluna `logoUrl` adicionada com sucesso em `applications`.');
    }

    if (appColumns.length > 0 && !appColumnNames.includes('contactEmail')) {
      logger.info('Migração automática: Adicionando coluna `contactEmail` na tabela `applications`...');
      await prisma.$executeRawUnsafe('ALTER TABLE applications ADD COLUMN contactEmail TEXT;');
      logger.success('Coluna `contactEmail` adicionada com sucesso em `applications`.');
    }

    if (appColumns.length > 0 && !appColumnNames.includes('contactPhone')) {
      logger.info('Migração automática: Adicionando coluna `contactPhone` na tabela `applications`...');
      await prisma.$executeRawUnsafe('ALTER TABLE applications ADD COLUMN contactPhone TEXT;');
      logger.success('Coluna `contactPhone` adicionada com sucesso em `applications`.');
    }

    // 4. Garantir tabela platform_settings e registro padrão
    const settingsColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info(platform_settings)');
    if (settingsColumns.length === 0) {
      logger.info('Criando tabela `platform_settings` no SQLite...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS platform_settings (
          id TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
          mpPixFeePercent REAL NOT NULL DEFAULT 0.99,
          mpCreditFeePercent REAL NOT NULL DEFAULT 4.99,
          mpDebitFeePercent REAL NOT NULL DEFAULT 1.99,
          commissionPixPercent REAL NOT NULL DEFAULT 1.00,
          commissionCreditPercent REAL NOT NULL DEFAULT 2.00,
          commissionDebitPercent REAL NOT NULL DEFAULT 1.50,
          companyLegalName TEXT NOT NULL DEFAULT 'CJC Dev Soluções Tecnológicas',
          companyTradeName TEXT NOT NULL DEFAULT 'CJC Dev Pays',
          companyCnpj TEXT NOT NULL DEFAULT '',
          companyStateTaxId TEXT NOT NULL DEFAULT '',
          companyMunicipalTaxId TEXT NOT NULL DEFAULT '',
          companyAddress TEXT NOT NULL DEFAULT '',
          companyCityState TEXT NOT NULL DEFAULT '',
          companyZipCode TEXT NOT NULL DEFAULT '',
          companyEmail TEXT NOT NULL DEFAULT 'financeiro@cjcdev.com.br',
          companyPhone TEXT NOT NULL DEFAULT '',
          updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe(`
        INSERT OR IGNORE INTO platform_settings (
          id, mpPixFeePercent, mpCreditFeePercent, mpDebitFeePercent,
          commissionPixPercent, commissionCreditPercent, commissionDebitPercent,
          companyLegalName, companyTradeName, companyCnpj, companyStateTaxId,
          companyMunicipalTaxId, companyAddress, companyCityState, companyZipCode,
          companyEmail, companyPhone, updatedAt
        ) VALUES (
          'default', 0.99, 4.99, 1.99, 1.00, 2.00, 1.50,
          'CJC Dev Soluções Tecnológicas', 'CJC Dev Pays', '', '',
          '', '', '', '',
          'financeiro@cjcdev.com.br', '', CURRENT_TIMESTAMP
        );
      `);
      logger.success('Tabela `platform_settings` criada e configurada com valores padrão.');
    } else {
      const existingCols = settingsColumns.map((c) => c.name);
      const companyCols = [
        { name: 'companyLegalName', sql: "TEXT NOT NULL DEFAULT 'CJC Dev Soluções Tecnológicas'" },
        { name: 'companyTradeName', sql: "TEXT NOT NULL DEFAULT 'CJC Dev Pays'" },
        { name: 'companyCnpj', sql: "TEXT NOT NULL DEFAULT ''" },
        { name: 'companyStateTaxId', sql: "TEXT NOT NULL DEFAULT ''" },
        { name: 'companyMunicipalTaxId', sql: "TEXT NOT NULL DEFAULT ''" },
        { name: 'companyAddress', sql: "TEXT NOT NULL DEFAULT ''" },
        { name: 'companyCityState', sql: "TEXT NOT NULL DEFAULT ''" },
        { name: 'companyZipCode', sql: "TEXT NOT NULL DEFAULT ''" },
        { name: 'companyEmail', sql: "TEXT NOT NULL DEFAULT 'financeiro@cjcdev.com.br'" },
        { name: 'companyPhone', sql: "TEXT NOT NULL DEFAULT ''" },
      ];

      for (const col of companyCols) {
        if (!existingCols.includes(col.name)) {
          logger.info(`Migração automática: Adicionando coluna \`${col.name}\` na tabela \`platform_settings\`...`);
          await prisma.$executeRawUnsafe(`ALTER TABLE platform_settings ADD COLUMN ${col.name} ${col.sql};`);
        }
      }

      // Garantir que a linha 'default' exista
      await prisma.$executeRawUnsafe(`
        INSERT OR IGNORE INTO platform_settings (
          id, mpPixFeePercent, mpCreditFeePercent, mpDebitFeePercent,
          commissionPixPercent, commissionCreditPercent, commissionDebitPercent,
          companyLegalName, companyTradeName, companyCnpj, companyStateTaxId,
          companyMunicipalTaxId, companyAddress, companyCityState, companyZipCode,
          companyEmail, companyPhone, updatedAt
        ) VALUES (
          'default', 0.99, 4.99, 1.99, 1.00, 2.00, 1.50,
          'CJC Dev Soluções Tecnológicas', 'CJC Dev Pays', '', '',
          '', '', '', '',
          'financeiro@cjcdev.com.br', '', CURRENT_TIMESTAMP
        );
      `);
    }

    // 5. Garantir tabela report_audits
    const auditColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info(report_audits)');
    if (auditColumns.length === 0) {
      logger.info('Criando tabela `report_audits` no SQLite...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS report_audits (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT NOT NULL,
          periodLabel TEXT NOT NULL,
          applicationId TEXT,
          applicationName TEXT NOT NULL DEFAULT 'Consolidado Geral',
          grossVolume REAL NOT NULL,
          mpFeeVolume REAL NOT NULL,
          commissionVolume REAL NOT NULL,
          netPayoutVolume REAL NOT NULL,
          transactionsCount INTEGER NOT NULL DEFAULT 0,
          dataHash TEXT NOT NULL,
          issuedBy TEXT NOT NULL DEFAULT 'Administrador',
          issuedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS report_audits_code_key ON report_audits(code);');
      logger.success('Tabela `report_audits` criada com sucesso.');
    }
  } catch (error) {
    logger.error('Erro na inicialização/migração automática do banco SQLite:', error);
  }
}
