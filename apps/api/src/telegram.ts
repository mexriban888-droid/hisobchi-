import crypto from 'node:crypto';

export type TelegramUser = { id: number; username?: string; first_name?: string; last_name?: string; language_code?: string };
export function verifyInitData(initData: string, token: string, maxAgeSeconds: number): TelegramUser {
  const params = new URLSearchParams(initData); const hash = params.get('hash'); const authDate = Number(params.get('auth_date'));
  if (!hash || !authDate || Math.abs(Date.now() / 1000 - authDate) > maxAgeSeconds) throw new Error('Telegram authorization expired');
  params.delete('hash'); const check = [...params.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const digest = crypto.createHmac('sha256', secret).update(check).digest('hex');
  const expected = Buffer.from(digest, 'hex'); const actual = Buffer.from(hash, 'hex');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(expected, actual)) throw new Error('Invalid Telegram signature');
  const raw = params.get('user'); if (!raw) throw new Error('Telegram user missing'); return JSON.parse(raw) as TelegramUser;
}
