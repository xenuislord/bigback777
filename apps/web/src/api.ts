export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: any,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  data?: unknown,
  method = data === undefined ? "GET" : "POST",
): Promise<T> {
  let r: Response;
  try {
    r = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Hearth-Request": "1" },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      signal: AbortSignal.timeout(path === "/chat" ? 100000 : 25000),
    });
  } catch {
    throw new APIError(
      "Host unavailable. Cached recipes and shopping edits are still available.",
      0,
      null,
    );
  }
  const result = await r.json();
  if (!r.ok)
    throw new APIError(
      result.error || "Request failed",
      r.status,
      result.details,
    );
  return result;
}
