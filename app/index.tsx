import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Camera, Image as ImageIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const processImage = (result: ImagePicker.ImagePickerResult) => {
        if (!result.canceled && result.assets && result.assets.length > 0) {
            router.push({
                pathname: '/result',
                params: { imageUri: result.assets[0].uri }
            });
        }
    };

    const takePhoto = async () => {
        try {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert("需要权限", "请允许访问相机以进行拍摄");
                return;
            }
            setIsLoading(true);
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
        }
    };

    const pickImage = async () => {
        try {
            setIsLoading(true);
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
            });
            processImage(result);
        } catch (error) {
            console.error("Gallery Error:", error);
            Alert.alert("错误", "无法打开相册");
        } finally {
            setIsLoading(false);
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
                <View className="items-center justify-center flex-1">
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

                    <Text className="text-white mt-10 text-xl font-medium tracking-wide opacity-90 shadow-sm">
                        拍酒单，看看那个<Text className="text-pink-500 font-bold text-2xl">坑</Text>
                    </Text>

                    {/* Secondary Gallery Button - Distinct from Main Action */}
                    <TouchableOpacity
                        onPress={pickImage}
                        className="mt-8 flex-row items-center bg-white/10 px-6 py-3 rounded-full border border-white/20 active:bg-white/20"
                    >
                        <ImageIcon color="#E879F9" size={20} />
                        <Text className="text-pink-300 ml-2 font-bold text-sm tracking-widest">
                            从相册选择
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
