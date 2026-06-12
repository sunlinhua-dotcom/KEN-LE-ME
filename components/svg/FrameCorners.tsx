import { KC } from '@/constants/theme';
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const L = 34, SW = 3;

function Corner({ flipX, flipY }: { flipX?: boolean; flipY?: boolean }) {
    return (
        <Svg
            width={L} height={L} viewBox={`0 0 ${L} ${L}`}
            style={{ transform: [{ scaleX: flipX ? -1 : 1 }, { scaleY: flipY ? -1 : 1 }] }}
        >
            <Path
                d={`M ${SW / 2} ${L - 6} L ${SW / 2} ${SW / 2 + 8} Q ${SW / 2} ${SW / 2} ${SW / 2 + 8} ${SW / 2} L ${L - 6} ${SW / 2}`}
                stroke={KC.gold} strokeWidth={SW} strokeLinecap="round" fill="none"
            />
        </Svg>
    );
}

/**
 * 相机取景框 —— 金色圆角四角 + 中心十字星
 */
export default function FrameCorners() {
    return (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 26 }}>
            <View style={{ flex: 1 }}>
                <View style={{ position: 'absolute', top: 0, left: 0 }}><Corner /></View>
                <View style={{ position: 'absolute', top: 0, right: 0 }}><Corner flipX /></View>
                <View style={{ position: 'absolute', bottom: 0, left: 0 }}><Corner flipY /></View>
                <View style={{ position: 'absolute', bottom: 0, right: 0 }}><Corner flipX flipY /></View>
                {/* 中心十字 */}
                <View style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -11, marginTop: -11 }}>
                    <Svg width={22} height={22} viewBox="0 0 22 22">
                        <Path d="M11 3 L11 8 M11 14 L11 19 M3 11 L8 11 M14 11 L19 11"
                            stroke="rgba(255,255,255,0.65)" strokeWidth="1.6" strokeLinecap="round" />
                        <Circle cx="11" cy="11" r="2" fill={KC.crimson} />
                    </Svg>
                </View>
            </View>
        </View>
    );
}
