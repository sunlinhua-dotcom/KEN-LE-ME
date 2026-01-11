import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';
import { ArrowLeft, Share2, Square, Star, Volume2 } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { AnalysisResult, analyzeWineList, WineItem } from '../utils/gemini';

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
                // Fallback to treat as single string if not JSON array
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
            // Fallback for empty state or error
            // Maybe redirect back?
            setLoading(false);
        }
    }, [imageUri, imageUris]);

    const handleShare = async () => {
        if (GlobalShareLock) return;
        GlobalShareLock = true;

        try {
            // Web Sharing Logic
            if (Platform.OS === 'web') {
                const shareText = `🍷 坑了么分析报告\n\n${result?.summary}\n\n(快保存截图分享)`;
                await Clipboard.setStringAsync(shareText);
                alert("已复制文案！\nWeb端请手动截图分享。\n(手机端App可自动生成长图)");
                return;
            }

            // Native Sharing Logic
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
                alert("分享功能异常，请手动截图");
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

    // Stop speaking when leaving screen
    useEffect(() => {
        return () => {
            Speech.stop();
        };
    }, []);

    const getBadge = (item: WineItem) => {
        if (!item.menuPrice || !item.ratio) {
            return { text: '🔍 鉴定', color: 'bg-blue-500' };
        }
        const ratio = item.ratio;
        if (ratio < 1.5) return { text: '✅ 良心', color: 'bg-green-500' };
        if (ratio < 2.5) return { text: '👌 正常', color: 'bg-yellow-500' };
        return { text: '💣 巨坑', color: 'bg-red-500' };
    };

    // Timer state ... (Same as before)
    const [seconds, setSeconds] = useState(0);
    const [loadingText, setLoadingText] = useState("正在连接 AI 大脑...");

    useEffect(() => {
        let timer: NodeJS.Timeout;
        let textTimer: NodeJS.Timeout;
        if (loading) {
            timer = setInterval(() => {
                setSeconds(s => s + 0.1);
            }, 100);

            const messages = [
                "正在识别酒标...",
                "正在扫描年份...",
                "正在全网比价 (淘宝/京东)...",
                "AI正在组织语言...",
                "正在计算防坑指数...",
                "正在分析多张图片..."
            ];
            textTimer = setInterval(() => {
                setLoadingText(messages[Math.floor(Math.random() * messages.length)]);
            }, 1500);

            return () => {
                clearInterval(timer);
                clearInterval(textTimer);
            };
        }
    }, [loading]);

    if (loading) {
        return (
            <View className="flex-1 bg-[#0F0F1A] items-center justify-center px-8">
                <View className="w-24 h-24 rounded-full border-4 border-pink-500/30 items-center justify-center mb-8">
                    <ActivityIndicator size="large" color="#FF1493" />
                    <View className="absolute w-24 h-24 rounded-full border-t-4 border-pink-500 animate-spin" />
                </View>

                <Text className="text-white font-bold text-2xl mb-2">{seconds.toFixed(1)}s</Text>
                <Text className="text-pink-400 font-bold text-lg text-center mb-4">{loadingText}</Text>
                <Text className="text-gray-400 text-sm mb-4">
                    正在分析 {targetUris.length} 张图片...
                </Text>

                <View className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                    <View className="h-full bg-pink-500 w-1/2" />
                </View>
                <Text className="text-gray-500 text-xs mt-4 text-center">
                    正在调用 Gemini 3.0 Pro 模型进行深度分析...
                </Text>
            </View>
        );
    }

    if (!result) return <View className="flex-1 bg-black" />;

    return (
        <LinearGradient
            colors={['#0F0F1A', '#2D1B36']}
            className="flex-1"
        >
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 py-4 flex-row justify-between items-center z-10">
                    <TouchableOpacity onPress={() => router.dismissAll()} className="p-2 bg-white/10 rounded-full">
                        <ArrowLeft color="white" size={24} />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold">
                        {result.type === 'single' ? '单品鉴定' : '酒单分析'}
                    </Text>
                    <TouchableOpacity
                        onPress={handleShare}
                        className="p-2 bg-white/10 rounded-full active:bg-white/30"
                    >
                        <Share2 color="white" size={24} />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View
                    ref={viewShotRef}
                    collapsable={false}
                    className="flex-1 bg-transparent"
                >
                    <ScrollView
                        className="flex-1 px-4 pt-4"
                        contentContainerStyle={{ paddingBottom: 40 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Image Carousel (for multiple images) */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            className="mb-6 flex-grow-0"
                            contentContainerStyle={{ paddingHorizontal: 0 }}
                        >
                            {targetUris.map((uri, idx) => (
                                <View key={idx} className="mr-3">
                                    <Image
                                        source={{ uri }}
                                        className="w-32 h-32 rounded-xl border border-white/20"
                                        resizeMode="cover"
                                    />
                                </View>
                            ))}
                        </ScrollView>

                        {/* Summary Card and Wine List (Rest is same) ... */}
                        <View className="bg-white/10 p-6 rounded-2xl mb-6 border border-pink-500/30 shadow-lg shadow-pink-500/20">
                            <View className="flex-row items-center justify-between mb-3">
                                <View className="flex-row items-center">
                                    <Text className="text-2xl mr-2">🤖</Text>
                                    <Text className="text-pink-400 font-bold text-lg">毒舌点评</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={handleSpeak}
                                    className="bg-white/10 p-2 rounded-full active:bg-pink-500/20"
                                >
                                    {isSpeaking ? (
                                        <Square size={20} color="#F472B6" fill="#F472B6" />
                                    ) : (
                                        <Volume2 size={20} color="#F472B6" />
                                    )}
                                </TouchableOpacity>
                            </View>
                            <Text className="text-white text-lg leading-relaxed font-medium">
                                {result.summary}
                            </Text>
                        </View>

                        <View className="space-y-4">
                            {result.items.map((wine, index) => {
                                const badge = getBadge(wine);
                                return (
                                    <View key={index} className="bg-white rounded-2xl p-5 shadow-lg">
                                        <View className="flex-row justify-between items-start mb-3">
                                            <View className="flex-1 mr-2">
                                                <Text className="text-black font-extrabold text-xl leading-tight mb-1">{wine.name}</Text>
                                                <View className="flex-row items-center space-x-2">
                                                    <View className="flex-row items-center">
                                                        <Star fill="#FCD34D" stroke="none" size={14} />
                                                        <Text className="text-black font-bold ml-1">{wine.rating}/10</Text>
                                                    </View>
                                                </View>
                                            </View>
                                            <View className="items-end">
                                                {wine.menuPrice ? (
                                                    <Text className="text-orange-500 text-3xl font-black tracking-tighter">
                                                        ¥{wine.menuPrice}
                                                    </Text>
                                                ) : (
                                                    <Text className="text-gray-400 text-sm font-bold">店内价未知</Text>
                                                )}
                                            </View>
                                        </View>

                                        <View className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100">
                                            <Text className="text-gray-700 text-sm font-medium leading-relaxed">
                                                🍷 <Text className="font-bold">特色：</Text>{wine.characteristics}
                                            </Text>
                                        </View>

                                        <View className="flex-row justify-between items-center pt-2 border-t border-gray-100">
                                            <View>
                                                <Text className="text-gray-500 text-xs">
                                                    电商参考价: <Text className="font-bold text-gray-700">
                                                        {wine.onlinePrice ? `¥${wine.onlinePrice}` : '查询中'}
                                                    </Text>
                                                </Text>
                                                {wine.diff !== null && wine.diff !== undefined && (
                                                    <Text className="text-gray-500 text-xs mt-1">
                                                        {wine.diff > 0 ? '商家溢价: ' : '低于电商: '}
                                                        <Text className={`font-bold ${wine.diff > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                            ¥{Math.abs(wine.diff)}
                                                        </Text>
                                                    </Text>
                                                )}
                                            </View>

                                            <View className={`px-4 py-3 rounded-full ${badge.color} flex-row items-center shadow-md`}>
                                                <Text className="text-white text-base font-black mr-1">{badge.text}</Text>
                                                {wine.ratio && (
                                                    <Text className="text-white text-sm font-bold">
                                                        ({wine.ratio.toFixed(1)}x)
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        <View className="items-center mt-8 opacity-50">
                            <Text className="text-white text-xs tracking-widest uppercase">POWERED BY BRIGHT305</Text>
                        </View>

                    </ScrollView>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
}
// global var hack to prevent rapid duplicate shares
let GlobalShareLock = false;
