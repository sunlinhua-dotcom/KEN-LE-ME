/**
 * 汇率换算客户端 —— 调服务端 /api/fx 把境外币种换成人民币。
 * web 同源走相对路径;原生 App 设 EXPO_PUBLIC_API_BASE 指向部署源站。
 */

const BASE = process.env.EXPO_PUBLIC_API_BASE || '';

// 会话内缓存,避免同一币种反复请求
const memo = new Map<string, number>();

/**
 * 离线兜底汇率(1 单位外币 ≈ 多少人民币),仅当 /api/fx 不可用时使用。
 * 数值是近似的,展示侧统一带「≈」与「约」字样,不当精确值用。
 */
const FALLBACK_CNY: Record<string, number> = {
    USD: 7.2, EUR: 7.8, JPY: 0.048, GBP: 9.2, HKD: 0.92, TWD: 0.225, KRW: 0.0053,
    THB: 0.20, SGD: 5.4, AUD: 4.8, CAD: 5.3, MYR: 1.55, VND: 0.00028, IDR: 0.00045,
    PHP: 0.125, INR: 0.086, CHF: 8.1, AED: 1.96, MOP: 0.89, NZD: 4.4,
    // 更多常去目的地,补齐离线兜底覆盖面
    SEK: 0.68, NOK: 0.66, DKK: 1.05, PLN: 1.82, TRY: 0.18, RUB: 0.078, ZAR: 0.39,
    MXN: 0.39, BRL: 1.32, SAR: 1.92, QAR: 1.98, EGP: 0.15, MAD: 0.74,
};

export interface FxRate {
    /** 1 单位外币折合多少人民币 */
    rate: number;
    /** true=实时汇率;false=离线兜底(近似) */
    live: boolean;
}

/** 取「1 单位 from 货币 → 多少 CNY」。CNY 自身返回 1。失败且无兜底时返回 null。 */
export async function getRateToCNY(from: string | undefined | null): Promise<FxRate | null> {
    const cur = (from || '').toUpperCase().trim();
    if (!cur || cur === 'CNY') return { rate: 1, live: true };
    if (memo.has(cur)) return { rate: memo.get(cur)!, live: true };

    try {
        const r = await fetch(`${BASE}/api/fx?from=${cur}&to=CNY`);
        if (r.ok) {
            const d = await r.json();
            if (d && typeof d.rate === 'number' && d.rate > 0) {
                memo.set(cur, d.rate);
                return { rate: d.rate, live: true };
            }
        }
    } catch { /* 落兜底 */ }

    if (FALLBACK_CNY[cur]) return { rate: FALLBACK_CNY[cur], live: false };
    return null;
}
