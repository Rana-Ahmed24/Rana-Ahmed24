import { afterEach, beforeAll, vi } from "vitest";
beforeAll(() => {
  // Unit tests never receive live project credentials or access the network.
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network disabled in unit tests");
    }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
});
