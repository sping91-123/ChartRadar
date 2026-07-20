export async function readOptionalJson<T>(response: Response, label: string): Promise<T | null> {
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`${label} returned a non-JSON response (${contentType || "unknown content type"}).`);
  }
  return response.json() as Promise<T>;
}
