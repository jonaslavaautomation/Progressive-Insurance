// Vercel Routing Middleware: every request (pages, scripts, images, PDFs) must present valid
// credentials before any of the app is sent. Visitors without them get a 401 and never receive
// the JavaScript bundle, so there is nothing to inspect.
//
// Configure in Vercel → Project → Settings → Environment Variables (Production and Preview):
//   SITE_USERS = "alice:<sha256-hex-of-password>,bob:<sha256-hex>"   (one entry per trainee)
// Generate a hash with:  node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "the-password"
// Fails closed: if SITE_USERS is missing or empty, the site returns 503 instead of opening up.

export const config = { matcher: '/(.*)' };

const REALM = 'LAVA Training';
const encoder = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison so response timing doesn't reveal how much of a hash matched. */
function safeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return diff === 0;
}

function parseUsers(raw: string | undefined): Map<string, string> {
  const users = new Map<string, string>();
  for (const entry of (raw ?? '').split(',')) {
    const [name, hash] = entry.trim().split(':');
    if (name && /^[0-9a-f]{64}$/i.test(hash ?? '')) users.set(name, hash.toLowerCase());
  }
  return users;
}

const deny = (status: 401 | 503, message: string) => new Response(message, {
  status,
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(status === 401 ? { 'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"` } : {}),
  },
});

export default async function middleware(request: Request): Promise<Response> {
  const users = parseUsers(process.env.SITE_USERS);
  if (!users.size) return deny(503, 'LAVA Training access is not configured. Ask an administrator to set SITE_USERS.');
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Basic ')) return deny(401, 'Sign in to LAVA Training.');
  let decoded = '';
  try { decoded = atob(header.slice(6)); } catch { return deny(401, 'Sign in to LAVA Training.'); }
  const split = decoded.indexOf(':');
  const name = decoded.slice(0, split);
  const password = decoded.slice(split + 1);
  const expected = users.get(name) ?? '0'.repeat(64);
  const ok = split > 0 && safeEqual(await sha256Hex(password), expected) && users.has(name);
  if (!ok) return deny(401, 'Invalid user name or password.');
  // Continue to the static app (Vercel's "next()" for framework-agnostic middleware).
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}
