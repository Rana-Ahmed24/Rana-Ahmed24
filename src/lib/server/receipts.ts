import "server-only";
import { HttpError } from "./http";

const WORKER_URL =
  process.env.R2_RECEIPT_WORKER_URL ?? "https://expenses-receipts.ziadamrid.workers.dev";
const MAX_RECEIPT_BYTES = 3 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function objectUrl(expenseId: string, key: string): string {
  const prefix = `receipts/${expenseId}/`;
  const filename = key.startsWith(prefix) ? key.slice(prefix.length) : "";
  if (!UUID_PATTERN.test(expenseId) || !/^[0-9a-f-]{36}\.jpg$/i.test(filename))
    throw new HttpError(404, "This receipt is unavailable.");
  return `${WORKER_URL}/receipts/${expenseId}/${filename}`;
}

export async function uploadReceipt(file: File, expenseId: string): Promise<string> {
  if (
    !UUID_PATTERN.test(expenseId) ||
    file.type !== "image/jpeg" ||
    file.size < 4 ||
    file.size > MAX_RECEIPT_BYTES
  )
    throw new HttpError(400, "Use a JPEG receipt photo smaller than 3 MB.");

  const bytes = await file.arrayBuffer();
  const signature = new Uint8Array(bytes, 0, 3);
  if (signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff)
    throw new HttpError(400, "That file is not a valid receipt photo.");

  const key = `receipts/${expenseId}/${crypto.randomUUID()}.jpg`;
  let response: Response;
  try {
    response = await fetch(objectUrl(expenseId, key), {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: bytes,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new HttpError(503, "Receipt storage is temporarily unavailable. Please try again.");
  }
  if (!response.ok)
    throw new HttpError(503, "Receipt storage could not save this photo. Please try again.");
  return key;
}

export async function getReceipt(expenseId: string, key: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(objectUrl(expenseId, key), {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new HttpError(503, "Receipt storage is temporarily unavailable. Please try again.");
  }
  if (response.status === 404) throw new HttpError(404, "This receipt is unavailable.");
  if (!response.ok)
    throw new HttpError(503, "Receipt storage could not load this photo. Please try again.");
  return response;
}

export async function deleteReceipt(expenseId: string, key: string): Promise<void> {
  try {
    const response = await fetch(objectUrl(expenseId, key), {
      method: "DELETE",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok && response.status !== 404)
      console.error("Receipt cleanup failed", { status: response.status });
  } catch {
    console.error("Receipt cleanup failed", { type: "NetworkError" });
  }
}
