const path = require('path');
const fs = require('fs');

/**
 * Lê e faz parse do arquivo .env da raiz do projeto para garantir
 * que o PM2 sempre inicialize o processo com as variáveis atualizadas do arquivo físico.
 */
function parseEnv(filePath) {
  const env = {};
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        // Remove aspas simples ou duplas ao redor do valor
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
  }
  return env;
}

const rootEnv = parseEnv(path.resolve(__dirname, '.env'));
const appName = rootEnv.APP_NAME || process.env.APP_NAME || 'Pays';

module.exports = {
  apps: [
    {
      name: appName,
      script: './dist/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 3000,
      autorestart: true,
      env: {
        NODE_ENV: rootEnv.NODE_ENV || 'production',
        PORT: rootEnv.PORT || 4020,
        ...rootEnv
      }
    }
  ]
};
