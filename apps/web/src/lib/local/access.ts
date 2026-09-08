export function localRequestAllowed(request: Request): boolean {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return false;
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)) return false;
  const origin = request.headers.get("origin");
  if (origin && origin !== `${url.protocol}//${host}`) return false;
  return request.headers.get("sec-fetch-site") !== "cross-site";
}
