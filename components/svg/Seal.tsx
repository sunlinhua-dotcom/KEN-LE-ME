import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface Props {
    label: string;        // 良心 / 正常 / 巨坑 / 鉴定
    color: string;
    /** 比值文字,如 "2.1x" */
    sub?: string;
    size?: number;
    rotate?: number;
}

/**
 * 鉴定印章 —— 双环钢印风格,盖在每张酒卡右上角
 */
export default function Seal({ label, color, sub, size = 64, rotate = 12 }: Props) {
    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${rotate}deg` }] }}>
            <Svg width={size} height={size} viewBox="0 0 72 72" fill="none" style={{ position: 'absolute' }}>
                {/* 外环 */}
                <Circle cx="36" cy="36" r="33" stroke={color} strokeWidth="2.5" opacity="0.9" />
                {/* 内虚线环 */}
                <Circle cx="36" cy="36" r="27.5" stroke={color} strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />
                {/* 左右菱形装饰 */}
                <Path d="M8.5 36 L11.5 33 L14.5 36 L11.5 39 Z" fill={color} opacity="0.85" />
                <Path d="M57.5 36 L60.5 33 L63.5 36 L60.5 39 Z" fill={color} opacity="0.85" />
            </Svg>
            <Text style={{ color, fontSize: size * 0.26, fontWeight: '900', letterSpacing: 2, marginLeft: 2 }}>
                {label}
            </Text>
            {!!sub && (
                <Text style={{ color, fontSize: size * 0.14, fontWeight: '700', opacity: 0.85, marginTop: 1 }}>
                    {sub}
                </Text>
            )}
        </View>
    );
}
