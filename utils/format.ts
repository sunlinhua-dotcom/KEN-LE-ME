import { KC } from '@/constants/theme';
import type { AnalysisResult, WineItem } from './gemini';

/** 千分位价格格式化:1234 → "1,234" */
export function formatPrice(n: number | null | undefined): string {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
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
