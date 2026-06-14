/**
 * Zeabur(及任意 Node 容器)用的服务器:
 *  - 托管 expo export 出的静态站(dist)
 *  - 处理 POST /api/analyze:服务端持有 key,转发 APIyi(与 CF Pages Function 同逻辑)
 *
 * 运行时环境变量(在 Zeabur 面板设置,不带 EXPO_PUBLIC_ 前缀):
 *   GEMINI_API_KEY   (必填)
 *   GEMINI_BASE_URL  (可选,默认 https://api.apiyi.com/v1)
 *   GEMINI_MODEL     (可选,默认 gemini-3.5-flash)
 *   PORT             (可选,默认 8080)
 *
 * 注意:核心转发逻辑与 functions/api/analyze.js 保持一致,改其一记得同步另一个。
 */
import express from 'express';

const PORT = Number(process.env.PORT) || 8080;
const API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = process.env.GEMINI_BASE_URL || 'https://api.apiyi.com/v1';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const PROMPT = `
      You are a Master Sommelier and Wine Market Auditor serving Chinese travelers worldwide.
      Analyze these images (Wine List / Menu pages, bottles, a receipt, and/or a storefront).

      **Tasks:**
      1. **DETECT TYPE & MERGE:**
         - All images belong to ONE session (menu pages, bottles on a table, a receipt, a storefront).
         - Treat them as a SINGLE combined input.
         - If ANY image contains a list of prices, treat the whole set as "menu".
         - If ALL images are just bottles with no price text, treat as "single".

      2. **DETECT CURRENCY (important — drives the overseas conversion):**
         - Determine the ISO 4217 currency code of the PRICES shown on the menu/receipt.
         - Use the currency symbol, the language, and any 店名/地址/城市 cues:
           ¥/￥/元/人民币 → CNY; $ (USA) → USD; HK$/港币 → HKD; NT$/台币 → TWD;
           € → EUR; £ → GBP; 円/¥(日本)/JPY → JPY; ₩/원 → KRW; ฿/บาท → THB; S$ → SGD;
           A$ → AUD; C$ → CAD; RM → MYR; ₫ → VND; Rp → IDR; ₱ → PHP; ₹ → INR; CHF → CHF; د.إ/AED → AED; MOP$ → MOP.
         - If it is clearly mainland China, or you genuinely cannot tell, use "CNY".

      3. **CRITICAL FOR MENUS ("menu"):**
         - Extract EVERY priced item from ALL images. Deduplicate overlaps. Do NOT skip text-only items.

      4. **CRITICAL FOR BOTTLES ("single"):**
         - Identify ALL unique bottles. **menuPrice MUST BE NULL.** Estimate the online retail price.

      5. **PRICING — SAME CURRENCY ONLY (critical for the fairness math):**
         - menuPrice = the number printed on the menu, expressed in the detected "currency".
         - onlinePrice = the typical ONLINE RETAIL price of that SAME bottle, expressed in the SAME "currency":
           · CNY menus → China e-commerce (京东/淘宝) RMB price.
           · Overseas menus → the international online retail / Wine-Searcher average, expressed in the menu's currency.
         - ratio = menuPrice / onlinePrice. **NEVER mix two currencies** — both prices MUST be in "currency".

      6. **DETECT STORE (only if a venue name / logo / storefront / receipt header is visible):**
         - store.name: the restaurant / bar / hotel / venue name (original language is fine).
         - store.brand: chain or group name if applicable, else null.
         - store.country / store.city: from any visible address or strong context.
         - store.region: "domestic" for mainland China, otherwise "overseas".
         - store.reputationNote: ONLY if you genuinely recognize this SPECIFIC venue, a ≤40-char Chinese note on its
           general reputation/positioning (e.g. "米其林一星,人均偏高,口碑稳定"). If you do not recognize it, use null.
           NEVER invent a star rating or a review count here.
         - If no venue is identifiable, set EVERY store field to null.

      7. **GENERAL ANALYSIS (per item):**
         - "characteristics": Chinese tasting notes.
         - "rating": a 1-10 number.
         - "roast": one savage/funny Chinese line, MAX 20 chars, specific to THAT item. No emoji.
         - "knowledge": a useful Chinese intro, MAX 45 chars (产区/品种/为何出名/小贴士). No emoji.

      **Summary Guidelines:**
      - Structure: 💰Best Value -> 💸Most Expensive -> 😈Savage Review.
      - **NO NEWLINES** in the summary string. Use spaces.

      **Return JSON ONLY:**
      {
        "type": "menu" | "single",
        "currency": "CNY" | "USD" | "EUR" | "JPY" | "GBP" | "HKD" | "TWD" | "KRW" | "THB" | "SGD" | "<ISO 4217>",
        "store": {
          "name": string | null,
          "brand": string | null,
          "country": string | null,
          "city": string | null,
          "region": "domestic" | "overseas" | null,
          "reputationNote": string | null
        },
        "summary": "💰最值: ... 💸最贵: ... 😈点评: ...",
        "items": [
          {
            "name": "Wine Name",
            "menuPrice": number | null,
            "onlinePrice": number | null,
            "ratio": number | null,
            "characteristics": "Chinese description",
            "rating": number,
            "roast": "中文毒舌一句,≤20字",
            "knowledge": "中文知识介绍,≤45字"
          }
        ]
      }
`;

function extractResult(text) {
    const clean = (text || '').trim();
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen === -1 || lastClose === -1) return null;
    let s = clean.substring(firstOpen, lastClose + 1)
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
    try {
        return JSON.parse(s);
    } catch {
        try {
            return JSON.parse(s.replace(/[\r\n\t]+/g, ' '));
        } catch {
            return null;
        }
    }
}

const app = express();
app.use(express.json({ limit: '25mb' }));

app.post('/api/analyze', async (req, res) => {
    if (!API_KEY) {
        return res.status(500).json({ error: '服务端未配置 API Key(请设置 GEMINI_API_KEY)' });
    }
    const images = req.body && req.body.images;
    if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: '未收到图片' });
    }
    if (images.length > 12) {
        return res.status(400).json({ error: '图片太多,一次最多 12 张' });
    }

    const content = [
        { type: 'text', text: PROMPT },
        ...images.map((b64) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } })),
    ];

    try {
        const r = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
            body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content }], max_tokens: 8192 }),
        });
        const data = await r.json().catch(() => null);
        if (!data) return res.status(502).json({ error: 'AI 服务无响应,请重试' });
        if (data.error) return res.status(502).json({ error: data.error.message || 'AI 服务返回错误' });
        const result = extractResult(data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
        if (!result || !Array.isArray(result.items)) {
            return res.status(502).json({ error: '无法解析 AI 返回的数据,请重试' });
        }
        res.json(result);
    } catch (e) {
        res.status(502).json({ error: (e && e.message) || '请求失败,请重试' });
    }
});

// 带超时的 fetch(与 Functions 的 fetchTO 同义,Node 用 AbortSignal.timeout)
const fetchTO = (url, opts = {}) => fetch(url, { ...opts, signal: AbortSignal.timeout(4500) });

// ── 汇率:GET /api/fx?from=USD&to=CNY(与 functions/api/fx.js 同逻辑)──
// CF 版走边缘缓存;Node 版用进程内 TTL 缓存 + Cache-Control 头护住上游免费配额。
const FX_TTL_MS = 43200 * 1000; // 12h
const fxMemo = new Map();
app.get('/api/fx', async (req, res) => {
    const CODE = /^[A-Z]{3}$/;
    const from = String(req.query.from || '').toUpperCase();
    const to = String(req.query.to || 'CNY').toUpperCase();
    if (!CODE.test(from) || !CODE.test(to)) return res.status(400).json({ error: '货币代码不合法' });
    if (from === to) {
        res.set('Cache-Control', 'public, max-age=43200');
        return res.json({ from, to, rate: 1, asOf: null, source: 'identity' });
    }
    const memoKey = `${from}-${to}`;
    const hit = fxMemo.get(memoKey);
    if (hit && Date.now() - hit.t < FX_TTL_MS) {
        res.set('Cache-Control', 'public, max-age=43200');
        return res.json(hit.body);
    }
    try {
        const r = await fetchTO(`https://open.er-api.com/v6/latest/${from}`);
        const d = await r.json().catch(() => null);
        if (d && d.result === 'success' && d.rates && typeof d.rates[to] === 'number' && d.rates[to] > 0) {
            const body = { from, to, rate: d.rates[to], asOf: d.time_last_update_utc || null, source: 'er-api' };
            fxMemo.set(memoKey, { body, t: Date.now() });
            res.set('Cache-Control', 'public, max-age=43200');
            return res.json(body);
        }
    } catch { /* 落备源 */ }
    try {
        const r = await fetchTO(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`);
        const d = await r.json().catch(() => null);
        if (d && d.rates && typeof d.rates[to] === 'number' && d.rates[to] > 0) {
            const body = { from, to, rate: d.rates[to], asOf: d.date || null, source: 'frankfurter' };
            fxMemo.set(memoKey, { body, t: Date.now() });
            res.set('Cache-Control', 'public, max-age=43200');
            return res.json(body);
        }
    } catch { /* 两源皆挂 */ }
    res.status(502).json({ error: '汇率暂不可用,请稍后重试' });
});

// ── 店铺口碑:GET /api/place(与 functions/api/place.js 同逻辑)──
const AMAP_KEY = process.env.AMAP_KEY;
const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY;
const pnum = (x) => { if (x == null || x === '') return null; const n = parseFloat(x); return Number.isFinite(n) ? n : null; };
const inChina = (lat, lng) => lat >= 18 && lat <= 53.6 && lng >= 73.4 && lng <= 135.1;
const amapStr = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const GPL = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };

app.get('/api/place', async (req, res) => {
    const name = String(req.query.name || '').trim();
    const city = String(req.query.city || '').trim();
    const country = String(req.query.country || '').trim();
    let region = String(req.query.region || '').trim();
    const lat = pnum(req.query.lat);
    const lng = pnum(req.query.lng);
    if (!name) return res.json({ ok: false, source: null, place: null, reason: 'no_name' });
    if (region !== 'domestic' && region !== 'overseas') {
        region = (lat != null && lng != null) ? (inChina(lat, lng) ? 'domestic' : 'overseas') : 'domestic';
    }

    if (region === 'overseas') {
        if (!GOOGLE_PLACES_KEY) return res.json({ ok: false, source: 'google', place: null, reason: 'no_google_key' });
        try {
            const body = { textQuery: [name, city, country].filter(Boolean).join(' '), languageCode: 'zh-CN', pageSize: 3 };
            if (lat != null && lng != null) body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 5000 } };
            const r = await fetchTO('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.formattedAddress,places.googleMapsUri,places.types' },
                body: JSON.stringify(body),
            });
            const d = await r.json().catch(() => null);
            if (!d) return res.json({ ok: false, source: 'google', place: null, reason: 'google_no_response' });
            if (d.error) return res.json({ ok: false, source: 'google', place: null, reason: `google_${d.error.status || d.error.code || 'err'}` });
            const p = Array.isArray(d.places) ? d.places[0] : null;
            if (!p) return res.json({ ok: true, source: 'google', place: null, reason: 'not_found' });
            return res.json({ ok: true, source: 'google', place: {
                source: 'google', name: (p.displayName && p.displayName.text) || name,
                rating: typeof p.rating === 'number' ? p.rating : null, ratingScale: 5,
                reviewCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
                priceLevel: p.priceLevel != null ? (GPL[p.priceLevel] ?? null) : null,
                cost: null, address: p.formattedAddress || null, type: Array.isArray(p.types) ? p.types[0] : null,
                tel: null, url: p.googleMapsUri || null, city: city || null,
            } });
        } catch { return res.json({ ok: false, source: 'google', place: null, reason: 'google_network' }); }
    }

    // domestic → 高德
    if (!AMAP_KEY) return res.json({ ok: false, source: 'amap', place: null, reason: 'no_amap_key' });
    try {
        const api = (lat != null && lng != null)
            ? `https://restapi.amap.com/v3/place/around?key=${AMAP_KEY}&location=${encodeURIComponent(`${lng},${lat}`)}&keywords=${encodeURIComponent(name)}&radius=3000&offset=10&extensions=all`
            : `https://restapi.amap.com/v3/place/text?key=${AMAP_KEY}&keywords=${encodeURIComponent(name)}${city ? `&city=${encodeURIComponent(city)}` : ''}&citylimit=false&offset=10&extensions=all`;
        const r = await fetchTO(api);
        const d = await r.json().catch(() => null);
        if (!d) return res.json({ ok: false, source: 'amap', place: null, reason: 'amap_no_response' });
        if (d.status !== '1') return res.json({ ok: false, source: 'amap', place: null, reason: `amap_${d.infocode || 'err'}:${d.info || ''}` });
        const pois = Array.isArray(d.pois) ? d.pois : [];
        const poi = pois.find((p) => p.biz_ext && pnum(p.biz_ext.rating) != null) || pois[0];
        if (!poi) return res.json({ ok: true, source: 'amap', place: null, reason: 'not_found' });
        return res.json({ ok: true, source: 'amap', place: {
            source: 'amap', name: poi.name || name,
            rating: poi.biz_ext ? pnum(poi.biz_ext.rating) : null, ratingScale: 5,
            reviewCount: null, priceLevel: null, cost: poi.biz_ext ? pnum(poi.biz_ext.cost) : null,
            address: amapStr(poi.address) || [poi.pname, poi.cityname, poi.adname].filter(Boolean).join('') || null,
            type: amapStr(poi.type), tel: amapStr(poi.tel), url: null, city: amapStr(poi.cityname),
        } });
    } catch { return res.json({ ok: false, source: 'amap', place: null, reason: 'amap_network' }); }
});

// 静态站:/result → result.html(extensions),哈希资源永久缓存
app.use(express.static('dist', {
    extensions: ['html'],
    setHeaders: (res, p) => {
        if (p.includes(`${'/_expo/static/'}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    },
}));

// 兜底:未命中静态文件的路径回首页,交给客户端路由
app.use((req, res) => res.sendFile('index.html', { root: 'dist' }));

app.listen(PORT, () => console.log(`🍷 server listening on :${PORT}`));
