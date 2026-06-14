import React from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

/**
 * 本地图标集 —— 替代 lucide-react-native
 * lucide 的桶式导入会把全部 3334 个图标打进首屏包(实测 Banana/Rocket 等
 * 全被打包),而本项目只用到下面 11 个。改用本地 SVG 后,首屏包不再含图标库。
 * 路径取自 lucide(ISC License),24×24,描边风格保持一致。
 */

interface IconProps {
    size?: number;
    color?: string;
    strokeWidth?: number;
    fill?: string;
}

function Base({ size = 24, color = '#fff', strokeWidth = 2, fill = 'none', children }: IconProps & { children: React.ReactNode }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            {children}
        </Svg>
    );
}

export function Camera(p: IconProps) {
    return (
        <Base {...p}>
            <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <Circle cx="12" cy="13" r="3" />
        </Base>
    );
}

export function ArrowRight(p: IconProps) {
    return (
        <Base {...p}>
            <Line x1="5" y1="12" x2="19" y2="12" />
            <Polyline points="12 5 19 12 12 19" />
        </Base>
    );
}

export function ArrowLeft(p: IconProps) {
    return (
        <Base {...p}>
            <Line x1="19" y1="12" x2="5" y2="12" />
            <Polyline points="12 19 5 12 12 5" />
        </Base>
    );
}

export function ImageIcon(p: IconProps) {
    return (
        <Base {...p}>
            <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <Circle cx="9" cy="9" r="2" />
            <Path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </Base>
    );
}

export function Plus(p: IconProps) {
    return (
        <Base {...p}>
            <Line x1="5" y1="12" x2="19" y2="12" />
            <Line x1="12" y1="5" x2="12" y2="19" />
        </Base>
    );
}

export function X(p: IconProps) {
    return (
        <Base {...p}>
            <Line x1="18" y1="6" x2="6" y2="18" />
            <Line x1="6" y1="6" x2="18" y2="18" />
        </Base>
    );
}

export function RotateCcw(p: IconProps) {
    return (
        <Base {...p}>
            <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <Path d="M3 3v5h5" />
        </Base>
    );
}

export function Share2(p: IconProps) {
    return (
        <Base {...p}>
            <Circle cx="18" cy="5" r="3" />
            <Circle cx="6" cy="12" r="3" />
            <Circle cx="18" cy="19" r="3" />
            <Line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <Line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </Base>
    );
}

export function Square(p: IconProps) {
    return (
        <Base {...p}>
            <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </Base>
    );
}

export function Volume2(p: IconProps) {
    return (
        <Base {...p}>
            <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <Path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </Base>
    );
}

export function Check(p: IconProps) {
    return (
        <Base {...p}>
            <Polyline points="20 6 9 17 4 12" />
        </Base>
    );
}

export function MapPin(p: IconProps) {
    return (
        <Base {...p}>
            <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <Circle cx="12" cy="10" r="3" />
        </Base>
    );
}

export function Globe(p: IconProps) {
    return (
        <Base {...p}>
            <Circle cx="12" cy="12" r="10" />
            <Path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <Line x1="2" y1="12" x2="22" y2="12" />
        </Base>
    );
}

export function Star(p: IconProps) {
    return (
        <Base {...p}>
            <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </Base>
    );
}
