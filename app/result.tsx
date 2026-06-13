import Reveal from '@/components/anim/Reveal';
import Gauge from '@/components/svg/Gauge';
import { ArrowLeft, Check, Share2, Square, Volume2 } from '@/components/svg/Icons';
import { BookGlyph, CoinGlyph, FlameGlyph, PriceTagGlyph, RobotMark, TasteGlyph, VerdictMark } from '@/components/svg/Glyphs';
import Medal from '@/components/svg/Medal';
import Seal from '@/components/svg/Seal';
import Stars from '@/components/svg/Stars';
import Deferred from '@/components/three/Deferred';
import { KC, SerifNum } from '@/constants/theme';
import { formatPrice, getCardTheme, getHighlights, getItemTier, getOverallVerdict, parseSummary, pickResultVariant } from '@/utils/format';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { AnalysisResult, analyzeWineList, WineItem } from '../utils/gemini';

// Three.js 场景代码分割:独立 chunk,不进首屏主包
const Scene = lazy(() => import('@/components/three/Scenes'));
// 3D 表盘从同一 chunk 取(保持代码分割完整)
const Gauge3D = lazy(() => import('@/components/three/Scenes').then(m => ({ default: m.Gauge3D })));

// 内容列最大宽度(宽屏居中,避免卡片被拉伸)
const SHELL = 600;

// djhh:中文段落词级断行 + 末行防孤字(RN-web 透传到 DOM)
const CJK = Platform.OS === 'web' ? ({ wordBreak: 'keep-all', overflowWrap: 'break-word', textWrap: 'pretty' } as any) : {};

const SCAN_STEPS = [
    { at: 0, label: '识别酒标与菜单文字' },
    { at: 3, label: '全网比价(淘宝 / 京东)' },
    { at: 7, label: '计算坑指数' },
    { at: 12, label: '生成毒舌点评' },
];

// 演示数据(?demo=pit / ?demo=quality):免调 API 预览四档卡片配色与排版
const DEMO_DATA: Record<string, AnalysisResult> = {
    pit: {
        type: 'menu',
        summary: '💰最值:长城天赋,店里卖得跟电商差不多,良心。 💸最贵:这瓶 1499 的奔富比电商贵出一只 iPhone。 😈点评:这酒单看着唬人,实则一半靠"看不懂"的进口名收智商税,懂行的直接点长城走人。',
        items: [
            { name: '奔富 BIN389 设拉子赤霞珠', menuPrice: 1499, onlinePrice: 558, ratio: 2.69, diff: 941, characteristics: '澳洲名庄,商务宴请硬通货,但餐厅加价最狠', rating: 8.6, roast: '这价够买俩瓶还多张电影票', knowledge: '澳洲南澳产区,奔富 BIN 系列经典款,设拉子为主混赤霞珠,可陈放 10 年以上。' },
            { name: '拉菲传奇波尔多', menuPrice: 880, onlinePrice: 328, ratio: 2.68, diff: 552, characteristics: '入门级"拉菲",名字唬人,品质普通', rating: 7.2, roast: '蹭"拉菲"俩字,溢价翻倍', knowledge: '法国波尔多大区级,拉菲罗斯柴尔德旗下入门系列,与正牌古堡是两回事。' },
            { name: '黄尾袋鼠西拉', menuPrice: 188, onlinePrice: 79, ratio: 2.38, diff: 109, characteristics: '澳洲走量餐酒,果味直接,日常口粮', rating: 6.8, roast: '超市常客,这儿翻倍卖', knowledge: '澳洲畅销餐酒品牌,西拉葡萄,果味浓郁易入口,适合配烤肉与日常小酌。' },
            { name: '长城天赋赤霞珠', menuPrice: 268, onlinePrice: 218, ratio: 1.23, diff: 50, characteristics: '国产老牌,价格透明,宴客不踩雷', rating: 7.5, roast: '加价克制,这桌唯一良心', knowledge: '国产老牌中粮长城旗下,河北/宁夏赤霞珠,性价比稳,商务宴请安全牌。' },
        ],
    },
    quality: {
        type: 'single',
        summary: '💰最值:这几瓶里巴黎之花最实在。 💸最贵:不用说也是黑桃 A。 😈点评:桌上这几瓶搭配挺讲究,有面子也喝得下去,识货。',
        items: [
            { name: 'Armand de Brignac 黑桃 A 香槟', menuPrice: null, onlinePrice: 4280, ratio: null, diff: null, characteristics: '夜店顶流,金瓶气场全开,口感其实细腻', rating: 9.1, roast: '气场拉满,钱包阵亡', knowledge: '法国香槟区,金属漆金瓶辨识度极高,黑桃符号是其标志,夜店与名流圈宠儿。' },
            { name: '唐培里侬香槟王 2013', menuPrice: null, onlinePrice: 1880, ratio: null, diff: null, characteristics: '香槟标杆,矿物感强,陈年潜力佳', rating: 8.9, roast: '懂行的都点它,不踩雷', knowledge: '酩悦旗下顶级年份香槟,只在好年份出品,以矿物感和陈年潜力著称。' },
            { name: '巴黎之花美丽时光', menuPrice: null, onlinePrice: 1280, ratio: null, diff: null, characteristics: '花卉瓶身,优雅花香,送礼有面', rating: 8.4, roast: '颜值即正义,送礼真香', knowledge: '巴黎之花顶级款,手绘银扣银莲花瓶身,白中白风格,花香优雅适合送礼。' },
        ],
    },
    error: { type: 'menu', summary: '', items: [], error: '网络连接超时(演示)' },
};

/** 毒舌点评 单行小节:图标 + 标签 + 内容 */
function SummaryRow({ icon, label, labelColor, text, last }: { icon: React.ReactNode; label: string; labelColor: string; text: string; last?: boolean }) {
    return (
        <View
            className="flex-row items-start"
            style={last ? undefined : { marginBottom: 11, paddingBottom: 11, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}
        >
            <View style={{ marginTop: 1, marginRight: 10 }}>{icon}</View>
            <View className="flex-1">
                <Text className="text-[11px] font-black mb-0.5" style={{ color: labelColor, letterSpacing: 3 }}>{label}</Text>
                <Text className="text-[14px] font-medium" style={[{ color: KC.textHi, lineHeight: 23 }, CJK]}>{text}</Text>
            </View>
        </View>
    );
}

/** 突出价格块:店内价大号 + 电商对比条(空白=溢价部分) */
function PriceBlock({ wine }: { wine: WineItem }) {
    const menu = wine.menuPrice;
    const online = wine.onlinePrice;
    if (!menu && !online) return null;

    // 单品模式:仅电商参考价
    if (!menu && online) {
        return (
            <View className="mt-4 flex-row items-end">
                <View>
                    <Text className="text-[10px] mb-0.5 tracking-wider" style={{ color: KC.textLow }}>电商参考价</Text>
                    <Text className="num" style={{ color: KC.textHi, fontFamily: SerifNum, fontSize: 30, fontWeight: '800' }}>¥{formatPrice(online)}</Text>
                </View>
            </View>
        );
    }

    const max = Math.max(menu || 0, online || 0) || 1;
    const onlinePct = Math.max(6, ((online || 0) / max) * 100);
    return (
        <View className="mt-4">
            <View className="flex-row items-end justify-between mb-2.5">
                <View>
                    <Text className="text-[10px] mb-0.5 tracking-wider" style={{ color: KC.textLow }}>店内价</Text>
                    <Text className="num" style={{ color: KC.textHi, fontFamily: SerifNum, fontSize: 32, fontWeight: '800', lineHeight: 34 }}>¥{formatPrice(menu)}</Text>
                </View>
                <View className="items-end pb-1">
                    <Text className="text-[10px] mb-0.5 tracking-wider" style={{ color: KC.textLow }}>电商参考</Text>
                    <Text className="num" style={{ color: KC.mint, fontFamily: SerifNum, fontSize: 19, fontWeight: '700' }}>¥{formatPrice(online)}</Text>
                </View>
            </View>
            {/* 对比条:绿色=电商价,剩余空白=餐厅溢价 */}
            <View className="h-2.5 rounded-full overflow-hidden flex-row" style={{ backgroundColor: 'rgba(255,90,95,0.18)' }}>
                <View style={{ width: `${onlinePct}%`, backgroundColor: KC.mint, borderRadius: 999 }} />
            </View>
        </View>
    );
}

export default function ResultScreen() {
    const { imageUri, imageUris, demo, variant: variantOverride } = useLocalSearchParams<{ imageUri?: string; imageUris?: string; demo?: string; variant?: string }>();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const viewShotRef = useRef<View>(null);
    const [targetUris, setTargetUris] = useState<string[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // 可重复调用的分析(供首次加载与"重试"复用)
    const runAnalysis = useCallback((uris: string[]) => {
        setLoading(true);
        setResult(null);
        analyzeWineList(uris)
            .then(setResult)
            .catch(err => setResult({ type: 'menu', summary: '', items: [], error: err instanceof Error ? err.message : '分析失败,请重试' }))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        // 演示模式:免调 API 直接渲染样例数据
        if (demo && DEMO_DATA[demo]) {
            setResult(DEMO_DATA[demo]);
            setLoading(false);
            return;
        }

        let uris: string[] = [];
        if (imageUris) {
            try {
                uris = JSON.parse(imageUris);
            } catch (e) {
                console.error("Failed to parse imageUris", e);
                uris = [imageUris];
            }
        } else if (imageUri) {
            uris = [imageUri];
        }

        setTargetUris(uris);

        if (uris.length > 0) runAnalysis(uris);
        else setLoading(false);
    }, [imageUri, imageUris, demo, runAnalysis]);

    // ── 整单结论 ──
    const verdict = useMemo(() => (result ? getOverallVerdict(result) : null), [result]);
    const highlights = useMemo(() => (result ? getHighlights(result) : null), [result]);
    const parsed = useMemo(() => (result?.summary ? parseSummary(result.summary) : null), [result]);
    // 3D 形态:?variant=N 可手动预览 12 种;否则按结果内容选择
    const sceneVariant = useMemo(() => {
        if (variantOverride != null && variantOverride !== '') {
            const n = parseInt(variantOverride, 10);
            if (!isNaN(n)) return ((n % 12) + 12) % 12;
        }
        return result && verdict ? pickResultVariant(result, verdict) : 0;
    }, [result, verdict, variantOverride]);
    const displayItems = useMemo(() => {
        if (!result?.items) return [];
        if (verdict?.mode === 'quality') {
            return [...result.items].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        }
        return result.items; // menu 模式已按溢价排序(坑王榜)
    }, [result, verdict]);

    const handleShare = async () => {
        if (GlobalShareLock) return;
        GlobalShareLock = true;

        try {
            if (Platform.OS === 'web') {
                const top = verdict && result?.items?.length
                    ? `\n🏆 坑王:${result.items[0].name}`
                    : '';
                const shareText = `🍷 坑了么鉴定报告\n\n${result?.summary}${top}\n\n(快保存截图分享)`;
                await Clipboard.setStringAsync(shareText);
                alert("已复制文案!\nWeb 端请手动截图分享。\n(手机端 App 可自动生成长图)");
                return;
            }

            if (viewShotRef.current) {
                const uri = await captureRef(viewShotRef, {
                    format: 'png',
                    quality: 0.8,
                });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri);
                } else {
                    Alert.alert("提示", "无法调起系统分享");
                }
            }
        } catch (error) {
            console.error("Share failed", error);
            if (Platform.OS === 'web') {
                alert("分享功能异常,请手动截图");
            } else {
                Alert.alert("分享失败", "请重试");
            }
        } finally {
            GlobalShareLock = false;
        }
    };

    const handleSpeak = async () => {
        if (isSpeaking) {
            Speech.stop();
            setIsSpeaking(false);
        } else {
            if (result?.summary) {
                setIsSpeaking(true);
                Speech.speak(result.summary, {
                    language: 'zh',
                    rate: 1.0,
                    pitch: 1.0,
                    onDone: () => setIsSpeaking(false),
                    onStopped: () => setIsSpeaking(false),
                });
            }
        }
    };

    useEffect(() => {
        return () => {
            Speech.stop();
        };
    }, []);

    // ── 加载计时与步骤 ──
    const [seconds, setSeconds] = useState(0);
    useEffect(() => {
        if (!loading) return;
        const timer = setInterval(() => setSeconds(s => s + 0.1), 100);
        return () => clearInterval(timer);
    }, [loading]);

    const stepIndex = SCAN_STEPS.reduce((acc, s, i) => (seconds >= s.at ? i : acc), 0);

    // 进度条微光
    const shimmer = useSharedValue(0);
    useEffect(() => {
        shimmer.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
    }, [shimmer]);
    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: -80 + shimmer.value * 360 }],
    }));

    /* ════════ 加载态:扫描隧道 ════════ */
    if (loading) {
        return (
            <View className="flex-1 bg-void">
                <Deferred><Scene name="scan" /></Deferred>
                <SafeAreaView className="flex-1 items-center justify-center px-10" style={{ width: '100%', maxWidth: SHELL, alignSelf: 'center' }}>
                    {/* 计时 */}
                    <Reveal dy={8} className="items-center">
                        <Text style={{ color: KC.textHi, fontSize: 54, fontWeight: '700', fontFamily: SerifNum, letterSpacing: -1 }}>
                            {seconds.toFixed(1)}
                            <Text style={{ fontSize: 20, color: KC.textLow }}> s</Text>
                        </Text>
                        <Text className="text-xs tracking-[0.4em] font-bold mt-1" style={{ color: KC.gold }}>
                            AI 鉴定中
                        </Text>
                    </Reveal>

                    {/* 步骤清单 */}
                    <View className="w-full mt-10 rounded-2xl border px-5 py-4" style={{ backgroundColor: 'rgba(10,6,20,0.66)', borderColor: 'rgba(255,255,255,0.1)' }}>
                        {SCAN_STEPS.map((s, i) => {
                            const done = i < stepIndex;
                            const active = i === stepIndex;
                            return (
                                <View key={s.label} className="flex-row items-center py-2">
                                    <View
                                        className="w-5 h-5 rounded-full items-center justify-center mr-3"
                                        style={{
                                            backgroundColor: done ? KC.mint : active ? KC.crimson : 'rgba(255,255,255,0.08)',
                                            opacity: done || active ? 1 : 0.5,
                                        }}
                                    >
                                        {done ? <Check size={12} color="#06120D" strokeWidth={3.5} />
                                            : <View className="w-1.5 h-1.5 rounded-full bg-white" style={{ opacity: active ? 1 : 0.4 }} />}
                                    </View>
                                    <Text
                                        className="text-[13px] font-medium"
                                        style={{ color: active ? KC.textHi : done ? KC.textMid : KC.textLow }}
                                    >
                                        {s.label}
                                        {active && '…'}
                                    </Text>
                                </View>
                            );
                        })}

                        {/* 进度条 */}
                        <View className="h-1 rounded-full overflow-hidden mt-3" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                            <Animated.View style={[shimmerStyle, { width: 90, height: '100%' }]}>
                                <LinearGradient
                                    colors={['rgba(255,46,126,0)', '#FF2E7E', 'rgba(255,46,126,0)']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={{ flex: 1 }}
                                />
                            </Animated.View>
                        </View>
                    </View>

                    <Text className="text-xs mt-4" style={{ color: KC.textLow }}>
                        正在分析 {targetUris.length} 张图片 · Gemini 视觉大模型
                    </Text>

                    {/* 缩略图 */}
                    <View className="flex-row mt-6">
                        {targetUris.slice(0, 5).map((uri, i) => (
                            <Image
                                key={i}
                                source={{ uri }}
                                className="rounded-lg mx-1"
                                style={{ width: 44, height: 54, borderWidth: 1, borderColor: 'rgba(232,194,104,0.4)', opacity: 0.85 }}
                                resizeMode="cover"
                            />
                        ))}
                        {targetUris.length > 5 && (
                            <View className="w-11 rounded-lg mx-1 items-center justify-center" style={{ height: 54, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                                <Text style={{ color: KC.textMid }} className="text-xs font-bold">+{targetUris.length - 5}</Text>
                            </View>
                        )}
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    if (!result) return <View className="flex-1 bg-void" />;

    /* ════════ 错误态:重试,而非假数据 ════════ */
    if (result.error) {
        return (
            <View className="flex-1 bg-void">
                <LinearGradient colors={['#1A0710', '#0E0818', '#060410']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                <SafeAreaView className="flex-1 items-center justify-center px-10">
                    <View className="w-full items-center rounded-3xl border px-6 py-8" style={{ maxWidth: SHELL, backgroundColor: 'rgba(18,12,30,0.7)', borderColor: 'rgba(255,90,95,0.3)' }}>
                        <View className="mb-4"><VerdictMark kind="blaze" size={44} color={KC.blaze} /></View>
                        <Text className="font-black text-lg mb-1.5" style={{ color: KC.textHi }}>没能识别出来</Text>
                        <Text className="text-[13px] text-center leading-6 mb-1" style={[{ color: KC.textMid }, CJK]}>
                            可能是网络波动,或图片里的酒单文字不够清晰。
                        </Text>
                        <Text className="text-[11px] text-center mb-6" style={{ color: KC.textLow }} numberOfLines={2}>
                            {result.error}
                        </Text>
                        <TouchableOpacity onPress={() => runAnalysis(targetUris)} disabled={targetUris.length === 0} activeOpacity={0.88} className="w-full">
                            <LinearGradient colors={['#FF5A9C', '#FF2E7E', '#C2125C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="w-full py-3.5 rounded-2xl items-center">
                                <Text className="text-white font-black text-base tracking-widest">重新鉴定</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.dismissAll()} className="mt-4">
                            <Text className="text-[13px]" style={{ color: KC.textLow }}>换张图片 / 返回首页</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    /* ════════ 结果态:判决星海报告 ════════ */
    const tint = verdict?.tier.color || KC.crimson;
    return (
        <View className="flex-1 bg-void">
            <Deferred><Scene name="verdict" tint={tint} score={verdict?.score ?? 50} mood={verdict?.tier.key} variant={sceneVariant} /></Deferred>
            {/* 内容可读性:底部加深 */}
            <LinearGradient
                colors={['rgba(6,4,16,0.15)', 'rgba(6,4,16,0.55)', 'rgba(6,4,16,0.82)']}
                locations={[0, 0.55, 1]}
                pointerEvents="none"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />

            <SafeAreaView className="flex-1">
                {/* ── 顶栏(居中收窄)── */}
                <View className="w-full self-center px-5 py-3 flex-row justify-between items-center z-10" style={{ maxWidth: SHELL }}>
                    <TouchableOpacity
                        onPress={() => router.dismissAll()}
                        accessibilityRole="button" accessibilityLabel="返回首页"
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
                    >
                        <ArrowLeft color="white" size={21} />
                    </TouchableOpacity>
                    <View className="items-center">
                        <Text className="text-lg font-black tracking-widest" style={{ color: KC.textHi }}>
                            {result.type === 'single' ? '单品鉴定' : '鉴定报告'}
                        </Text>
                        <Text className="text-[9px] tracking-[0.4em] font-bold" style={{ color: KC.gold }}>KENG LE ME</Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleShare}
                        accessibilityRole="button" accessibilityLabel="分享鉴定报告"
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: 'rgba(255,46,126,0.16)', borderWidth: 1, borderColor: 'rgba(255,46,126,0.4)' }}
                    >
                        <Share2 color="#FF7EAE" size={19} />
                    </TouchableOpacity>
                </View>

                <View ref={viewShotRef} collapsable={false} className="flex-1" style={{ backgroundColor: 'transparent' }}>
                    <ScrollView
                        className="flex-1"
                        contentContainerStyle={{ paddingBottom: 48, paddingTop: 6, paddingHorizontal: 16, alignItems: 'center' }}
                        showsVerticalScrollIndicator={false}
                    >
                      <View style={{ width: '100%', maxWidth: SHELL }}>
                        {/* ── 整单判决卡 ── */}
                        {verdict && (
                            <Reveal>
                                <View
                                    className="rounded-[28px] border px-5 pt-5 pb-5 mb-3.5 overflow-hidden"
                                    style={{ backgroundColor: 'rgba(12,8,22,0.74)', borderColor: `${tint}66` }}
                                >
                                    {/* 顶部色辉 + 边缘高光 */}
                                    <LinearGradient
                                        colors={[`${tint}38`, 'rgba(0,0,0,0)']}
                                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110 }}
                                    />
                                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: tint, opacity: 0.9 }} />

                                    <View className="flex-row items-center">
                                        <Suspense fallback={<Gauge value={verdict.score} color={tint} label={verdict.mode === 'pit' ? '坑指数' : '品质分'} size={150} unit="/100" />}>
                                            <Gauge3D
                                                value={verdict.score}
                                                color={tint}
                                                label={verdict.mode === 'pit' ? '坑指数' : '品质分'}
                                                size={150}
                                                unit="/100"
                                            />
                                        </Suspense>
                                        <View className="flex-1 ml-3">
                                            <View className="self-start px-2.5 py-1 rounded-full mb-1.5" style={{ backgroundColor: `${tint}22`, borderWidth: 1, borderColor: `${tint}55` }}>
                                                <Text style={{ color: tint }} className="text-[10px] font-black tracking-widest">
                                                    {verdict.mode === 'pit' ? '整单结论' : '整体评价'}
                                                </Text>
                                            </View>
                                            <Text style={{ color: tint }} className="text-[26px] font-black tracking-wide leading-tight">
                                                {verdict.tier.emoji} {verdict.tier.label}
                                            </Text>
                                            <Text className="text-xs mt-1 leading-5" style={{ color: KC.textMid }}>
                                                {verdict.tier.line}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* 关键数字栏 */}
                                    <View className="flex-row mt-4 pt-3.5" style={{ borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                                        <View className="flex-1 items-center">
                                            <Text className="text-[10px] mb-0.5" style={{ color: KC.textLow }}>鉴定款数</Text>
                                            <Text className="text-lg font-bold" style={{ color: KC.textHi, fontFamily: SerifNum }}>
                                                {result.items?.length || 0}
                                            </Text>
                                        </View>
                                        <View className="w-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
                                        {verdict.mode === 'pit' ? (
                                            <>
                                                <View className="flex-1 items-center">
                                                    <Text className="text-[10px] mb-0.5" style={{ color: KC.textLow }}>整单总溢价</Text>
                                                    <Text className="text-lg font-bold num" style={{ color: KC.blaze, fontFamily: SerifNum }}>
                                                        ¥{formatPrice(verdict.totalPremium)}
                                                    </Text>
                                                </View>
                                                <View className="w-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
                                                <View className="flex-1 items-center">
                                                    <Text className="text-[10px] mb-0.5" style={{ color: KC.textLow }}>平均溢价</Text>
                                                    <Text className="text-lg font-bold" style={{ color: KC.gold, fontFamily: SerifNum }}>
                                                        {highlights?.avgRatio ? `${highlights.avgRatio.toFixed(1)}x` : '—'}
                                                    </Text>
                                                </View>
                                            </>
                                        ) : (
                                            <View className="flex-1 items-center">
                                                <Text className="text-[10px] mb-0.5" style={{ color: KC.textLow }}>最高评分</Text>
                                                <Text className="text-lg font-bold" style={{ color: KC.gold, fontFamily: SerifNum }}>
                                                    {highlights?.topRated ? highlights.topRated.rating.toFixed(1) : '—'}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </Reveal>
                        )}

                        {/* ── 关键发现(最坑 / 最值)── */}
                        {verdict?.mode === 'pit' && (highlights?.worst || highlights?.best) && (
                            <Reveal delay={60} className="flex-row mb-3.5" style={{ gap: 10 }}>
                                {highlights?.worst && (
                                    <View className="flex-1 rounded-2xl border px-3.5 py-3" style={{ backgroundColor: 'rgba(46,13,16,0.6)', borderColor: 'rgba(255,90,95,0.3)' }}>
                                        <Text className="text-[10px] font-bold tracking-wider mb-1" style={{ color: KC.blaze }}>💣 最坑</Text>
                                        <Text className="text-[12px] font-bold leading-4" style={{ color: KC.textHi }} numberOfLines={2}>{highlights.worst.name}</Text>
                                        <Text className="text-[11px] mt-1 num" style={{ color: KC.blaze, fontFamily: SerifNum }}>多赚 ¥{formatPrice(highlights.worst.premium)}</Text>
                                    </View>
                                )}
                                {highlights?.best && (
                                    <View className="flex-1 rounded-2xl border px-3.5 py-3" style={{ backgroundColor: 'rgba(14,42,33,0.6)', borderColor: 'rgba(46,230,168,0.3)' }}>
                                        <Text className="text-[10px] font-bold tracking-wider mb-1" style={{ color: KC.mint }}>✅ 最值</Text>
                                        <Text className="text-[12px] font-bold leading-4" style={{ color: KC.textHi }} numberOfLines={2}>{highlights.best.name}</Text>
                                        <Text className="text-[11px] mt-1" style={{ color: KC.mint, fontFamily: SerifNum }}>仅 {highlights.best.ratio.toFixed(1)}x 溢价</Text>
                                    </View>
                                )}
                            </Reveal>
                        )}

                        {/* ── 毒舌点评(结构化小节)── */}
                        <Reveal delay={90}>
                            <View
                                className="rounded-3xl border mb-5 overflow-hidden"
                                style={{ borderColor: 'rgba(255,46,126,0.32)' }}
                            >
                                <LinearGradient
                                    colors={['rgba(255,46,126,0.14)', 'rgba(255,46,126,0.05)']}
                                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                                />
                                {/* 头部 */}
                                <View className="flex-row items-center justify-between px-5 pt-4 pb-1">
                                    <View className="flex-row items-center">
                                        <RobotMark size={26} />
                                        <Text style={{ color: KC.crimson }} className="font-black text-base tracking-[0.2em] ml-2.5">毒舌点评</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={handleSpeak}
                                        accessibilityRole="button" accessibilityLabel={isSpeaking ? '停止朗读' : '朗读毒舌点评'}
                                        className="w-9 h-9 rounded-full items-center justify-center"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,126,174,0.3)' }}
                                    >
                                        {isSpeaking ? (
                                            <Square size={15} color="#FF7EAE" fill="#FF7EAE" />
                                        ) : (
                                            <Volume2 size={16} color="#FF7EAE" />
                                        )}
                                    </TouchableOpacity>
                                </View>

                                {/* 小节:最值 / 最贵 / 点评 */}
                                <View className="px-5 pb-4 pt-2">
                                    {parsed?.value || parsed?.expensive || parsed?.roast ? (
                                        <>
                                            {parsed?.value && (
                                                <SummaryRow icon={<CoinGlyph size={20} />} label="最值" labelColor={KC.mint} text={parsed.value} />
                                            )}
                                            {parsed?.expensive && (
                                                <SummaryRow icon={<PriceTagGlyph size={20} />} label="最贵" labelColor={KC.gold} text={parsed.expensive} />
                                            )}
                                            {parsed?.roast && (
                                                <SummaryRow icon={<FlameGlyph size={20} />} label="点评" labelColor={KC.crimson} text={parsed.roast} last />
                                            )}
                                        </>
                                    ) : (
                                        <Text className="text-[15px] font-medium" style={[{ color: KC.textHi, lineHeight: 27 }, CJK]}>
                                            {result.summary}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </Reveal>

                        {/* ── 榜单标题 ── */}
                        {displayItems.length > 0 && (
                            <Reveal delay={150} className="flex-row items-center mb-3 px-1">
                                <View className="flex-1 h-px" style={{ backgroundColor: 'rgba(232,194,104,0.25)' }} />
                                <Text className="mx-3 text-sm font-black tracking-[0.3em]" style={{ color: KC.gold }}>
                                    {verdict?.mode === 'pit' ? '坑 王 榜' : '品 质 榜'}
                                </Text>
                                <View className="flex-1 h-px" style={{ backgroundColor: 'rgba(232,194,104,0.25)' }} />
                            </Reveal>
                        )}

                        {/* ── 酒款卡片(按档位配色)── */}
                        {displayItems.map((wine, index) => {
                            const tier = getItemTier(wine);
                            const theme = getCardTheme(tier);
                            const isKingOfPits = verdict?.mode === 'pit' && index === 0 && tier.key === 'blaze';
                            return (
                                <Reveal key={`${wine.name}-${index}`} delay={200 + Math.min(index, 8) * 70}>
                                    <View
                                        className="rounded-[26px] border mb-3.5 overflow-hidden"
                                        style={{ borderColor: theme.border, borderWidth: isKingOfPits ? 1.5 : 1 }}
                                    >
                                        {/* 玻璃染色背景 */}
                                        <LinearGradient colors={theme.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                                        {/* 顶部色辉 */}
                                        <LinearGradient colors={[theme.glow, 'rgba(0,0,0,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 70 }} />
                                        {/* 左侧档位强调条 */}
                                        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, backgroundColor: theme.bar }} />

                                        {/* 坑王缎带 */}
                                        {isKingOfPits && (
                                            <View className="absolute top-0 left-0 px-3 py-1 rounded-br-2xl" style={{ backgroundColor: KC.blaze }}>
                                                <Text className="text-[10px] font-black tracking-widest" style={{ color: '#1A0407' }}>👑 本单坑王</Text>
                                            </View>
                                        )}

                                        <View className="p-5" style={{ paddingTop: isKingOfPits ? 26 : 20 }}>
                                            {/* 印章 */}
                                            <View pointerEvents="none" style={{ position: 'absolute', top: isKingOfPits ? 26 : 12, right: 12, opacity: 0.95 }}>
                                                <Seal label={tier.label} color={tier.color} sub={wine.ratio ? `${wine.ratio.toFixed(1)}x` : undefined} size={56} />
                                            </View>

                                            {/* 名称行 */}
                                            <View className="flex-row items-start">
                                                <Medal rank={index + 1} size={32} />
                                                <View className="flex-1 ml-3 mr-16">
                                                    <Text className="font-black text-[17px] leading-snug" style={{ color: KC.textHi }}>
                                                        {wine.name}
                                                    </Text>
                                                    <View className="flex-row items-center mt-1.5">
                                                        <Stars rating={wine.rating || 0} size={12} />
                                                        <Text className="ml-2 text-xs font-bold" style={{ color: KC.gold, fontFamily: SerifNum }}>
                                                            {(wine.rating || 0).toFixed(1)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>

                                            {/* 突出价格 */}
                                            <PriceBlock wine={wine} />

                                            {/* 溢价结论 */}
                                            {wine.diff !== null && wine.diff !== undefined && (
                                                <View className="flex-row items-center mt-3 flex-wrap" style={{ gap: 8 }}>
                                                    <View
                                                        className="px-3 py-1.5 rounded-lg flex-row items-center"
                                                        style={{ backgroundColor: wine.diff > 0 ? 'rgba(255,90,95,0.18)' : 'rgba(46,230,168,0.16)' }}
                                                    >
                                                        <Text className="text-[13px] font-black num" style={{ color: wine.diff > 0 ? KC.blaze : KC.mint }}>
                                                            {wine.diff > 0 ? `溢价 ¥${formatPrice(wine.diff)}` : `比电商低 ¥${formatPrice(Math.abs(wine.diff))}`}
                                                        </Text>
                                                    </View>
                                                    {wine.ratio && (
                                                        <View className="px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                                                            <Text className="text-[12px] font-bold num" style={{ color: KC.gold }}>{wine.ratio.toFixed(1)}× 电商价</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            )}

                                            {/* 毒舌一句 */}
                                            {!!wine.roast && (
                                                <View className="flex-row items-center mt-3.5 rounded-xl px-3.5 py-2.5" style={{ backgroundColor: 'rgba(255,46,126,0.10)', borderLeftWidth: 2, borderLeftColor: KC.crimson }}>
                                                    <FlameGlyph size={17} />
                                                    <Text className="flex-1 text-[13.5px] font-semibold ml-2" style={[{ color: '#FFB3D0', lineHeight: 20 }, CJK]}>{wine.roast}</Text>
                                                </View>
                                            )}

                                            {/* 知识介绍 + 风味 */}
                                            {(!!wine.knowledge || !!wine.characteristics) && (
                                                <View className="rounded-xl mt-2.5 overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.24)' }}>
                                                    {!!wine.knowledge && (
                                                        <View className="flex-row items-start px-3.5 py-3">
                                                            <View style={{ marginTop: 1, marginRight: 9 }}><BookGlyph size={17} color={KC.gold} /></View>
                                                            <View className="flex-1">
                                                                <Text className="text-[10px] font-black mb-0.5" style={{ color: KC.gold, letterSpacing: 2 }}>冷 知 识</Text>
                                                                <Text className="text-[13px]" style={[{ color: KC.textMid, lineHeight: 21 }, CJK]}>{wine.knowledge}</Text>
                                                            </View>
                                                        </View>
                                                    )}
                                                    {!!wine.knowledge && !!wine.characteristics && (
                                                        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 14 }} />
                                                    )}
                                                    {!!wine.characteristics && (
                                                        <View className="flex-row items-start px-3.5 py-3">
                                                            <View style={{ marginTop: 1, marginRight: 9 }}><TasteGlyph size={17} /></View>
                                                            <View className="flex-1">
                                                                <Text className="text-[10px] font-black mb-0.5" style={{ color: KC.goldSoft, letterSpacing: 2 }}>风 味</Text>
                                                                <Text className="text-[13px]" style={[{ color: KC.textMid, lineHeight: 21 }, CJK]}>{wine.characteristics}</Text>
                                                            </View>
                                                        </View>
                                                    )}
                                                </View>
                                            )}

                                            {/* 推荐结论(突出) */}
                                            <View className="flex-row items-center mt-3.5 self-start px-3.5 py-2 rounded-full" style={{ backgroundColor: `${theme.accent}1F`, borderWidth: 1, borderColor: `${theme.accent}55` }}>
                                                <VerdictMark kind={tier.key} size={15} color={theme.accent} />
                                                <Text className="text-[13px] font-black tracking-wide ml-1.5" style={{ color: theme.accent }}>
                                                    {theme.advice}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </Reveal>
                            );
                        })}

                        {/* 空结果兜底 */}
                        {displayItems.length === 0 && (
                            <View className="rounded-3xl border p-8 items-center" style={{ backgroundColor: 'rgba(18,12,30,0.8)', borderColor: 'rgba(255,255,255,0.1)' }}>
                                <Text className="text-4xl mb-3">🧐</Text>
                                <Text className="font-bold text-base mb-1" style={{ color: KC.textHi }}>没认出酒款</Text>
                                <Text className="text-xs text-center leading-5" style={{ color: KC.textLow }}>
                                    光线充足、酒单文字清晰时识别率更高,换张图再试试
                                </Text>
                            </View>
                        )}

                        {/* 页脚 */}
                        <View className="items-center mt-7">
                            <Text className="text-[9px] tracking-[0.3em] uppercase font-bold" style={{ color: 'rgba(247,243,249,0.28)' }}>
                                POWERED BY BRIGHT305 · 坑了么 AI
                            </Text>
                        </View>
                      </View>
                    </ScrollView>
                </View>
            </SafeAreaView>
        </View>
    );
}
// global var hack to prevent rapid duplicate shares
let GlobalShareLock = false;
