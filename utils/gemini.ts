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

export interface AnalysisResult {
    type: 'menu' | 'single';
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
        const diff = (menuPrice > 0 && onlinePrice > 0) ? (menuPrice - onlinePrice) : null;
        return { ...item, diff: item.diff ?? diff };
    });
    processedItems.sort((a, b) => (b.diff || 0) - (a.diff || 0));
    return { ...result, items: processedItems };
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

        // 调服务端转发(key 在服务端,前端拿不到)
        const resp = await fetch(API_PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: base64List }),
        });

        if (!resp.ok) {
            const errBody = await resp.json().catch(() => ({} as { error?: string }));
            return errorResult(errBody.error || `分析服务暂不可用 (${resp.status})`);
        }

        const data = (await resp.json()) as AnalysisResult;
        if (data.error) return errorResult(data.error);
        if (!Array.isArray(data.items)) return errorResult('返回数据异常,请重试');

        return processItems(data);
    } catch (error) {
        console.error('❌ Analysis Error:', error);
        return errorResult(error instanceof Error ? error.message : String(error));
    }
}
