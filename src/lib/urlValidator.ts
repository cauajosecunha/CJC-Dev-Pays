import { config } from '../config/env.js';

/**
 * Valida se uma URL externa é segura para requisições de webhook e callbacks (Proteção contra SSRF).
 * Bloqueia protocolos inseguros e destinos em redes internas, loopback ou metadados de provedores de nuvem.
 */
export function isSafeUrl(urlString?: string | null, allowLocalhostInDev = true): boolean {
  if (!urlString || typeof urlString !== 'string') return false;

  try {
    const parsed = new URL(urlString.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Em ambiente de desenvolvimento, permite localhost para testes de webhook locais se explicitado
    if (allowLocalhostInDev && config.nodeEnv !== 'production') {
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return true;
      }
    }

    // Bloquear localhost e loopback
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0'
    ) {
      return false;
    }

    // Bloquear metadados de nuvem (AWS, GCP, DigitalOcean, Azure) e domínios locais
    if (
      hostname === '169.254.169.254' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return false;
    }

    // Bloquear IPv4 de faixas privadas:
    // 10.0.0.0/8
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;

    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    const match172 = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (match172) {
      const secondOctet = parseInt(match172[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return false;
    }

    // 192.168.0.0/16
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;

    // 169.254.0.0/16 (Link-local)
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;

    return true;
  } catch {
    return false;
  }
}
