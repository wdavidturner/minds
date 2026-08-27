import { describe, expect, it } from "vitest";
import { operatorCookieHeader } from "../src/auth";
import { login, loginPostResponse } from "../src/html/login";

describe("login form", () => {
  it("posts back to /login, not a separate /op/login URL", () => {
    const html = login();
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/login"');
    expect(html).not.toContain("/op/login");
  });

  it("shows an error on the same page when login fails", () => {
    const html = login({ error: "That token is not valid." });
    expect(html).toContain("That token is not valid.");
    expect(html).toContain('action="/login"');
  });
});

describe("loginPostResponse", () => {
  it("rejects a wrong token with the login page still at 401", async () => {
    const response = loginPostResponse("wrong", "secret", false);
    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toMatch(/text\/html/);
    expect(await response.text()).toContain("That token is not valid.");
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("sets the operator cookie and redirects home on a match", () => {
    const response = loginPostResponse("secret", "secret", true);
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/");
    expect(response.headers.get("Set-Cookie")).toBe(
      operatorCookieHeader("secret", { secure: true }),
    );
  });
});
