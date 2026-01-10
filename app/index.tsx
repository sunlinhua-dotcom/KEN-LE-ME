import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
    const router = useRouter();

    const handleSnap = () => {
        router.push('/camera');
    };

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
                        <Text className="text-white text-4xl font-extrabold tracking-tighter">坑了么</Text>
                        <Text className="text-pink-400 text-xs tracking-[0.3em] uppercase font-semibold">Bright Wine</Text>
                    </View>
                    <TouchableOpacity className="w-12 h-12 bg-white/10 rounded-full items-center justify-center backdrop-blur-md border border-white/10">
                        {/* Placeholder for avatar/settings */}
                        <View className="w-6 h-6 rounded-full bg-pink-500" />
                    </TouchableOpacity>
                </View>

                {/* Center Action */}
                <View className="items-center justify-center">
                    <TouchableOpacity
                        onPress={handleSnap}
                        activeOpacity={0.8}
                        className="rounded-full shadow-2xl shadow-pink-500/40"
                    >
                        <LinearGradient
                            colors={['#FF1493', '#FF007F']} // Bright Pink Gradient
                            className="w-56 h-56 rounded-full items-center justify-center border-4 border-white/10"
                        >
                            <Camera color="white" size={80} strokeWidth={1.5} />
                        </LinearGradient>
                    </TouchableOpacity>
                    <Text className="text-white mt-10 text-xl font-medium tracking-wide opacity-90">
                        拍酒单，看看那个<Text className="text-pink-500 font-bold">坑</Text>
                    </Text>
                </View>

                {/* Footer / History */}
                {/* Footer Spacer */}
                <View className="w-11/12 h-20 items-center justify-center opacity-30">
                    <Text className="text-white text-xs tracking-widest uppercase">Powered by Gemini 3.0</Text>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
}
