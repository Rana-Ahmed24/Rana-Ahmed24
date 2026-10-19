import "server-only";
import { NextRequest, NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(value: unknown, status = 200): NextResponse {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function requireSameOrigin(
  req: NextRequest,
  contentTypes: string[] = ["application/json"],
): void {
  const origin = req.headers.get("origin");
  // NextURL normalizes loopback hosts to localhost. Compare the browser's
  // actual Host instead; never trust a caller-supplied x-forwarded-host.
  const expected = new URL(req.url);
  const host = req.headers.get("host");
  if (host) expected.host = host;
  if (origin !== expected.origin || req.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "Please submit changes from this website.");
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentTypes.some((type) => contentType.startsWith(type)))
    throw new HttpError(415, "Use the expense form to submit this change.");
}
export async function readJson(req: NextRequest): Promise<unknown> {
  // Bound streamed bodies too; Content-Length can be absent or dishonest.
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new HttpError(413, "This expense contains too much text.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid request. Please try again.");
  }
}
export async function readExpenseSubmission(
  req: NextRequest,
): Promise<{ value: unknown; receipt: File | null }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.startsWith("application/json"))
    return { value: await readJson(req), receipt: null };
  if (!contentType.startsWith("multipart/form-data"))
    throw new HttpError(415, "Use the expense form to submit this change.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "This expense form could not be read. Please try again.");
  }
  const rawExpense = form.get("expense");
  if (typeof rawExpense !== "string") throw new HttpError(400, "Enter the expense details.");

  let value: unknown;
  try {
    value = JSON.parse(rawExpense);
  } catch {
    throw new HttpError(400, "Invalid expense details. Please try again.");
  }

  const rawReceipt = form.get("receipt");
  if (rawReceipt !== null && !(rawReceipt instanceof File))
    throw new HttpError(400, "Choose a receipt photo to upload.");
  return { value, receipt: rawReceipt };
}
export function fail(error: unknown): NextResponse {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  // Do not log request bodies, cookies, connection URLs, or database errors.
  console.error("Expense request failed", {
    type: error instanceof Error ? error.name : "UnknownError",
  });
  return json(
    {
      error:
        "Couldn't reach the expense database. Your changes have not been confirmed. Please try again.",
    },
    503,
  );
}
export function invalid(message: string): never {
  throw new HttpError(400, message);
}
