// functions/proxy/[[path]].js

// --- 配置 (现在从 Cloudflare 环境变量读取) ---
// 在 Cloudflare Pages 设置 -> 函数 -> 环境变量绑定 中设置以下变量:
// CACHE_TTL (例如 86400)
// MAX_RECURSION (例如 5)
// FILTER_DISCONTINUITY (不再需要，设为 false 或移除)
// USER_AGENTS_JSON (例如 ["UA1", "UA2"]) - JSON 字符串数组
// DEBUG (例如 false 或 true)
// --- 配置结束 ---

// functions/proxy/[[path]].js

// 常量
const MEDIA_FILE_EXTENSIONS = [
    '.mp4', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.f4v', '.m4v', '.3gp', '.3g2', '.ts', '.mts', '.m2ts',
    '.mp3', '.wav', '.ogg', '.aac', '.m4a', '.flac', '.wma', '.alac', '.aiff', '.opus',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg', '.avif', '.heic'
];
const MEDIA_CONTENT_TYPES = ['video/', 'audio/', 'image/'];

export async function onRequest(context) {
    const { request, env, next, waitUntil } = context;
    const url = new URL(request.url);

    // ----- 配置读取 -----
    const DEBUG_ENABLED = (env.DEBUG === 'true');
    const CACHE_TTL = parseInt(env.CACHE_TTL || '86400', 10);
    const MAX_RECURSION = parseInt(env.MAX_RECURSION || '5', 10);

    let USER_AGENTS = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    try {
        if (env.USER_AGENTS_JSON) {
            const agents = JSON.parse(env.USER_AGENTS_JSON);
            if (Array.isArray(agents) && agents.length > 0) {
                USER_AGENTS = agents;
            } else {
                logDebug("环境变量 USER_AGENTS_JSON 格式无效或为空，使用默认值");
            }
        }
    } catch (e) {
        logDebug(`解析 USER_AGENTS_JSON 失败: ${e.message}`);
    }

    // ----- 工具函数 -----

    function logDebug(msg) {
        if (DEBUG_ENABLED) console.log(`[Proxy Func] ${msg}`);
    }

    function getTargetUrlFromPath(pathname) {
        // 路径格式: /proxy/经过编码的URL
        const encodedUrl = pathname.replace(/^\/proxy\//, '');
        if (!encodedUrl) return null;
        try {
            let decodedUrl = decodeURIComponent(encodedUrl);
            if (!/^https?:\/\//i.test(decodedUrl)) {
                if (/^https?:\/\//i.test(encodedUrl)) {
                    decodedUrl = encodedUrl;
                    logDebug(`Path not encoded but looks like URL: ${decodedUrl}`);
                } else {
                    logDebug(`无效的URL(解码后): ${decodedUrl}`); return null;
                }
            }
            return decodedUrl;
        } catch (e) {
            logDebug(`目标URL解码异常: ${encodedUrl} - ${e.message}`); return null;
        }
    }

    function createResponse(body, status = 200, headers = {}) {
        const h = new Headers(headers);
        h.set("Access-Control-Allow-Origin", "*");
        h.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
        h.set("Access-Control-Allow-Headers", "*");
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: h });
        }
        return new Response(body, { status, headers: h });
    }

    function createM3u8Response(content) {
        return createResponse(content, 200, {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": `public, max-age=${CACHE_TTL}`,
        });
    }

    function getRandomUserAgent() {
        return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    }

    function getBaseUrl(urlStr) {
        try {
            const u = new URL(urlStr);
            return u.pathname === '/' || !u.pathname
                ? `${u.origin}/`
                : `${u.origin}${u.pathname.split('/').slice(0, -1).join('/')}/`;
        } catch (e) {
            logDebug(`BaseUrl计算异常: ${urlStr}, ${e.message}`);
            const idx = urlStr.lastIndexOf('/');
            return idx > urlStr.indexOf('://') + 2 ? urlStr.substring(0, idx + 1) : urlStr + '/';
        }
    }

    function resolveUrl(baseUrl, relUrl) {
        if (/^https?:\/\//i.test(relUrl)) return relUrl;
        try { return new URL(relUrl, baseUrl).toString(); }
        catch (e) {
            if (relUrl.startsWith('/')) {
                try { const urlObj = new URL(baseUrl); return `${urlObj.origin}${relUrl}`; }
                catch { }
            }
            return `${baseUrl.replace(/\/[^/]*$/, '/')}${relUrl}`;
        }
    }

    function rewriteUrlToProxy(targetUrl) {
        return `/proxy/${encodeURIComponent(targetUrl)}`;
    }

    async function fetchContentWithType(targetUrl) {
        const headers = new Headers({
            'User-Agent': getRandomUserAgent(),
            'Accept': '*/*',
            'Accept-Language': request.headers.get('Accept-Language') || 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': request.headers.get('Referer') || new URL(targetUrl).origin,
        });
        try {
            logDebug(`fetch: ${targetUrl}`);
            const resp = await fetch(targetUrl, { headers, redirect: 'follow' });
            if (!resp.ok) {
                logDebug(`请求失败: ${resp.status} ${resp.statusText} - ${targetUrl}`);
                throw new Error(`HTTP error ${resp.status}: ${resp.statusText}. URL: ${targetUrl}`);
            }
            const content = await resp.text();
            const contentType = resp.headers.get('Content-Type') || '';
            logDebug(`请求成功: ${targetUrl}, Content-Type: ${contentType}, 长度: ${content.length}`);
            return { content, contentType, responseHeaders: resp.headers };
        } catch (error) {
            logDebug(`彻底失败: ${targetUrl}: ${error.message}`);
            throw new Error(`目标URL失败 ${targetUrl}: ${error.message}`);
        }
    }

    function isM3u8Content(content, contentType) {
        if (contentType && (
            contentType.includes('application/vnd.apple.mpegurl') ||
            contentType.includes('application/x-mpegurl') ||
            contentType.includes('audio/mpegurl')
        )) return true;
        return content && typeof content === 'string' && content.trim().startsWith('#EXTM3U');
    }

    function processKeyLine(line, baseUrl) {
        return line.replace(/URI="([^"]+)"/, (_, uri) => {
            const abs = resolveUrl(baseUrl, uri);
            logDebug(`处理KEY URI: ${uri} -> ${abs}`);
            return `URI="${rewriteUrlToProxy(abs)}"`;
        });
    }

    function processMapLine(line, baseUrl) {
        return line.replace(/URI="([^"]+)"/, (_, uri) => {
            const abs = resolveUrl(baseUrl, uri);
            logDebug(`处理MAP URI: ${uri} -> ${abs}`);
            return `URI="${rewriteUrlToProxy(abs)}"`;
        });
    }

    function processMediaPlaylist(url, content) {
        const baseUrl = getBaseUrl(url);
        const lines = content.split('\n');
        const output = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line && i === lines.length - 1) { output.push(line); continue; }
            if (!line) continue;
            if (line.startsWith('#EXT-X-KEY')) { output.push(processKeyLine(line, baseUrl)); continue; }
            if (line.startsWith('#EXT-X-MAP')) { output.push(processMapLine(line, baseUrl)); continue; }
            if (line.startsWith('#EXTINF')) { output.push(line); continue; }
            if (!line.startsWith('#')) {
                const absUrl = resolveUrl(baseUrl, line);
                logDebug(`片段: ${line} -> ${absUrl}`);
                output.push(rewriteUrlToProxy(absUrl));
                continue;
            }
            output.push(line);
        }
        return output.join('\n');
    }

    async function processM3u8Content(targetUrl, content, recursionDepth = 0, env) {
        if (content.includes('#EXT-X-STREAM-INF') || content.includes('#EXT-X-MEDIA:')) {
            logDebug(`主播放列表: ${targetUrl}`);
            return await processMasterPlaylist(targetUrl, content, recursionDepth, env);
        }
        logDebug(`媒体播放列表: ${targetUrl}`);
        return processMediaPlaylist(targetUrl, content);
    }

    async function processMasterPlaylist(url, content, recursionDepth, env) {
        if (recursionDepth > MAX_RECURSION) {
            throw new Error(`递归过深 (${MAX_RECURSION}): ${url}`);
        }
        const baseUrl = getBaseUrl(url);
        const lines = content.split('\n');
        let highestBandwidth = -1, bestVariantUrl = '';
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                const bw = lines[i].match(/BANDWIDTH=(\d+)/);
                const curBw = bw ? parseInt(bw[1], 10) : 0;
                let variantUriLine = '';
                for (let j = i + 1; j < lines.length; j++) {
                    const l = lines[j].trim(); if (l && !l.startsWith('#')) { variantUriLine = l; i = j; break; }
                }
                if (variantUriLine && curBw >= highestBandwidth) {
                    highestBandwidth = curBw;
                    bestVariantUrl = resolveUrl(baseUrl, variantUriLine);
                }
            }
        }
        if (!bestVariantUrl) {
            logDebug(`没有找到BANDWIDTH，尝试首个m3u8子列表`);
            for (let i = 0; i < lines.length; i++) {
                const l = lines[i].trim();
                if (l && !l.startsWith('#') && (l.endsWith('.m3u8') || l.includes('.m3u8?'))) {
                    bestVariantUrl = resolveUrl(baseUrl, l);
                    logDebug(`备选: ${bestVariantUrl}`); break;
                }
            }
        }
        if (!bestVariantUrl) {
            logDebug(`主列表无有效子列表，尝试作为媒体列表`);
            return processMediaPlaylist(url, content);
        }
        const cacheKey = `m3u8_processed:${bestVariantUrl}`;
        let kvNamespace = null;
        try { kvNamespace = env.LIBRETV_PROXY_KV; } catch (e) { logDebug(`KV命名空间访问异常: ${e.message}`);}
        if (kvNamespace) {
            try {
                const cached = await kvNamespace.get(cacheKey);
                if (cached) {
                    logDebug(`[缓存命中] 子列表: ${bestVariantUrl}`);
                    return cached;
                } else { logDebug(`[缓存miss] 子列表: ${bestVariantUrl}`);}
            } catch (kvError) { logDebug(`KV读缓存失败(${cacheKey}): ${kvError.message}`);}
        }
        logDebug(`子列表(带宽${highestBandwidth}): ${bestVariantUrl}`);
        const { content: variantContent, contentType } = await fetchContentWithType(bestVariantUrl);
        if (!isM3u8Content(variantContent, contentType)) {
            logDebug(`${bestVariantUrl} 不是M3U8,类型:${contentType}。作为媒体列表处理。`);
            return processMediaPlaylist(bestVariantUrl, variantContent);
        }
        const processed = await processM3u8Content(bestVariantUrl, variantContent, recursionDepth + 1, env);
        if (kvNamespace) {
            try { waitUntil(kvNamespace.put(cacheKey, processed, { expirationTtl: CACHE_TTL })); logDebug(`子列表写入缓存:${bestVariantUrl}`);}
            catch (kvError) { logDebug(`写入KV缓存失败(${cacheKey}): ${kvError.message}`);}
        }
        return processed;
    }

    // ----- 主要请求处理 -----
    try {
        const targetUrl = getTargetUrlFromPath(url.pathname);
        if (!targetUrl) {
            logDebug(`无效代理路径:${url.pathname}`);
            return createResponse("无效的代理请求。路径应为 /proxy/<经过编码的URL>", 400);
        }
        logDebug(`收到代理请求: ${targetUrl}`);

        // ----- KV缓存检查 -----
        const cacheKey = `proxy_raw:${targetUrl}`;
        let kvNamespace = null;
        try { kvNamespace = env.LIBRETV_PROXY_KV; } catch (e) { logDebug(`KV命名空间访问异常: ${e.message}`); }
        if (kvNamespace) {
            try {
                const cachedJson = await kvNamespace.get(cacheKey);
                if (cachedJson) {
                    logDebug(`[缓存命中] 原始内容:${targetUrl}`);
                    const cachedData = JSON.parse(cachedJson);
                    const content = cachedData.body;
                    let headers = {};
                    try { headers = JSON.parse(cachedData.headers); } catch {}
                    const contentType = headers['content-type'] || headers['Content-Type'] || '';
                    if (isM3u8Content(content, contentType)) {
                        logDebug(`缓存内容为M3U8，重新处理:${targetUrl}`);
                        const processed = await processM3u8Content(targetUrl, content, 0, env);
                        return createM3u8Response(processed);
                    } else {
                        logDebug(`缓存返回非M3U8:${targetUrl}`);
                        return createResponse(content, 200, new Headers(headers));
                    }
                } else { logDebug(`[缓存miss] 原始内容:${targetUrl}`);}
            } catch (kvError) { logDebug(`KV读/解析缓存失败(${cacheKey}):${kvError.message}`);}
        }

        // ----- 真实请求 -----
        const { content, contentType, responseHeaders } = await fetchContentWithType(targetUrl);

        // ----- KV写入 -----
        if (kvNamespace) {
            try {
                const headersToCache = {};
                responseHeaders.forEach((value, key) => { headersToCache[key.toLowerCase()] = value; });
                const cacheValue = { body: content, headers: JSON.stringify(headersToCache) };
                waitUntil(kvNamespace.put(cacheKey, JSON.stringify(cacheValue), { expirationTtl: CACHE_TTL }));
                logDebug(`写入原始内容缓存: ${targetUrl}`);
            } catch (kvError) { logDebug(`KV写缓存失败(${cacheKey}):${kvError.message}`);}
        }

        // ----- 响应处理 -----
        if (isM3u8Content(content, contentType)) {
            logDebug(`内容为M3U8,处理: ${targetUrl}`);
            const processed = await processM3u8Content(targetUrl, content, 0, env);
            return createM3u8Response(processed);
        } else {
            logDebug(`直接返回: ${targetUrl},类型:${contentType}`);
            const finalHeaders = new Headers(responseHeaders);
            finalHeaders.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
            finalHeaders.set("Access-Control-Allow-Origin", "*");
            finalHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
            finalHeaders.set("Access-Control-Allow-Headers", "*");
            return createResponse(content, 200, finalHeaders);
        }

    } catch (error) {
        logDebug(`严重错误: ${error.message}\n${error.stack}`);
        return createResponse(`代理处理错误: ${error.message}`, 500);
    }
}

// OPTIONS (CORS预检)
export async function onOptions(context) {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
        },
    });
}
