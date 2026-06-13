/**
 * VerdictCosmos —— 结果页 3D 判决星海(仅 Web)
 * 共享"宇宙舞台"(星云 / 星海 / 视差 / 火花) + 12 种完全不同的核心形态(HERO),
 * 形状和感觉都随结果变化(见 utils/format pickResultVariant)。
 * tint = 档位色,mood = 档位动画风格,variant = 0–11 形态。
 */
import { Canvas, useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import { View } from 'react-native';
import * as THREE from 'three';

/* ════════ 工具 ════════ */
function glowTexture(rgb: string): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, `rgba(${rgb},0.9)`);
    g.addColorStop(0.4, `rgba(${rgb},0.3)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
}
function rgbOf(c: THREE.Color) { return `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`; }

/** 通用菲涅尔玻璃/宝石材质(描边发光) */
function fresnelMat(color: THREE.Color, core = '#F5DFA6', power = 2.2, base = 0.06, gain = 0.82) {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        uniforms: { uRim: { value: color }, uCore: { value: new THREE.Color(core) }, uPow: { value: power }, uBase: { value: base }, uGain: { value: gain } },
        vertexShader: /* glsl */`
            varying vec3 vN; varying vec3 vV;
            void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: /* glsl */`
            uniform vec3 uRim; uniform vec3 uCore; uniform float uPow; uniform float uBase; uniform float uGain; varying vec3 vN; varying vec3 vV;
            void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow); vec3 col = mix(uRim*0.2, mix(uRim,uCore,f), f); gl_FragColor = vec4(col, uBase + f*uGain); }`,
    });
}

const POINT_VERT = /* glsl */`
    attribute float aSize; uniform float uTime; uniform float uPx; varying float vTw;
    void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
    gl_PointSize = clamp(aSize*uPx/max(0.5,-mv.z),1.0,20.0); vTw = 0.4+0.6*(0.5+0.5*sin(uTime*1.6 + position.x*3.0)); }`;
const POINT_FRAG = /* glsl */`
    uniform vec3 uColor; varying float vTw;
    void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.06,d); gl_FragColor = vec4(uColor, a*vTw*0.85); }`;
function pointsMat(color: THREE.Color, px = 9) {
    return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uPx: { value: px }, uColor: { value: color } }, vertexShader: POINT_VERT, fragmentShader: POINT_FRAG });
}

/* ════════ 共享环境 ════════ */
function Nebula({ color }: { color: THREE.Color }) {
    const tints = useMemo(() => ({ main: glowTexture(rgbOf(color)), gold: glowTexture('232,194,104'), violet: glowTexture('124,77,255') }), [color]);
    const refs = [useRef<THREE.Sprite>(null), useRef<THREE.Sprite>(null), useRef<THREE.Sprite>(null)];
    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        const b = [0.24 + 0.06 * Math.sin(t * 0.5), 0.16 + 0.05 * Math.sin(t * 0.4 + 2), 0.13 + 0.04 * Math.sin(t * 0.3 + 4)];
        refs.forEach((r, i) => { if (r.current) (r.current.material as THREE.SpriteMaterial).opacity = b[i]; });
    });
    return (<>
        <sprite ref={refs[0]} position={[-2.8, 2.2, -5]} scale={[10, 10, 1]}><spriteMaterial map={tints.main} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.24} /></sprite>
        <sprite ref={refs[1]} position={[3, -1, -6]} scale={[11, 11, 1]}><spriteMaterial map={tints.gold} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.16} /></sprite>
        <sprite ref={refs[2]} position={[0.5, 3.6, -7]} scale={[12, 12, 1]}><spriteMaterial map={tints.violet} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.13} /></sprite>
    </>);
}
function StarField({ count = 320 }: { count?: number }) {
    const positions = useMemo(() => {
        const a = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) { const r = 10 + Math.random() * 8, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1); a[i * 3] = r * Math.sin(ph) * Math.cos(th); a[i * 3 + 1] = r * Math.cos(ph); a[i * 3 + 2] = -Math.abs(r * Math.sin(ph) * Math.sin(th)) - 2; }
        return a;
    }, [count]);
    return (<points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial size={0.04} color="#9AA0CF" transparent opacity={0.55} sizeAttenuation depthWrite={false} /></points>);
}
function Embers({ color, count = 60, speedMul = 1 }: { color: THREE.Color; count?: number; speedMul?: number }) {
    const ref = useRef<THREE.Points>(null);
    const { positions, sizes, speeds } = useMemo(() => {
        const positions = new Float32Array(count * 3), sizes = new Float32Array(count), speeds = new Float32Array(count);
        for (let i = 0; i < count; i++) { positions[i * 3] = (Math.random() - 0.5) * 10; positions[i * 3 + 1] = -3 + Math.random() * 8; positions[i * 3 + 2] = -1 - Math.random() * 5; sizes[i] = 2 + Math.random() * 5; speeds[i] = 0.16 + Math.random() * 0.35; }
        return { positions, sizes, speeds };
    }, [count]);
    const mat = useMemo(() => pointsMat(color, 7), [color]);
    useFrame(({ clock }, dt) => {
        mat.uniforms.uTime.value = clock.elapsedTime;
        const pos = ref.current?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined; if (!pos) return;
        for (let i = 0; i < count; i++) { let y = pos.getY(i) + speeds[i] * dt * speedMul; if (y > 5) y = -3; pos.setY(i, y); }
        pos.needsUpdate = true;
    });
    return (<points ref={ref} material={mat}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /><bufferAttribute attach="attributes-aSize" args={[sizes, 1]} /></bufferGeometry></points>);
}
function CausticSea({ color }: { color: THREE.Color }) {
    const mat = useMemo(() => new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uColor: { value: color }, uGold: { value: new THREE.Color('#E8C268') } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: /* glsl */`
            uniform float uTime; uniform vec3 uColor; uniform vec3 uGold; varying vec2 vUv;
            float caustics(vec2 uv,float t){ vec2 p=uv*3.2; for(int i=0;i<4;i++){ float k=float(i); p+=0.42*vec2(sin(0.7*t+p.y*1.3+k*1.7),cos(0.6*t+p.x*1.1+k*1.3)); } return pow(0.5+0.5*sin(p.x)*cos(p.y),3.0); }
            void main(){ float depth=vUv.y; float c=caustics(vUv*vec2(1.6,3.0)+vec2(0.0,uTime*0.04),uTime); float horizon=smoothstep(1.0,0.55,depth); float near=smoothstep(0.0,0.25,depth); vec3 col=mix(uColor,uGold,c*0.5)*c; gl_FragColor=vec4(col,c*horizon*near*0.5); }`,
    }), [color]);
    useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime; });
    return (<mesh material={mat} position={[0, -2.3, -1]} rotation={[-Math.PI / 2.35, 0, 0]}><planeGeometry args={[26, 22, 1, 1]} /></mesh>);
}
function ScanBeam({ color }: { color: THREE.Color }) {
    const mat = useMemo(() => new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uColor: { value: color } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: /* glsl */`uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
            void main(){ float sweep=fract(uTime*0.12); float line=smoothstep(0.04,0.0,abs(vUv.y-sweep)); float grid=smoothstep(0.02,0.0,abs(fract(vUv.x*10.0)-0.5)*0.06)*0.15; float edge=smoothstep(0.5,0.35,abs(vUv.x-0.5)); gl_FragColor=vec4(uColor,(line*0.5+grid)*edge); }`,
    }), [color]);
    useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime; });
    return (<mesh material={mat} position={[0, 1.4, -0.5]}><planeGeometry args={[9, 7]} /></mesh>);
}
function ShockWave({ color }: { color: THREE.Color }) {
    const refs = useRef<(THREE.Mesh | null)[]>([]); const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
    useFrame(({ clock }) => {
        for (let i = 0; i < 3; i++) { const t = (clock.elapsedTime * 0.5 + i / 3) % 1; const m = refs.current[i]; if (m) { const s = 0.4 + t * 3.4; m.scale.set(s, s, s); m.rotation.x = Math.PI / 2; } if (mats.current[i]) mats.current[i]!.opacity = (1 - t) * 0.5; }
    });
    return (<group position={[0, 1.55, 0]}>{[0, 1, 2].map(i => (<mesh key={i} ref={el => { refs.current[i] = el; }}><torusGeometry args={[1, 0.02, 8, 80]} /><meshBasicMaterial ref={(el: any) => { mats.current[i] = el; }} color={color} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>))}</group>);
}

/* ════════ 12 种核心形态(HERO)════════ */
const STAGE_Y = 1.55;

// 0 · 判决宝石
function HCrystal({ color, spin }: HeroProps) {
    const g = useRef<THREE.Group>(null);
    const geo = useMemo(() => { const x = new THREE.IcosahedronGeometry(1, 1).toNonIndexed(); x.computeVertexNormals(); return x; }, []);
    const mat = useMemo(() => fresnelMat(color), [color]);
    useFrame(({ clock }) => { const t = clock.elapsedTime; if (g.current) { g.current.rotation.y = t * spin; g.current.rotation.x = Math.sin(t * 0.4) * 0.25; g.current.position.y = STAGE_Y + Math.sin(t * 0.7) * 0.12; } });
    return (<group ref={g} position={[0, STAGE_Y, 0]}><mesh geometry={geo} material={mat} /><mesh scale={0.45}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color={color} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh></group>);
}

// 1 · 熔岩核(噪声位移脉冲球)
function HMolten({ color, spin }: HeroProps) {
    const mesh = useRef<THREE.Mesh>(null);
    const mat = useMemo(() => new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uColor: { value: color }, uHot: { value: new THREE.Color('#FFE0A0') } },
        vertexShader: /* glsl */`uniform float uTime; varying float vD; varying vec3 vN;
            void main(){ float n = sin(position.x*4.0+uTime)*sin(position.y*4.0+uTime*1.2)*sin(position.z*4.0+uTime*0.8); vD=n; vN=normalize(normalMatrix*normal); vec3 p = position + normal*n*0.22; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
        fragmentShader: /* glsl */`uniform vec3 uColor; uniform vec3 uHot; varying float vD; varying vec3 vN;
            void main(){ float hot = smoothstep(-0.4,0.6,vD); vec3 col = mix(uColor*0.5, uHot, hot); float rim = pow(1.0-abs(vN.z),1.5); gl_FragColor=vec4(col + rim*uColor*0.3, 0.55+hot*0.4); }`,
    }), [color]);
    useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime; if (mesh.current) { mesh.current.rotation.y = clock.elapsedTime * spin * 0.6; mesh.current.position.y = STAGE_Y; } });
    return (<mesh ref={mesh} material={mat} position={[0, STAGE_Y, 0]}><icosahedronGeometry args={[1.1, 5]} /></mesh>);
}

// 2 · 吸金漩涡(正面螺旋粒子向心)
function HMaelstrom({ color }: HeroProps) {
    const ref = useRef<THREE.Points>(null); const N = 460;
    const st = useMemo(() => { const r = new Float32Array(N), th = new Float32Array(N); for (let i = 0; i < N; i++) { r[i] = 0.3 + Math.random() * 3.4; th[i] = Math.random() * Math.PI * 2; } return { r, th }; }, []);
    const positions = useMemo(() => new Float32Array(N * 3), []);
    const mat = useMemo(() => { const m = pointsMat(color, 8); return m; }, [color]);
    useFrame(({ clock }, dt) => {
        mat.uniforms.uTime.value = clock.elapsedTime;
        const pos = ref.current?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined; if (!pos) return;
        for (let i = 0; i < N; i++) { st.th[i] += dt * (1.8 / Math.max(0.3, st.r[i])); st.r[i] -= dt * 0.45; if (st.r[i] < 0.12) st.r[i] = 3.7; pos.setXYZ(i, Math.cos(st.th[i]) * st.r[i], STAGE_Y + Math.sin(st.th[i]) * st.r[i], 0); }
        pos.needsUpdate = true;
        if (ref.current) ref.current.rotation.z = clock.elapsedTime * 0.05;
    });
    return (<points ref={ref} material={mat}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /><bufferAttribute attach="attributes-aSize" args={[useMemo(() => { const s = new Float32Array(N); for (let i = 0; i < N; i++) s[i] = 3 + Math.random() * 5; return s; }, []), 1]} /></bufferGeometry></points>);
}

// 3 · 碎晶环(锯齿碎片环 + 冲击波)
function HShatter({ color, spin }: HeroProps) {
    const g = useRef<THREE.Group>(null); const refs = useRef<(THREE.Mesh | null)[]>([]); const N = 11;
    const items = useMemo(() => Array.from({ length: N }, (_, i) => { const a = (i / N) * Math.PI * 2; return { a, r: 1.7, s: 0.22 + (i % 3) * 0.08, axis: new THREE.Vector3(Math.sin(i), Math.cos(i * 1.3), Math.sin(i * 0.7)).normalize() }; }), []);
    const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }), [color]);
    useFrame(({ clock }, dt) => { const t = clock.elapsedTime; refs.current.forEach((m, i) => { if (!m) return; m.rotateOnAxis(items[i].axis, dt * spin); }); if (g.current) g.current.rotation.z = t * 0.12; });
    return (<group ref={g} position={[0, STAGE_Y, 0]}>{items.map((it, i) => (<mesh key={i} ref={el => { refs.current[i] = el; }} position={[Math.cos(it.a) * it.r, Math.sin(it.a) * it.r, 0]} scale={it.s} material={mat}><tetrahedronGeometry args={[1, 0]} /></mesh>))}</group>);
}

// 4 · 钻石光环(光环 torus + 环绕星点 + 核)
function HHalo({ color, spin }: HeroProps) {
    const ring = useRef<THREE.Mesh>(null); const orb = useRef<THREE.Points>(null);
    const mat = useMemo(() => fresnelMat(color, '#FFF4D8', 2.0, 0.1, 0.9), [color]);
    const tex = useMemo(() => glowTexture(rgbOf(color)), [color]);
    const N = 60; const orbit = useMemo(() => { const p = new Float32Array(N * 3), s = new Float32Array(N); for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, r = 1.55 + (Math.random() - 0.5) * 0.2; p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = Math.sin(a) * r * 0.4; p[i * 3 + 2] = Math.sin(a) * r * 0.9; s[i] = 3 + Math.random() * 5; } return { p, s }; }, []);
    const omat = useMemo(() => pointsMat(new THREE.Color('#F5DFA6'), 8), []);
    useFrame(({ clock }, dt) => { const t = clock.elapsedTime; omat.uniforms.uTime.value = t; if (ring.current) { ring.current.rotation.x = 1.1 + Math.sin(t * 0.3) * 0.1; ring.current.rotation.y = t * spin * 1.4; } if (orb.current) orb.current.rotation.y += dt * 0.5; });
    return (<group position={[0, STAGE_Y, 0]}>
        <mesh ref={ring} material={mat}><torusGeometry args={[1.3, 0.13, 16, 80]} /></mesh>
        <sprite scale={[1.6, 1.6, 1]}><spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.5} /></sprite>
        <points ref={orb} material={omat}><bufferGeometry><bufferAttribute attach="attributes-position" args={[orbit.p, 3]} /><bufferAttribute attach="attributes-aSize" args={[orbit.s, 1]} /></bufferGeometry></points>
    </group>);
}

// 5 · 金币雨(漂浮旋转金币)
function HCoins({ spin }: HeroProps) {
    const g = useRef<THREE.Group>(null); const refs = useRef<(THREE.Mesh | null)[]>([]); const N = 16;
    const coins = useMemo(() => Array.from({ length: N }, (_, i) => ({ x: (Math.random() - 0.5) * 4.4, y: Math.random() * 5, z: -1 - Math.random() * 3, rot: Math.random() * Math.PI, spd: 0.3 + Math.random() * 0.5, sp: 0.5 + Math.random() })), []);
    const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#E8C268', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), []);
    const edge = useMemo(() => new THREE.MeshBasicMaterial({ color: '#FFF0C0', transparent: true, opacity: 0.5, wireframe: true, depthWrite: false }), []);
    useFrame((_, dt) => { refs.current.forEach((m, i) => { if (!m) return; m.rotation.y += dt * coins[i].sp * (1 + spin); m.rotation.x += dt * 0.4; let y = m.position.y - dt * coins[i].spd; if (y < -3) y = 5; m.position.y = y; }); });
    return (<group ref={g} position={[0, STAGE_Y - 1, 0]}>{coins.map((c, i) => (<mesh key={i} ref={el => { refs.current[i] = el; }} position={[c.x, c.y, c.z]} rotation={[Math.PI / 2.3, c.rot, 0]} material={mat}><cylinderGeometry args={[0.32, 0.32, 0.04, 24]} /><mesh material={edge} scale={1.02}><cylinderGeometry args={[0.32, 0.32, 0.05, 24]} /></mesh></mesh>))}</group>);
}

// 6 · 棱镜簇(多面体钻石群)
function HPrism({ color, spin }: HeroProps) {
    const g = useRef<THREE.Group>(null); const refs = useRef<(THREE.Mesh | null)[]>([]); const N = 6;
    const items = useMemo(() => Array.from({ length: N }, (_, i) => { const a = (i / N) * Math.PI * 2; return { pos: [Math.cos(a) * 1.0, Math.sin(a) * 0.9, Math.sin(a * 1.6) * 0.6] as [number, number, number], s: 0.45 + (i % 2) * 0.25, axis: new THREE.Vector3(Math.sin(i * 2), 1, Math.cos(i)).normalize() }; }), []);
    const mat = useMemo(() => fresnelMat(color, '#FFFFFF', 2.4, 0.08, 0.85), [color]);
    useFrame(({ clock }, dt) => { refs.current.forEach((m, i) => { if (m) m.rotateOnAxis(items[i].axis, dt * (0.4 + spin)); }); if (g.current) { g.current.rotation.y = clock.elapsedTime * 0.25; g.current.position.y = STAGE_Y + Math.sin(clock.elapsedTime * 0.6) * 0.1; } });
    return (<group ref={g} position={[0, STAGE_Y, 0]}>{items.map((it, i) => (<mesh key={i} ref={el => { refs.current[i] = el; }} position={it.pos} scale={it.s} material={mat}><octahedronGeometry args={[1, 0]} /></mesh>))}</group>);
}

// 7 · 绽放球(柔光球 + 缓缓扩散光环)
function HBloom({ color }: HeroProps) {
    const core = useRef<THREE.Mesh>(null); const rings = useRef<(THREE.Mesh | null)[]>([]); const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
    const tex = useMemo(() => glowTexture(rgbOf(color)), [color]);
    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        if (core.current) core.current.scale.setScalar(0.9 + Math.sin(t * 1.2) * 0.06);
        for (let i = 0; i < 3; i++) { const p = (t * 0.28 + i / 3) % 1; const m = rings.current[i]; if (m) { const s = 0.6 + p * 2.6; m.scale.set(s, s, s); m.rotation.x = Math.PI / 2; } if (mats.current[i]) mats.current[i]!.opacity = (1 - p) * 0.4; }
    });
    return (<group position={[0, STAGE_Y, 0]}>
        <sprite scale={[3.2, 3.2, 1]}><spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.55} /></sprite>
        <mesh ref={core}><sphereGeometry args={[0.7, 32, 32]} /><meshBasicMaterial color={color} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
        {[0, 1, 2].map(i => (<mesh key={i} ref={el => { rings.current[i] = el; }}><torusGeometry args={[1, 0.03, 10, 64]} /><meshBasicMaterial ref={(el: any) => { mats.current[i] = el; }} color={color} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>))}
    </group>);
}

// 8 · 水晶花园(自下生长的水晶尖)
function HGarden({ color }: HeroProps) {
    const refs = useRef<(THREE.Mesh | null)[]>([]); const N = 7;
    const items = useMemo(() => Array.from({ length: N }, (_, i) => ({ x: (i - (N - 1) / 2) * 0.55 + (Math.random() - 0.5) * 0.2, z: -0.4 + (Math.random() - 0.5) * 0.8, h: 1.1 + Math.random() * 1.3, ph: Math.random() * Math.PI * 2 })), []);
    const mat = useMemo(() => fresnelMat(color, '#EAFBF2', 2.0, 0.08, 0.8), [color]);
    useFrame(({ clock }) => { const t = clock.elapsedTime; refs.current.forEach((m, i) => { if (!m) return; const s = 0.85 + Math.sin(t * 0.8 + items[i].ph) * 0.12; m.scale.y = s; m.rotation.y = t * 0.2 + items[i].ph; }); });
    return (<group position={[0, STAGE_Y - 1.4, 0]}>{items.map((it, i) => (<mesh key={i} ref={el => { refs.current[i] = el; }} position={[it.x, it.h / 2, it.z]} material={mat}><coneGeometry args={[0.22, it.h, 6]} /></mesh>))}</group>);
}

// 9 · 花瓣(放射花瓣旋转开合)
function HPetals({ color, spin }: HeroProps) {
    const g = useRef<THREE.Group>(null); const refs = useRef<(THREE.Mesh | null)[]>([]); const N = 8;
    const mat = useMemo(() => fresnelMat(color, '#FFFFFF', 2.0, 0.07, 0.7), [color]);
    useFrame(({ clock }) => { const t = clock.elapsedTime; if (g.current) g.current.rotation.z = t * (0.3 + spin); const open = 0.5 + Math.sin(t * 0.6) * 0.18; refs.current.forEach((m, i) => { if (m) m.rotation.x = open; }); });
    return (<group ref={g} position={[0, STAGE_Y, 0]}>{Array.from({ length: N }).map((_, i) => { const a = (i / N) * Math.PI * 2; return (<group key={i} rotation={[0, 0, a]}><mesh ref={el => { refs.current[i] = el; }} position={[0, 0.9, 0]} scale={[0.35, 1, 0.12]} material={mat}><octahedronGeometry args={[1, 0]} /></mesh></group>); })}<mesh scale={0.4}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#F5DFA6" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh></group>);
}

// 10 · 线框星球(经纬线球 + 扫描赤道)
function HGlobe({ color, spin }: HeroProps) {
    const g = useRef<THREE.Group>(null); const eq = useRef<THREE.Mesh>(null);
    useFrame(({ clock }) => { const t = clock.elapsedTime; if (g.current) { g.current.rotation.y = t * (0.25 + spin); g.current.rotation.x = 0.3; } if (eq.current) { eq.current.position.y = Math.sin(t * 0.6) * 1.1; eq.current.rotation.x = Math.PI / 2; } });
    return (<group ref={g} position={[0, STAGE_Y, 0]}>
        <mesh><sphereGeometry args={[1.2, 24, 16]} /><meshBasicMaterial color={color} wireframe transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
        <mesh scale={0.55}><icosahedronGeometry args={[1, 1]} /><meshBasicMaterial color={color} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
        <mesh ref={eq}><torusGeometry args={[1.25, 0.015, 6, 64]} /><meshBasicMaterial color="#CFE8FF" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
    </group>);
}

// 11 · 星座网络(节点 + 连线)
function HConstellation({ color }: HeroProps) {
    const g = useRef<THREE.Group>(null);
    const { nodePos, linePos, sizes } = useMemo(() => {
        const N = 26; const pts: THREE.Vector3[] = [];
        for (let i = 0; i < N; i++) pts.push(new THREE.Vector3((Math.random() - 0.5) * 3.4, (Math.random() - 0.5) * 3.0, (Math.random() - 0.5) * 2.2));
        const nodePos = new Float32Array(N * 3), sizes = new Float32Array(N);
        pts.forEach((p, i) => { nodePos[i * 3] = p.x; nodePos[i * 3 + 1] = p.y; nodePos[i * 3 + 2] = p.z; sizes[i] = 4 + Math.random() * 5; });
        const lines: number[] = [];
        for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (pts[i].distanceTo(pts[j]) < 1.25) { lines.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z); }
        return { nodePos, linePos: new Float32Array(lines), sizes };
    }, []);
    const nmat = useMemo(() => pointsMat(color, 9), [color]);
    useFrame(({ clock }, dt) => { nmat.uniforms.uTime.value = clock.elapsedTime; if (g.current) { g.current.rotation.y += dt * 0.12; g.current.rotation.x = Math.sin(clock.elapsedTime * 0.3) * 0.15; } });
    return (<group ref={g} position={[0, STAGE_Y, 0]}>
        <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[linePos, 3]} /></bufferGeometry><lineBasicMaterial color={color} transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} /></lineSegments>
        <points material={nmat}><bufferGeometry><bufferAttribute attach="attributes-position" args={[nodePos, 3]} /><bufferAttribute attach="attributes-aSize" args={[sizes, 1]} /></bufferGeometry></points>
    </group>);
}

interface HeroProps { color: THREE.Color; spin: number }
const HEROES: React.FC<HeroProps>[] = [HCrystal, HMolten, HMaelstrom, HShatter, HHalo, HCoins, HPrism, HBloom, HGarden, HPetals, HGlobe, HConstellation];
// 每种形态的环境特效与是否带焦散海
const AMBIENT: ('shock' | 'beam' | 'sea' | 'none')[] = ['sea', 'none', 'none', 'shock', 'none', 'none', 'none', 'none', 'sea', 'none', 'beam', 'beam'];

/* ════════ 指挥(视差 + 呼吸) ════════ */
function Director({ children }: { children: React.ReactNode }) {
    const rig = useRef<THREE.Group>(null); const pointer = useRef({ x: 0, y: 0 });
    React.useEffect(() => { const onMove = (e: PointerEvent) => { pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1; pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1; }; window.addEventListener('pointermove', onMove); return () => window.removeEventListener('pointermove', onMove); }, []);
    useFrame((_, dt) => { if (rig.current) { rig.current.rotation.y = THREE.MathUtils.damp(rig.current.rotation.y, pointer.current.x * 0.14, 2.5, dt); rig.current.rotation.x = THREE.MathUtils.damp(rig.current.rotation.x, -pointer.current.y * 0.06, 2.5, dt); } });
    return <group ref={rig}>{children}</group>;
}

type Mood = 'mint' | 'amber' | 'blaze' | 'scan';
const MOOD_SPIN: Record<Mood, number> = { blaze: 0.6, amber: 0.3, mint: 0.18, scan: 0.24 };
const MOOD_EMBER: Record<Mood, number> = { blaze: 1.9, amber: 1.0, mint: 0.7, scan: 0.9 };

export default function VerdictCosmos({ tint = '#FF2E7E', score = 50, paused = false, mood = 'blaze', variant = 0 }: { tint?: string; score?: number; paused?: boolean; mood?: Mood; variant?: number }) {
    const color = useMemo(() => new THREE.Color(tint), [tint]);
    const gold = useMemo(() => new THREE.Color('#F5DFA6'), []);
    const isNarrow = typeof window !== 'undefined' && window.innerWidth < 480;
    const v = ((variant % 12) + 12) % 12;
    const Hero = HEROES[v];
    const ambient = AMBIENT[v];
    const spin = MOOD_SPIN[mood] ?? 0.3;
    void score;
    return (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <Canvas
                frameloop={paused ? 'never' : 'always'}
                dpr={[1, 1.75]}
                camera={{ position: [0, 0.3, 8], fov: 46 }}
                gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
                onCreated={(state) => { state.gl.setClearColor('#060410', 1); setTimeout(() => state.advance(performance.now()), 120); setTimeout(() => state.advance(performance.now()), 420); }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            >
                <Nebula color={color} />
                <StarField count={isNarrow ? 220 : 320} />
                {ambient === 'sea' && <CausticSea color={color} />}
                {ambient === 'beam' && <ScanBeam color={color} />}
                <Director>
                    <Hero color={color} spin={spin} />
                    {ambient === 'shock' && <ShockWave color={color} />}
                    {mood === 'mint' && <Embers color={gold} count={isNarrow ? 26 : 40} speedMul={0.5} />}
                    <Embers color={color} count={isNarrow ? 40 : 58} speedMul={MOOD_EMBER[mood] ?? 1} />
                </Director>
            </Canvas>
        </View>
    );
}
