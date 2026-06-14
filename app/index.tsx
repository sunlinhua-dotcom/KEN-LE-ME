import Logo from '@/components/svg/Logo';
import Reveal from '@/components/anim/Reveal';
import Deferred from '@/components/three/Deferred';
import { KC } from '@/constants/theme';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowRight, Camera, Globe, ImageIcon, MapPin, Plus, X } from '@/components/svg/Icons';
import { lazy, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

// Three.js 场景代码分割:打成独立 chunk,首屏主包不含 Three.js
const Scene = lazy(() => import('@/components/three/Scenes'));

const CAPABILITIES = ['红酒', '雪茄', '酒单', '菜单', '小票', '外卖截图'];

export default function HomeScreen() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [selectedImages, setSelectedImages] = useState<string[]>([]);

    // 3D 场景默认渲染;仅在页面失焦(被结果页覆盖)时暂停省电
    const [scenePaused, setScenePaused] = useState(false);
    useFocusEffect(useCallback(() => {
        setScenePaused(false);
        return () => setScenePaused(true);
    }, []));

    const buzz = () => {
        if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        }
    };

    // 释放 web 端 createObjectURL 产生的 blob,避免内存泄漏(原生 file:// 不处理)
    const revokeIfBlob = (uri: string) => {
        if (Platform.OS === 'web' && typeof uri === 'string' && uri.startsWith('blob:')) {
            try { URL.revokeObjectURL(uri); } catch { /* noop */ }
        }
    };

    const processImage = (result: ImagePicker.ImagePickerResult) => {
        if (!result.canceled && result.assets && result.assets.length > 0) {
            const newUris = result.assets.map(asset => asset.uri);
            setSelectedImages(prev => [...prev, ...newUris]);
        }
    };

    const handleAnalyze = () => {
        if (selectedImages.length === 0) return;
        buzz();

        router.push({
            pathname: '/result',
            params: { imageUris: JSON.stringify(selectedImages) }
        });

        // Clear state shortly after navigation so it's clean on return
        setTimeout(() => {
            setSelectedImages([]);
        }, 500);
    };

    // Web-specific file handler to bypass Expo ImagePicker issues on Android/ColorOS
    const handleWebUpload = (mode: 'camera' | 'gallery') => {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            // 挂到 DOM:部分微信 / 老 iOS WebView 会忽略游离 input 的 click
            input.style.cssText = 'position:fixed;top:-100px;left:-100px;width:1px;height:1px;opacity:0;';
            document.body.appendChild(input);

            if (mode === 'camera') {
                input.capture = 'environment';
            } else {
                input.multiple = true;
            }

            input.onchange = (event: any) => {
                const files = event.target.files;
                if (files && files.length > 0) {
                    setIsLoading(true);
                    setLoadingMessage("正在处理图片...");

                    const newUris = Array.from(files).map((file: any) => URL.createObjectURL(file));

                    setTimeout(() => {
                        setSelectedImages(prev => [...prev, ...newUris]);
                        setIsLoading(false);
                    }, 500);
                }
                input.remove();
            };

            setIsLoading(true);
            setLoadingMessage(mode === 'camera' ? "正在启动相机..." : "正在打开相册...");

            setTimeout(() => {
                input.click();
                // 浏览器取消选择不会触发事件,2.5s 后自动收起加载层
                setTimeout(() => {
                    setIsLoading(false);
                    setLoadingMessage("");
                }, 2500);
            }, 100);

        } catch (e) {
            console.error(e);
            Alert.alert("错误", "无法调起系统选择器");
            setIsLoading(false);
        }
    };

    const takePhoto = async () => {
        buzz();
        if (Platform.OS === 'web') {
            handleWebUpload('camera');
            return;
        }

        try {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert("需要权限", "请允许访问相机以进行拍摄");
                return;
            }

            setIsLoading(true);
            setLoadingMessage("正在启动相机...");

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
            });
            processImage(result);
        } catch (error) {
            console.error("Camera Error:", error);
            Alert.alert("错误", "无法启动相机");
        } finally {
            setIsLoading(false);
            setLoadingMessage("");
        }
    };

    const pickImage = async () => {
        buzz();
        if (Platform.OS === 'web') {
            handleWebUpload('gallery');
            return;
        }

        try {
            setIsLoading(true);
            setLoadingMessage("正在加载相册...");

            await new Promise(resolve => setTimeout(resolve, 50));

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
                allowsMultipleSelection: true,
                selectionLimit: 10
            });

            if (!result.canceled) {
                setLoadingMessage("正在处理...");
                processImage(result);
            }
        } catch (error) {
            console.error("Gallery Error:", error);
            // 部分 Android 多选会失败,降级单选
            try {
                const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: false,
                    quality: 0.8,
                    allowsMultipleSelection: false
                });
                if (!result.canceled) processImage(result);
            } catch {
                Alert.alert("错误", "无法打开相册");
            }
        } finally {
            setIsLoading(false);
            setLoadingMessage("");
        }
    };

    // ── CTA 动效:脉冲环 + 金色刻度环旋转 ──
    const ringScale = useSharedValue(1);
    const ringOpacity = useSharedValue(0.5);
    const dialSpin = useSharedValue(0);

    useEffect(() => {
        ringScale.value = withRepeat(
            withTiming(1.9, { duration: 2400, easing: Easing.out(Easing.ease) }), -1, false
        );
        ringOpacity.value = withRepeat(
            withTiming(0, { duration: 2400, easing: Easing.out(Easing.ease) }), -1, false
        );
        dialSpin.value = withRepeat(
            withTiming(360, { duration: 26000, easing: Easing.linear }), -1, false
        );
    }, [ringScale, ringOpacity, dialSpin]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: ringScale.value }],
        opacity: ringOpacity.value,
    }));
    const dialStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${dialSpin.value}deg` }],
    }));

    const handleCopyWeChat = async () => {
        await Clipboard.setStringAsync("sunlinhuamj");
        Alert.alert("已复制", "微信号 sunlinhuamj 已复制到剪贴板");
    };

    const hasImages = selectedImages.length > 0;

    return (
        <View className="flex-1 bg-void">
            <StatusBar barStyle="light-content" />

            {/* 首屏即时底色(Three.js 加载前不留白) */}
            <LinearGradient
                colors={['#060410', '#170A26', '#0E0818', '#060410']}
                locations={[0, 0.4, 0.75, 1]}
                pointerEvents="none"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />

            {/* ── Three.js 酒杯宇宙(web)/ 辉光星空(native),首屏后延迟加载 ── */}
            <Deferred>
                <Scene name="wine" paused={scenePaused} />
            </Deferred>

            {/* 底部可读性渐变 */}
            <LinearGradient
                colors={['rgba(6,4,16,0)', 'rgba(6,4,16,0.55)', 'rgba(6,4,16,0.92)']}
                locations={[0.35, 0.7, 1]}
                pointerEvents="none"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />

            <SafeAreaView className="flex-1">
                {/* ── 品牌头部 ── */}
                <Reveal dy={-12} className="w-full px-6 pt-3 flex-row justify-between items-center z-10">
                    <View className="flex-row items-center">
                        <Logo size={46} />
                        <View className="ml-3">
                            <Text className="text-white text-3xl font-black tracking-tight" style={{ color: KC.textHi }}>坑了么</Text>
                            <Text style={{ color: KC.gold }} className="text-[9px] tracking-[0.35em] font-bold mt-0.5">
                                WINE GUARD · 避坑指南
                            </Text>
                        </View>
                    </View>
                    <View className="px-3 py-1.5 rounded-full border" style={{ borderColor: 'rgba(232,194,104,0.35)', backgroundColor: 'rgba(232,194,104,0.08)' }}>
                        <Text style={{ color: KC.goldSoft }} className="text-[10px] font-bold tracking-widest">AI 鉴定</Text>
                    </View>
                </Reveal>

                {/* ── 主舞台 ── */}
                <View className="flex-1 z-10">
                    {/* 3D 酒杯展示区(留白,让杯子呼吸) */}
                    <View style={hasImages ? { height: 36 } : { height: '30%' }} />

                    {/* 文案 + CTA */}
                    <View className="items-center px-8 pb-2">
                        {!hasImages && (
                            <Reveal delay={150} className="items-center mb-5">
                                <Text className="text-center" style={{ color: KC.textHi, fontSize: 28, fontWeight: '900', letterSpacing: 1 }}>
                                    这杯酒,<Text style={{ color: KC.crimson }}>坑</Text>不坑?
                                </Text>
                                <Text className="text-center mt-2.5 text-[13px] leading-5" style={{ color: KC.textMid, maxWidth: 260 }}>
                                    拍下酒单,AI 一秒看穿溢价,毒舌点评帮你避坑
                                </Text>

                                {/* ── 新功能高亮(对联式左右对称):左联境外换算 / 右联店铺背调 ── */}
                                <View className="mt-4 flex-row items-stretch justify-center w-full" style={{ maxWidth: 330 }}>
                                    {/* 左联:境外换算 */}
                                    <View className="flex-1 items-center px-1.5">
                                        <View className="w-8 h-8 rounded-full items-center justify-center mb-1.5" style={{ backgroundColor: 'rgba(255,194,75,0.14)', borderWidth: 1, borderColor: 'rgba(255,194,75,0.34)' }}>
                                            <Globe size={16} color={KC.amber} />
                                        </View>
                                        <Text className="text-[13px] font-black" style={{ color: KC.goldSoft }}>境外不踩坑</Text>
                                        <Text className="text-[11px] mt-0.5" style={{ color: KC.textLow, lineHeight: 14, textAlign: 'center' }}>外币 → 人民币</Text>
                                    </View>
                                    {/* 中缝 */}
                                    <View style={{ width: 1, alignSelf: 'center', height: 44, backgroundColor: 'rgba(232,194,104,0.25)' }} />
                                    {/* 右联:店铺背调 */}
                                    <View className="flex-1 items-center px-1.5">
                                        <View className="w-8 h-8 rounded-full items-center justify-center mb-1.5" style={{ backgroundColor: 'rgba(46,230,168,0.14)', borderWidth: 1, borderColor: 'rgba(46,230,168,0.34)' }}>
                                            <MapPin size={16} color={KC.mint} />
                                        </View>
                                        <Text className="text-[13px] font-black" style={{ color: KC.mint }}>进店先背调</Text>
                                        <Text className="text-[11px] mt-0.5" style={{ color: KC.textLow, lineHeight: 14, textAlign: 'center' }}>高德 / Google</Text>
                                    </View>
                                </View>
                            </Reveal>
                        )}

                        {/* ── 主 CTA:雷达拍摄按钮 ── */}
                        <View className="items-center justify-center" style={{ height: hasImages ? 150 : 192 }}>
                            {/* 扩散脉冲 */}
                            {!hasImages && (
                                <Animated.View
                                    style={[pulseStyle, { position: 'absolute', width: 164, height: 164, borderRadius: 100, borderWidth: 1.5, borderColor: KC.crimson }]}
                                />
                            )}
                            {/* 旋转金色刻度环 */}
                            <Animated.View style={[dialStyle, { position: 'absolute' }]} pointerEvents="none">
                                <Svg width={hasImages ? 152 : 186} height={hasImages ? 152 : 186} viewBox="0 0 200 200">
                                    <Circle cx="100" cy="100" r="96" stroke={KC.gold} strokeWidth="1.6" strokeDasharray="10 14" strokeLinecap="round" fill="none" opacity={0.7} />
                                </Svg>
                            </Animated.View>

                            <TouchableOpacity onPress={takePhoto} activeOpacity={0.85} disabled={isLoading}
                                accessibilityRole="button" accessibilityLabel="拍摄酒单进行鉴定">
                                <View style={{
                                    shadowColor: KC.crimson, shadowOpacity: 0.75, shadowRadius: 36, shadowOffset: { width: 0, height: 0 },
                                    borderRadius: 999, elevation: 18,
                                }}>
                                    <LinearGradient
                                        colors={['#FF5A9C', '#FF2E7E', '#C2125C']}
                                        start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
                                        style={{
                                            width: hasImages ? 118 : 158, height: hasImages ? 118 : 158, borderRadius: 999,
                                            alignItems: 'center', justifyContent: 'center',
                                            borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.32)',
                                        }}
                                    >
                                        {isLoading ? (
                                            <ActivityIndicator color="white" size="large" />
                                        ) : (
                                            <>
                                                <Camera color="white" size={hasImages ? 42 : 56} strokeWidth={1.6} />
                                                <Text className="text-white font-black tracking-[0.3em] mt-1.5" style={{ fontSize: hasImages ? 12 : 14, marginLeft: 4 }}>
                                                    拍酒单
                                                </Text>
                                            </>
                                        )}
                                    </LinearGradient>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {hasImages ? (
                            <Text className="mt-1 text-xs" style={{ color: KC.textLow }}>
                                点击上方继续拍摄,或在下方开始鉴定
                            </Text>
                        ) : (
                            <>
                                {/* 相册多选 */}
                                <Reveal delay={300}>
                                    <TouchableOpacity
                                        onPress={pickImage}
                                        className="mt-4 flex-row items-center px-6 py-3 rounded-full border"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.16)' }}
                                    >
                                        <ImageIcon color={KC.goldSoft} size={18} />
                                        <Text style={{ color: KC.goldSoft }} className="ml-2 font-bold text-[13px] tracking-[0.2em]">
                                            从相册选择 · 可多张
                                        </Text>
                                    </TouchableOpacity>
                                </Reveal>

                                {/* 能力胶囊 */}
                                <Reveal delay={450} className="flex-row flex-wrap justify-center mt-5" style={{ maxWidth: 320 }}>
                                    {CAPABILITIES.map((c) => (
                                        <View
                                            key={c}
                                            className="px-3 py-1.5 m-1 rounded-full border"
                                            style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.045)' }}
                                        >
                                            <Text className="text-[11px] font-medium" style={{ color: KC.textMid }}>{c}</Text>
                                        </View>
                                    ))}
                                </Reveal>
                            </>
                        )}
                    </View>

                    {!hasImages && <View className="flex-1" />}
                </View>

                {/* ── 待鉴定图片托盘 ── */}
                {hasImages && (
                    <Reveal dy={60} duration={450}
                        className="w-full rounded-t-[28px] border-t px-6 pt-5 pb-7 z-20"
                        style={{ backgroundColor: 'rgba(10,6,20,0.88)', borderColor: 'rgba(232,194,104,0.22)' }}
                    >
                        <View className="flex-row justify-between items-center mb-4">
                            <View className="flex-row items-baseline">
                                <Text className="font-black text-lg" style={{ color: KC.textHi }}>待鉴定</Text>
                                <Text className="ml-2 font-black text-lg" style={{ color: KC.crimson }}>{selectedImages.length} 张</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => { selectedImages.forEach(revokeIfBlob); setSelectedImages([]); }}
                                accessibilityRole="button" accessibilityLabel="清空已选图片"
                                className="px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
                            >
                                <Text className="text-xs" style={{ color: KC.textLow }}>清空</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
                            {selectedImages.map((uri, index) => (
                                <View key={index} className="mr-3 relative pt-2">
                                    <Image
                                        source={{ uri }}
                                        className="w-20 h-24 rounded-xl"
                                        style={{ borderWidth: 1, borderColor: 'rgba(232,194,104,0.35)', backgroundColor: '#16101F' }}
                                        resizeMode="cover"
                                    />
                                    <TouchableOpacity
                                        onPress={() => { revokeIfBlob(uri); setSelectedImages(prev => prev.filter((_, i) => i !== index)); }}
                                        accessibilityRole="button" accessibilityLabel={`移除第 ${index + 1} 张图片`}
                                        className="absolute top-0 -right-1.5 w-6 h-6 rounded-full items-center justify-center z-10"
                                        style={{ backgroundColor: KC.blaze, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' }}
                                    >
                                        <X size={13} color="white" />
                                    </TouchableOpacity>
                                </View>
                            ))}

                            <TouchableOpacity
                                onPress={takePhoto}
                                accessibilityRole="button" accessibilityLabel="继续拍摄或添加图片"
                                className="w-20 h-24 rounded-xl items-center justify-center mt-2"
                                style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.04)' }}
                            >
                                <Plus color={KC.textLow} size={22} />
                                <Text className="text-[10px] mt-1" style={{ color: KC.textLow }}>继续拍</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        <TouchableOpacity onPress={handleAnalyze} activeOpacity={0.88}>
                            <LinearGradient
                                colors={['#FF5A9C', '#FF2E7E', '#C2125C']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                className="w-full py-4 rounded-2xl items-center flex-row justify-center"
                                style={{ shadowColor: KC.crimson, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 12 }}
                            >
                                <Text className="text-white font-black text-lg tracking-[0.25em] mr-2">开始鉴定</Text>
                                <ArrowRight color="white" size={22} />
                            </LinearGradient>
                        </TouchableOpacity>
                    </Reveal>
                )}

                {/* ── 加载遮罩 ── */}
                {isLoading && (
                    <View className="absolute inset-0 z-50 items-center justify-center" style={{ backgroundColor: 'rgba(6,4,16,0.72)' }}>
                        <ActivityIndicator size="large" color={KC.crimson} />
                        <Text className="mt-4 font-bold tracking-widest" style={{ color: KC.textHi }}>
                            {loadingMessage || "处理中..."}
                        </Text>
                    </View>
                )}

                {/* ── 页脚 ── */}
                {!hasImages && (
                    <Reveal delay={600} className="w-full items-center justify-center mb-5 z-10">
                        <Text className="text-[9px] tracking-[0.3em] uppercase font-bold" style={{ color: 'rgba(247,243,249,0.30)' }}>
                            POWERED BY BRIGHT305
                        </Text>
                        <TouchableOpacity onPress={handleCopyWeChat} className="mt-1.5 active:opacity-50">
                            <Text className="text-[10px] font-medium tracking-widest" style={{ color: 'rgba(247,243,249,0.38)' }}>
                                WeChat: <Text style={{ textDecorationLine: 'underline', color: 'rgba(232,194,104,0.6)' }}>sunlinhuamj</Text>(点击复制)
                            </Text>
                        </TouchableOpacity>
                    </Reveal>
                )}
            </SafeAreaView>
        </View>
    );
}
