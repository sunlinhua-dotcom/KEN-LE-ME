/**
 * ScanTunnel —— AI 分析中的 3D 扫描隧道(仅 Web)
 * 穿梭光环 + 雷达扇扫 + 汇聚粒子涡流 + 脉冲核心
 */
import { Canvas, useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import { View } from 'react-native';
import * as THREE from 'three';

const RING_COLORS = ['#FF2E7E', '#E8C268', '#FF2E7E', '#6FB3FF', '#E8C268', '#FF2E7E'];

/* ── 穿梭光环 ── */
function WarpRings() {
    const refs = useRef<(THREE.Mesh | null)[]>([]);
    useFrame((_, dt) => {
        refs.current.forEach(m => {
            if (!m) return;
            m.position.z += dt * 3.2;
            if (m.position.z > 5) m.position.z -= 30;
            const fade = 1 - Math.min(1, Math.abs(m.position.z - 1) / 16);
            (m.material as THREE.MeshBasicMaterial).opacity = fade * 0.55;
        });
    });
    return (
        <>
            {RING_COLORS.map((c, i) => (
                <mesh key={i} ref={el => { refs.current[i] = el; }} position={[0, 0, -i * 5]}>
                    <torusGeometry args={[2.7, 0.014, 8, 96]} />
                    <meshBasicMaterial color={c} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
                </mesh>
            ))}
        </>
    );
}

/* ── 雷达扇形扫描 ── */
function RadarSweep() {
    const mat = useMemo(() => new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#FF2E7E') } },
        vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
            uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
            void main() {
                vec2 p = vUv - 0.5;
                float r = length(p);
                if (r > 0.5) discard;
                float ang = atan(p.y, p.x);
                float sweep = pow(fract(-ang / 6.28318 - uTime * 0.22), 7.0);
                float rings = smoothstep(0.012, 0.0, abs(fract(r * 6.0) - 0.5) * 0.16);
                float edge = smoothstep(0.5, 0.42, r);
                float a = (sweep * 0.55 + rings * 0.10) * edge;
                gl_FragColor = vec4(uColor, a);
            }`,
    }), []);
    useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime; });
    return (
        <mesh position={[0, 0, -1.5]} material={mat}>
            <planeGeometry args={[5.6, 5.6]} />
        </mesh>
    );
}

/* ── 汇聚粒子涡流 ── */
function Vortex({ count = 300 }: { count?: number }) {
    const ref = useRef<THREE.Points>(null);
    const state = useMemo(() => {
        const r = new Float32Array(count), th = new Float32Array(count), z = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            r[i] = 1.2 + Math.random() * 5.5;
            th[i] = Math.random() * Math.PI * 2;
            z[i] = -16 + Math.random() * 18;
        }
        return { r, th, z };
    }, [count]);
    const positions = useMemo(() => new Float32Array(count * 3), [count]);
    const mat = useMemo(() => new THREE.PointsMaterial({
        size: 0.05, color: '#F5DFA6', transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }), []);

    useFrame((_, dt) => {
        const pos = ref.current?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
        if (!pos) return;
        for (let i = 0; i < count; i++) {
            state.th[i] += dt * (2.4 / Math.max(0.4, state.r[i]));
            state.r[i] -= dt * 0.5;
            state.z[i] += dt * 2.2;
            if (state.r[i] < 0.25 || state.z[i] > 4) {
                state.r[i] = 4.5 + Math.random() * 2.5;
                state.z[i] = -15;
            }
            pos.setXYZ(i, Math.cos(state.th[i]) * state.r[i], Math.sin(state.th[i]) * state.r[i] * 0.85, state.z[i]);
        }
        pos.needsUpdate = true;
    });

    return (
        <points ref={ref} material={mat}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
        </points>
    );
}

/* ── 脉冲核心 ── */
function Core() {
    const mesh = useRef<THREE.Mesh>(null);
    const glow = useRef<THREE.Sprite>(null);
    const tex = useMemo(() => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const ctx = c.getContext('2d')!;
        const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, 'rgba(255,86,150,0.9)');
        g.addColorStop(1, 'rgba(255,46,126,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(c);
    }, []);

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        const s = 1 + Math.sin(t * 2.6) * 0.12;
        mesh.current?.scale.setScalar(s);
        if (mesh.current) {
            mesh.current.rotation.x = t * 0.5;
            mesh.current.rotation.y = t * 0.8;
        }
        glow.current?.scale.setScalar(2.6 + Math.sin(t * 2.6) * 0.5);
    });

    return (
        <group position={[0, 0, -1]}>
            <sprite ref={glow} scale={[2.6, 2.6, 1]}>
                <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.8} />
            </sprite>
            <mesh ref={mesh}>
                <icosahedronGeometry args={[0.5, 1]} />
                <meshBasicMaterial color="#FF6FA6" wireframe transparent opacity={0.9} />
            </mesh>
        </group>
    );
}

export default function ScanTunnel({ paused = false }: { paused?: boolean }) {
    const isNarrow = typeof window !== 'undefined' && window.innerWidth < 480;
    return (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <Canvas
                frameloop={paused ? 'never' : 'always'}
                dpr={[1, 1.5]}
                camera={{ position: [0, 0, 6], fov: 50 }}
                gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
                onCreated={(state) => {
                    state.gl.setClearColor('#060410', 1);
                    // rAF 被节流(后台标签页 / 遮挡窗口)时也保证首帧可见
                    setTimeout(() => state.advance(performance.now()), 120);
                    setTimeout(() => state.advance(performance.now()), 400);
                }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            >
                <WarpRings />
                <RadarSweep />
                <Vortex count={isNarrow ? 220 : 300} />
                <Core />
            </Canvas>
        </View>
    );
}
