// Tin Tức 24H: static file server + restricted Dân Trí HTML proxy.
// Local: node server.js | GitHub Pages backend: deploy this service to Render.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const extraOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",").map((item) => item.trim()).filter(Boolean);
const allowedOrigins = new Set([
  "https://anh-a11y.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  ...extraOrigins
]);
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};
const isDanTriHost = (host) => host === "dantri.com.vn" || host.endsWith(".dantri.com.vn");

function send(res, status, body, type = "text/plain; charset=utf-8", additionalHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    ...additionalHeaders
  });
  res.end(body);
}

function sendApi(req, res, status, body, type = "application/json; charset=utf-8", extra = {}) {
  const origin = req.headers.origin || "";
  const cors = { "Vary": "Origin" };
  if (origin && isAllowedOrigin(origin)) {
    cors["Access-Control-Allow-Origin"] = origin;
    cors["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    cors["Access-Control-Allow-Headers"] = "Accept, Content-Type";
    cors["Access-Control-Max-Age"] = "86400";
  }
  return send(res, status, body, type, { ...cors, ...extra });
}

async function proxyFetch(req, requestUrl, res) {
  const origin = req.headers.origin || "";
  if (!isAllowedOrigin(origin)) {
    return sendApi(req, res, 403, JSON.stringify({ error: "Origin này chưa được phép gọi API. Hãy thêm vào CORS_ORIGINS trên dịch vụ backend." }));
  }
  if (req.method === "OPTIONS") {
    return sendApi(req, res, 204, "", "text/plain; charset=utf-8");
  }
  if (req.method !== "GET") {
    return sendApi(req, res, 405, JSON.stringify({ error: "Chỉ hỗ trợ GET." }));
  }
  const raw = requestUrl.searchParams.get("url");
  if (!raw) return sendApi(req, res, 400, JSON.stringify({ error: "Thiếu tham số url." }));

  let target;
  try { target = new URL(raw); }
  catch (_) { return sendApi(req, res, 400, JSON.stringify({ error: "URL không hợp lệ." })); }
  if (!/^https?:$/.test(target.protocol) || !isDanTriHost(target.hostname.toLowerCase())) {
    return sendApi(req, res, 400, JSON.stringify({ error: "Chỉ cho phép URL thuộc dantri.com.vn." }));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const upstream = await fetch(target.href, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });
    let finalUrl;
    try { finalUrl = new URL(upstream.url); }
    catch (_) { return sendApi(req, res, 502, JSON.stringify({ error: "Nguồn trả về URL không hợp lệ." })); }
    if (!isDanTriHost(finalUrl.hostname.toLowerCase())) {
      return sendApi(req, res, 502, JSON.stringify({ error: "Nguồn chuyển hướng sang tên miền không được phép." }));
    }
    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok) {
      return sendApi(req, res, upstream.status, JSON.stringify({
        error: `Dân Trí trả về HTTP ${upstream.status}. Trang có thể yêu cầu xác minh hoặc chặn crawler.`
      }));
    }
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return sendApi(req, res, 415, JSON.stringify({ error: `Nguồn không trả về HTML (${contentType}).` }));
    }
    const body = await upstream.text();
    return sendApi(req, res, 200, body, "text/html; charset=utf-8");
  } catch (error) {
    const message = error.name === "AbortError"
      ? "Quá thời gian chờ khi tải trang nguồn."
      : `Không kết nối được tới Dân Trí: ${error.message}`;
    return sendApi(req, res, 502, JSON.stringify({ error: message }));
  } finally {
    clearTimeout(timer);
  }
}


// Proxy ảnh từ CDN Dân Trí để trang GitHub Pages có thể hiển thị ảnh.
// Chỉ cho phép CDN cụ thể nhằm tránh biến endpoint thành open proxy.
async function proxyImage(req, requestUrl, res) {
  const origin = req.headers.origin || "";

  if (!isAllowedOrigin(origin)) {
    return sendApi(req, res, 403, JSON.stringify({ error: "Origin này chưa được phép gọi API." }));
  }

  if (req.method === "OPTIONS") {
    return sendApi(req, res, 204, "", "text/plain; charset=utf-8");
  }

  if (req.method !== "GET") {
    return sendApi(req, res, 405, JSON.stringify({ error: "Chỉ hỗ trợ GET." }));
  }

  const raw = requestUrl.searchParams.get("url");
  if (!raw) {
    return sendApi(req, res, 400, JSON.stringify({ error: "Thiếu tham số url." }));
  }

  let target;
  try {
    target = new URL(raw);
  } catch (_) {
    return sendApi(req, res, 400, JSON.stringify({ error: "URL ảnh không hợp lệ." }));
  }

  if (target.protocol !== "https:" || target.hostname.toLowerCase() !== "cdnphoto.dantri.com.vn") {
    return sendApi(req, res, 400, JSON.stringify({ error: "Chỉ cho phép ảnh HTTPS từ cdnphoto.dantri.com.vn." }));
  }

  let referer = "https://dantri.com.vn/";
  const requestedReferer = requestUrl.searchParams.get("referer");
  if (requestedReferer) {
    try {
      const parsedReferer = new URL(requestedReferer);
      if (isDanTriHost(parsedReferer.hostname.toLowerCase())) {
        referer = parsedReferer.href;
      }
    } catch (_) {
      // Giữ referer mặc định nếu query không hợp lệ.
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const upstream = await fetch(target.href, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Referer": referer
      }
    });

    if (!upstream.ok) {
      return sendApi(req, res, upstream.status, JSON.stringify({
        error: `CDN ảnh Dân Trí trả về HTTP ${upstream.status}.`
      }));
    }

    let finalUrl;
    try {
      finalUrl = new URL(upstream.url);
    } catch (_) {
      return sendApi(req, res, 502, JSON.stringify({ error: "Nguồn ảnh trả về URL không hợp lệ." }));
    }

    if (finalUrl.protocol !== "https:" || finalUrl.hostname.toLowerCase() !== "cdnphoto.dantri.com.vn") {
      return sendApi(req, res, 502, JSON.stringify({ error: "Ảnh chuyển hướng sang máy chủ không được phép." }));
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return sendApi(req, res, 415, JSON.stringify({ error: "Nguồn không trả về dữ liệu ảnh." }));
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length > 8 * 1024 * 1024) {
      return sendApi(req, res, 413, JSON.stringify({ error: "Ảnh vượt quá giới hạn 8 MB." }));
    }

    return sendApi(req, res, 200, bytes, contentType, {
      "Cache-Control": "public, max-age=3600"
    });
  } catch (error) {
    const message = error.name === "AbortError"
      ? "Tải ảnh quá thời gian chờ."
      : `Không kết nối được tới CDN ảnh Dân Trí: ${error.message}`;
    return sendApi(req, res, 502, JSON.stringify({ error: message }));
  } finally {
    clearTimeout(timer);
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (requestUrl.pathname === "/healthz") {
    return send(res, 200, JSON.stringify({ ok: true, service: "news-website-crawler-api" }), "application/json; charset=utf-8");
  }
  if (requestUrl.pathname === "/api/fetch") return proxyFetch(req, requestUrl, res);
  if (requestUrl.pathname === "/api/image") return proxyImage(req, requestUrl, res);
  if (req.method === "OPTIONS") return send(res, 204, "");
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");

  let pathname;
  try { pathname = decodeURIComponent(requestUrl.pathname); }
  catch (_) { return send(res, 400, "Bad URL"); }
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(ROOT, `.${pathname}`);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, "index.html")) {
    return send(res, 403, "Forbidden");
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, "Not found");
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "X-Content-Type-Options": "nosniff" });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Tin Tức 24H đang chạy tại http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/healthz`);
  console.log("Nhấn Ctrl+C để dừng máy chủ.");
});
