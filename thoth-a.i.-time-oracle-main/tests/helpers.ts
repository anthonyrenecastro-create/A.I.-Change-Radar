import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app';
import { loadConfig, type AppConfig } from '../server/config';
import { openDb, type Db } from '../server/db';

let ipCounter = 1;

export class Client {
  cookie = '';
  ip = `10.0.0.${ipCounter++}`;
  constructor(public base: string) {}
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(`${this.base}${path}`, {
      method, headers: { 'content-type': 'application/json', 'x-forwarded-for': this.ip, ...(this.cookie ? { cookie: this.cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0].includes('=;') ? '' : set.split(';')[0];
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, body: json as any };
  }
  get = (p: string) => this.req('GET', p);
  post = (p: string, b?: unknown) => this.req('POST', p, b ?? {});
  put = (p: string, b: unknown) => this.req('PUT', p, b);
  patch = (p: string, b: unknown) => this.req('PATCH', p, b);
  del = (p: string) => this.req('DELETE', p);
}

export async function startTestApp(overrides: Partial<AppConfig> = {}) {
  const config: AppConfig = { ...loadConfig({ NODE_ENV: 'test' } as NodeJS.ProcessEnv), trustProxy: true, billingWebhookSecret: 'test-webhook-secret-0123456789abcdef', ...overrides };
  const db: Db = openDb(':memory:');
  const app = createApp(db, config);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', () => r()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  return { db, config, base, client: () => new Client(base), close: () => new Promise<void>(r => server.close(() => r())) };
}

export const PASSWORD = 'correct horse battery';
export async function registerTenant(c: Client, email: string, org = 'Org') {
  const r = await c.post('/auth/register', { email, password: PASSWORD, organization: org });
  if (r.status !== 201) throw new Error(`register failed ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

export const wfBody = (over: Record<string, unknown> = {}) => ({ name: 'WF', criticality: 'medium', vendor: 'Demo AI Vendor', model: 'demo-chat-large', ...over });
