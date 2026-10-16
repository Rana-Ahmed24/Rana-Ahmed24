import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { readJson, requireSameOrigin } from "../src/lib/server/http";

function request(origin: string | undefined, host = "127.0.0.1:3100", extras = {}) {
  return new NextRequest(`http://${host}/api/access`, {
    method: "POST",
    headers: { host, "content-type": "application/json", ...(origin ? { origin } : {}), ...extras },
    body: "{}",
  });
}
describe("mutation request boundaries", () => {
  it("accepts loopback Host even if NextURL normalizes it", () => {
    expect(() => requireSameOrigin(request("http://127.0.0.1:3100"))).not.toThrow();
    expect(() =>
      requireSameOrigin(request("http://localhost:3100", "localhost:3100")),
    ).not.toThrow();
  });
  it("rejects missing/cross origins, forwarded-host spoofing, and non-JSON requests", () => {
    expect(() => requireSameOrigin(request(undefined))).toThrow();
    expect(() =>
      requireSameOrigin(
        request("https://evil.example", undefined, { "x-forwarded-host": "evil.example" }),
      ),
    ).toThrow();
    expect(() =>
      requireSameOrigin(
        request("http://127.0.0.1:3100", undefined, { "sec-fetch-site": "cross-site" }),
      ),
    ).toThrow();
    expect(() =>
      requireSameOrigin(
        request("http://127.0.0.1:3100", undefined, { "content-type": "text/plain" }),
      ),
    ).toThrow();
  });
  it("rejects oversized streaming bodies and invalid JSON", async () => {
    await expect(
      readJson(
        new NextRequest("http://localhost/api/access", { method: "POST", body: "x".repeat(9000) }),
      ),
    ).rejects.toThrow(/too much text/);
    await expect(
      readJson(
        new NextRequest("http://localhost/api/access", { method: "POST", body: "not json" }),
      ),
    ).rejects.toThrow(/Invalid request/);
  });
});
