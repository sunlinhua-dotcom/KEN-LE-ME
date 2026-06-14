/**
 * Cloudflare Pages Function —— 汇率换算(境外货币 → 人民币)
 *
 * 前端 GET /api/fx?from=USD&to=CNY  →  { from, to, rate, asOf, source }
 * rate = 1 单位 from 货币 折合多少 to 货币。
 *
 * 数据源(都免费、无需 key):
 *   主:open.er-api.com(161 种货币)
 *   备:frankfurter.dev(欧洲央行参考汇率)
 * 结果用 Cloudflare 边缘缓存 12 小时,既省上游配额,又让换算秒回。
 *
 * 无需任何环境变量。
 */

const CODE = /^[A-Z]{3}$/;

function json(obj, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
    });
}

/** 带超时的 fetch:上游卡住时快速失败,好让备源/前端兜底及时顶上 */
async function fetchTO(url, opts = {}, ms = 4000) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
        return await fetch(url, { ...opts, signal: ac.signal });
    } finally {
        clearTimeout(t);
    }
}

async function fetchRate(from, to) {
    // 主源:open.er-api(单一 base,直接取目标币种)
    try {
        const r = await fetchTO(`https://open.er-api.com/v6/latest/${from}`, { cf: { cacheTtl: 43200 } });
        const d = await r.json().catch(() => null);
        if (d && d.result === 'success' && d.rates && typeof d.rates[to] === 'number' && d.rates[to] > 0) {
            return { rate: d.rates[to], asOf: d.time_last_update_utc || null, source: 'er-api' };
        }
    } catch { /* 落到备源 */ }

    // 备源:frankfurter(ECB,覆盖主要货币)
    try {
        const r = await fetchTO(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`, { cf: { cacheTtl: 43200 } });
        const d = await r.json().catch(() => null);
        if (d && d.rates && typeof d.rates[to] === 'number' && d.rates[to] > 0) {
            return { rate: d.rates[to], asOf: d.date || null, source: 'frankfurter' };
        }
    } catch { /* 两源皆挂 */ }

    return null;
}

export async function onRequestGet(context) {
    const { request, waitUntil } = context;
    const url = new URL(request.url);
    const from = (url.searchParams.get('from') || '').toUpperCase();
    const to = (url.searchParams.get('to') || 'CNY').toUpperCase();

    if (!CODE.test(from) || !CODE.test(to)) {
        return json({ error: '货币代码不合法(需 3 位字母 ISO 4217)' }, 400);
    }
    if (from === to) {
        return json({ from, to, rate: 1, asOf: null, source: 'identity' });
    }

    // 边缘缓存命中即返回(按 from-to 维度)
    const cache = caches.default;
    const cacheKey = new Request(`https://fx.kenleme.internal/${from}-${to}`, { method: 'GET' });
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    const got = await fetchRate(from, to);
    if (!got) return json({ error: '汇率暂不可用,请稍后重试' }, 502);

    const resp = json(
        { from, to, rate: got.rate, asOf: got.asOf, source: got.source },
        200,
        { 'Cache-Control': 'public, max-age=43200' }, // 12h
    );
    if (waitUntil) waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
}
