import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados CJC-Dev-Pays...');

  // 1. Criar Usuário Administrador
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@cjcdev.com';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(adminPassword, salt);

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash, username: adminUsername, name: 'Administrador CJC Dev' },
    create: {
      email: adminEmail,
      username: adminUsername,
      passwordHash,
      name: 'Administrador CJC Dev',
    },
  });
  console.log(`✅ Administrador configurado: ${admin.email} (${admin.username})`);

  // 2. Aplicações Iniciais do Ecossistema
  const initialApps = [
    {
      name: 'Sua Loja Delivery',
      slug: 'sua-loja',
      apiKey: 'cjc_live_sualoja_9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c',
      webhookUrl: 'http://localhost/Sua_Loja/api/webhook/cjc-pays.php',
      webhookSecret: 'whsec_sualoja_4d7e9a1b2c3f5e6a8d0b2c4e6f8a0b2d',
    },
    {
      name: 'Seu Salão',
      slug: 'seu-salao',
      apiKey: 'cjc_live_seusalao_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
      webhookUrl: 'http://localhost/Seu_Salao/api/webhook/cjc-pays.php',
      webhookSecret: 'whsec_seusalao_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d',
    },
    {
      name: 'FaceCraft Portal & Loja',
      slug: 'facecraft',
      apiKey: 'cjc_live_facecraft_5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
      webhookUrl: 'http://localhost/FaceCraft/api/webhook/cjc-pays.php',
      webhookSecret: 'whsec_facecraft_3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f',
    },
  ];

  for (const app of initialApps) {
    const apiKeyHash = crypto.createHash('sha256').update(app.apiKey).digest('hex');

    const created = await prisma.application.upsert({
      where: { slug: app.slug },
      update: {
        name: app.name,
        apiKey: app.apiKey,
        apiKeyHash,
        webhookUrl: app.webhookUrl,
        webhookSecret: app.webhookSecret,
        isActive: true,
      },
      create: {
        name: app.name,
        slug: app.slug,
        apiKey: app.apiKey,
        apiKeyHash,
        webhookUrl: app.webhookUrl,
        webhookSecret: app.webhookSecret,
        isActive: true,
      },
    });

    console.log(`✅ Aplicação configurada: ${created.name} (${created.slug})`);
    console.log(`   🔑 API Key: ${app.apiKey}`);
    console.log(`   🛡️ Webhook Secret: ${app.webhookSecret}`);
  }

  console.log('🎉 Seed finalizado com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
