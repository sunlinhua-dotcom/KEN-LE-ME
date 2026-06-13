import React from 'react';
import AuroraField from './AuroraField';
import ScanTunnel from './ScanTunnel';
import WineUniverse from './WineUniverse';

export type SceneName = 'wine' | 'scan' | 'aurora';

/**
 * 所有 Three.js 场景的唯一懒加载边界。
 * 三个场景收进同一个文件 → three.js 只属于这一个异步 chunk,
 * 不会被 Metro 提升到首屏 eager 的 __common(否则等于没拆)。
 * 子场景的 .web / 原生实现仍由各自的文件按平台自动解析。
 */
export default function Scene({ name, paused }: { name: SceneName; paused?: boolean }) {
    if (name === 'scan') return <ScanTunnel paused={paused} />;
    if (name === 'aurora') return <AuroraField paused={paused} />;
    return <WineUniverse paused={paused} />;
}
