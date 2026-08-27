import { layout } from "./layout";

export function login(): string {
  return layout(
    "Login",
    `<h1>Login</h1>
<form method="post" action="/op/login">
  <label>Token <input type="password" name="token" required autofocus></label>
  <button>Login</button>
</form>`,
  );
}
