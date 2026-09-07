import { pushTestMessages, type PushTestKind } from "./pushTestMessages";

/** Ordinary users can only send a fixed diagnostic to a token they already own. */
export function pushTestRequest(body: unknown, isAdmin: boolean): { kind: PushTestKind; token: string | null } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const kind = input.kind ?? "default";
  if (!pushTestMessages.some(message => message.kind === kind) || (!isAdmin && kind !== "default")) return null;
  const token = typeof input.token === "string" && input.token.length >= 20 && input.token.length <= 4096 && /^[A-Za-z0-9_:.-]+$/.test(input.token) ? input.token : null;
  if ((!isAdmin || input.token !== undefined) && !token) return null;
  return { kind: kind as PushTestKind, token };
}
