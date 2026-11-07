/** Cap streamed UTF-8 bytes before parsing, regardless of the Content-Length header. */
export async function readBoundedText(request: Request, maxBytes: number): Promise<string> {
  if (Number(request.headers.get("content-length")) > maxBytes) {
    throw new RangeError("Request body too large");
  }
  if (!request.body) throw new SyntaxError("Missing request body");

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new RangeError("Request body too large");
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  return JSON.parse(await readBoundedText(request, maxBytes));
}
