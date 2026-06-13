/**
 * VerdictCosmos —— 结果页 3D 判决星海(仅 Web)
 * 本项目最复杂的场景,随坑指数变色:
 *   焦散酒池(tilted caustics sea) + 悬浮判决水晶(fresnel 宝石) +
 *   视差碎晶 + 上升火花粒子 + 三色星云 + 远景星海 + 指针视差
 * tint = 判决档位色(良心绿 / 正常金 / 巨坑红 / 鉴定蓝),整场景据此染色。
 */
import { Canvas, useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import { View } from 'react-native';
import * as THREE from 'three';

/* ── 工具:径向辉光贴图 ── */
function glowTexture(rgb: string): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, `rgba(${rgb},0.9)`);
    g.addColorStop(0.4, `rgba(${rgb},0.3)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
}

function hexToRgbStr(hex: string): string {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/* ── 焦散酒池:倾斜平面 + 流动焦散 shader,延伸到地平线 ── */
function CausticSea({ color }: { color: THREE.Color }) {
    const mat = useMemo(() => new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uColor: { value: color }, uGold: { value: new THREE.Color('#E8C268') } },
        vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
            uniform float uTime; uniform vec3 uColor; uniform vec3 uGold; varying vec2 vUv;
            // 稳定的流动焦散(多次正弦扰动,不会爆值)
            float caustics(vec2 uv, float t){
                vec2 p = uv * 3.2;
                for(int i=0;i<4;i++){
                    float k = float(i);
                    p += 0.42 * vec2(sin(0.7*t + p.y*1.3 + k*1.7), cos(0.6*t + p.x*1.1 + k*1.3));
                }
                float v = 0.5 + 0.5 * sin(p.x) * cos(p.y);
                return pow(v, 3.0);
            }
            void main(){
                float depth = vUv.y;                 // 0 近 → 1 远
                float c = caustics(vUv * vec2(1.6, 3.0) + vec2(0.0, uTime*0.04), uTime);
                float horizon = smoothstep(1.0, 0.55, depth);   // 远处淡出
                float near = smoothstep(0.0, 0.25, depth);        // 最近端淡出(贴近相机太亮)
                vec3 col = mix(uColor, uGold, c*0.5) * c;
                float a = c * horizon * near * 0.5;
                gl_FragColor = vec4(col, a);
            }`,
    }), [color]);
    useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime; });
    return (
        <mesh material={mat} position={[0, -2.3, -1]} rotation={[-Math.PI / 2.35, 0, 0]}>
            <planeGeometry args={[26, 22, 1, 1]} />
        </mesh>
    );
}

/* ── 判决水晶:多面宝石 + 菲涅尔描边发光 ── */
function VerdictCrystal({ color, score, spin = 0.32 }: { color: THREE.Color; score: number; spin?: number }) {
    const group = useRef<THREE.Group>(null);
    const geo = useMemo(() => {
        const g = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
        g.computeVertexNormals();
        return g;
    }, []);
    const mat = useMemo(() => new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        uniforms: { uRim: { value: color }, uCore: { value: new THREE.Color('#F5DFA6') } },
        vertexShader: /* glsl */`
            varying vec3 vN; varying vec3 vV; varying float vFacet;
            void main(){
                vN = normalize(normalMatrix * normal);
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vV = normalize(-mv.xyz);
                vFacet = 0.5 + 0.5 * sin(dot(normal, vec3(12.9,78.2,37.7)));
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */`
            uniform vec3 uRim; uniform vec3 uCore; varying vec3 vN; varying vec3 vV; varying float vFacet;
            void main(){
                float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
                vec3 col = mix(uRim * 0.22, mix(uRim, uCore, f), f);
                col += vFacet * 0.12 * uCore;
                gl_FragColor = vec4(col, 0.06 + f * 0.8);
            }`,
    }), [color]);
    // 分数越高(越坑/越优),水晶略大、转更快
    const sc = 0.85 + (score / 100) * 0.5;
    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        if (group.current) {
            group.current.rotation.y = t * spin;
            group.current.rotation.x = Math.sin(t * 0.4) * 0.25;
            // 狂暴档(spin 大)轻微脉冲抖动
            const pulse = spin > 0.45 ? Math.sin(t * 9) * 0.04 : 0;
            group.current.position.y = 1.55 + Math.sin(t * 0.7) * 0.12 + pulse;
        }
    });
    return (
        <group ref={group} position={[0, 1.55, 0]} scale={sc}>
            <mesh geometry={geo} material={mat} />
            {/* 内核微光 */}
            <mesh scale={0.45}>
                <icosahedronGeometry args={[1, 0]} />
                <meshBasicMaterial color={color} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
        </group>
    );
}

/* ── 视差碎晶:小宝石缓慢翻滚 ── */
function Shards({ color, count = 7, spinMul = 1 }: { color: THREE.Color; count?: number; spinMul?: number }) {
    const group = useRef<THREE.Group>(null);
    const items = useMemo(() => {
        const arr: { pos: [number, number, number]; s: number; spin: number; axis: THREE.Vector3 }[] = [];
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            const r = 2.6 + (i % 3) * 0.9;
            arr.push({
                pos: [Math.cos(a) * r, 0.4 + Math.sin(a * 1.7) * 1.8, -1.5 - (i % 4)],
                s: 0.14 + (i % 3) * 0.07,
                spin: 0.3 + (i % 5) * 0.12,
                axis: new THREE.Vector3(Math.sin(i), Math.cos(i * 1.3), Math.sin(i * 0.7)).normalize(),
            });
        }
        return arr;
    }, [count]);
    const mat = useMemo(() => new THREE.MeshBasicMaterial({
        color, wireframe: true, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false,
    }), [color]);
    const refs = useRef<(THREE.Mesh | null)[]>([]);
    useFrame(({ clock }, dt) => {
        const t = clock.elapsedTime;
        refs.current.forEach((m, i) => {
            if (!m) return;
            m.rotateOnAxis(items[i].axis, dt * items[i].spin * spinMul);
            m.position.y = items[i].pos[1] + Math.sin(t * 0.6 + i) * 0.18;
        });
        if (group.current) group.current.rotation.y = t * 0.05;
    });
    return (
        <group ref={group}>
            {items.map((it, i) => (
                <mesh key={i} ref={el => { refs.current[i] = el; }} position={it.pos} scale={it.s} material={mat}>
                    <tetrahedronGeometry args={[1, 0]} />
                </mesh>
            ))}
        </group>
    );
}

/* ── 上升火花粒子 ── */
function Embers({ color, count = 90, speedMul = 1 }: { color: THREE.Color; count?: number; speedMul?: number }) {
    const ref = useRef<THREE.Points>(null);
    const { positions, sizes, speeds } = useMemo(() => {
        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const speeds = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 10;
            positions[i * 3 + 1] = -3 + Math.random() * 8;
            positions[i * 3 + 2] = -1 - Math.random() * 5;
            sizes[i] = 2 + Math.random() * 6;
            speeds[i] = 0.18 + Math.random() * 0.4;
        }
        return { positions, sizes, speeds };
    }, [count]);
    const mat = useMemo(() => new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uColor: { value: color }, uGold: { value: new THREE.Color('#F5DFA6') } },
        vertexShader: /* glsl */`
            attribute float aSize; uniform float uTime; varying float vTw;
            void main(){
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mv;
                gl_PointSize = clamp(aSize * 7.0 / max(0.6, -mv.z), 1.0, 16.0);
                vTw = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 2.0 + position.x * 3.0));
            }`,
        fragmentShader: /* glsl */`
            uniform vec3 uColor; uniform vec3 uGold; varying float vTw;
            void main(){
                float d = length(gl_PointCoord - 0.5);
                float a = smoothstep(0.5, 0.05, d);
                vec3 col = mix(uColor, uGold, vTw);
                gl_FragColor = vec4(col, a * vTw * 0.8);
            }`,
    }), [color]);
    useFrame(({ clock }, dt) => {
        mat.uniforms.uTime.value = clock.elapsedTime;
        const pos = ref.current?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
        if (!pos) return;
        for (let i = 0; i < count; i++) {
            let y = pos.getY(i) + speeds[i] * dt * speedMul;
            if (y > 5) y = -3;
            pos.setY(i, y);
            pos.setX(i, pos.getX(i) + Math.sin(clock.elapsedTime * 0.6 + i) * 0.002);
        }
        pos.needsUpdate = true;
    });
    return (
        <points ref={ref} material={mat}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
            </bufferGeometry>
        </points>
    );
}

/* ── 巨坑专属:危险冲击波环(从晶体向外脉冲扩散) ── */
function Shockwave({ color }: { color: THREE.Color }) {
    const refs = useRef<(THREE.Mesh | null)[]>([]);
    const RINGS = 3;
    return (
        <group position={[0, 1.55, 0]}>
            {Array.from({ length: RINGS }).map((_, i) => (
                <ShockRing key={i} color={color} phase={i / RINGS} ref={(el: THREE.Mesh | null) => { refs.current[i] = el; }} />
            ))}
        </group>
    );
}
const ShockRing = React.forwardRef<THREE.Mesh, { color: THREE.Color; phase: number }>(({ color, phase }, ref) => {
    const mat = useRef<THREE.MeshBasicMaterial>(null);
    useFrame(({ clock }) => {
        const t = (clock.elapsedTime * 0.5 + phase) % 1;
        const m = (ref as React.MutableRefObject<THREE.Mesh | null>).current;
        if (m) {
            const s = 0.4 + t * 3.4;
            m.scale.set(s, s, s);
            m.rotation.x = Math.PI / 2;
        }
        if (mat.current) mat.current.opacity = (1 - t) * 0.5;
    });
    return (
        <mesh ref={ref}>
            <torusGeometry args={[1, 0.02, 8, 80]} />
            <meshBasicMaterial ref={mat} color={color} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
    );
});
ShockRing.displayName = 'ShockRing';

/* ── 鉴定专属:垂直扫描光束 ── */
function ScanBeam({ color }: { color: THREE.Color }) {
    const mat = useMemo(() => new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uColor: { value: color } },
        vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: /* glsl */`
            uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
            void main(){
                float sweep = fract(uTime * 0.12);
                float line = smoothstep(0.04, 0.0, abs(vUv.y - sweep));
                float grid = smoothstep(0.02, 0.0, abs(fract(vUv.x*10.0)-0.5)*0.06) * 0.15;
                float edge = smoothstep(0.5,0.35,abs(vUv.x-0.5));
                gl_FragColor = vec4(uColor, (line*0.5 + grid) * edge);
            }`,
    }), [color]);
    useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime; });
    return (
        <mesh material={mat} position={[0, 1.4, -0.5]}>
            <planeGeometry args={[9, 7]} />
        </mesh>
    );
}

/* ── 三色星云 ── */
function Nebula({ color }: { color: THREE.Color }) {
    const tints = useMemo(() => {
        const rgb = `${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)}`;
        return { main: glowTexture(rgb), gold: glowTexture('232,194,104'), violet: glowTexture('124,77,255') };
    }, [color]);
    const refs = [useRef<THREE.Sprite>(null), useRef<THREE.Sprite>(null), useRef<THREE.Sprite>(null)];
    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        const b = [0.24 + 0.06 * Math.sin(t * 0.5), 0.16 + 0.05 * Math.sin(t * 0.4 + 2), 0.13 + 0.04 * Math.sin(t * 0.3 + 4)];
        refs.forEach((r, i) => { if (r.current) (r.current.material as THREE.SpriteMaterial).opacity = b[i]; });
    });
    return (
        <>
            <sprite ref={refs[0]} position={[-2.8, 2.2, -5]} scale={[10, 10, 1]}>
                <spriteMaterial map={tints.main} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.24} />
            </sprite>
            <sprite ref={refs[1]} position={[3.0, -1.0, -6]} scale={[11, 11, 1]}>
                <spriteMaterial map={tints.gold} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.16} />
            </sprite>
            <sprite ref={refs[2]} position={[0.5, 3.6, -7]} scale={[12, 12, 1]}>
                <spriteMaterial map={tints.violet} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.13} />
            </sprite>
        </>
    );
}

/* ── 远景星海 ── */
function StarField({ count = 360 }: { count?: number }) {
    const positions = useMemo(() => {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const r = 10 + Math.random() * 8;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            arr[i * 3 + 1] = r * Math.cos(phi);
            arr[i * 3 + 2] = -Math.abs(r * Math.sin(phi) * Math.sin(theta)) - 2;
        }
        return arr;
    }, [count]);
    return (
        <points>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial size={0.04} color="#9AA0CF" transparent opacity={0.55} sizeAttenuation depthWrite={false} />
        </points>
    );
}

/* ── 指挥:指针视差 + 呼吸 ── */
function Director({ children }: { children: React.ReactNode }) {
    const rig = useRef<THREE.Group>(null);
    const pointer = useRef({ x: 0, y: 0 });
    React.useEffect(() => {
        const onMove = (e: PointerEvent) => {
            pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
        };
        window.addEventListener('pointermove', onMove);
        return () => window.removeEventListener('pointermove', onMove);
    }, []);
    useFrame((_, dt) => {
        if (rig.current) {
            rig.current.rotation.y = THREE.MathUtils.damp(rig.current.rotation.y, pointer.current.x * 0.14, 2.5, dt);
            rig.current.rotation.x = THREE.MathUtils.damp(rig.current.rotation.x, -pointer.current.y * 0.06, 2.5, dt);
        }
    });
    return <group ref={rig}>{children}</group>;
}

type Mood = 'mint' | 'amber' | 'blaze' | 'scan';
const MOODS: Record<Mood, { spin: number; ember: number; shard: number; special: 'none' | 'shock' | 'beam' | 'sparkle' }> = {
    blaze: { spin: 0.6, ember: 1.9, shard: 1.7, special: 'shock' },   // 狂暴:快转 + 冲击波 + 急升火花
    amber: { spin: 0.3, ember: 1.0, shard: 1.0, special: 'none' },    // 平稳
    mint: { spin: 0.18, ember: 0.8, shard: 0.6, special: 'sparkle' }, // 舒缓:慢转 + 上升星火
    scan: { spin: 0.22, ember: 0.9, shard: 0.8, special: 'beam' },    // 鉴定:扫描光束
};

export default function VerdictCosmos({ tint = '#FF2E7E', score = 50, paused = false, mood = 'blaze' }: { tint?: string; score?: number; paused?: boolean; mood?: Mood }) {
    const color = useMemo(() => new THREE.Color(tint), [tint]);
    const gold = useMemo(() => new THREE.Color('#F5DFA6'), []);
    const isNarrow = typeof window !== 'undefined' && window.innerWidth < 480;
    const m = MOODS[mood] || MOODS.blaze;
    void hexToRgbStr;
    return (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <Canvas
                frameloop={paused ? 'never' : 'always'}
                dpr={[1, 1.75]}
                camera={{ position: [0, 0.3, 8], fov: 46 }}
                gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
                onCreated={(state) => {
                    state.gl.setClearColor('#060410', 1);
                    setTimeout(() => state.advance(performance.now()), 120);
                    setTimeout(() => state.advance(performance.now()), 420);
                }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            >
                <Nebula color={color} />
                <StarField count={isNarrow ? 240 : 360} />
                <CausticSea color={color} />
                {m.special === 'beam' && <ScanBeam color={color} />}
                <Director>
                    <VerdictCrystal color={color} score={score} spin={m.spin} />
                    <Shards color={color} count={isNarrow ? 5 : 7} spinMul={m.shard} />
                    <Embers color={color} count={isNarrow ? 60 : 90} speedMul={m.ember} />
                    {m.special === 'shock' && <Shockwave color={color} />}
                    {m.special === 'sparkle' && <Embers color={gold} count={isNarrow ? 30 : 46} speedMul={0.5} />}
                </Director>
            </Canvas>
        </View>
    );
}
