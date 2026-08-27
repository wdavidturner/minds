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

export function isOperator(
  request: Request,
  token: string | undefined,
): boolean {
  if (!token) return false;
  return readOperatorToken(request) === token;
}

export function unauthorized(): Response {
  return new Response(null, { status: 401 });
}

export function operatorCookieHeader(token: string): string {
  return `${OPERATOR_COOKIE}=${token}; Path=/; HttpOnly`;
}
