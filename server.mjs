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
