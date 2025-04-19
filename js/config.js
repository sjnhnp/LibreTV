// js/config.js - Global constants and configuration settings

// Proxy URL configuration (Update if deployment environment changes)
const PROXY_URL = '/proxy/'; // Relative path for Cloudflare Pages, Vercel with rewrites, etc.

// Local Storage Keys (Reverted to original names for compatibility)
const SEARCH_HISTORY_KEY = 'videoSearchHistory';     // Reverted from _v2
const VIEWING_HISTORY_KEY = 'viewingHistory';       // Assuming original was 'viewingHistory' or similar without suffix
const CUSTOM_APIS_KEY = 'customAPIs';               // Reverted from _v2
const SELECTED_APIS_KEY = 'selectedAPIs';           // Reverted from _v2
const PASSWORD_STORAGE_KEY = 'passwordVerified';    // Reverted from 'passwordVerification_v2' to match original logic
const AUTOPLAY_KEY = 'autoplayEnabled';
const AD_FILTERING_KEY = 'adFilteringEnabled';     // Reverted from _v2 to match original player config usage
const EPISODE_REVERSE_KEY = 'episodesReversed';
const HAS_INITIALIZED_DEFAULTS_KEY = 'hasInitializedDefaults'; // Reverted from _v1
const HAS_SEEN_DISCLAIMER_KEY = 'hasSeenDisclaimer';       // Reverted from _v1

// History Limits
// Using optimized variable name, but reverted value to original for search history compatibility
const MAX_SEARCH_HISTORY_ITEMS = 5;  // Reverted value from 10 to 5 (original MAX_HISTORY_ITEMS)
const MAX_VIEWING_HISTORY_ITEMS = 50; // Keep optimized value for viewing history

// Password Protection Configuration
const PASSWORD_CONFIG = {
    localStorageKey: PASSWORD_STORAGE_KEY, // Uses the corrected key constant above
    verificationTTL: 90 * 24 * 60 * 60 * 1000, // 90 days in milliseconds
};

// Site Information
const SITE_CONFIG = {
    name: 'LibreTV',
    url: 'https://libretv.is-an.org', // Update if domain changes
    description: '免费在线视频搜索与观看平台',
    logo: 'https://images.icon-icons.com/38/PNG/512/retrotv_5520.png', // Consider hosting locally
    version: '1.0.4' // Update version as needed (Kept from optimization)
};

// Built-in API Site Definitions
// 'adult': true marks potentially sensitive content sources
// 'detail': URL base for sites requiring HTML scraping for details (optional)
const API_SITES = {
    // --- Regular Sources ---
    heimuer:   { api: 'https://json.heimuer.xyz', name: '黑木耳', detail: 'https://heimuer.tv' },
    ffzy:      { api: 'http://ffzy5.tv', name: '非凡影视', detail: 'http://ffzy5.tv' }, // Note: HTTP
    tyyszy:    { api: 'https://tyyszy.com', name: '天涯资源' },
    zy360:     { api: 'https://360zy.com', name: '360资源' },
    wolong:    { api: 'https://wolongzyw.com', name: '卧龙资源' },
    cjhw:      { api: 'https://cjhwba.com', name: '新华为' },
    hwba:      { api: 'https://cjwba.com', name: '华为吧资源' },
    jisu:      { api: 'https://jszyapi.com', name: '极速资源', detail: 'https://jszyapi.com' },
    dbzy:      { api: 'https://dbzy.com', name: '豆瓣资源' },
    bfzy:      { api: 'https://bfzyapi.com', name: '暴风资源' },
    mozhua:    { api: 'https://mozhuazy.com', name: '魔爪资源' },
    mdzy:      { api: 'https://www.mdzyapi.com', name: '魔都资源' },
    ruyi:      { api: 'https://cj.rycjapi.com', name: '如意资源' },

    // --- Adult Sources (Potentially Sensitive) ---
    // Note: These might be unstable or contain explicit content.
    // The HIDE_BUILTIN_ADULT_APIS flag controls their visibility in the UI.
    ckzy:      { api: 'https://www.ckzy1.com', name: 'CK资源', adult: true },
    jkun:      { api: 'https://jkunzyapi.com', name: 'JKUN资源', adult: true },
    bwzy:      { api: 'https://api.bwzym3u8.com', name: '百万资源', adult: true },
    souav:     { api: 'https://api.souavzy.vip', name: 'SouAV资源', adult: true },
    siwa:      { api: 'https://siwazyw.tv', name: '丝袜资源', adult: true },
    r155:      { api: 'https://155api.com', name: '155资源', adult: true },
    lsb:       { api: 'https://apilsbzy1.com', name: 'LSB资源', adult: true },
    huangcang: { api: 'https://hsckzy.vip', name: '黄色仓库', adult: true, detail: 'https://hsckzy.vip' }
};

// Flag to control visibility of built-in adult APIs in the settings panel
const HIDE_BUILTIN_ADULT_APIS = true; // Set to false to show adult sources by default (Kept from optimization)

// *** Added back from original code for compatibility ***
// Aggregated search configuration options
const AGGREGATED_SEARCH_CONFIG = {
    enabled: true,             // Whether to enable aggregated search
    timeout: 8000,            // Timeout for a single source (milliseconds)
    maxResults: 10000,          // Maximum number of results (Note: High value, might impact performance)
    parallelRequests: true,   // Whether to request all sources in parallel
    showSourceBadges: true    // Whether to show source badges in results
};

// Standard API Request Paths and Headers (assuming CMS common paths)
// Kept optimized version assuming detail fetching logic was updated
const API_CONFIG = {
    search: {
        path: '/api.php/provide/vod/?ac=videolist&wd=',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    },
    detail: {
        path: '/api.php/provide/vod/?ac=videolist&ids=',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    }
};

// Regex for extracting M3U8 URLs (used as fallback in api.js)
// Kept optimized version
const M3U8_PATTERN = /\$?(https?:\/\/[^$'"\s]+\.m3u8)/g;

// Player Configuration
const PLAYER_CONFIG = {
    autoplay: true,
    allowFullscreen: true,
    timeout: 15000,            // Player load timeout (ms) - Handled within player.html logic
    autoPlayNext: true,        // Default state for auto-play toggle - Handled by player.html logic
    adFilteringEnabled: true, // Default state for ad filtering toggle
    adFilteringStorage: AD_FILTERING_KEY, // Uses the corrected key constant
    autoplayStorage: AUTOPLAY_KEY // Uses the corrected key constant
};

// Custom API Configuration
const CUSTOM_API_CONFIG = {
    maxSources: 10,          // Increased max custom sources (Kept from optimization)
    testTimeout: 5000,       // Availability test timeout (ms) (Kept from optimization)
    namePrefix: '自定义-',   // Prefix for display name if needed (not used currently)
    localStorageKey: CUSTOM_APIS_KEY // Uses the corrected key constant
};

// Error Messages (Example - not currently used, but good for future i18n)
const ERROR_MESSAGES = {
    NETWORK_ERROR: '网络连接错误，请检查网络设置',
    TIMEOUT_ERROR: '请求超时，服务器响应时间过长',
    API_ERROR: 'API接口返回错误，请尝试更换数据源',
    PLAYER_ERROR: '播放器加载失败，请尝试其他视频源',
    UNKNOWN_ERROR: '发生未知错误，请刷新页面重试'
};

// Security related settings (Example - mostly handled server-side/proxy)
const SECURITY_CONFIG = {
    enableXSSProtection: true, // Basic client-side sanitization is implemented
    maxQueryLength: 100       // Max search query length handled in app.js (Kept from optimization)
};

// --- Make constants globally accessible (if not using modules) ---
// Ensure all necessary constants, including the restored AGGREGATED_SEARCH_CONFIG
// and constants with reverted key names, are exported.
window.PROXY_URL = PROXY_URL;
window.SEARCH_HISTORY_KEY = SEARCH_HISTORY_KEY;
window.MAX_SEARCH_HISTORY_ITEMS = MAX_SEARCH_HISTORY_ITEMS; // Note: value reverted to 5
window.PASSWORD_CONFIG = PASSWORD_CONFIG;
window.SITE_CONFIG = SITE_CONFIG;
window.API_SITES = API_SITES;
window.HIDE_BUILTIN_ADULT_APIS = HIDE_BUILTIN_ADULT_APIS;
window.AGGREGATED_SEARCH_CONFIG = AGGREGATED_SEARCH_CONFIG; // Export the restored config
window.API_CONFIG = API_CONFIG;
window.M3U8_PATTERN = M3U8_PATTERN;
window.PLAYER_CONFIG = PLAYER_CONFIG;
window.ERROR_MESSAGES = ERROR_MESSAGES;
window.SECURITY_CONFIG = SECURITY_CONFIG;
window.CUSTOM_API_CONFIG = CUSTOM_API_CONFIG;
// Expose other keys (using reverted names)
window.VIEWING_HISTORY_KEY = VIEWING_HISTORY_KEY;
window.MAX_VIEWING_HISTORY_ITEMS = MAX_VIEWING_HISTORY_ITEMS;
window.CUSTOM_APIS_KEY = CUSTOM_APIS_KEY;
window.SELECTED_APIS_KEY = SELECTED_APIS_KEY;
window.PASSWORD_STORAGE_KEY = PASSWORD_STORAGE_KEY; // Export the reverted key name constant
window.AUTOPLAY_KEY = AUTOPLAY_KEY;
window.AD_FILTERING_KEY = AD_FILTERING_KEY; // Export the reverted key name constant
window.EPISODE_REVERSE_KEY = EPISODE_REVERSE_KEY;
window.HAS_INITIALIZED_DEFAULTS_KEY = HAS_INITIALIZED_DEFAULTS_KEY;
window.HAS_SEEN_DISCLAIMER_KEY = HAS_SEEN_DISCLAIMER_KEY;


console.log("Config loaded (Compatibility corrections applied).");
