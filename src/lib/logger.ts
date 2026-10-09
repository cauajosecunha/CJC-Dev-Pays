type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'DEBUG';

function formatTimestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[${formatTimestamp()}] [INFO] ℹ️ ${message}`, meta ? JSON.stringify(meta) : '');
  },
  success: (message: string, meta?: any) => {
    console.log(`[${formatTimestamp()}] [SUCCESS] ✅ ${message}`, meta ? JSON.stringify(meta) : '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[${formatTimestamp()}] [WARN] ⚠️ ${message}`, meta ? JSON.stringify(meta) : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[${formatTimestamp()}] [ERROR] ❌ ${message}`, error || '');
  },
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${formatTimestamp()}] [DEBUG] 🔍 ${message}`, meta ? JSON.stringify(meta) : '');
    }
  },
};
