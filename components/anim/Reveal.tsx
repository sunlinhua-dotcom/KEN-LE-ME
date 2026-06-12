import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

interface Props {
    children: React.ReactNode;
    /** 延迟毫秒 */
    delay?: number;
    /** 初始位移(正值=从下方浮入,负值=从上方落入) */
    dy?: number;
    duration?: number;
    style?: ViewStyle | ViewStyle[];
    className?: string;
}

/**
 * 跨平台入场动画(淡入 + 浮动)
 * - 用 style 驱动而非 entering 布局动画:Reanimated v4 的 entering
 *   在 react-native-web 上会卡在初始帧。
 * - className 放在内层普通 View 上:NativeWind 不会编译
 *   Animated.View 上的 className。
 */
export default function Reveal({ children, delay = 0, dy = 14, duration = 600, style, className }: Props) {
    const v = useSharedValue(0);

    useEffect(() => {
        v.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    }, [delay, duration, v]);

    const anim = useAnimatedStyle(() => ({
        opacity: v.value,
        transform: [{ translateY: (1 - v.value) * dy }],
    }));

    return (
        <Animated.View style={anim}>
            <View className={className} style={style}>
                {children}
            </View>
        </Animated.View>
    );
}
