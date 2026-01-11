import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Camera, Image as ImageIcon, Plus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
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
    };

    const takePhoto = async () => {
        try {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert("需要权限", "请允许访问相机以进行拍摄");
                return;
            }
            // For camera, loading might be fast enough not to block UI, 
            // but let's show loading during the "launch" phase if needed.
            // Actually, we don't want to block the button if user wants to spam click on web (cico style), 
            // but on native it opens a full screen view.

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
            });
            processImage(result);
        } catch (error) {
            console.error("Camera Error:", error);
            Alert.alert("错误", "无法启动相机");
        }
    };

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
                allowsMultipleSelection: true, // Enable multi-select
                selectionLimit: 10 // Reasonable limit
            });
            processImage(result);
        } catch (error) {
            console.error("Gallery Error:", error);
            Alert.alert("错误", "无法打开相册");
        }
    };

    const handleMainButtonPress = () => {
        if (Platform.OS === 'web') {
            // On Web, launchImageLibraryAsync acts as the native file picker (Camera + Gallery)
            // This is the CICO behavior the user requested.
            pickImage();
        } else {
            // On Native, stick to Camera for big button, user uses secondary button for Gallery
            takePhoto();
        }
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
            <SafeAreaView className="flex-1 items-center justify-between py-10">
                {/* Header */}
                <View className="w-full px-8 flex-row justify-between items-center">
                    <View>
                        <Text className="text-white text-4xl font-extrabold tracking-tighter shadow-lg">坑了么</Text>
                        <Text className="text-pink-400 text-xs tracking-[0.4em] uppercase font-semibold ml-1">Bright Wine</Text>
                    </View>
                    <View className="w-12 h-12 bg-white/5 rounded-full items-center justify-center border border-white/10 shadow-inner">
                        <View className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                    </View>
                </View>

                {/* Center Action */}
                <View className="items-center justify-center flex-1 w-full">

                    {/* Selected Images Queue (Basket) */}
                    {selectedImages.length > 0 && (
                        <View className="mb-8 w-full">
                            <Text className="text-white ml-8 mb-2 font-bold text-lg">
                                已选 <Text className="text-pink-500">{selectedImages.length}</Text> 张图片
                            </Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 32 }}
                                className="w-full"
                            >
                                {selectedImages.map((uri, index) => (
                                    <View key={index} className="mr-3 relative">
                                        <Image
                                            source={{ uri }}
                                            className="w-20 h-20 rounded-lg border border-white/20"
                                        />
                                        <TouchableOpacity
                                            onPress={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                                            className="absolute -top-2 -right-2 bg-red-500 rounded-full w-6 h-6 items-center justify-center border border-white"
                                        >
                                            <X size={14} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {/* Add More Button (Small) */}
                                <TouchableOpacity
                                    onPress={handleMainButtonPress}
                                    className="w-20 h-20 rounded-lg border border-dashed border-white/30 items-center justify-center bg-white/5 active:bg-white/10"
                                >
                                    <Plus color="#AAA" size={24} />
                                </TouchableOpacity>
                            </ScrollView>

                            {/* Analyze Button */}
                            <View className="w-full px-8 mt-6">
                                <TouchableOpacity
                                    onPress={handleAnalyze}
                                    className="w-full bg-pink-500 py-4 rounded-xl items-center shadow-lg active:scale-95 transition-transform"
                                >
                                    <Text className="text-white font-bold text-xl tracking-widest">
                                        开始分析 ({selectedImages.length})
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Main Capture Button (Hidden if we have images, or show differently? Let's show it only if empty to start, or keep it as 'Add') 
                        Actually, sticking to the existing 'Main Button' as the primary 'Add' action is good, 
                        but if we have images, we might want to de-emphasize the big pulsing ring to focus on the 'Analyze' action.
                        Let's hide the big ring if images exist to reduce clutter.
                    */}
                    {selectedImages.length === 0 && (
                        <View className="relative items-center justify-center">
                            {/* Pulsing Ring */}
                            <Animated.View
                                className="absolute w-56 h-56 rounded-full bg-pink-500"
                                style={animatedRingStyle}
                            />

                            {/* Breathing Button */}
                            <TouchableOpacity
                                onPress={handleMainButtonPress}
                                activeOpacity={0.9}
                                className="z-10"
                                disabled={isLoading}
                            >
                                <Animated.View
                                    style={[animatedButtonStyle]}
                                    className="shadow-[0_0_40px_rgba(255,20,147,0.6)] rounded-full"
                                >
                                    <LinearGradient
                                        colors={['#FF1493', '#FF007F']} // Bright Pink Gradient
                                        className="w-56 h-56 rounded-full items-center justify-center border-4 border-white/20"
                                    >
                                        {isLoading ? (
                                            <ActivityIndicator color="white" size="large" />
                                        ) : (
                                            <Camera color="white" size={88} strokeWidth={1.5} />
                                        )}
                                    </LinearGradient>
                                </Animated.View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedImages.length === 0 && (
                        <Text className="text-white mt-10 text-xl font-medium tracking-wide opacity-90 shadow-sm">
                            拍酒单，看看那个<Text className="text-pink-500 font-bold text-2xl">坑</Text>
                        </Text>
                    )}

                    {/* Secondary Gallery Button - Distinct from Main Action (Hide if we have images, can add via big button or small add button) */}
                    <TouchableOpacity
                        onPress={pickImage}
                        className="mt-8 flex-row items-center bg-white/10 px-6 py-3 rounded-full border border-white/20 active:bg-white/20"
                    >
                        <ImageIcon color="#E879F9" size={20} />
                        <Text className="text-pink-300 ml-2 font-bold text-sm tracking-widest">
                            从相册选择 (多选)
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View className="w-full items-center justify-center opacity-40 mb-4">
                    <Text className="text-white text-[10px] tracking-[0.2em] uppercase font-bold text-center">
                        POWERED BY BRIGHT305
                    </Text>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
}
