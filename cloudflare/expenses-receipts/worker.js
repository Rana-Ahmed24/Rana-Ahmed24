const MAX_RECEIPT_BYTES = 3 * 1024 * 1024;
const RECEIPT_PATH = /^\/receipts\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg)$/i;

function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return json({ ok: true });

    const match = url.pathname.match(RECEIPT_PATH);
    if (!match) return json({ error: "Not found" }, 404);

    const key = `receipts/${match[1]}/${match[2]}`;
    if (request.method === "PUT") {
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "image/jpeg")
        return json({ error: "JPEG images only" }, 415);
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength < 4 || bytes.byteLength > MAX_RECEIPT_BYTES)
        return json({ error: "Receipt photo is too large" }, 413);
      const signature = new Uint8Array(bytes, 0, 3);
      if (signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff)
        return json({ error: "Invalid image" }, 400);
      const object = await env.RECEIPTS.put(key, bytes, {
        httpMetadata: { contentType: "image/jpeg", contentDisposition: "inline" },
      });
      return json({ key: object.key, size: object.size }, 201);
    }

    if (request.method === "GET") {
      const object = await env.RECEIPTS.get(key);
      if (!object) return json({ error: "Not found" }, 404);
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("ETag", object.httpEtag);
      headers.set("Cache-Control", "private, no-store");
      headers.set("Content-Disposition", "inline; filename=receipt.jpg");
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(object.body, { headers });
    }

    if (request.method === "DELETE") {
      await env.RECEIPTS.delete(key);
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }

    return json({ error: "Method not allowed" }, 405);
  },
};
