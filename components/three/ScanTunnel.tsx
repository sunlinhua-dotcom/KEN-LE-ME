/**
 * ScanTunnel —— 原生端降级版:脉冲雷达环
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

function Pulse({ delay, color }: { delay: number; color: string }) {
    const v = useSharedValue(0);
    useEffect(() => {
        v.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }), -1, false));
    }, [delay, v]);
    const style = useAnimatedStyle(() => ({
        opacity: (1 - v.value) * 0.5,
        transform: [{ scale: 0.3 + v.value * 2.4 }],
    }));
    return (
        <Animated.View style={[{
            position: 'absolute', width: 180, height: 180, borderRadius: 90,
            borderWidth: 1.5, borderColor: color,
        }, style]} />
    );
}

export default function ScanTunnel({ paused: _paused = false }: { paused?: boolean }) {
    return (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <LinearGradient
                colors={['#060410', '#1B0B28', '#060410']}
                style={{ flex: 1 }}
            />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Pulse delay={0} color="#FF2E7E" />
                <Pulse delay={800} color="#E8C268" />
                <Pulse delay={1600} color="#FF2E7E" />
            </View>
        </View>
    );
}
