import { KC, SerifNum } from '@/constants/theme';
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

function polar(cx: number, cy: number, r: number, deg: number) {
    const rad = ((deg - 180) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
    const s = polar(cx, cy, r, startDeg);
    const e = polar(cx, cy, r, endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

interface Props {
    /** 0–100 */
    value: number;
    color: string;
    /** 仪表盘下方小标签,如 "坑指数" */
    label: string;
    size?: number;
    /** 数值右侧单位,如 "/100" */
    unit?: string;
}

/**
 * 坑指数半圆仪表盘 —— 240° 弧形表盘 + 刻度 + 衬线大数字
 */
export default function Gauge({ value, color, label, size = 150, unit = '' }: Props) {
    const W = 120, H = 96;          // viewBox
    const cx = 60, cy = 64, r = 50;
    const START = -30, END = 210;   // 240° 表盘
    const clamped = Math.min(100, Math.max(0, value));
    const sweep = START + (END - START) * (clamped / 100);

    // 刻度(每 20 一格)
    const ticks = [0, 20, 40, 60, 80, 100].map(v => {
        const deg = START + (END - START) * (v / 100);
        const o = polar(cx, cy, r + 7, deg);
        const i = polar(cx, cy, r + 3, deg);
        return { o, i, key: v };
    });

    const scale = size / W;

    return (
        <View style={{ width: size, height: H * scale, alignItems: 'center', justifyContent: 'flex-end' }}>
            <Svg width={size} height={H * scale} viewBox={`0 0 ${W} ${H}`} fill="none">
                <Defs>
                    <LinearGradient id="ggArc" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor={color} stopOpacity="0.55" />
                        <Stop offset="1" stopColor={color} />
                    </LinearGradient>
                </Defs>

                {/* 轨道 */}
                <Path d={arcPath(cx, cy, r, START, END)} stroke="rgba(255,255,255,0.1)" strokeWidth="7" strokeLinecap="round" />
                {/* 数值弧 */}
                {clamped > 0.5 && (
                    <Path d={arcPath(cx, cy, r, START, sweep)} stroke="url(#ggArc)" strokeWidth="7" strokeLinecap="round" />
                )}
                {/* 弧端发光点 */}
                {(() => {
                    const tip = polar(cx, cy, r, sweep);
                    return (
                        <>
                            <Circle cx={tip.x} cy={tip.y} r="6.5" fill={color} opacity="0.25" />
                            <Circle cx={tip.x} cy={tip.y} r="3" fill="#FFFFFF" />
                        </>
                    );
                })()}
                {/* 刻度 */}
                {ticks.map(t => (
                    <Path
                        key={t.key}
                        d={`M ${t.i.x.toFixed(1)} ${t.i.y.toFixed(1)} L ${t.o.x.toFixed(1)} ${t.o.y.toFixed(1)}`}
                        stroke="rgba(255,255,255,0.3)" strokeWidth="1.4" strokeLinecap="round"
                    />
                ))}
            </Svg>

            {/* 中心数字(衬线体) */}
            <View style={{ position: 'absolute', top: 14 * scale, left: 0, right: 0, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ color: KC.textHi, fontSize: 38 * scale, fontWeight: '700', fontFamily: SerifNum, letterSpacing: -1 }}>
                        {Math.round(clamped)}
                    </Text>
                    {!!unit && (
                        <Text style={{ color: KC.textLow, fontSize: 12 * scale, fontWeight: '600', marginLeft: 2 }}>{unit}</Text>
                    )}
                </View>
                <Text style={{ color, fontSize: 11 * scale, fontWeight: '700', letterSpacing: 4, marginTop: 2 }}>
                    {label}
                </Text>
            </View>
        </View>
    );
}
