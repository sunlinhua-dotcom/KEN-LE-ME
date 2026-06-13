import Gauge from '@/components/svg/Gauge';
import Medal from '@/components/svg/Medal';
import PriceBars from '@/components/svg/PriceBars';
import Seal from '@/components/svg/Seal';
import Stars from '@/components/svg/Stars';
import Reveal from '@/components/anim/Reveal';
import Deferred from '@/components/three/Deferred';
import { KC, SerifNum } from '@/constants/theme';
import { formatPrice, getItemTier, getOverallVerdict } from '@/utils/format';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';
import { ArrowLeft, Check, Share2, Square, Volume2 } from '@/components/svg/Icons';
import React, { lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { AnalysisResult, analyzeWineList } from '../utils/gemini';

// Three.js 场景代码分割:独立 chunk,不进首屏主包
const Scene = lazy(() => import('@/components/three/Scenes'));

const SCAN_STEPS = [
    { at: 0, label: '识别酒标与菜单文字' },
    { at: 3, label: '全网比价(淘宝 / 京东)' },
    { at: 7, label: '计算坑指数' },
    { at: 12, label: '生成毒舌点评' },
];

export default function ResultScreen() {
    const { imageUri, imageUris } = useLocalSearchParams<{ imageUri?: string; imageUris?: string }>();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const viewShotRef = useRef<View>(null);
    const [targetUris, setTargetUris] = useState<string[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);

    useEffect(() => {
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

        if (uris.length > 0) {
            analyzeWineList(uris)
                .then(data => setResult(data))
                .catch(err => {
                    console.error(err);
                    Alert.alert("Error", "Analysis failed");
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [imageUri, imageUris]);

    // ── 整单结论 ──
    const verdict = useMemo(() => (result ? getOverallVerdict(result) : null), [result]);
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
                <SafeAreaView className="flex-1 items-center justify-center px-10">
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

    /* ════════ 结果态:极光报告 ════════ */
    return (
        <View className="flex-1 bg-void">
            <Deferred><Scene name="aurora" /></Deferred>

            <SafeAreaView className="flex-1">
                {/* ── 顶栏 ── */}
                <View className="px-5 py-3 flex-row justify-between items-center z-10">
                    <TouchableOpacity
                        onPress={() => router.dismissAll()}
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
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: 'rgba(255,46,126,0.16)', borderWidth: 1, borderColor: 'rgba(255,46,126,0.4)' }}
                    >
                        <Share2 color="#FF7EAE" size={19} />
                    </TouchableOpacity>
                </View>

                <View ref={viewShotRef} collapsable={false} className="flex-1" style={{ backgroundColor: 'transparent' }}>
                    <ScrollView
                        className="flex-1 px-4"
                        contentContainerStyle={{ paddingBottom: 48, paddingTop: 6 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* ── 整单判决卡 ── */}
                        {verdict && (
                            <Reveal>
                                <View
                                    className="rounded-3xl border px-5 pt-5 pb-4 mb-4 overflow-hidden"
                                    style={{ backgroundColor: 'rgba(16,10,28,0.78)', borderColor: `${verdict.tier.color}55` }}
                                >
                                    {/* 顶部色辉 */}
                                    <LinearGradient
                                        colors={[`${verdict.tier.color}30`, 'rgba(0,0,0,0)']}
                                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 90 }}
                                    />
                                    <View className="flex-row items-center">
                                        <Gauge
                                            value={verdict.score}
                                            color={verdict.tier.color}
                                            label={verdict.mode === 'pit' ? '坑指数' : '品质分'}
                                            size={146}
                                        />
                                        <View className="flex-1 ml-4">
                                            <Text style={{ color: verdict.tier.color }} className="text-2xl font-black tracking-wide">
                                                {verdict.tier.emoji} {verdict.tier.label}
                                            </Text>
                                            <Text className="text-xs mt-1.5 leading-5" style={{ color: KC.textMid }}>
                                                {verdict.tier.line}
                                            </Text>
                                            <View className="flex-row mt-3">
                                                <View className="mr-5">
                                                    <Text className="text-[10px]" style={{ color: KC.textLow }}>鉴定款数</Text>
                                                    <Text className="text-base font-bold" style={{ color: KC.textHi, fontFamily: SerifNum }}>
                                                        {result.items?.length || 0}
                                                    </Text>
                                                </View>
                                                {verdict.mode === 'pit' && verdict.totalPremium > 0 && (
                                                    <View>
                                                        <Text className="text-[10px]" style={{ color: KC.textLow }}>整单总溢价</Text>
                                                        <Text className="text-base font-bold" style={{ color: KC.blaze, fontFamily: SerifNum }}>
                                                            ¥{formatPrice(verdict.totalPremium)}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </Reveal>
                        )}

                        {/* ── 毒舌点评 ── */}
                        <Reveal delay={90}>
                            <View
                                className="rounded-3xl border p-5 mb-5"
                                style={{ backgroundColor: 'rgba(255,46,126,0.07)', borderColor: 'rgba(255,46,126,0.30)' }}
                            >
                                <View className="flex-row items-center justify-between mb-2.5">
                                    <View className="flex-row items-center">
                                        <Text className="text-xl mr-2">🤖</Text>
                                        <Text style={{ color: KC.crimson }} className="font-black text-base tracking-widest">毒舌点评</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={handleSpeak}
                                        className="w-9 h-9 rounded-full items-center justify-center"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                                    >
                                        {isSpeaking ? (
                                            <Square size={16} color="#FF7EAE" fill="#FF7EAE" />
                                        ) : (
                                            <Volume2 size={17} color="#FF7EAE" />
                                        )}
                                    </TouchableOpacity>
                                </View>
                                <Text className="text-[15px] font-medium" style={{ color: KC.textHi, lineHeight: 26 }}>
                                    {result.summary}
                                </Text>
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

                        {/* ── 酒款卡片 ── */}
                        {displayItems.map((wine, index) => {
                            const tier = getItemTier(wine);
                            return (
                                <Reveal key={`${wine.name}-${index}`} delay={200 + Math.min(index, 8) * 70}>
                                    <View
                                        className="rounded-3xl border p-5 mb-3.5 overflow-hidden"
                                        style={{ backgroundColor: 'rgba(18,12,30,0.82)', borderColor: 'rgba(255,255,255,0.10)' }}
                                    >
                                        {/* 印章 */}
                                        <View pointerEvents="none" style={{ position: 'absolute', top: 10, right: 10, opacity: 0.92 }}>
                                            <Seal label={tier.label} color={tier.color} sub={wine.ratio ? `${wine.ratio.toFixed(1)}x` : undefined} size={58} />
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

                                        {/* 价格对比 */}
                                        {(wine.menuPrice || wine.onlinePrice) && (
                                            <View className="mt-4">
                                                <PriceBars menuPrice={wine.menuPrice} onlinePrice={wine.onlinePrice} />
                                            </View>
                                        )}

                                        {/* 溢价结论 */}
                                        {wine.diff !== null && wine.diff !== undefined && (
                                            <View className="flex-row items-center mt-2.5">
                                                <View
                                                    className="px-3 py-1 rounded-full"
                                                    style={{ backgroundColor: wine.diff > 0 ? 'rgba(255,90,95,0.14)' : 'rgba(46,230,168,0.13)' }}
                                                >
                                                    <Text className="text-xs font-bold" style={{ color: wine.diff > 0 ? KC.blaze : KC.mint }}>
                                                        {wine.diff > 0 ? `商家多赚 ¥${formatPrice(wine.diff)}` : `低于电商 ¥${formatPrice(Math.abs(wine.diff))}`}
                                                    </Text>
                                                </View>
                                                <Text className="ml-2 text-[11px]" style={{ color: KC.textLow }}>{tier.line}</Text>
                                            </View>
                                        )}

                                        {/* 特色 */}
                                        {!!wine.characteristics && (
                                            <View
                                                className="rounded-xl px-3.5 py-3 mt-3.5 border"
                                                style={{ backgroundColor: 'rgba(255,255,255,0.045)', borderColor: 'rgba(255,255,255,0.07)' }}
                                            >
                                                <Text className="text-[13px] leading-5" style={{ color: KC.textMid }}>
                                                    🍷 {wine.characteristics}
                                                </Text>
                                            </View>
                                        )}
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
                    </ScrollView>
                </View>
            </SafeAreaView>
        </View>
    );
}
// global var hack to prevent rapid duplicate shares
let GlobalShareLock = false;
