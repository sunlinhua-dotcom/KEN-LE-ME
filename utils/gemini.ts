import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

// 服务端转发地址:web 同源走相对路径 /api/analyze(Cloudflare Pages Function);
// 原生 App 需用绝对地址(设 EXPO_PUBLIC_API_PROXY)。key 不再出现在前端。
const API_PROXY = process.env.EXPO_PUBLIC_API_PROXY || '/api/analyze';

export interface WineItem {
    name: string;
    menuPrice: number | null;
    onlinePrice: number | null;
    ratio: number | null;
    diff: number | null; // Added diff for price difference
    characteristics: string;
    rating: number;
    /** 针对这一款的毒舌一句(≤20 字,中文,犀利) */
    roast?: string;
    /** 这一款的知识介绍(产区 / 品种 / 为何出名,≤45 字,中文) */
    knowledge?: string;
}

/** 拍到门头 / 酒单抬头 / 小票时,AI 识别出的店铺信息(可能全为 null) */
export interface StoreInfo {
    /** 店名(原文即可) */
    name: string | null;
    /** 连锁 / 集团品牌 */
    brand: string | null;
    /** 国家(中文名或 ISO-2) */
    country: string | null;
    /** 城市 */
    city: string | null;
    /** 照片里识别到的门牌/地址原文(用于地理编码精确定位) */
    address: string | null;
    /** 境内 / 境外 */
    region: 'domestic' | 'overseas' | null;
    /** AI 自带知识的口碑提示(≤40 字,非实时;不认识则 null) */
    reputationNote: string | null;
}

export interface AnalysisResult {
    type: 'menu' | 'single';
    /** 菜单价格的币种(ISO 4217),缺省按 CNY 处理 */
    currency?: string;
    /** 识别到的店铺(用于查口碑);未识别则为 null/缺省 */
    store?: StoreInfo | null;
    summary: string;
    items: WineItem[];
    /** 出错时填写;UI 据此显示错误态 + 重试,而非假数据 */
    error?: string;
}

/** 失败时返回的干净错误对象(不含任何假酒款,UI 显示重试) */
function errorResult(message: string): AnalysisResult {
    return { type: 'menu', summary: '', items: [], error: message };
}

/** 计算溢价并按溢价从高到低排序(坑王榜) */
function processItems(result: AnalysisResult): AnalysisResult {
    if (!result.items) return result;
    const processedItems = result.items.map(item => {
        const menuPrice = item.menuPrice || 0;
        const onlinePrice = item.onlinePrice || 0;
        const bothValid = menuPrice > 0 && onlinePrice > 0;
        const diff = bothValid ? (menuPrice - onlinePrice) : null;
        // 本地按同币种价格重算 ratio(币种无关的纯比值),优先于 AI 给的 ratio:
        // ① 保证 diff 与 ratio 一致(不会出现「溢价¥X」配「2.7×」互相打架);
        // ② AI 漏给 ratio 时,有店内价+电商价的条目也不会被坑指数计算丢弃。
        const ratio = bothValid ? menuPrice / onlinePrice : null;
        return { ...item, diff: item.diff ?? diff, ratio: ratio ?? item.ratio };
    });
    processedItems.sort((a, b) => (b.diff || 0) - (a.diff || 0));
    return { ...result, items: processedItems };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * POST /api/analyze —— 带超时 + 自动重试。
 * 识别本身要 10-30s+,大陆访问 Cloudflare 弱网时长请求易掉线;一次抖动就失败太脆。
 * 策略:单次最长等 75s;网络中断 / 超时 / 服务端 5xx 自动重试(最多 3 次、退避);
 * 4xx(图片问题等)不重试直接返回。错误文案区分"超时 / 断网",不再一律"网络波动"。
 */
async function postAnalyze(body: { images: string[] }): Promise<AnalysisResult> {
    const ATTEMPTS = 3;
    const TIMEOUT_MS = 75000;
    let lastError = '网络不稳,请稍后重试';

    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const resp = await fetch(API_PROXY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(timer);
            const parsed = (await resp.json().catch(() => null)) as (AnalysisResult & { error?: string }) | null;

            if (resp.ok && parsed) return parsed;

            // 服务端返回错误:5xx 值得重试,4xx(图片格式/数量等)直接返回
            const msg = (parsed && parsed.error) || `分析服务暂不可用 (${resp.status})`;
            if (resp.status >= 500 && attempt < ATTEMPTS) { lastError = msg; await sleep(1000 * attempt); continue; }
            return errorResult(msg);
        } catch (e) {
            clearTimeout(timer);
            const aborted = e instanceof Error && e.name === 'AbortError';
            lastError = aborted ? '识别超时(图片偏多或网络较慢)' : '网络连接中断';
            if (attempt < ATTEMPTS) { await sleep(1000 * attempt); continue; }
            return errorResult(
                aborted
                    ? '识别超时:图片偏多或网络较慢,建议少拍一两张、或换个网络重试'
                    : '网络连接不稳,多次重试仍失败,请稍后再试',
            );
        }
    }
    return errorResult(lastError);
}

export async function analyzeWineList(imageUris: string[]): Promise<AnalysisResult> {
    try {
        // 本地压缩 + 转 base64(减小上传体积),全部并行
        const base64Promises = imageUris.map(async (uri) => {
            const manipResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1024 } }],
                { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            if (manipResult.base64) return manipResult.base64;

            // base64 缺失时的兜底(web 用 FileReader,原生用 FileSystem)
            if (Platform.OS === 'web') {
                const response = await fetch(manipResult.uri);
                const blob = await response.blob();
                return await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (typeof reader.result === 'string') resolve(reader.result.split(',')[1]);
                        else reject(new Error('图片转换失败'));
                    };
                    reader.readAsDataURL(blob);
                });
            }
            return await FileSystem.readAsStringAsync(manipResult.uri, { encoding: 'base64' });
        });

        const base64List = await Promise.all(base64Promises);
        if (base64List.some(b => !b)) return errorResult('图片处理失败,请重试');

        // 调服务端转发(key 在服务端,前端拿不到)。带超时 + 自动重试,弱网更稳。
        const data = await postAnalyze({ images: base64List });
        if (data.error) return errorResult(data.error);
        if (!Array.isArray(data.items)) return errorResult('返回数据异常,请重试');

        return processItems(data);
    } catch (error) {
        console.error('❌ Analysis Error:', error);
        return errorResult(error instanceof Error ? error.message : String(error));
    }
}
