/**
 * WineUniverse —— 首页 3D 场景(仅 Web)
 * 程序化高脚杯(菲涅尔玻璃) + 杯中酒液 + 升腾气泡 + 香槟金尘 + 星云辉光
 * 全部程序化生成,零外部资源,弱网秒开
 */
import { Canvas, useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import { View } from 'react-native';
import * as THREE from 'three';

/* ── 工具:径向辉光贴图 ── */
function makeGlowTexture(rgb: string): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, `rgba(${rgb},0.85)`);
    g.addColorStop(0.35, `rgba(${rgb},0.28)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
}

/* ── 工具:平滑高脚杯母线 ── */
function glassProfile(): THREE.Vector2[] {
    const ctrl: [number, number][] = [
        [0.001, -1.62], [0.40, -1.61], [0.58, -1.58], [0.55, -1.52],
        [0.16, -1.46], [0.07, -1.30], [0.065, -0.85], [0.07, -0.45],
        [0.13, -0.36], [0.40, -0.22], [0.62, 0.02], [0.72, 0.35],
        [0.73, 0.66], [0.67, 1.02], [0.60, 1.28],
    ];
    const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, y]) => new THREE.Vector3(x, y, 0)));
    return curve.getPoints(72).map(p => new THREE.Vector2(Math.max(0.001, p.x), p.y));
}

/* ── 菲涅尔玻璃杯 ── */
function GlassGoblet() {
    const geo = useMemo(() => new THREE.LatheGeometry(glassProfile(), 72), []);
    const mat = useMemo(() => new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uRim: { value: new THREE.Color('#F5DFA6') },
            uInner: { value: new THREE.Color('#FF2E7E') },
        },
        vertexShader: /* glsl */`
            varying vec3 vN; varying vec3 vV;
            void main() {
                vN = normalize(normalMatrix * normal);
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vV = normalize(-mv.xyz);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */`
            uniform vec3 uRim; uniform vec3 uInner;
            varying vec3 vN; varying vec3 vV;
            void main() {
                float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6);
                vec3 col = mix(uInner * 0.16, uRim, f);
                gl_FragColor = vec4(col, 0.035 + f * 0.85);
            }`,
    }), []);
    return <mesh geometry={geo} material={mat} />;
}

/* ── 杯中酒液(高度渐变 + 微醺晃动) ── */
function WineLiquid() {
    const group = useRef<THREE.Group>(null);
    const bodyGeo = useMemo(() => {
        const ctrl: [number, number][] = [
            [0.001, -0.16], [0.30, -0.10], [0.50, 0.04], [0.60, 0.22], [0.615, 0.34],
        ];
        const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, y]) => new THREE.Vector3(x, y, 0)));
        const pts = curve.getPoints(36).map(p => new THREE.Vector2(Math.max(0.001, p.x), p.y));
        return new THREE.LatheGeometry(pts, 64);
    }, []);
    const bodyMat = useMemo(() => new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
            uDeep: { value: new THREE.Color('#4A0A22') },
            uBright: { value: new THREE.Color('#FF2E7E') },
        },
        vertexShader: /* glsl */`
            varying float vY;
            void main() { vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
            uniform vec3 uDeep; uniform vec3 uBright; varying float vY;
            void main() {
                vec3 col = mix(uDeep, uBright, smoothstep(-0.18, 0.36, vY));
                gl_FragColor = vec4(col, 0.92);
            }`,
    }), []);

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        if (group.current) {
            group.current.rotation.z = Math.sin(t * 0.6) * 0.045;
            group.current.rotation.x = Math.cos(t * 0.45) * 0.035;
        }
    });

    return (
        <group ref={group}>
            <mesh geometry={bodyGeo} material={bodyMat} />
            {/* 酒面 */}
            <mesh position={[0, 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.6, 48]} />
                <meshBasicMaterial color="#FF4D93" transparent opacity={0.95} />
            </mesh>
        </group>
    );
}

/* ── 圆点粒子着色器(通用) ── */
const POINT_VERT = /* glsl */`
    attribute float aSize; attribute float aPhase;
    uniform float uTime; uniform float uPx;
    varying float vTw;
    void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uPx / max(0.5, -mv.z), 1.0, 22.0);
        vTw = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.4 + aPhase));
    }`;
const POINT_FRAG = /* glsl */`
    uniform vec3 uColor; varying float vTw;
    void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.08, d);
        gl_FragColor = vec4(uColor, a * vTw * 0.8);
    }`;

function makePointsMaterial(color: string, px: number) {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uPx: { value: px }, uColor: { value: new THREE.Color(color) } },
        vertexShader: POINT_VERT, fragmentShader: POINT_FRAG,
    });
}

/* ── 杯中升腾气泡 ── */
function Bubbles({ count = 80 }: { count?: number }) {
    const ref = useRef<THREE.Points>(null);
    const { positions, sizes, phases, speeds } = useMemo(() => {
        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const phases = new Float32Array(count);
        const speeds = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const r = Math.sqrt(Math.random()) * 0.46;
            const a = Math.random() * Math.PI * 2;
            positions[i * 3] = Math.cos(a) * r;
            positions[i * 3 + 1] = -0.14 + Math.random() * 0.46;
            positions[i * 3 + 2] = Math.sin(a) * r;
            sizes[i] = 5 + Math.random() * 9;
            phases[i] = Math.random() * Math.PI * 2;
            speeds[i] = 0.06 + Math.random() * 0.12;
        }
        return { positions, sizes, phases, speeds };
    }, [count]);
    const mat = useMemo(() => makePointsMaterial('#FFD9EA', 5), []);

    useFrame(({ clock }, dt) => {
        mat.uniforms.uTime.value = clock.elapsedTime;
        const pos = ref.current?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
        if (!pos) return;
        for (let i = 0; i < count; i++) {
            let y = pos.getY(i) + speeds[i] * dt;
            if (y > 0.32) y = -0.14;
            pos.setY(i, y);
            pos.setX(i, pos.getX(i) + Math.sin(clock.elapsedTime * 2 + phases[i]) * 0.0006);
        }
        pos.needsUpdate = true;
    });

    return (
        <points ref={ref} material={mat}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
                <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
            </bufferGeometry>
        </points>
    );
}

/* ── 环绕尘埃(香槟金 / 酒红双色) ── */
function Dust({ count, color, radius, px = 11, speed = 0.02, squash = 0.62 }: {
    count: number; color: string; radius: [number, number]; px?: number; speed?: number; squash?: number;
}) {
    const ref = useRef<THREE.Points>(null);
    const { positions, sizes, phases } = useMemo(() => {
        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const phases = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const r = radius[0] + Math.random() * (radius[1] - radius[0]);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.cos(phi) * squash;
            positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
            sizes[i] = 2.5 + Math.random() * 7;
            phases[i] = Math.random() * Math.PI * 2;
        }
        return { positions, sizes, phases };
    }, [count, radius, squash]);
    const mat = useMemo(() => makePointsMaterial(color, px), [color, px]);

    useFrame(({ clock }, dt) => {
        mat.uniforms.uTime.value = clock.elapsedTime;
        if (ref.current) ref.current.rotation.y += dt * speed;
    });

    return (
        <points ref={ref} material={mat}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
                <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
            </bufferGeometry>
        </points>
    );
}

/* ── 星云辉光 ── */
function Nebula() {
    const tex = useMemo(() => ({
        crimson: makeGlowTexture('255,46,126'),
        gold: makeGlowTexture('232,194,104'),
        violet: makeGlowTexture('124,77,255'),
    }), []);
    const refs = [useRef<THREE.Sprite>(null), useRef<THREE.Sprite>(null), useRef<THREE.Sprite>(null)];

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        const breathe = [0.22 + 0.06 * Math.sin(t * 0.5), 0.17 + 0.05 * Math.sin(t * 0.38 + 2), 0.14 + 0.04 * Math.sin(t * 0.3 + 4)];
        refs.forEach((r, i) => { if (r.current) (r.current.material as THREE.SpriteMaterial).opacity = breathe[i]; });
    });

    return (
        <>
            <sprite ref={refs[0]} position={[-2.6, 1.8, -4]} scale={[9, 9, 1]}>
                <spriteMaterial map={tex.crimson} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.22} />
            </sprite>
            <sprite ref={refs[1]} position={[2.8, -1.4, -5]} scale={[10, 10, 1]}>
                <spriteMaterial map={tex.gold} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.17} />
            </sprite>
            <sprite ref={refs[2]} position={[0.4, 3.2, -6]} scale={[11, 11, 1]}>
                <spriteMaterial map={tex.violet} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.14} />
            </sprite>
        </>
    );
}

/* ── 远景星海 ── */
function StarField({ count = 420 }: { count?: number }) {
    const positions = useMemo(() => {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const r = 9 + Math.random() * 9;
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
            <pointsMaterial size={0.055} color="#8E96C9" transparent opacity={0.7} sizeAttenuation depthWrite={false} />
        </points>
    );
}

/* ── 场景指挥:入场推轨 + 指针视差 + 呼吸浮动 ── */
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

    useFrame(({ clock }, dt) => {
        const t = clock.elapsedTime;
        if (rig.current) {
            // 指针视差(移动端自动归零)
            rig.current.rotation.y = THREE.MathUtils.damp(rig.current.rotation.y, pointer.current.x * 0.16, 2.5, dt);
            rig.current.rotation.x = THREE.MathUtils.damp(rig.current.rotation.x, -pointer.current.y * 0.07, 2.5, dt);
            // 呼吸浮动
            rig.current.position.y = Math.sin(t * 0.55) * 0.07;
        }
    });

    return <group ref={rig}>{children}</group>;
}

/* ── 主组件 ── */
export default function WineUniverse({ paused = false }: { paused?: boolean }) {
    const isNarrow = typeof window !== 'undefined' && window.innerWidth < 480;

    return (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <Canvas
                frameloop={paused ? 'never' : 'always'}
                dpr={[1, 2]}
                camera={{ position: [0, 0, 7.6], fov: 42 }}
                gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
                onCreated={(state) => {
                    state.gl.setClearColor('#060410', 1);
                    // rAF 被节流(后台标签页 / 遮挡窗口)时也保证首帧可见
                    setTimeout(() => state.advance(performance.now()), 120);
                    setTimeout(() => state.advance(performance.now()), 400);
                }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            >
                <Director>
                    <Nebula />
                    <StarField count={isNarrow ? 300 : 420} />
                    <Dust count={isNarrow ? 150 : 230} color="#E8C268" radius={[2.4, 5.6]} />
                    <Dust count={isNarrow ? 60 : 100} color="#FF2E7E" radius={[2.0, 4.6]} speed={-0.014} px={9} />
                    {/* 高脚杯舞台(上移,给下方 UI 留呼吸) */}
                    <group position={[0, 1.46, 0]} scale={0.74}>
                        <GlassGoblet />
                        <WineLiquid />
                        <Bubbles count={isNarrow ? 42 : 56} />
                    </group>
                </Director>
            </Canvas>
        </View>
    );
}
