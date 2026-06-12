import { SerifNum } from '@/constants/theme';
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

const PALETTE: Record<number, { ring: string; glow: string; text: string }> = {
    1: { ring: '#F5D87C', glow: '#8A6B1F', text: '#F5DFA6' }, // 金
    2: { ring: '#D7DCE5', glow: '#5E6573', text: '#E8ECF3' }, // 银
    3: { ring: '#E3A573', glow: '#74441F', text: '#F0C09A' }, // 铜
};

/**
 * 坑王榜排名奖牌 —— 前三名月桂奖牌,其余为序号圆环
 */
export default function Medal({ rank, size = 34 }: { rank: number; size?: number }) {
    const p = PALETTE[rank];

    if (!p) {
        return (
            <View style={{
                width: size, height: size, borderRadius: size / 2,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
                backgroundColor: 'rgba(255,255,255,0.06)',
                alignItems: 'center', justifyContent: 'center',
            }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: size * 0.42, fontWeight: '700', fontFamily: SerifNum }}>
                    {rank}
                </Text>
            </View>
        );
    }

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{ position: 'absolute' }}>
                <Defs>
                    <RadialGradient id={`mg${rank}`} cx="0.5" cy="0.4" r="0.75">
                        <Stop offset="0" stopColor={p.glow} stopOpacity="0.95" />
                        <Stop offset="1" stopColor="#0E0818" stopOpacity="0.9" />
                    </RadialGradient>
                </Defs>
                <Circle cx="20" cy="20" r="17" fill={`url(#mg${rank})`} stroke={p.ring} strokeWidth="2" />
                {/* 左右月桂枝 */}
                <Path d="M9 27 C 6.5 23, 6.5 17, 9.5 13 M9 27 C 11 25.5, 12 23.5, 12 21.5 M8 21 C 9.8 20.4, 11 19, 11.6 17"
                    stroke={p.ring} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.9" />
                <Path d="M31 27 C 33.5 23, 33.5 17, 30.5 13 M31 27 C 29 25.5, 28 23.5, 28 21.5 M32 21 C 30.2 20.4, 29 19, 28.4 17"
                    stroke={p.ring} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.9" />
            </Svg>
            <Text style={{ color: p.text, fontSize: size * 0.46, fontWeight: '800', fontFamily: SerifNum, marginTop: -1 }}>
                {rank}
            </Text>
        </View>
    );
}
