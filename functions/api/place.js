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

async function lookupAmap(env, { name, city, lat, lng }) {
    const key = env.AMAP_KEY;
    if (!key) return json({ ok: false, source: 'amap', place: null, reason: 'no_amap_key' });

    let api;
    if (lat != null && lng != null) {
        // 有定位:就近搜索更准
        api = `https://restapi.amap.com/v3/place/around?key=${key}`
            + `&location=${encodeURIComponent(`${lng},${lat}`)}`
            + `&keywords=${encodeURIComponent(name)}&radius=3000&offset=10&extensions=all`;
    } else {
        api = `https://restapi.amap.com/v3/place/text?key=${key}`
            + `&keywords=${encodeURIComponent(name)}`
            + (city ? `&city=${encodeURIComponent(city)}` : '')
            + `&citylimit=false&offset=10&extensions=all`;
    }

    let d;
    try {
        const r = await fetchTO(api);
        d = await r.json();
    } catch {
        return json({ ok: false, source: 'amap', place: null, reason: 'amap_network' });
    }
    if (!d) return json({ ok: false, source: 'amap', place: null, reason: 'amap_no_response' });
    if (d.status !== '1') {
        return json({ ok: false, source: 'amap', place: null, reason: `amap_${d.infocode || 'err'}:${d.info || ''}` });
    }

    const pois = Array.isArray(d.pois) ? d.pois : [];
    // 优先取有评分的 POI,其次取第一个
    const rated = pois.find((p) => p.biz_ext && num(p.biz_ext.rating) != null);
    const poi = rated || pois[0];
    if (!poi) return json({ ok: true, source: 'amap', place: null, reason: 'not_found' });

    const rating = poi.biz_ext ? num(poi.biz_ext.rating) : null; // 高德评分为 0-5
    const cost = poi.biz_ext ? num(poi.biz_ext.cost) : null;     // 人均(元)

    return json({
        ok: true,
        source: 'amap',
        place: {
            source: 'amap',
            name: poi.name || name,
            rating,
            ratingScale: 5,
            reviewCount: null,
            priceLevel: null,
            cost,
            address: amapStr(poi.address) || [poi.pname, poi.cityname, poi.adname].filter(Boolean).join('') || null,
            type: amapStr(poi.type),
            tel: amapStr(poi.tel),
            url: null,
            city: amapStr(poi.cityname),
        },
    });
}

const GOOGLE_PRICE_LEVEL = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

async function lookupGoogle(env, { name, city, country, lat, lng }) {
    const key = env.GOOGLE_PLACES_KEY;
    if (!key) return json({ ok: false, source: 'google', place: null, reason: 'no_google_key' });

    const body = {
        textQuery: [name, city, country].filter(Boolean).join(' '),
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
        `https://place.kenleme.internal/${region}?q=${encodeURIComponent(name)}&c=${encodeURIComponent(city)}&co=${encodeURIComponent(country)}&g=${coordKey}`,
        { method: 'GET' },
    );
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    const params = { name, city, country, lat, lng };
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
