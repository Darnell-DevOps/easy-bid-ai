/** Cap streamed bytes before parsing, regardless of the Content-Length header. */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBytes) {
    throw new RangeError("Request body too large");
  }
  if (!request.body) throw new SyntaxError("Missing JSON body");

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let json = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new RangeError("Request body too large");
      json += decoder.decode(value, { stream: true });
    }
    return JSON.parse(json + decoder.decode());
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
