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
      You are a Master Sommelier and Wine Market Auditor for China.
      Analyze these images (Wine List Pages or Multiple Bottles).

      **Tasks:**
      1. **DETECT TYPE & MERGE:**
         - These images belong to ONE session (e.g. page 1, page 2 of a menu OR multiple bottles on a table).
         - Treat them as a SINGLE combined input.
         - If ANY image contains a list of prices, treat the whole set as "menu".
         - If ALL images are just bottles with no text list, treat as "single" (collection of bottles).

      2. **CRITICAL FOR MENUS ("menu"):**
         - Extract items from ALL images.
         - **Deduplicate** if the same item appears in overlapping photos.
         - **EVERY SINGLE ITEM** with a price must be extracted.
         - **DO NOT ignore text-only items.**
         - Determine the final list of unique wine/beverage items.

      3. **CRITICAL FOR BOTTLES ("single"):**
         - Identify ALL unique bottles across all photos.
         - **menuPrice MUST BE NULL.**
         - Estimate the online retail price for each.

      4. **GENERAL ANALYSIS:**
         - Estimate China online retail price (JD/Taobao).
         - Provide tasting notes/characteristics (in Chinese).
         - Provide a 1-10 rating.
         - Generate a witty, short, savage/funny summary in Chinese.
         - For EACH item, also write a "roast": a single savage/funny one-liner
           in Chinese, MAX 20 characters, sharp and specific to THAT item
           (mock the pricing if overpriced, praise if good value). No emoji inside roast.
         - For EACH item, also write "knowledge": a useful intro in Chinese (MAX 45
           characters) — origin region / grape or category / why it's notable / a
           drinking tip. Educational and specific, not generic. No emoji inside.

      **Summary Guidelines:**
      - Structure: 💰Best Value -> 💸Most Expensive -> 😈Savage Review.
      - **NO NEWLINES** in the summary string. Use spaces.

      **Return JSON ONLY:**
      {
        "type": "menu" | "single",
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
