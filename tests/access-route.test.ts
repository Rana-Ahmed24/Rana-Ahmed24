import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST, DELETE } from "../src/app/api/access/route";
afterEach(() => vi.unstubAllEnvs());
describe("open access compatibility endpoint", () => {
  it("does not require a key or cookie and issues no login cookie", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).authorized).toBe(true);
    expect(response.headers.get("set-cookie")).toBeNull();
    for (const [method, handler] of [
      ["POST", POST],
      ["DELETE", DELETE],
    ] as const) {
      const req = new NextRequest("https://family.example/api/access", {
        method,
        headers: {
          host: "family.example",
          origin: "https://family.example",
          "content-type": "application/json",
        },
        body: "{}",
      });
      const result = await handler(req);
      expect((await result.json()).authorized).toBe(true);
      expect(result.headers.get("set-cookie")).toBeNull();
    }
  });
  it("reports database configuration independently of removed access secrets", async () => {
    vi.stubEnv("SUPABASE_URL", "https://test.example");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-only");
    expect(await (await GET()).json()).toEqual({ authorized: true, configured: true });
  });
});
