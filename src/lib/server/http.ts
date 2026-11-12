import * as z from "zod";

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** Safe, user-presentable error. Never includes stack traces or upstream detail. */
export function errorResponse(status: number, code: string, message: string, headers: HeadersInit = {}): Response {
  return json({ error: true, code, message }, status, headers);
}

export async function readJson(request: Request): Promise<unknown | typeof INVALID_JSON> {
  try {
    return await request.json();
  } catch {
    return INVALID_JSON;
  }
}
export const INVALID_JSON = Symbol("invalid-json");

export function validationError(err: z.ZodError): Response {
  const first = err.issues[0];
  const path = first?.path.join(".") || "body";
  return errorResponse(400, "invalid_request", `Invalid ${path}: ${first?.message ?? "bad value"}`);
}

export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "anonymous").trim();
}
