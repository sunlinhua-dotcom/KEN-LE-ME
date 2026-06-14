import { KC } from '@/constants/theme';
import type { AnalysisResult, WineItem } from './gemini';

/** 千分位价格格式化:1234 → "1,234" */
export function formatPrice(n: number | null | undefined): string {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
}

/* ──────────── 多币种(境外)展示 ──────────── */

const CURRENCY_SYMBOL: Record<string, string> = {
    CNY: '¥', USD: '$', EUR: '€', JPY: '¥', GBP: '£', HKD: 'HK$', TWD: 'NT$', KRW: '₩',
    THB: '฿', SGD: 'S$', AUD: 'A$', CAD: 'C$', MYR: 'RM', VND: '₫', IDR: 'Rp', PHP: '₱',
    INR: '₹', CHF: 'CHF ', AED: 'AED ', MOP: 'MOP$', NZD: 'NZ$',
};

/** 币种符号;未知币种回退成「CODE 」前缀 */
export function currencySymbol(code?: string): string {
    if (!code) return '¥';
    const c = code.toUpperCase().trim();
    return CURRENCY_SYMBOL[c] || `${c} `;
}

/** 是否为非人民币(境外)币种 */
export function isForeign(code?: string): boolean {
    return !!code && code.toUpperCase().trim() !== 'CNY';
}

/** 按币种格式化金额:formatMoney(188, 'USD') → "$188" */
export function formatMoney(n: number | null | undefined, code?: string): string {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return `${currencySymbol(code)}${formatPrice(n)}`;
}

/** 折人民币展示:cnyApprox(188, 7.2) → "≈¥1,354";rate 为空返回 null */
export function cnyApprox(n: number | null | undefined, rate: number | null | undefined): string | null {
    if (n === null || n === undefined || isNaN(n) || !rate || rate <= 0) return null;
    return `≈¥${formatPrice(n * rate)}`;
}

export interface VerdictTier {
    key: 'mint' | 'amber' | 'blaze' | 'scan';
    label: string;
    emoji: string;
    color: string;
    /** 一句话结论 */
    line: string;
}

/** 单品鉴定档位(按 menuPrice/onlinePrice 比值) */
export function getItemTier(item: WineItem): VerdictTier {
    if (!item.menuPrice || !item.ratio) {
        return { key: 'scan', label: '鉴定', emoji: '🔍', color: KC.scan, line: '无店内价,仅鉴定品质' };
    }
    if (item.ratio < 1.5) return { key: 'mint', label: '良心', emoji: '✅', color: KC.mint, line: '价格厚道,可以放心点' };
    if (item.ratio < 2.5) return { key: 'amber', label: '正常', emoji: '👌', color: KC.amber, line: '行价范围,合理溢价' };
    return { key: 'blaze', label: '巨坑', emoji: '💣', color: KC.blaze, line: '溢价离谱,慎点' };
}

export interface CardTheme {
    /** 卡片背景渐变(深色染色玻璃) */
    bg: [string, string];
    border: string;
    /** 顶部色辉 */
    glow: string;
    accent: string;
    /** 左侧强调竖条 */
    bar: string;
    /** 一句可执行建议 */
    advice: string;
}

const CARD_THEME: Record<VerdictTier['key'], Omit<CardTheme, 'advice'>> = {
    mint: { bg: ['rgba(14,42,33,0.80)', 'rgba(8,20,17,0.86)'], border: 'rgba(46,230,168,0.34)', glow: 'rgba(46,230,168,0.20)', accent: KC.mint, bar: KC.mint },
    amber: { bg: ['rgba(44,33,13,0.80)', 'rgba(22,16,8,0.86)'], border: 'rgba(255,194,75,0.30)', glow: 'rgba(255,194,75,0.18)', accent: KC.amber, bar: KC.amber },
    blaze: { bg: ['rgba(46,13,16,0.84)', 'rgba(24,8,10,0.88)'], border: 'rgba(255,90,95,0.36)', glow: 'rgba(255,90,95,0.24)', accent: KC.blaze, bar: KC.blaze },
    scan: { bg: ['rgba(13,27,46,0.82)', 'rgba(8,14,24,0.86)'], border: 'rgba(111,179,255,0.30)', glow: 'rgba(111,179,255,0.18)', accent: KC.scan, bar: KC.scan },
};

const ADVICE: Record<VerdictTier['key'], string> = {
    mint: '推荐点这款,性价比高',
    amber: '可以点,价格在合理区间',
    blaze: '建议避开,或自带更划算',
    scan: '仅作品质鉴定参考',
};

/** 每张酒卡的配色主题 + 可执行建议 */
export function getCardTheme(tier: VerdictTier): CardTheme {
    return { ...CARD_THEME[tier.key], advice: ADVICE[tier.key] };
}

export interface SummaryParts {
    value?: string;      // 最值
    expensive?: string;  // 最贵
    roast?: string;      // 点评
    raw: string;         // 原文兜底
}

/**
 * 把 AI 的 "💰最值: … 💸最贵: … 😈点评: …" run-on 字符串拆成结构化小节,
 * 供结果页分行渲染(解决整段挤在一起、标点孤行的换行问题)。
 */
export function parseSummary(summary: string): SummaryParts {
    const raw = (summary || '').trim();
    const grab = (emojis: string[]): string | undefined => {
        // 命中任一标记,截到下一个标记或结尾
        const markers = ['💰', '💸', '😈', '最值', '最贵', '点评'];
        for (const e of emojis) {
            const i = raw.indexOf(e);
            if (i === -1) continue;
            let start = i + e.length;
            // 跳过紧邻的"最值:/最贵:/点评:"与冒号空格
            start = skipLabel(raw, start);
            let end = raw.length;
            for (const mk of markers) {
                const j = raw.indexOf(mk, start + 1);
                if (j !== -1 && j < end) end = j;
            }
            const seg = raw.slice(start, end).trim().replace(/^[:：\s]+/, '').trim();
            if (seg) return seg;
        }
        return undefined;
    };
    return {
        value: grab(['💰', '最值']),
        expensive: grab(['💸', '最贵']),
        roast: grab(['😈', '点评']),
        raw,
    };
}

function skipLabel(s: string, i: number): number {
    const labels = ['最值', '最贵', '点评'];
    for (const l of labels) {
        if (s.startsWith(l, i)) { i += l.length; break; }
    }
    while (i < s.length && (s[i] === ':' || s[i] === '：' || s[i] === ' ')) i++;
    return i;
}

/**
 * 选择结果页 3D 形态(0–11,共 12 种),形状和感觉随结果变化:
 * - 按档位分"家族"(危险/华贵/舒缓/鉴定),决定整体气质;
 * - 家族内按内容哈希细分,保证不同酒单 / 不同图片看到不同形态。
 * 12 种形态见 VerdictCosmos.web 的 HEROES。
 */
export function pickResultVariant(result: AnalysisResult, verdict: OverallVerdict): number {
    const families: Record<VerdictTier['key'], number[]> = {
        blaze: [0, 1, 2, 3],   // 危险:宝石 / 熔岩球 / 吸金漩涡 / 碎晶环
        amber: [4, 5, 6],      // 华贵:钻石光环 / 金币雨 / 棱镜簇
        mint: [7, 8, 9],       // 舒缓:绽放球 / 水晶花园 / 花瓣
        scan: [10, 11],        // 鉴定:线框星球 / 星座网络
    };
    const fam = families[verdict.tier.key] || [0, 4, 7, 10];

    // 内容哈希:首款名 + 款数 + 分数 + 总溢价 → 同档位不同结果也会换形态
    const seed = `${result.items?.[0]?.name || ''}|${result.items?.length || 0}|${verdict.score}|${Math.round(verdict.totalPremium)}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return fam[h % fam.length];
}

export interface Highlights {
    worst?: { name: string; premium: number };   // 最坑(溢价最高)
    best?: { name: string; ratio: number };       // 最值(倍数最低)
    topRated?: { name: string; rating: number };  // 评分最高
    avgRatio?: number;                            // 平均溢价倍数
}

/** 关键发现:供结果页"一眼看懂"的摘要 */
export function getHighlights(result: AnalysisResult): Highlights {
    const items = result.items || [];
    const priced = items.filter(i => i.menuPrice && i.onlinePrice && i.ratio);
    const h: Highlights = {};

    if (priced.length) {
        const worst = priced.reduce((a, b) => ((b.diff || 0) > (a.diff || 0) ? b : a));
        if ((worst.diff || 0) > 0) h.worst = { name: worst.name, premium: worst.diff || 0 };
        const best = priced.reduce((a, b) => ((b.ratio || 99) < (a.ratio || 99) ? b : a));
        h.best = { name: best.name, ratio: best.ratio || 0 };
        h.avgRatio = priced.reduce((s, i) => s + (i.ratio || 1), 0) / priced.length;
    }
    const rated = items.filter(i => typeof i.rating === 'number');
    if (rated.length) {
        const top = rated.reduce((a, b) => (b.rating > a.rating ? b : a));
        h.topRated = { name: top.name, rating: top.rating };
    }
    return h;
}

export interface OverallVerdict {
    /** 0–100,越高越坑;single 模式下为品质分(越高越好) */
    score: number;
    mode: 'pit' | 'quality';
    tier: VerdictTier;
    /** 总溢价金额(menu 模式) */
    totalPremium: number;
    /** 参与计算的条目数 */
    counted: number;
}

/** 整单坑指数:加权平均比值映射到 0–100 */
export function getOverallVerdict(result: AnalysisResult): OverallVerdict {
    const items = result.items || [];
    const priced = items.filter(i => i.menuPrice && i.onlinePrice && i.ratio);

    // 单品模式(没有任何店内价):给"品质分"
    if (result.type === 'single' || priced.length === 0) {
        const rated = items.filter(i => typeof i.rating === 'number');
        const avg = rated.length
            ? rated.reduce((s, i) => s + i.rating, 0) / rated.length
            : 0;
        const score = Math.round(avg * 10);
        const tier: VerdictTier =
            score >= 80 ? { key: 'mint', label: '优选', emoji: '🏆', color: KC.mint, line: '整体品质在线' }
                : score >= 55 ? { key: 'amber', label: '尚可', emoji: '👌', color: KC.amber, line: '中规中矩' }
                    : { key: 'scan', label: '一般', emoji: '🔍', color: KC.scan, line: '品质平平' };
        return { score, mode: 'quality', tier, totalPremium: 0, counted: rated.length };
    }

    // 酒单模式:按店内价加权的平均溢价比
    const weightSum = priced.reduce((s, i) => s + (i.menuPrice || 0), 0);
    const weightedRatio = priced.reduce((s, i) => s + (i.ratio || 1) * (i.menuPrice || 0), 0) / (weightSum || 1);
    // ratio 1.0 → 0 分,3.0+ → 100 分
    const score = Math.round(Math.min(100, Math.max(0, ((weightedRatio - 1) / 2) * 100)));
    const totalPremium = priced.reduce((s, i) => s + Math.max(0, i.diff || 0), 0);

    const tier: VerdictTier =
        score < 25 ? { key: 'mint', label: '良心酒单', emoji: '✅', color: KC.mint, line: '整体定价厚道,放心喝' }
            : score < 55 ? { key: 'amber', label: '正常水位', emoji: '👌', color: KC.amber, line: '常规餐酒溢价,无大坑' }
                : { key: 'blaze', label: '巨坑预警', emoji: '💣', color: KC.blaze, line: '整体溢价偏高,点单留神' };

    return { score, mode: 'pit', tier, totalPremium, counted: priced.length };
}
