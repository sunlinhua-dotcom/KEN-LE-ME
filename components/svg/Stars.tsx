import { KC } from '@/constants/theme';
import React from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

const STAR = 'M8 1.2 L9.9 5.4 L14.4 5.9 L11 9 L12 13.5 L8 11.2 L4 13.5 L5 9 L1.6 5.9 L6.1 5.4 Z';

/**
 * 评分星标 —— 0–10 分映射五星,支持半星精度(金色渐变填充)
 */
export default function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
    const ratio = Math.min(1, Math.max(0, rating / 10));
    const totalW = 16 * 5;

    return (
        <View style={{ width: size * 5 + 8, height: size + 2, justifyContent: 'center' }}>
            <Svg width={size * 5 + 8} height={size + 2} viewBox={`0 0 ${totalW + 8} 16`}>
                <Defs>
                    <ClipPath id="starFill">
                        <Rect x="0" y="0" width={(totalW + 8) * ratio} height="16" />
                    </ClipPath>
                </Defs>
                {/* 底层空星 */}
                {[0, 1, 2, 3, 4].map(i => (
                    <G key={`b${i}`} transform={`translate(${i * 16 + 2}, 0.5)`}>
                        <Path d={STAR} fill="rgba(255,255,255,0.14)" />
                    </G>
                ))}
                {/* 金色填充层(按比例裁切) */}
                <G clipPath="url(#starFill)">
                    {[0, 1, 2, 3, 4].map(i => (
                        <G key={`f${i}`} transform={`translate(${i * 16 + 2}, 0.5)`}>
                            <Path d={STAR} fill={KC.gold} />
                        </G>
                    ))}
                </G>
            </Svg>
        </View>
    );
}
