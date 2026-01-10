import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, Share2, Star } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { AnalysisResult, analyzeWineList, WineItem } from '../utils/gemini';

export default function ResultScreen() {
    const { imageUri } = useLocalSearchParams<{ imageUri: string }>();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const viewShotRef = useRef<View>(null); // Ref for the visual area to capture

    useEffect(() => {
        if (imageUri) {
            analyzeWineList(imageUri)
                .then(data => setResult(data))
                .catch(err => {
                    console.error(err);
                    Alert.alert("Error", "Analysis failed");
                })
                .finally(() => setLoading(false));
        } else {
            analyzeWineList("").then(data => {
                setResult(data);
                setLoading(false);
            });
        }
    }, [imageUri]);

    const handleShare = async () => {
        if (GlobalShareLock) return;
        GlobalShareLock = true;

        try {
            // Web Sharing Logic
            if (Platform.OS === 'web') {
                const shareText = `🍷 坑了么分析报告\n\n${result?.summary}\n\n(快保存截图分享)`;
                await Clipboard.setStringAsync(shareText);
                // Force an alert on Web so user knows something happened
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

    const getBadge = (item: WineItem) => {
        if (!item.menuPrice || !item.ratio) {
            return { text: '🔍 鉴定', color: 'bg-blue-500' };
        }
        const ratio = item.ratio;
        if (ratio < 1.5) return { text: '✅ 良心', color: 'bg-green-500' };
        if (ratio < 2.5) return { text: '👌 正常', color: 'bg-yellow-500' };
        return { text: '💣 巨坑', color: 'bg-red-500' };
    };

    if (loading) {
        return (
            <View className="flex-1 bg-[#0F0F1A] items-center justify-center px-8">
                <ActivityIndicator size="large" color="#FF1493" />
                <Text className="text-white mt-6 font-bold text-xl text-center">AI 侍酒师正在赶来...</Text>
                <Text className="text-gray-500 text-sm mt-3 text-center">
                    正在识别酒标、年份、产区...
                    {"\n"}
                    并全网比价中...
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
                    <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white/10 rounded-full">
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

                {/* 
                   Wrap the content we want to screenshot in a View that supports ref.
                   ScrollView usually works with viewShot but sometimes has issues with long content on Android.
                   For now, we capture the visible ScrollView area.
                */}
                <View
                    ref={viewShotRef}
                    collapsable={false}
                    className="flex-1 bg-transparent" // Important for capture
                >
                    <ScrollView
                        className="flex-1 px-4 pt-4"
                        contentContainerStyle={{ paddingBottom: 40 }}
                        showsVerticalScrollIndicator={false}
                    >

                        {/* Uploaded Image Thumbnail (Small) */}
                        <View className="items-center mb-6">
                            <Image
                                source={{ uri: imageUri }}
                                className="w-32 h-32 rounded-xl border border-white/20"
                                resizeMode="cover"
                            />
                        </View>

                        {/* Summary Card */}
                        <View className="bg-white/10 p-6 rounded-2xl mb-6 border border-pink-500/30 shadow-lg shadow-pink-500/20">
                            <View className="flex-row items-center mb-3">
                                <Text className="text-2xl mr-2">🤖</Text>
                                <Text className="text-pink-400 font-bold text-lg">毒舌点评</Text>
                            </View>
                            <Text className="text-white text-lg leading-relaxed font-medium">
                                {result.summary}
                            </Text>
                        </View>

                        {/* Wine List */}
                        <View className="space-y-4">
                            {result.items.map((wine, index) => {
                                const badge = getBadge(wine);
                                return (
                                    <View key={index} className="bg-white rounded-2xl p-5 shadow-lg">
                                        {/* Top Row: Name & Price */}
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

                                        {/* Middle: Characteristics */}
                                        <View className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100">
                                            <Text className="text-gray-700 text-sm font-medium leading-relaxed">
                                                🍷 <Text className="font-bold">特色：</Text>{wine.characteristics}
                                            </Text>
                                        </View>

                                        {/* Bottom: Logic & Badge */}
                                        <View className="flex-row justify-between items-center pt-2 border-t border-gray-100">
                                            <Text className="text-gray-500 text-xs text-right">
                                                电商参考价: <Text className="font-bold text-gray-700">
                                                    {wine.onlinePrice ? `¥${wine.onlinePrice}` : '查询中'}
                                                </Text>
                                            </Text>

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

                        {/* Footer branding for screenshot */}
                        <View className="items-center mt-8 opacity-50">
                            <Text className="text-white text-xs tracking-widest uppercase">Powered by 坑了么 AI</Text>
                        </View>

                    </ScrollView>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
}
// global var hack to prevent rapid duplicate shares
let GlobalShareLock = false;
