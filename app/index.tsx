import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowRight, Camera, Image as ImageIcon, Plus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [selectedImages, setSelectedImages] = useState<string[]>([]);

    const processImage = (result: ImagePicker.ImagePickerResult) => {
        if (!result.canceled && result.assets && result.assets.length > 0) {
            const newUris = result.assets.map(asset => asset.uri);
            // Append new images to the list
            setSelectedImages(prev => [...prev, ...newUris]);
        }
    };

    const handleAnalyze = () => {
        if (selectedImages.length === 0) return;

        router.push({
            pathname: '/result',
            params: { imageUris: JSON.stringify(selectedImages) }
        });

        // Clear state shortly after navigation so it's clean on return
        setTimeout(() => {
            setSelectedImages([]);
        }, 500);
    };

    const takePhoto = async () => {
        try {
            if (Platform.OS !== 'web') {
                const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
                if (!permissionResult.granted) {
                    Alert.alert("需要权限", "请允许访问相机以进行拍摄");
                    return;
                }
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
        try {
            setIsLoading(true);
            setLoadingMessage("正在加载相册...");

            // Allow UI to update before bridge call
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
            // Fallback for some Androids that fail with multiple selection
            try {
                const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: false,
                    quality: 0.8,
                    allowsMultipleSelection: false // Fallback to single
                });
                if (!result.canceled) processImage(result);
            } catch (e) {
                Alert.alert("错误", "无法打开相册");
            }
        } finally {
            setIsLoading(false);
            setLoadingMessage("");
        }
    };

    const handleMainButtonPress = () => {
        // Always invoke Camera for the main button, even on Web
        // This solves the issue where specific Android devices (OnePlus)
        // don't show the "Camera" option in the File Picker.
        takePhoto();
    };

    // Animation Shared Values
    const scale = useSharedValue(1);
    const ringScale = useSharedValue(1);
    const ringOpacity = useSharedValue(0.6);

    useEffect(() => {
        // Breathing effect for the main button
        scale.value = withRepeat(
            withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            -1,
            true // reverse
        );

        // Ripple/Pulse effect for the ring
        ringScale.value = withRepeat(
            withTiming(1.6, { duration: 2000, easing: Easing.out(Easing.ease) }),
            -1,
            false
        );
        ringOpacity.value = withRepeat(
            withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
            -1,
            false
        );
    }, []);

    const animatedButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    const animatedRingStyle = useAnimatedStyle(() => ({
        transform: [{ scale: ringScale.value }],
        opacity: ringOpacity.value,
    }));

    return (
        <LinearGradient
            colors={['#0F0F1A', '#2D1B36', '#0F0F1A']}
            className="flex-1"
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <StatusBar barStyle="light-content" />
            <SafeAreaView className="flex-1 justify-between">

                {/* Header */}
                <View className="w-full px-8 pt-4 flex-row justify-between items-center z-10">
                    <View>
                        <Text className="text-white text-4xl font-extrabold tracking-tighter shadow-lg">坑了么</Text>
                        <Text className="text-pink-400 text-xs tracking-[0.4em] uppercase font-semibold ml-1">Bright Wine</Text>
                    </View>
                    <View className="w-12 h-12 bg-white/5 rounded-full items-center justify-center border border-white/10 shadow-inner">
                        <View className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                    </View>
                </View>

                {/* Main Content Area */}
                <View className="flex-1 items-center justify-center">

                    {/* Main Camera Button */}
                    <View className="relative items-center justify-center">
                        {selectedImages.length === 0 && (
                            <Animated.View
                                className="absolute w-56 h-56 rounded-full bg-pink-500"
                                style={animatedRingStyle}
                            />
                        )}

                        <TouchableOpacity
                            onPress={handleMainButtonPress}
                            activeOpacity={0.9}
                            className="z-10"
                            disabled={isLoading}
                        >
                            <Animated.View
                                style={[selectedImages.length === 0 ? animatedButtonStyle : {}]}
                                className="shadow-[0_0_40px_rgba(255,20,147,0.6)] rounded-full"
                            >
                                <LinearGradient
                                    colors={['#FF1493', '#FF007F']}
                                    className={`${selectedImages.length > 0 ? "w-40 h-40" : "w-56 h-56"} rounded-full items-center justify-center border-4 border-white/20 transition-all`}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="white" size="large" />
                                    ) : (
                                        <Camera color="white" size={selectedImages.length > 0 ? 60 : 88} strokeWidth={1.5} />
                                    )}
                                </LinearGradient>
                            </Animated.View>
                        </TouchableOpacity>
                    </View>

                    {selectedImages.length === 0 ? (
                        <Text className="text-white mt-10 text-xl font-medium tracking-wide opacity-90 shadow-sm">
                            拍酒单，看看那个<Text className="text-pink-500 font-bold text-2xl">坑</Text>
                        </Text>
                    ) : (
                        <Text className="text-white/60 mt-6 text-sm">
                            点击上图继续添加，或下方开始分析
                        </Text>
                    )}

                    {/* Secondary Button */}
                    {selectedImages.length === 0 && (
                        <TouchableOpacity
                            onPress={pickImage}
                            className="mt-8 flex-row items-center bg-white/10 px-6 py-3 rounded-full border border-white/20 active:bg-white/20"
                        >
                            <ImageIcon color="#E879F9" size={20} />
                            <Text className="text-pink-300 ml-2 font-bold text-sm tracking-widest">
                                从相册选择 (多选)
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Bottom Area: Image List & Action Panel */}
                {selectedImages.length > 0 && (
                    <View className="w-full bg-black/40 rounded-t-3xl border-t border-white/10 p-6 pb-8 backdrop-blur-md">

                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white font-bold text-lg">
                                待分析 <Text className="text-pink-500">({selectedImages.length})</Text>
                            </Text>
                            <TouchableOpacity onPress={() => setSelectedImages([])}>
                                <Text className="text-gray-400 text-xs">清空</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            className="mb-6"
                        >
                            {selectedImages.map((uri, index) => (
                                <View key={index} className="mr-4 relative pt-2">
                                    <Image
                                        source={{ uri }}
                                        className="w-20 h-24 rounded-lg border border-white/20 bg-gray-800"
                                        resizeMode="cover"
                                    />
                                    <TouchableOpacity
                                        onPress={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                                        className="absolute top-0 -right-2 bg-red-500 rounded-full w-6 h-6 items-center justify-center border border-white shadow-sm z-10"
                                    >
                                        <X size={14} color="white" />
                                    </TouchableOpacity>
                                </View>
                            ))}

                            <TouchableOpacity
                                onPress={handleMainButtonPress}
                                className="w-20 h-24 rounded-lg border border-dashed border-white/30 items-center justify-center bg-white/5 active:bg-white/10 mt-2"
                            >
                                <Plus color="#AAA" size={24} />
                            </TouchableOpacity>
                        </ScrollView>

                        <TouchableOpacity
                            onPress={handleAnalyze}
                            className="w-full bg-pink-500 py-4 rounded-xl items-center shadow-lg active:scale-95 transition-transform flex-row justify-center"
                        >
                            <Text className="text-white font-bold text-xl tracking-widest mr-2">
                                开始鉴定
                            </Text>
                            <ArrowRight color="white" size={24} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Loading Overlay */}
                {isLoading && (
                    <View className="absolute inset-0 bg-black/60 z-50 items-center justify-center backdrop-blur-sm">
                        <ActivityIndicator size="large" color="#FF1493" />
                        <Text className="text-white mt-4 font-bold tracking-widest">
                            {loadingMessage || "处理中..."}
                        </Text>
                    </View>
                )}

                {/* Footer Branding */}
                {selectedImages.length === 0 && (
                    <View className="w-full items-center justify-center opacity-40 mb-4">
                        <Text className="text-white text-[10px] tracking-[0.2em] uppercase font-bold text-center">
                            POWERED BY BRIGHT305
                        </Text>
                    </View>
                )}

            </SafeAreaView>
        </LinearGradient>
    );
}
