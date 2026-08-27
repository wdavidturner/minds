import { describe, expect, it } from "vitest";
import {
  isOperator,
  operatorCookieHeader,
  readOperatorToken,
  unauthorized,
} from "../src/auth";

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/", { headers });
}

describe("readOperatorToken", () => {
  it("reads Bearer token", () => {
    expect(readOperatorToken(req({ Authorization: "Bearer secret" }))).toBe(
      "secret",
    );
  });

  it("reads operator cookie", () => {
    expect(readOperatorToken(req({ Cookie: "operator=secret" }))).toBe(
      "secret",
    );
  });

  it("parses cookie among others", () => {
    expect(
      readOperatorToken(req({ Cookie: "foo=bar; operator=secret; baz=qux" })),
    ).toBe("secret");
  });

  it("returns null when missing", () => {
    expect(readOperatorToken(req())).toBeNull();
  });
});

describe("isOperator", () => {
  const secret = "secret";

  it("accepts Bearer match", () => {
    expect(isOperator(req({ Authorization: "Bearer secret" }), secret)).toBe(
      true,
    );
  });

  it("accepts cookie match", () => {
    expect(isOperator(req({ Cookie: "operator=secret" }), secret)).toBe(true);
  });

  it("rejects wrong token", () => {
    expect(isOperator(req({ Authorization: "Bearer wrong" }), secret)).toBe(
      false,
    );
    expect(isOperator(req({ Cookie: "operator=wrong" }), secret)).toBe(false);
  });

  it("rejects missing credentials", () => {
    expect(isOperator(req(), secret)).toBe(false);
  });

  it("rejects empty env token", () => {
    expect(
      isOperator(req({ Authorization: "Bearer secret" }), undefined),
    ).toBe(false);
    expect(isOperator(req({ Authorization: "Bearer secret" }), "")).toBe(false);
    expect(isOperator(req({ Cookie: "operator=secret" }), "")).toBe(false);
  });
});

describe("unauthorized", () => {
  it("returns 401", () => {
    expect(unauthorized().status).toBe(401);
  });
});

describe("operatorCookieHeader", () => {
  it("sets operator cookie with path", () => {
    const header = operatorCookieHeader("secret");
    expect(header).toContain("operator=secret");
    expect(header).toContain("Path=/");
  });

  it("sets SameSite so the cookie is not sent cross-site", () => {
    expect(operatorCookieHeader("secret")).toMatch(/SameSite=Lax/i);
  });

  it("sets Secure on HTTPS cookies", () => {
    expect(operatorCookieHeader("secret", { secure: true })).toMatch(/;\s*Secure(?:;|$)/);
  });
});
