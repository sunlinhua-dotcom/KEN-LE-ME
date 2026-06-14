/**
 * Cloudflare Pages Function —— 店铺口碑查询(境内高德 / 境外 Google)
 *
 * 前端 GET /api/place?name=店名&city=城市&country=国家&region=domestic|overseas&lat=&lng=
 * 统一返回(永远 200,UI 据 ok/place 容错,不让查询失败把页面打挂):
 *   { ok: boolean, source: 'amap'|'google'|null, place: <PlaceResult>|null, reason?: string }
 *
 * 路由:
 *   region=domestic  → 高德 POI(biz_ext.rating 真实评分、人均)
 *   region=overseas  → Google Places API (New) Text Search(rating / 评论数 / 价位)
 *   region 缺省时按经纬度(中国 bbox)判断,再缺省按 domestic 处理。
 *
 * 环境变量(Cloudflare Pages → 设置 → 环境变量,建议设为加密 Secret;切勿写进前端):
 *   AMAP_KEY            (境内高德 Web 服务 key;本项目用户已提供)
 *   GOOGLE_PLACES_KEY   (可选;没配则境外退化为前端的 AI 参考口碑)
 *
 * 高德 key 若开了「IP 白名单」或「数字签名」会从边缘调用失败 —— 失败原因会原样回传
 * 到 reason(如 amap_10001:INVALID_USER_KEY),便于排查。
 */

function json(obj, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
    });
}

function num(x) {
    if (x === null || x === undefined || x === '') return null;
    const n = parseFloat(x);
    return Number.isFinite(n) ? n : null;
}

/** 中国大陆(含港澳台)粗略经纬度范围 */
function inChina(lat, lng) {
    return lat >= 18 && lat <= 53.6 && lng >= 73.4 && lng <= 135.1;
}

/* ── WGS-84(浏览器 GPS)→ GCJ-02(高德/火星坐标)──
   浏览器 navigator.geolocation 给的是 WGS-84;高德 API 要 GCJ-02。
   在中国直接拿 WGS-84 查高德会系统性偏移 ~500m(实测陕西南路→襄阳北路、徐汇区),
   即用户说的"定位漂移"。查高德前必须转换;Google(境外)仍用 WGS-84。 */
const GCJ_PI = Math.PI, GCJ_A = 6378245.0, GCJ_EE = 0.00669342162296594323;
function gcjOutOfChina(lat, lng) { return (lng < 72.004 || lng > 137.8347) || (lat < 0.8293 || lat > 55.8271); }
function gcjTLat(x, y) {
    let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * GCJ_PI) + 20 * Math.sin(2 * x * GCJ_PI)) * 2 / 3;
    r += (20 * Math.sin(y * GCJ_PI) + 40 * Math.sin(y / 3 * GCJ_PI)) * 2 / 3;
    r += (160 * Math.sin(y / 12 * GCJ_PI) + 320 * Math.sin(y * GCJ_PI / 30)) * 2 / 3;
    return r;
}
function gcjTLng(x, y) {
    let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * GCJ_PI) + 20 * Math.sin(2 * x * GCJ_PI)) * 2 / 3;
    r += (20 * Math.sin(x * GCJ_PI) + 40 * Math.sin(x / 3 * GCJ_PI)) * 2 / 3;
    r += (150 * Math.sin(x / 12 * GCJ_PI) + 300 * Math.sin(x / 30 * GCJ_PI)) * 2 / 3;
    return r;
}
/** WGS-84 → GCJ-02,返回 [lat, lng];中国境外原样返回 */
function wgs84ToGcj02(lat, lng) {
    if (gcjOutOfChina(lat, lng)) return [lat, lng];
    let dLat = gcjTLat(lng - 105, lat - 35);
    let dLng = gcjTLng(lng - 105, lat - 35);
    const rl = lat / 180 * GCJ_PI;
    let m = Math.sin(rl); m = 1 - GCJ_EE * m * m;
    const s = Math.sqrt(m);
    dLat = (dLat * 180) / ((GCJ_A * (1 - GCJ_EE)) / (m * s) * GCJ_PI);
    dLng = (dLng * 180) / (GCJ_A / s * Math.cos(rl) * GCJ_PI);
    return [lat + dLat, lng + dLng];
}

/** 高德有些字段(address/tel)在无值时会返回 [],统一成字符串/null */
function amapStr(v) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    return null;
}

/** 带超时的 fetch:上游(高德/Google)卡住时快速失败,不拖垮店铺卡 */
async function fetchTO(url, opts = {}, ms = 4500) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
        return await fetch(url, { ...opts, signal: ac.signal });
    } finally {
        clearTimeout(t);
    }
}

/** 拉一次高德 JSON(带超时),失败返回 null */
async function amapGet(url) {
    try {
        const r = await fetchTO(url);
        return await r.json();
    } catch {
        return null;
    }
}

/** 地理编码:把照片里的门牌/地址转成 GCJ-02 坐标(高德 geocode 返回的就是 GCJ-02) */
async function amapGeocode(env, address, city) {
    const url = `https://restapi.amap.com/v3/geocode/geo?key=${env.AMAP_KEY}`
        + `&address=${encodeURIComponent(address)}`
        + (city ? `&city=${encodeURIComponent(city)}` : '');
    const d = await amapGet(url);
    if (d && d.status === '1' && Array.isArray(d.geocodes) && d.geocodes[0] && typeof d.geocodes[0].location === 'string') {
        const [lng, lat] = d.geocodes[0].location.split(',').map(Number);
        if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng, lat };
    }
    return null;
}

/** 从 POI 列表里挑一个:优先有评分的,其次第一个 */
function pickPoi(d) {
    const pois = d && d.status === '1' && Array.isArray(d.pois) ? d.pois : [];
    return pois.find((p) => p.biz_ext && num(p.biz_ext.rating) != null) || pois[0] || null;
}

/** 把高德 POI 规整成统一的 place 结构 */
function amapPlace(poi, name) {
    return {
        source: 'amap',
        name: poi.name || name,
        rating: poi.biz_ext ? num(poi.biz_ext.rating) : null, // 高德评分 0-5
        ratingScale: 5,
        reviewCount: null,
        priceLevel: null,
        cost: poi.biz_ext ? num(poi.biz_ext.cost) : null,     // 人均(元)
        address: amapStr(poi.address) || [poi.pname, poi.cityname, poi.adname].filter(Boolean).join('') || null,
        type: amapStr(poi.type),
        tel: amapStr(poi.tel),
        url: null,
        city: amapStr(poi.cityname),
    };
}

async function lookupAmap(env, { name, city, address, lat, lng }) {
    const key = env.AMAP_KEY;
    if (!key) return json({ ok: false, source: 'amap', place: null, reason: 'no_amap_key' });

    // 坐标锚点优先级:① 照片门牌地址(地理编码,最准、不靠 GPS)② GPS(WGS-84→GCJ-02)
    let gLng = null, gLat = null, byAddress = false;
    if (address) {
        const g = await amapGeocode(env, address, city);
        if (g) { gLng = g.lng; gLat = g.lat; byAddress = true; }
    }
    if (gLat == null && lat != null && lng != null) {
        const [aLat, aLng] = wgs84ToGcj02(lat, lng);
        gLat = aLat; gLng = aLng;
    }

    // 有锚点:就近 + 店名关键字匹配(门牌锚点半径更小、更精确)
    if (gLat != null && gLng != null) {
        const radius = byAddress ? 1200 : 3000;
        const loc = encodeURIComponent(`${gLng},${gLat}`);
        let poi = pickPoi(await amapGet(`https://restapi.amap.com/v3/place/around?key=${key}&location=${loc}&keywords=${encodeURIComponent(name)}&radius=${radius}&offset=10&extensions=all`));
        // 门牌锚点但店名没匹配上 → 就近(不带关键字)取该地址处的 POI 兜底
        if (!poi && byAddress) {
            poi = pickPoi(await amapGet(`https://restapi.amap.com/v3/place/around?key=${key}&location=${loc}&radius=300&offset=10&extensions=all`));
        }
        if (!poi) return json({ ok: true, source: 'amap', place: null, reason: 'not_found' });
        return json({ ok: true, source: 'amap', place: amapPlace(poi, name) });
    }

    // 无任何坐标锚点:仅按店名 + 城市文本搜索
    const d = await amapGet(`https://restapi.amap.com/v3/place/text?key=${key}&keywords=${encodeURIComponent(name)}`
        + (city ? `&city=${encodeURIComponent(city)}` : '') + `&citylimit=false&offset=10&extensions=all`);
    if (!d) return json({ ok: false, source: 'amap', place: null, reason: 'amap_no_response' });
    if (d.status !== '1') return json({ ok: false, source: 'amap', place: null, reason: `amap_${d.infocode || 'err'}:${d.info || ''}` });
    const poi = pickPoi(d);
    if (!poi) return json({ ok: true, source: 'amap', place: null, reason: 'not_found' });
    return json({ ok: true, source: 'amap', place: amapPlace(poi, name) });
}

const GOOGLE_PRICE_LEVEL = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

async function lookupGoogle(env, { name, city, country, address, lat, lng }) {
    const key = env.GOOGLE_PLACES_KEY;
    if (!key) return json({ ok: false, source: 'google', place: null, reason: 'no_google_key' });

    const body = {
        // 门牌优先:照片里识别到的地址也进查询词,海外门店同样能精确锁定
        textQuery: [name, address, city, country].filter(Boolean).join(' '),
        languageCode: 'zh-CN',
        pageSize: 3, // 只读 places[0];pageSize 是 New API 的规范字段(maxResultCount 已弃用)
    };
    if (lat != null && lng != null) {
        body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 5000 } };
    }

    let d;
    try {
        const r = await fetchTO('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': key,
                // 只取这几个字段:rating/评论数/价位属 Pro 档,每月 5000 次免费
                'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.formattedAddress,places.googleMapsUri,places.types',
            },
            body: JSON.stringify(body),
        });
        d = await r.json();
    } catch {
        return json({ ok: false, source: 'google', place: null, reason: 'google_network' });
    }
    if (!d) return json({ ok: false, source: 'google', place: null, reason: 'google_no_response' });
    if (d.error) {
        return json({ ok: false, source: 'google', place: null, reason: `google_${d.error.status || d.error.code || 'err'}` });
    }

    const p = Array.isArray(d.places) ? d.places[0] : null;
    if (!p) return json({ ok: true, source: 'google', place: null, reason: 'not_found' });

    return json({
        ok: true,
        source: 'google',
        place: {
            source: 'google',
            name: (p.displayName && p.displayName.text) || name,
            rating: typeof p.rating === 'number' ? p.rating : null, // Google 评分为 0-5
            ratingScale: 5,
            reviewCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
            priceLevel: p.priceLevel != null ? (GOOGLE_PRICE_LEVEL[p.priceLevel] ?? null) : null,
            cost: null,
            address: p.formattedAddress || null,
            type: Array.isArray(p.types) ? p.types[0] : null,
            tel: null,
            url: p.googleMapsUri || null,
            city: city || null,
        },
    });
}

export async function onRequestGet(context) {
    const { request, env, waitUntil } = context;
    const url = new URL(request.url);

    const name = (url.searchParams.get('name') || '').trim();
    const city = (url.searchParams.get('city') || '').trim();
    const country = (url.searchParams.get('country') || '').trim();
    const address = (url.searchParams.get('address') || '').trim();
    let region = (url.searchParams.get('region') || '').trim();
    const lat = num(url.searchParams.get('lat'));
    const lng = num(url.searchParams.get('lng'));

    if (!name) return json({ ok: false, source: null, place: null, reason: 'no_name' });

    // region 缺省时按定位判断,再缺省按境内
    if (region !== 'domestic' && region !== 'overseas') {
        if (lat != null && lng != null) region = inChina(lat, lng) ? 'domestic' : 'overseas';
        else region = 'domestic';
    }

    // 边缘缓存:同店 12h 内复用,省高德/Google 配额(坐标取 2 位小数做 key)
    const cache = caches.default;
    const coordKey = lat != null && lng != null ? `${lat.toFixed(2)},${lng.toFixed(2)}` : '';
    const cacheKey = new Request(
        `https://place.kenleme.internal/${region}?q=${encodeURIComponent(name)}&c=${encodeURIComponent(city)}&co=${encodeURIComponent(country)}&a=${encodeURIComponent(address)}&g=${coordKey}`,
        { method: 'GET' },
    );
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    const params = { name, city, country, address, lat, lng };
    const resp = region === 'overseas'
        ? await lookupGoogle(env, params)
        : await lookupAmap(env, params);

    // 只缓存查到结果的(避免把 not_found / key 缺失缓存住)
    try {
        const peek = await resp.clone().json();
        if (peek && peek.ok && peek.place) {
            const cacheable = json(peek, 200, { 'Cache-Control': 'public, max-age=43200' });
            if (waitUntil) waitUntil(cache.put(cacheKey, cacheable));
        }
    } catch { /* 缓存失败不影响返回 */ }

    return resp;
}
