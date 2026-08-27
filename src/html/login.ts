import { matchesOperatorToken, operatorCookieHeader } from "../auth";
import { escapeHtml, layout } from "./layout";

export function login(options: { error?: string } = {}): string {
  const error = options.error
    ? `<p class="error" role="alert">${escapeHtml(options.error)}</p>`
    : "";
  return layout(
    "Login",
    `<h1>Login</h1>
${error}
<form method="post" action="/login">
  <label>Token <input type="password" name="token" required autofocus></label>
  <button>Login</button>
</form>`,
  );
}

export function loginPostResponse(
  submitted: string,
  expected: string | undefined,
  secure: boolean,
): Response {
  if (!matchesOperatorToken(submitted, expected)) {
    return new Response(login({ error: "That token is not valid." }), {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/",
      "Set-Cookie": operatorCookieHeader(submitted, { secure }),
    },
  });
}
