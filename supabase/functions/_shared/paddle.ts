import { Environment, Paddle, EventName } from 'npm:@paddle/paddle-node-sdk';

export { EventName };

export type PaddleEnv = 'sandbox' | 'live';

export type PaidPlan = 'starter' | 'pro';

const GATEWAY_BASE_URL = 'https://connector-gateway.lovable.dev/paddle';

export function getServerPaddleEnv(): PaddleEnv {
  const value = Deno.env.get('PAYMENTS_ENVIRONMENT');
  if (value !== 'sandbox' && value !== 'live') {
    throw new Error('PAYMENTS_ENVIRONMENT must be set to sandbox or live');
  }
  return value;
}

export function getPlanPriceId(env: PaddleEnv, plan: PaidPlan): string {
  const prefix = env === 'sandbox' ? 'PADDLE_SANDBOX' : 'PADDLE_LIVE';
  const key = `${prefix}_${plan.toUpperCase()}_PRICE_ID`;
  const priceId = Deno.env.get(key);
  if (!priceId || !/^pri_[a-z\d]{26}$/.test(priceId)) {
    throw new Error(`${key} must contain a valid Paddle price ID`);
  }
  return priceId;
}

export function getPlanForPriceId(env: PaddleEnv, priceId: string): PaidPlan | null {
  if (priceId === getPlanPriceId(env, 'starter')) return 'starter';
  if (priceId === getPlanPriceId(env, 'pro')) return 'pro';
  return null;
}

export function getConnectionApiKey(env: PaddleEnv): string {
  return env === 'sandbox'
    ? Deno.env.get('PADDLE_SANDBOX_API_KEY')!
    : Deno.env.get('PADDLE_LIVE_API_KEY')!;
}

export function getPaddleClient(env: PaddleEnv): Paddle {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

  return new Paddle(connectionApiKey, {
    environment: GATEWAY_BASE_URL as unknown as Environment,
    customHeaders: {
      'X-Connection-Api-Key': connectionApiKey,
      'Lovable-API-Key': lovableApiKey,
    },
  });
}

export async function gatewayFetch(env: PaddleEnv, path: string, init?: RequestInit): Promise<Response> {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  return fetch(`${GATEWAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Connection-Api-Key': connectionApiKey,
      'Lovable-API-Key': lovableApiKey,
      ...init?.headers,
    },
  });
}

export function getWebhookSecret(env: PaddleEnv): string {
  return env === 'sandbox'
    ? Deno.env.get('PAYMENTS_SANDBOX_WEBHOOK_SECRET')!
    : Deno.env.get('PAYMENTS_LIVE_WEBHOOK_SECRET')!;
}

export async function verifyWebhook(req: Request, env: PaddleEnv) {
  const signature = req.headers.get('paddle-signature');
  const body = await req.text();
  const secret = getWebhookSecret(env);

  if (!signature || !body) {
    throw new Error('Missing signature or body');
  }

  const paddle = getPaddleClient(env);
  return await paddle.webhooks.unmarshal(body, secret, signature);
}
