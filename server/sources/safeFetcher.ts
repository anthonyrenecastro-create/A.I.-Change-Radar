import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

export interface SafeFetchResult {
  status: number;
  finalUrl: string;
  body: string;
  etag?: string;
  lastModified?: string;
}

const MAX_RESPONSE_SIZE = 2 * 1024 * 1024; // 2MB limit
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

/**
 * Checks if an IPv4 or IPv6 address is private, loopback, link-local, or multicast (SSRF prevention).
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  // IPv6 loopback and unspecified
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
    return true;
  }

  // IPv4 mapped IPv6
  if (ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }

  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(isNaN)) {
    return true; // Malformed or unrecognized IP
  }

  const [b0, b1] = parts;

  // 0.0.0.0/8
  if (b0 === 0) return true;
  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;
  // 10.0.0.0/8 (Private)
  if (b0 === 10) return true;
  // 172.16.0.0/12 (Private)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (b0 === 192 && b1 === 168) return true;
  // 169.254.0.0/16 (Link-local / AWS metadata service)
  if (b0 === 169 && b1 === 254) return true;
  // 224.0.0.0/4 (Multicast)
  if (b0 >= 224) return true;

  return false;
}

/**
 * Safely fetches a public URL with SSRF protection, size caps, and timeouts.
 */
export async function safeFetch(
  targetUrl: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    redirectCount?: number;
    allowedDomains?: string[];
  } = {}
): Promise<SafeFetchResult> {
  const redirectCount = options.redirectCount ?? 0;
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error(`Too many redirects (limit ${MAX_REDIRECTS})`);
  }

  const parsedUrl = new URL(targetUrl);
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only http and https are allowed.`);
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // If specific domain whitelist is supplied, enforce it
  if (options.allowedDomains && options.allowedDomains.length > 0) {
    const isAllowed = options.allowedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
    if (!isAllowed) {
      throw new Error(`Domain ${hostname} is not in the allowed sources whitelist.`);
    }
  }

  // Resolve DNS to verify IP is not internal / private
  try {
    const lookups = await dns.lookup(hostname, { all: true });
    for (const entry of lookups) {
      if (isPrivateOrReservedIp(entry.address)) {
        throw new Error(`Access to private, loopback, or metadata IP (${entry.address}) is strictly blocked.`);
      }
    }
  } catch (err: any) {
    if (err.message.includes('strictly blocked')) {
      throw err;
    }
    throw new Error(`DNS resolution failed for hostname ${hostname}: ${err.message}`);
  }

  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const reqHeaders: Record<string, string> = {
      'User-Agent': 'AIChangeRadar-Monitor/1.0 (+https://aichangeradar.com/bot; bot@aichangeradar.com)',
      Accept: 'text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'identity', // avoid compressed stream complications
      ...(options.headers || {}),
    };

    const req = client.get(
      parsedUrl,
      {
        headers: reqHeaders,
        timeout: timeoutMs,
      },
      (res) => {
        // Handle Redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).toString();
          res.resume(); // discard response
          return safeFetch(redirectUrl, {
            ...options,
            redirectCount: redirectCount + 1,
          })
            .then(resolve)
            .catch(reject);
        }

        const etag = res.headers.etag as string | undefined;
        const lastModified = res.headers['last-modified'] as string | undefined;

        let totalBytes = 0;
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > MAX_RESPONSE_SIZE) {
            req.destroy(new Error(`Response exceeded maximum size limit of ${MAX_RESPONSE_SIZE} bytes`));
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          resolve({
            status: res.statusCode || 200,
            finalUrl: targetUrl,
            body,
            etag,
            lastModified,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}
