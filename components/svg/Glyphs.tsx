import { KC } from '@/constants/theme';
import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * 品牌化装饰 SVG —— 替代系统 emoji(🤖💰💸😈🍷📖),
 * 统一描边/填充风格,告别 emoji 在不同平台的粗糙渲染。
 */

interface GlyphProps { size?: number }

/* AI 机器人头(毒舌点评 标识) */
export function RobotMark({ size = 26 }: GlyphProps) {
    return (
        <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
            <Defs>
                <LinearGradient id="rmBody" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#FF7EAE" />
                    <Stop offset="1" stopColor={KC.crimson} />
                </LinearGradient>
            </Defs>
            {/* 天线 */}
            <Path d="M16 4 L16 7.5" stroke={KC.gold} strokeWidth="2" strokeLinecap="round" />
            <Circle cx="16" cy="3.4" r="2" fill={KC.gold} />
            {/* 头壳 */}
            <Rect x="6.5" y="8" width="19" height="16" rx="6" fill="url(#rmBody)" />
            <Rect x="6.5" y="8" width="19" height="16" rx="6" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="1" />
            {/* 眼睛 */}
            <Circle cx="12.4" cy="16" r="2.4" fill="#1A0410" />
            <Circle cx="19.6" cy="16" r="2.4" fill="#1A0410" />
            <Circle cx="13.1" cy="15.3" r="0.8" fill="#FFFFFF" />
            <Circle cx="20.3" cy="15.3" r="0.8" fill="#FFFFFF" />
            {/* 腮红 */}
            <Circle cx="9.5" cy="20" r="1.3" fill="#FFFFFF" fillOpacity="0.18" />
            <Circle cx="22.5" cy="20" r="1.3" fill="#FFFFFF" fillOpacity="0.18" />
            {/* 耳 */}
            <Rect x="4" y="13.5" width="2.5" height="5" rx="1.2" fill={KC.gold} />
            <Rect x="25.5" y="13.5" width="2.5" height="5" rx="1.2" fill={KC.gold} />
        </Svg>
    );
}

/* 省钱硬币(最值) */
export function CoinGlyph({ size = 22 }: GlyphProps) {
    const c = KC.mint;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="9.2" fill={`${c}22`} stroke={c} strokeWidth="1.8" />
            <Circle cx="12" cy="12" r="6.4" stroke={c} strokeWidth="1" strokeDasharray="2 2.4" opacity="0.7" />
            {/* ¥ */}
            <Path d="M9 8 L12 12 L15 8 M12 12 L12 16.5 M9.4 13 H14.6 M9.4 15 H14.6"
                stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
    );
}

/* 飞走的钱(最贵) */
export function PriceTagGlyph({ size = 22 }: GlyphProps) {
    const c = KC.gold;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M4 11.5 L11.6 3.9 A2 2 0 0 1 13 3.3 L19 3.3 A1.7 1.7 0 0 1 20.7 5 L20.7 11 A2 2 0 0 1 20.1 12.4 L12.5 20 A1.8 1.8 0 0 1 10 20 L4 14 A1.8 1.8 0 0 1 4 11.5 Z"
                fill={`${c}22`} stroke={c} strokeWidth="1.7" strokeLinejoin="round" />
            <Circle cx="16.2" cy="7.8" r="1.7" fill={c} />
        </Svg>
    );
}

/* 毒舌火焰(点评) */
export function FlameGlyph({ size = 22 }: GlyphProps) {
    const c = KC.crimson;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Defs>
                <LinearGradient id="flG" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#FF7EAE" />
                    <Stop offset="1" stopColor={c} />
                </LinearGradient>
            </Defs>
            <Path d="M13 2.5 C 13.5 6, 17 7, 17.5 11 C 18.6 9.6, 19 8.4, 19 8.4 C 20.6 11, 21 13.4, 21 15 A 9 9 0 1 1 5.6 9.2 C 6.4 11.6, 7.8 12, 8.4 11 C 8 7, 11 5.5, 13 2.5 Z"
                fill="url(#flG)" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="0.6" />
            <Path d="M12 18.6 C 9.6 18.6, 9 16.6, 9.6 15 C 10.4 16, 11 15.8, 11.2 14.6 C 11.4 13, 12.6 12.2, 13 11 C 13.4 13, 15 13.6, 15 16 C 15 17.6, 13.8 18.6, 12 18.6 Z"
                fill={KC.goldSoft} />
        </Svg>
    );
}

/* 知识小书(冷知识) */
export function BookGlyph({ size = 18, color = KC.gold }: GlyphProps & { color?: string }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M4 5 A2 2 0 0 1 6 3.4 L11 3.4 L11 19.4 L6 19.4 A2 2 0 0 0 4 20.4 Z"
                fill={`${color}1E`} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
            <Path d="M20 5 A2 2 0 0 0 18 3.4 L13 3.4 L13 19.4 L18 19.4 A2 2 0 0 1 20 20.4 Z"
                fill={`${color}10`} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
            <Path d="M6.5 7.5 H9 M6.5 10 H9 M15 7.5 H17.5 M15 10 H17.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
        </Svg>
    );
}

/* 风味酒杯(品鉴) */
export function TasteGlyph({ size = 18, color = KC.goldSoft }: GlyphProps & { color?: string }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M7 3.5 L17 3.5 C 17 10, 14.5 13.5, 12 14.2 C 9.5 13.5, 7 10, 7 3.5 Z"
                fill={`${color}22`} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
            <Path d="M7.4 6.5 C 8 9, 10 11, 12 11 C 14 11, 16 9, 16.6 6.5 Z" fill={KC.crimson} opacity="0.85" />
            <Path d="M12 14.2 L12 19 M8.5 20.4 L15.5 20.4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
    );
}

/* 档位结论小标(推荐/可点/避开/鉴定) */
export function VerdictMark({ kind, size = 16, color }: { kind: 'mint' | 'amber' | 'blaze' | 'scan'; size?: number; color: string }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            {kind === 'mint' && (
                <Path d="M5 12.5 L10 17.5 L19 7" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {kind === 'amber' && (
                <Path d="M7 11 L7 20 M7 11 C 7 6, 10 4, 13 4 C 15 4, 15 6.5, 13.5 8 L19 8 C 20.4 8, 21 9.4, 20.4 11 L18 18 C 17.6 19.4, 16.4 20, 15 20 L7 20"
                    stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            )}
            {kind === 'blaze' && (
                <>
                    <Path d="M12 3 L21.5 20 A1 1 0 0 1 20.6 21.5 L3.4 21.5 A1 1 0 0 1 2.5 20 Z"
                        stroke={color} strokeWidth="1.9" strokeLinejoin="round" fill="none" />
                    <Path d="M12 9 L12 14" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
                    <Circle cx="12" cy="17.4" r="1.2" fill={color} />
                </>
            )}
            {kind === 'scan' && (
                <>
                    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
                    <Path d="M16.5 16.5 L21 21" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
                </>
            )}
        </Svg>
    );
}
