import React from 'react';
import ScanTunnel from './ScanTunnel';
import VerdictCosmos from './VerdictCosmos';
import WineUniverse from './WineUniverse';

// 同一 chunk 内再导出 3D 表盘 —— 经 lazy(import('./Scenes').then(m => m.Gauge3D))
// 引用,确保 three.js 不会因多入口被提升进首屏包。
export { default as Gauge3D } from './Gauge3D';

export type SceneName = 'wine' | 'scan' | 'verdict';
export type VerdictMood = 'mint' | 'amber' | 'blaze' | 'scan';

interface SceneProps {
    name: SceneName;
    paused?: boolean;
    /** verdict 场景:判决档位色 */
    tint?: string;
    /** verdict 场景:坑指数 / 品质分 0-100 */
    score?: number;
    /** verdict 场景:档位,驱动不同动画风格 */
    mood?: VerdictMood;
}

/**
 * 所有 Three.js 场景的唯一懒加载边界。
 * 全部场景收进同一个文件 → three.js 只属于这一个异步 chunk,
 * 不会被 Metro 提升到首屏 eager 的 __common(否则等于没拆)。
 * 子场景的 .web / 原生实现仍由各自的文件按平台自动解析。
 */
export default function Scene({ name, paused, tint, score, mood }: SceneProps) {
    if (name === 'scan') return <ScanTunnel paused={paused} />;
    if (name === 'verdict') return <VerdictCosmos paused={paused} tint={tint} score={score} mood={mood} />;
    return <WineUniverse paused={paused} />;
}
