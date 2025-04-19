// API请求处理函数和聚合搜索

async function handleApiRequest(url) {
    const customApi = url.searchParams.get('customApi') || '';
    const source = url.searchParams.get('source') || 'heimuer';

    try {
        // 搜索接口
        if (url.pathname === '/api/search') {
            const searchQuery = url.searchParams.get('wd');
            if (!searchQuery) throw new Error('缺少搜索参数');
            if (source === 'custom' && !customApi) throw new Error('使用自定义API时必须提供API地址');
            if (!API_SITES[source] && source !== 'custom') throw new Error('无效的API来源');

            const apiUrl = customApi
                ? `${customApi}${API_CONFIG.search.path}${encodeURIComponent(searchQuery)}`
                : `${API_SITES[source].api}${API_CONFIG.search.path}${encodeURIComponent(searchQuery)}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                const resp = await fetch(PROXY_URL + encodeURIComponent(apiUrl), {
                    headers: API_CONFIG.search.headers,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!resp.ok) throw new Error(`API请求失败: ${resp.status}`);
                const data = await resp.json();
                if (!data || !Array.isArray(data.list)) throw new Error('API返回的数据格式无效');
                data.list.forEach(item => {
                    item.source_name = source === 'custom' ? '自定义源' : (API_SITES[source] ? API_SITES[source].name : '');
                    item.source_code = source;
                    if (source === 'custom') item.api_url = customApi;
                });
                return JSON.stringify({ code: 200, list: data.list || [] });
            } catch (fetchError) {
                clearTimeout(timeoutId);
                throw fetchError;
            }
        }

        // 详情接口
        if (url.pathname === '/api/detail') {
            const id = url.searchParams.get('id');
            const sourceCode = url.searchParams.get('source') || 'heimuer';
            if (!id) throw new Error('缺少视频ID参数');
            if (!/^[\w-]+$/.test(id)) throw new Error('无效的视频ID格式');

            if (sourceCode === 'custom' && !customApi) throw new Error('使用自定义API时必须提供API地址');
            if (!API_SITES[sourceCode] && sourceCode !== 'custom') throw new Error('无效的API来源');

            if ((sourceCode === 'ffzy' || sourceCode === 'jisu' || sourceCode === 'huangcang') && API_SITES[sourceCode].detail) {
                return await handleSpecialSourceDetail(id, sourceCode);
            }
            if (sourceCode === 'custom' && url.searchParams.get('useDetail') === 'true') {
                return await handleCustomApiSpecialDetail(id, customApi);
            }

            const detailUrl = customApi
                ? `${customApi}${API_CONFIG.detail.path}${id}`
                : `${API_SITES[sourceCode].api}${API_CONFIG.detail.path}${id}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                const resp = await fetch(PROXY_URL + encodeURIComponent(detailUrl), {
                    headers: API_CONFIG.detail.headers,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!resp.ok) throw new Error(`详情请求失败: ${resp.status}`);
                const data = await resp.json();
                if (!data || !Array.isArray(data.list) || data.list.length === 0) throw new Error('获取到的详情内容无效');
                const videoDetail = data.list[0];
                let episodes = [];

                if (videoDetail.vod_play_url) {
                    const playSources = videoDetail.vod_play_url.split('$$$');
                    if (playSources.length > 0) {
                        const mainSource = playSources[0];
                        const episodeList = mainSource.split('#');
                        episodes = episodeList.map(ep => {
                            const parts = ep.split('$');
                            return parts.length > 1 ? parts[1] : '';
                        }).filter(url => url && /^https?:\/\//i.test(url));
                    }
                }
                if (episodes.length === 0 && videoDetail.vod_content) {
                    const matches = videoDetail.vod_content.match(M3U8_PATTERN) || [];
                    episodes = matches.map(link => link.replace(/^\$/, ''));
                }

                return JSON.stringify({
                    code: 200,
                    episodes,
                    detailUrl,
                    videoInfo: {
                        title: videoDetail.vod_name,
                        cover: videoDetail.vod_pic,
                        desc: videoDetail.vod_content,
                        type: videoDetail.type_name,
                        year: videoDetail.vod_year,
                        area: videoDetail.vod_area,
                        director: videoDetail.vod_director,
                        actor: videoDetail.vod_actor,
                        remarks: videoDetail.vod_remarks,
                        source_name: sourceCode === 'custom' ? '自定义源' : (API_SITES[sourceCode] ? API_SITES[sourceCode].name : ''),
                        source_code: sourceCode
                    }
                });
            } catch (fetchError) {
                clearTimeout(timeoutId);
                throw fetchError;
            }
        }

        throw new Error('未知的API路径');
    } catch (error) {
        console.error('API处理错误:', error);
        return JSON.stringify({
            code: 400,
            msg: error && error.message ? error.message : '请求处理失败',
            list: [],
            episodes: [],
        });
    }
}

// 自定义API特殊详情
async function handleCustomApiSpecialDetail(id, customApi) {
    try {
        const detailUrl = `${customApi}/index.php/vod/detail/id/${id}.html`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(PROXY_URL + encodeURIComponent(detailUrl), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`自定义API详情页请求失败: ${response.status}`);
        const html = await response.text();

        const generalPattern = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
        let matches = html.match(generalPattern) || [];
        matches = matches.map(link => {
            link = link.substring(1);
            const parenIndex = link.indexOf('(');
            return parenIndex > 0 ? link.substring(0, parenIndex) : link;
        });

        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        const descMatch = html.match(/<div[^>]*class=["']sketch["'][^>]*>([\s\S]*?)<\/div>/);
        return JSON.stringify({
            code: 200,
            episodes: matches,
            detailUrl,
            videoInfo: {
                title: titleMatch ? titleMatch[1].trim() : '',
                desc: descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').trim() : '',
                source_name: '自定义源',
                source_code: 'custom'
            }
        });
    } catch (error) {
        console.error(`自定义API详情获取失败:`, error);
        throw error;
    }
}

// 特殊资源（极速/非凡/黄色仓库等）支持，统一处理
async function handleSpecialSourceDetail(id, sourceCode) {
    try {
        const detailUrl = `${API_SITES[sourceCode].detail}/index.php/vod/detail/id/${id}.html`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(PROXY_URL + encodeURIComponent(detailUrl), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`详情页请求失败: ${response.status}`);
        const html = await response.text();

        let matches = [];
        if (sourceCode === 'ffzy') {
            const ffzyPattern = /\$(https?:\/\/[^"'\s]+?\/\d{8}\/\d+_[a-f0-9]+\/index\.m3u8)/g;
            matches = html.match(ffzyPattern) || [];
        }
        if (matches.length === 0) {
            const generalPattern = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
            matches = html.match(generalPattern) || [];
        }
        matches = [...new Set(matches)].map(link => {
            link = link.substring(1);
            const parenIndex = link.indexOf('(');
            return parenIndex > 0 ? link.substring(0, parenIndex) : link;
        });

        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        const descMatch = html.match(/<div[^>]*class=["']sketch["'][^>]*>([\s\S]*?)<\/div>/);

        return JSON.stringify({
            code: 200,
            episodes: matches,
            detailUrl,
            videoInfo: {
                title: titleMatch ? titleMatch[1].trim() : '',
                desc: descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').trim() : '',
                source_name: API_SITES[sourceCode] ? API_SITES[sourceCode].name : '',
                source_code: sourceCode
            }
        });
    } catch (error) {
        console.error(`${API_SITES[sourceCode]?.name || sourceCode}详情获取失败:`, error);
        throw error;
    }
}

// 聚合搜索
async function handleAggregatedSearch(searchQuery) {
    const availableSources = Object.keys(API_SITES).filter(key =>
        key !== 'aggregated' && key !== 'custom'
    );
    if (availableSources.length === 0) throw new Error('没有可用的API源');
    const searchPromises = availableSources.map(async (source) => {
        try {
            const apiUrl = `${API_SITES[source].api}${API_CONFIG.search.path}${encodeURIComponent(searchQuery)}`;
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`${source}源搜索超时`)), 8000)
            );
            const fetchPromise = fetch(PROXY_URL + encodeURIComponent(apiUrl), {
                headers: API_CONFIG.search.headers
            });
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            if (!response.ok) throw new Error(`${source}源请求失败: ${response.status}`);
            const data = await response.json();
            if (!data || !Array.isArray(data.list)) throw new Error(`${source}源返回的数据格式无效`);
            return data.list.map(item => ({
                ...item,
                source_name: API_SITES[source].name,
                source_code: source
            }));
        } catch (error) {
            console.warn(`${source}源搜索失败:`, error);
            return [];
        }
    });
    try {
        const resultsArray = await Promise.all(searchPromises);
        let allResults = [];
        resultsArray.forEach(results => {
            if (Array.isArray(results) && results.length > 0) allResults = allResults.concat(results);
        });
        if (allResults.length === 0) {
            return JSON.stringify({ code: 200, list: [], msg: '所有源均无搜索结果' });
        }
        // 去重
        const seen = new Set();
        const uniqueResults = allResults.filter(item => {
            const key = `${item.source_code}_${item.vod_id}`;
            if (!seen.has(key)) { seen.add(key); return true; }
            return false;
        });
        uniqueResults.sort((a, b) => {
            const nc = (a.vod_name || '').localeCompare(b.vod_name || '');
            if (nc !== 0) return nc;
            return (a.source_name || '').localeCompare(b.source_name || '');
        });
        return JSON.stringify({ code: 200, list: uniqueResults });
    } catch (error) {
        console.error('聚合搜索处理错误:', error);
        return JSON.stringify({ code: 400, msg: '聚合搜索处理失败: ' + error.message, list: [] });
    }
}

// 多自定义API聚合搜索
async function handleMultipleCustomSearch(searchQuery, customApiUrls) {
    const apiUrls = customApiUrls.split(CUSTOM_API_CONFIG.separator)
        .map(url => url.trim())
        .filter(url => url.length > 0 && /^https?:\/\//.test(url))
        .slice(0, CUSTOM_API_CONFIG.maxSources);
    if (apiUrls.length === 0) throw new Error('没有提供有效的自定义API地址');
    const searchPromises = apiUrls.map(async (apiUrl, index) => {
        try {
            const fullUrl = `${apiUrl}${API_CONFIG.search.path}${encodeURIComponent(searchQuery)}`;
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`自定义API ${index+1} 搜索超时`)), 8000)
            );
            const fetchPromise = fetch(PROXY_URL + encodeURIComponent(fullUrl), {
                headers: API_CONFIG.search.headers
            });
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            if (!response.ok) throw new Error(`自定义API ${index+1} 请求失败: ${response.status}`);
            const data = await response.json();
            if (!data || !Array.isArray(data.list)) throw new Error(`自定义API ${index+1} 返回的数据格式无效`);
            return data.list.map(item => ({
                ...item,
                source_name: `${CUSTOM_API_CONFIG.namePrefix}${index+1}`,
                source_code: 'custom',
                api_url: apiUrl
            }));
        } catch (error) {
            console.warn(`自定义API ${index+1} 搜索失败:`, error);
            return [];
        }
    });
    try {
        const resultsArray = await Promise.all(searchPromises);
        let allResults = [];
        resultsArray.forEach(results => {
            if (Array.isArray(results) && results.length > 0) allResults = allResults.concat(results);
        });
        if (allResults.length === 0) {
            return JSON.stringify({ code: 200, list: [], msg: '所有自定义API源均无搜索结果' });
        }
        // 去重
        const seen = new Set();
        const uniqueResults = allResults.filter(item => {
            const key = `${item.api_url || ''}_${item.vod_id}`;
            if (!seen.has(key)) { seen.add(key); return true; }
            return false;
        });
        return JSON.stringify({ code: 200, list: uniqueResults });
    } catch (error) {
        console.error('自定义API聚合搜索处理错误:', error);
        return JSON.stringify({ code: 400, msg: '自定义API聚合搜索处理失败: ' + error.message, list: [] });
    }
}

// 全局 fetch 拦截 hook
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        const requestUrl = typeof input === 'string' ? new URL(input, window.location.origin) : input.url;
        if (requestUrl.pathname.startsWith('/api/')) {
            if (window.isPasswordProtected && window.isPasswordVerified) {
                if (window.isPasswordProtected() && !window.isPasswordVerified()) return;
            }
            try {
                const data = await handleApiRequest(requestUrl);
                return new Response(data, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            } catch (error) {
                return new Response(JSON.stringify({ code: 500, msg: '服务器内部错误' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }
        return originalFetch.apply(this, arguments);
    };
})();

// 站点可用性测试
async function testSiteAvailability(apiUrl) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch('/api/search?wd=test&customApi=' + encodeURIComponent(apiUrl), {
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) return false;
        const data = await response.json();
        return data && data.code !== 400 && Array.isArray(data.list);
    } catch (error) {
        console.error('站点可用性测试失败:', error);
        return false;
    }
}
