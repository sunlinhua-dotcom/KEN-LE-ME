/**
 * Cloudflare Pages Function —— AI 鉴定服务端转发(藏 API key)
 *
 * 前端只 POST 到 /api/analyze,带 { images: string[] }(已压缩的 base64 JPEG 列表)。
 * 真正的 APIyi key 存在服务端环境变量 GEMINI_API_KEY 里(在 Cloudflare Pages 设置),
 * 永远不进前端 bundle,F12 也扒不到。
 *
 * 需要在 Cloudflare Pages → 设置 → 环境变量(生产)里配置:
 *   GEMINI_API_KEY   (必填,你的 APIyi key,建议设为加密 Secret)
 *   GEMINI_BASE_URL  (可选,默认 https://api.apiyi.com/v1)
 *   GEMINI_MODEL     (可选,默认 gemini-3.5-flash)
 */

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
         - store.address: the most precise LOCATION CLUE you can READ from the image (门牌 / 路牌 / 招牌 / 小票 / 海报),
           used to pin the venue's location. Copy it VERBATIM, preferring in this order:
           ① full address with house number — 门牌 (e.g. "上海市黄浦区陕西南路123号" / "123 Market St, San Francisco");
           ② street + number; ③ street name or a cross-street (e.g. "陕西南路 / 淮海中路口");
           ④ a clear nearby landmark, metro station or mall (e.g. "陕西南路地铁站", "环贸 iapm").
           ALWAYS prefer an on-image clue over a guess. Use null ONLY if the image shows no location text at all.
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
          "address": string | null,
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

function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

/** 从 AI 文本里抠出 JSON 并容错解析(与原前端逻辑一致) */
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

export async function onRequestPost(context) {
    const { request, env } = context;
    const API_KEY = env.GEMINI_API_KEY;
    const BASE_URL = env.GEMINI_BASE_URL || 'https://api.apiyi.com/v1';
    const MODEL = env.GEMINI_MODEL || 'gemini-3.5-flash';

    if (!API_KEY) {
        return json({ error: '服务端未配置 API Key(请在 Cloudflare Pages 设置 GEMINI_API_KEY)' }, 500);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: '请求格式错误' }, 400);
    }

    const images = body && body.images;
    if (!Array.isArray(images) || images.length === 0) {
        return json({ error: '未收到图片' }, 400);
    }
    if (images.length > 12) {
        return json({ error: '图片太多,一次最多 12 张' }, 400);
    }

    const content = [
        { type: 'text', text: PROMPT },
        ...images.map((b64) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } })),
    ];

    try {
        const resp = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [{ role: 'user', content }],
                max_tokens: 8192,
            }),
        });

        const data = await resp.json().catch(() => null);
        if (!data) return json({ error: 'AI 服务无响应,请重试' }, 502);
        if (data.error) return json({ error: data.error.message || 'AI 服务返回错误' }, 502);

        const result = extractResult(data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
        if (!result || !Array.isArray(result.items)) {
            return json({ error: '无法解析 AI 返回的数据,请重试' }, 502);
        }
        return json(result, 200);
    } catch (e) {
        return json({ error: (e && e.message) || '请求失败,请重试' }, 502);
    }
}

/** 非 POST 给个友好提示,避免被当成静态 404 */
export async function onRequestGet() {
    return json({ error: '请用 POST 调用 /api/analyze' }, 405);
}
