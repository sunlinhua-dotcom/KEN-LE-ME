/**
 * Gauge3D —— 结果页坑指数 / 品质分 的 3D 分段表盘(仅 Web)
 * 240° 分段弧,点亮段向前凸起 + 发光端点 + 轻微倾斜与浮动;
 * 中心数字用 RN Text 覆盖层渲染(保证字体清晰)。
 */
import { KC, SerifNum } from '@/constants/theme';
import { Canvas, useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import * as THREE from 'three';

const N = 46;
const ARC = (Math.PI * 4) / 3;       // 240°
const START = (Math.PI * 7) / 6;      // 210°(左下),向右下扫
const R = 1.45;

function glowTex(rgb: string) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, `rgba(${rgb},0.95)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
}

function Dial({ color, target }: { color: THREE.Color; target: number }) {
    const group = useRef<THREE.Group>(null);
    const refs = useRef<(THREE.Mesh | null)[]>([]);
    const tip = useRef<THREE.Sprite>(null);
    const prog = useRef(0);

    const segs = useMemo(() => Array.from({ length: N }, (_, i) => {
        const frac = i / (N - 1);
        const a = START - frac * ARC;
        return { frac, a, pos: [Math.cos(a) * R, Math.sin(a) * R, 0] as [number, number, number], rot: a - Math.PI / 2 };
    }), []);

    const lit = useMemo(() => color.clone(), [color]);
    const dim = useMemo(() => new THREE.Color('#2A2038'), []);
    const tex = useMemo(() => {
        const rgb = `${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)}`;
        return glowTex(rgb);
    }, [color]);

    useFrame(({ clock }, dt) => {
        prog.current += (target - prog.current) * Math.min(1, dt * 3.2);
        const p = prog.current;
        refs.current.forEach((m, i) => {
            if (!m) return;
            const on = segs[i].frac <= p + 0.001;
            const mat = m.material as THREE.MeshBasicMaterial;
            mat.color.copy(on ? lit : dim);
            mat.opacity = on ? 0.96 : 0.45;
            m.scale.z = on ? 1.7 : 1.0;
        });
        // 端点辉光
        if (tip.current) {
            const a = START - Math.max(0, Math.min(1, p)) * ARC;
            tip.current.position.set(Math.cos(a) * R, Math.sin(a) * R, 0.18);
            (tip.current.material as THREE.SpriteMaterial).opacity = 0.7 + 0.3 * Math.sin(clock.elapsedTime * 4);
        }
        // 轻微浮动倾斜
        if (group.current) {
            group.current.rotation.x = -0.34 + Math.sin(clock.elapsedTime * 0.8) * 0.04;
            group.current.rotation.z = Math.sin(clock.elapsedTime * 0.5) * 0.03;
        }
    });

    return (
        <group ref={group} rotation={[-0.34, 0, 0]}>
            {segs.map((s, i) => (
                <mesh key={i} ref={el => { refs.current[i] = el; }} position={s.pos} rotation={[0, 0, s.rot]}>
                    <boxGeometry args={[0.055, 0.22, 0.1]} />
                    <meshBasicMaterial color={dim} transparent opacity={0.45} toneMapped={false} />
                </mesh>
            ))}
            <sprite ref={tip} scale={[0.7, 0.7, 1]}>
                <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.8} />
            </sprite>
        </group>
    );
}

interface Props {
    value: number;
    color: string;
    label: string;
    size?: number;
    unit?: string;
}

export default function Gauge3D({ value, color, label, size = 150, unit = '' }: Props) {
    const col = useMemo(() => new THREE.Color(color), [color]);
    const clamped = Math.min(100, Math.max(0, value));
    const H = size * 0.78;

    return (
        <View style={{ width: size, height: H, alignItems: 'center', justifyContent: 'center' }}>
            <Canvas
                dpr={[1, 1.5]}
                camera={{ position: [0, 0, 4.1], fov: 38 }}
                gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
                onCreated={(state) => {
                    setTimeout(() => state.advance(performance.now()), 100);
                    setTimeout(() => state.advance(performance.now()), 420);
                }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            >
                <Dial color={col} target={clamped / 100} />
            </Canvas>

            {/* 中心数字覆盖层 */}
            <View pointerEvents="none" style={{ position: 'absolute', top: H * 0.18, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ color: KC.textHi, fontSize: size * 0.27, fontWeight: '800', fontFamily: SerifNum, letterSpacing: -1 }}>
                        {Math.round(clamped)}
                    </Text>
                    {!!unit && <Text style={{ color: KC.textLow, fontSize: size * 0.085, fontWeight: '700', marginLeft: 2 }}>{unit}</Text>}
                </View>
                <Text style={{ color, fontSize: size * 0.075, fontWeight: '800', letterSpacing: 3, marginTop: 1 }}>{label}</Text>
            </View>
        </View>
    );
}
