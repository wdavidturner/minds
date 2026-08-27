const OPERATOR_COOKIE = "operator";

export function readOperatorToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length);
  }

  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;

  for (const part of cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${OPERATOR_COOKIE}=`)) {
      return trimmed.slice(OPERATOR_COOKIE.length + 1);
    }
  }

  return null;
}

/**
 * Loop length depends only on the longer string, not on where the first
 * mismatch is, so comparing the operator token does not leak match length
 * through response timing the way `===` can.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < maxLength; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

export function isOperator(
  request: Request,
  token: string | undefined,
): boolean {
  if (!token) return false;
  const provided = readOperatorToken(request);
  if (provided === null) return false;
  return timingSafeEqual(provided, token);
}

export function unauthorized(): Response {
  return new Response(null, { status: 401 });
}

export function operatorCookieHeader(token: string): string {
  return `${OPERATOR_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax`;
}
