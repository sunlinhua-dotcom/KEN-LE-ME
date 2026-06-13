/**
 * VerdictCosmos —— 原生端降级版(iOS / Android)
 * 用判决色染色的渐变 + 辉光球,保持与 web 同一气质。
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

function Orb({ size, color, x, y, delay = 0 }: { size: number; color: string; x: number; y: number; delay?: number }) {
    const v = useSharedValue(0.4);
    useEffect(() => {
        v.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.ease) }), -1, true));
    }, [delay, v]);
    const style = useAnimatedStyle(() => ({
        opacity: 0.2 + v.value * 0.4,
        transform: [{ translateY: (v.value - 0.7) * 24 }, { scale: 0.9 + v.value * 0.2 }],
    }));
    return (
        <Animated.View style={[{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />
    );
}

function withAlpha(hex: string, a: number) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export default function VerdictCosmos({ tint = '#FF2E7E', paused: _paused = false }: { tint?: string; score?: number; paused?: boolean }) {
    return (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <LinearGradient
                colors={['#060410', '#140A20', '#0E0818', '#060410']}
                locations={[0, 0.32, 0.7, 1]}
                start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
                style={{ flex: 1 }}
            />
            <Orb size={300} color={withAlpha(tint, 0.16)} x={-70} y={-40} />
            <Orb size={240} color="rgba(232,194,104,0.09)" x={180} y={260} delay={800} />
            <Orb size={220} color="rgba(124,77,255,0.11)" x={40} y={520} delay={1600} />
            <Orb size={6} color={withAlpha(tint, 0.9)} x={90} y={180} delay={300} />
            <Orb size={5} color="rgba(245,223,166,0.9)" x={300} y={120} delay={1100} />
            <Orb size={4} color={withAlpha(tint, 0.8)} x={250} y={420} delay={2000} />
        </View>
    );
}
