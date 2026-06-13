/**
 * Gauge3D —— 原生端降级:复用 SVG 表盘(不引入 three)。
 */
import Gauge from '@/components/svg/Gauge';
import React from 'react';

interface Props {
    value: number;
    color: string;
    label: string;
    size?: number;
    unit?: string;
}

export default function Gauge3D({ value, color, label, size = 150, unit = '' }: Props) {
    return <Gauge value={value} color={color} label={label} size={size} unit={unit} />;
}
