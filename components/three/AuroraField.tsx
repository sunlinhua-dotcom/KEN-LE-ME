/**
 * AuroraField —— 原生端降级版:静谧极光渐变
 */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { View } from 'react-native';

export default function AuroraField({ paused: _paused = false }: { paused?: boolean }) {
    return (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <LinearGradient
                colors={['#0B0618', '#1C0B22', '#0E0818', '#060410']}
                locations={[0, 0.32, 0.7, 1]}
                start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
                style={{ flex: 1 }}
            />
            <View style={{ position: 'absolute', top: -60, right: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(255,46,126,0.10)' }} />
            <View style={{ position: 'absolute', top: 240, left: -100, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(232,194,104,0.07)' }} />
        </View>
    );
}
