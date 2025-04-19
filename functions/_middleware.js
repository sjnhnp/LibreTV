import { sha256 } from '../js/sha256.js';

// Cloudflare Pages Middleware: 注入环境变量（如PASSWORD的HASH）到前端HTML
export async function onRequest(context) {
  const { request, env, next } = context;
  const response = await next();

  // 仅处理HTML类型
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    let html = await response.text();
    const password = env.PASSWORD || "";
    let passwordHash = "";
    if (password) {
      passwordHash = await sha256(password);
    }
    // 只做单点替换，防止无意间多处被影响
    html = html.replace(
      'window.__ENV__.PASSWORD = "{{PASSWORD}}";',
      `window.__ENV__.PASSWORD = "${passwordHash}"; // SHA-256 hash`
    );
    return new Response(html, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });
  }
  // 非HTML直接返回
  return response;
}
