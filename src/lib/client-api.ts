export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (typeof options?.body === "string" && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers,
  });
  const result = await response
    .json()
    .catch(() => ({ error: "The server returned an unexpected response. Please try again." }));
  if (!response.ok)
    throw new ApiError(result.error ?? "Something went wrong. Please try again.", response.status);
  return result as T;
}
