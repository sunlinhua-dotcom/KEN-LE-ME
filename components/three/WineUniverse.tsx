/**
 * WineUniverse —— 原生端降级版(iOS / Android)
 * Web 端由 WineUniverse.web.tsx 提供完整 Three.js 场景;
 * 原生端用多层渐变 + 辉光 + 浮动光点保持同一气质。
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

function Orb({ size, color, x, y, delay = 0 }: { size: number; color: string; x: number; y: number; delay?: number }) {
    const v = useSharedValue(0.5);
    useEffect(() => {
        v.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.ease) }), -1, true));
    }, [delay, v]);
    const style = useAnimatedStyle(() => ({
        opacity: 0.25 + v.value * 0.4,
        transform: [{ translateY: (v.value - 0.75) * 26 }, { scale: 0.92 + v.value * 0.16 }],
    }));
    return (
        <Animated.View
            style={[{
                position: 'absolute', left: x, top: y, width: size, height: size,
                borderRadius: size / 2, backgroundColor: color,
            }, style]}
        />
    );
}

export default function WineUniverse({ paused: _paused = false }: { paused?: boolean }) {
    return (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <LinearGradient
                colors={['#060410', '#170A26', '#2B0E33', '#12081F', '#060410']}
                locations={[0, 0.28, 0.5, 0.78, 1]}
                start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
                style={{ flex: 1 }}
            />
            {/* 辉光球 */}
            <Orb size={300} color="rgba(255,46,126,0.16)" x={-80} y={60} />
            <Orb size={260} color="rgba(232,194,104,0.10)" x={180} y={300} delay={900} />
            <Orb size={220} color="rgba(124,77,255,0.12)" x={60} y={-60} delay={1700} />
            {/* 浮动光点 */}
            <Orb size={8} color="rgba(245,223,166,0.9)" x={64} y={170} delay={300} />
            <Orb size={5} color="rgba(255,120,180,0.9)" x={300} y={120} delay={1100} />
            <Orb size={6} color="rgba(245,223,166,0.8)" x={250} y={420} delay={2000} />
            <Orb size={4} color="rgba(255,255,255,0.8)" x={120} y={520} delay={600} />
        </View>
    );
}
