export interface BoundedOfficialResponseOptions {
  maxBytes: number;
  contentType: RegExp;
  contentTypeError: string;
  tooLargeError: string;
}

export async function readBoundedOfficialResponseText(
  response: Response,
  options: BoundedOfficialResponseOptions
) {
  const type = response.headers.get("content-type") ?? "";
  if (!options.contentType.test(type)) {
    throw new Error(`${options.contentTypeError}:${type.slice(0, 80)}`);
  }
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > options.maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(options.tooLargeError);
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > options.maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(options.tooLargeError);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}
