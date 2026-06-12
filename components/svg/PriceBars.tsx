import { KC, SerifNum } from '@/constants/theme';
import { formatPrice } from '@/utils/format';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

interface Props {
    menuPrice: number | null;
    onlinePrice: number | null;
}

const BAR_H = 12;
const GAP = 22;

/**
 * 店内价 vs 电商价 对比条 —— 一眼看出溢价幅度
 */
export default function PriceBars({ menuPrice, onlinePrice }: Props) {
    const [w, setW] = useState(0);
    const max = Math.max(menuPrice || 0, onlinePrice || 0);
    if (!max) return null;

    const LABEL_W = 44, PRICE_W = 72;
    const trackW = Math.max(0, w - LABEL_W - PRICE_W);

    const rows = [
        { label: '店内', value: menuPrice, color: ['#FF5A8F', KC.crimson] as const, id: 'pbMenu' },
        { label: '电商', value: onlinePrice, color: ['#6FF0C2', KC.mint] as const, id: 'pbShop' },
    ].filter(r => r.value);

    return (
        <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
            {w > 0 && (
                <Svg width={w} height={rows.length * GAP} viewBox={`0 0 ${w} ${rows.length * GAP}`}>
                    <Defs>
                        {rows.map(r => (
                            <LinearGradient key={r.id} id={r.id} x1="0" y1="0" x2="1" y2="0">
                                <Stop offset="0" stopColor={r.color[0]} stopOpacity="0.65" />
                                <Stop offset="1" stopColor={r.color[1]} />
                            </LinearGradient>
                        ))}
                    </Defs>
                    {rows.map((r, i) => {
                        const y = i * GAP + (GAP - BAR_H) / 2;
                        const bw = Math.max(BAR_H, trackW * ((r.value || 0) / max));
                        return (
                            <React.Fragment key={r.id}>
                                {/* 轨道 */}
                                <Rect x={LABEL_W} y={y} width={trackW} height={BAR_H} rx={BAR_H / 2} fill="rgba(255,255,255,0.07)" />
                                {/* 数值条 */}
                                <Rect x={LABEL_W} y={y} width={bw} height={BAR_H} rx={BAR_H / 2} fill={`url(#${r.id})`} />
                                {/* 条端高光点 */}
                                <Rect x={LABEL_W + bw - BAR_H + 3} y={y + 3} width={BAR_H - 6} height={BAR_H - 6} rx={(BAR_H - 6) / 2} fill="#FFFFFF" opacity={0.85} />
                            </React.Fragment>
                        );
                    })}
                </Svg>
            )}
            {/* 标签与价格(覆盖层,保证字体渲染质量) */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
                {rows.map((r, i) => (
                    <View key={r.id} style={{ height: GAP, flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ width: LABEL_W, color: KC.textLow, fontSize: 11, fontWeight: '600', letterSpacing: 1 }}>
                            {r.label}
                        </Text>
                        <View style={{ flex: 1 }} />
                        <Text style={{ width: PRICE_W, textAlign: 'right', color: i === 0 ? KC.textHi : KC.mint, fontSize: 13, fontWeight: '700', fontFamily: SerifNum }} numberOfLines={1}>
                            ¥{formatPrice(r.value)}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}
