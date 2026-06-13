import FrameCorners from '@/components/svg/FrameCorners';
import { KC } from '@/constants/theme';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ImageIcon, RotateCcw, X } from '@/components/svg/Icons';
import { useEffect, useRef, useState } from 'react';
import { Alert, StatusBar, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CameraScreen() {
    const [facing, setFacing] = useState<any>('back');
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const router = useRouter();
    const [isTakingPicture, setIsTakingPicture] = useState(false);
    const { height } = useWindowDimensions();

    // 扫描线动画
    const scanY = useSharedValue(0);
    useEffect(() => {
        scanY.value = withRepeat(
            withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
            -1, true
        );
    }, [scanY]);
    const scanStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: scanY.value * (height - 320) }],
    }));

    // Auto-request permission on mount if not determined yet
    useEffect(() => {
        if (permission && !permission.granted && permission.canAskAgain) {
            requestPermission();
        }
    }, [permission, requestPermission]);

    if (!permission) {
        return <View className="flex-1 bg-void" />;
    }

    if (!permission.granted) {
        return (
            <View className="flex-1 justify-center items-center bg-void px-8">
                <Text className="text-5xl mb-5">📷</Text>
                <Text className="text-xl font-black mb-2 text-center" style={{ color: KC.textHi }}>开启相机权限</Text>
                <Text className="mb-8 text-center text-[13px] leading-5" style={{ color: KC.textLow }}>
                    我们需要相机权限来拍摄酒单进行识别
                </Text>
                <TouchableOpacity onPress={requestPermission} activeOpacity={0.88}>
                    <LinearGradient
                        colors={['#FF5A9C', '#FF2E7E', '#C2125C']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        className="px-10 py-3.5 rounded-full"
                    >
                        <Text className="text-white font-black text-base tracking-widest">去授权</Text>
                    </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.back()} className="mt-5">
                    <Text style={{ color: KC.textLow }}>暂不授权</Text>
                </TouchableOpacity>
            </View>
        );
    }

    function toggleCameraFacing() {
        setFacing((current: any) => (current === 'back' ? 'front' : 'back'));
    }

    async function takePicture() {
        if (cameraRef.current && !isTakingPicture) {
            setIsTakingPicture(true);
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.5,
                    skipProcessing: true,
                });

                router.push({
                    pathname: '/result',
                    params: { imageUri: photo.uri }
                });
            } catch (e) {
                console.error("Failed to take picture:", e);
                Alert.alert("拍照失败", "请重试或选择相册上传");
            } finally {
                setIsTakingPicture(false);
            }
        }
    }

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
                base64: false,
            });

            if (!result.canceled) {
                router.push({
                    pathname: '/result',
                    params: { imageUri: result.assets[0].uri }
                });
            }
        } catch (e) {
            console.error("Pick image error:", e);
            Alert.alert("Error", "无法选择图片");
        }
    };

    return (
        <View className="flex-1 bg-black">
            <StatusBar hidden />
            <CameraView
                style={{ flex: 1 }}
                facing={facing}
                ref={cameraRef}
                mode="picture"
            >
                {/* 金色取景框 + 中心十字 */}
                <FrameCorners />

                {/* 扫描线 */}
                <View pointerEvents="none" style={{ position: 'absolute', top: 130, left: 30, right: 30, bottom: 190 }}>
                    <Animated.View style={scanStyle}>
                        <LinearGradient
                            colors={['rgba(255,46,126,0)', 'rgba(255,46,126,0.75)', 'rgba(255,46,126,0)']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={{ height: 2, borderRadius: 1 }}
                        />
                    </Animated.View>
                </View>

                <SafeAreaView className="flex-1 justify-between">
                    {/* 顶栏 */}
                    <View className="flex-row justify-between items-center px-6 pt-4">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{ backgroundColor: 'rgba(6,4,16,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}
                        >
                            <X color="white" size={22} />
                        </TouchableOpacity>

                        {/* 拍摄提示 */}
                        <View className="px-4 py-2 rounded-full" style={{ backgroundColor: 'rgba(6,4,16,0.55)', borderWidth: 1, borderColor: 'rgba(232,194,104,0.4)' }}>
                            <Text className="text-[11px] font-bold tracking-wider" style={{ color: KC.goldSoft }}>
                                对准酒单 · 光线充足更准
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={toggleCameraFacing}
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{ backgroundColor: 'rgba(6,4,16,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}
                        >
                            <RotateCcw color="white" size={19} />
                        </TouchableOpacity>
                    </View>

                    {/* 底部操作区 */}
                    <View className="pb-14 px-12 flex-row justify-between items-center">
                        <View className="w-12" />

                        {/* 快门:金环 + 酒红芯 */}
                        <TouchableOpacity
                            onPress={takePicture}
                            disabled={isTakingPicture}
                            className="items-center justify-center"
                        >
                            <View
                                className={`w-[84px] h-[84px] rounded-full items-center justify-center ${isTakingPicture ? 'opacity-50' : ''}`}
                                style={{ borderWidth: 3, borderColor: KC.gold }}
                            >
                                <LinearGradient
                                    colors={['#FF5A9C', '#FF2E7E', '#C2125C']}
                                    start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
                                    style={{ width: 66, height: 66, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' }}
                                />
                            </View>
                        </TouchableOpacity>

                        {/* 相册 */}
                        <TouchableOpacity
                            onPress={pickImage}
                            className="w-12 h-12 rounded-full items-center justify-center"
                            style={{ backgroundColor: 'rgba(6,4,16,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}
                        >
                            <ImageIcon color="white" size={22} />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </CameraView>
        </View>
    );
}
