import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Image as ImageIcon, RotateCcw, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CameraScreen() {
    const [facing, setFacing] = useState('back');
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef(null);
    const router = useRouter();
    const [isTakingPicture, setIsTakingPicture] = useState(false);

    if (!permission) {
        return <View className="flex-1 bg-black" />;
    }

    // Handle case where permission is not granted
    if (!permission.granted) {
        // If we are on web, camera permission might not block the whole UI if we only want upload,
        // but CameraView will fail. We can show a fallback UI or just the permission request.
        // For simplicity, we keep the permission request but maybe add a "Use Gallery" button here too?
        // Let's stick to the main request for now, or users can go back.
        return (
            <View className="flex-1 justify-center items-center bg-[#0F0F1A] px-6">
                <Text className="text-white text-xl font-bold mb-2 text-center">开启相机权限</Text>
                <Text className="text-gray-400 mb-8 text-center">我们需要相机权限来拍摄酒单进行识别</Text>
                <TouchableOpacity
                    onPress={requestPermission}
                    className="bg-pink-500 px-8 py-3 rounded-full active:bg-pink-600 mb-4"
                >
                    <Text className="text-white font-bold text-lg">去授权</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text className="text-white/50">暂不授权</Text>
                </TouchableOpacity>
            </View>
        );
    }

    function toggleCameraFacing() {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
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
                base64: false, // We read as base64 in the util function
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
            >
                <SafeAreaView className="flex-1 justify-between">
                    {/* Top Bar */}
                    <View className="flex-row justify-between items-center px-6 pt-4">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="w-10 h-10 rounded-full bg-black/40 items-center justify-center"
                        >
                            <X color="white" size={24} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={toggleCameraFacing}
                            className="w-10 h-10 rounded-full bg-black/40 items-center justify-center"
                        >
                            <RotateCcw color="white" size={20} />
                        </TouchableOpacity>
                    </View>

                    {/* Bottom Controls */}
                    <View className="pb-16 px-10 flex-row justify-between items-center bg-transparent">
                        {/* Placeholder to balance layout (or Flash toggle) */}
                        <View className="w-12" />

                        {/* Shutter Button */}
                        <TouchableOpacity
                            onPress={takePicture}
                            disabled={isTakingPicture}
                            className="items-center justify-center"
                        >
                            <View className={`w-20 h-20 rounded-full border-4 border-white items-center justify-center ${isTakingPicture ? 'opacity-50' : ''}`}>
                                <View className="w-16 h-16 rounded-full bg-white" />
                            </View>
                        </TouchableOpacity>

                        {/* Gallery Button */}
                        <TouchableOpacity
                            onPress={pickImage}
                            className="w-12 h-12 rounded-full bg-white/20 items-center justify-center backdrop-blur-md border border-white/10"
                        >
                            <ImageIcon color="white" size={24} />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </CameraView>
        </View>
    );
}
