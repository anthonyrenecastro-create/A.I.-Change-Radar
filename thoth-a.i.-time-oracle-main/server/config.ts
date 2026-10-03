export interface AppConfig {
  production: boolean;
  port: number;
  appUrl: string | null;
  databasePath: string;
  billingWebhookSecret: string;
  enableLab: boolean;
  /** Public read-only demo sessions in production must be opted into explicitly. */
  allowPublicDemo: boolean;
  seedDemoOnStart: boolean;
  trustProxy: boolean;
}

const PLACEHOLDER = /^(|changeme|change-me|MY_.*|your[-_].*|secret|test)$/i;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const production = env.NODE_ENV === 'production';
  const flag = (v: string | undefined, dflt: boolean) => (v === undefined ? dflt : v === 'true' || v === '1');
  const cfg: AppConfig = {
    production,
    port: Number(env.PORT ?? 3000),
    appUrl: env.APP_URL && !/^MY_/.test(env.APP_URL) ? env.APP_URL.replace(/\/$/, '') : null,
    databasePath: env.DATABASE_PATH ?? (production ? 'data/navigator.db' : 'data/navigator-dev.db'),
    billingWebhookSecret: env.BILLING_WEBHOOK_SECRET ?? '',
    enableLab: flag(env.ENABLE_LAB, !production),
    allowPublicDemo: flag(env.ALLOW_PUBLIC_DEMO, !production),
    seedDemoOnStart: flag(env.SEED_DEMO, !production),
    trustProxy: flag(env.TRUST_PROXY, false),
  };
  if (production) {
    const problems: string[] = [];
    if (PLACEHOLDER.test(cfg.billingWebhookSecret) || cfg.billingWebhookSecret.length < 24) problems.push('BILLING_WEBHOOK_SECRET must be set to a random value of at least 24 characters');
    if (!cfg.appUrl) problems.push('APP_URL must be set (used for origin checks and secure cookies)');
    if (cfg.enableLab) problems.push('ENABLE_LAB must not be true in production');
    if (problems.length) throw new Error(`Invalid production configuration:\n- ${problems.join('\n- ')}`);
  }
  return cfg;
}
