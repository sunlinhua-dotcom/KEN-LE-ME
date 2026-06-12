import { KC } from '@/constants/theme';
import React from 'react';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';

/**
 * 坑了么品牌徽标 —— 高脚杯 + 雷达扫描环
 * 寓意:把每一杯酒放进"鉴定雷达"里
 */
export default function Logo({ size = 44 }: { size?: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
            <Defs>
                <LinearGradient id="lgWine" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={KC.crimson} />
                    <Stop offset="1" stopColor={KC.crimsonDeep} />
                </LinearGradient>
                <LinearGradient id="lgGlass" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={KC.goldSoft} />
                    <Stop offset="1" stopColor={KC.gold} />
                </LinearGradient>
            </Defs>

            {/* 雷达扫描环(断续刻度) */}
            <Circle
                cx="32" cy="32" r="29"
                stroke={KC.gold} strokeWidth="1.6"
                strokeDasharray="7 9" strokeLinecap="round"
                opacity="0.75"
            />
            {/* 雷达高亮弧 */}
            <Path
                d="M 12 14 A 27 27 0 0 1 32 5"
                stroke={KC.crimson} strokeWidth="2.4" strokeLinecap="round" fill="none"
            />

            {/* 杯中酒(波浪液面) */}
            <Path
                d="M22.6 23.5
                   C 25.8 21.8, 28.8 25.0, 32 23.5
                   C 35.2 22.0, 38.2 25.2, 41.4 23.5
                   C 40.6 30.5, 36.8 35.4, 32 36.9
                   C 27.2 35.4, 23.4 30.5, 22.6 23.5 Z"
                fill="url(#lgWine)"
            />

            {/* 高脚杯轮廓 */}
            <Path
                d="M20.5 13.5 C 20.5 27, 26 36.2, 32 38 C 38 36.2, 43.5 27, 43.5 13.5 Z"
                stroke="url(#lgGlass)" strokeWidth="2.2" strokeLinejoin="round" fill="none"
            />
            {/* 杯梗 */}
            <Path d="M32 38 L32 49" stroke="url(#lgGlass)" strokeWidth="2.2" strokeLinecap="round" />
            {/* 杯座 */}
            <Ellipse cx="32" cy="51" rx="8.5" ry="2.4" stroke="url(#lgGlass)" strokeWidth="2" fill="none" />

            {/* 杯壁高光 */}
            <Path d="M24.5 16 C 24.7 22.5, 26.4 27.6, 28.4 30.6" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="1.3" strokeLinecap="round" fill="none" />

            {/* 金色星芒 */}
            <Path d="M50 12 L51.3 15.3 L54.6 16.6 L51.3 17.9 L50 21.2 L48.7 17.9 L45.4 16.6 L48.7 15.3 Z" fill={KC.goldSoft} />
        </Svg>
    );
}
