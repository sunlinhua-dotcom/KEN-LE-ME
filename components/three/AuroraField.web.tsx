/**
 * AuroraField —— 结果页极光粒子背景(仅 Web)
 * 全屏流动极光着色器(酒红 / 香槟金 / 薄荷三色微光) + 漂浮微尘
 * 刻意克制,内容卡片永远是主角
 */
import { Canvas, useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import { View } from 'react-native';
import * as THREE from 'three';

function AuroraPlane() {
    const mat = useMemo(() => new THREE.ShaderMaterial({
        depthWrite: false,
        depthTest: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: /* glsl */`
            uniform float uTime; varying vec2 vUv;
            vec3 band(vec2 uv, float y0, float amp, float freq, float spd, vec3 col, float w) {
                float y = y0 + amp * sin(uv.x * freq + uTime * spd)
                             + amp * 0.5 * sin(uv.x * freq * 2.3 - uTime * spd * 1.7);
                return col * smoothstep(w, 0.0, abs(uv.y - y));
            }
            void main() {
                vec2 uv = vUv;
                vec3 c = vec3(0.024, 0.016, 0.063);
                c += band(uv, 0.80, 0.05, 4.0,  0.16, vec3(1.00, 0.18, 0.49) * 0.085, 0.30);
                c += band(uv, 0.52, 0.07, 3.1, -0.12, vec3(0.91, 0.76, 0.41) * 0.060, 0.27);
                c += band(uv, 0.26, 0.06, 5.0,  0.09, vec3(0.18, 0.90, 0.66) * 0.045, 0.30);
                float vg = smoothstep(1.25, 0.35, length(uv - vec2(0.5, 0.45)));
                c *= mix(0.55, 1.0, vg);
                gl_FragColor = vec4(c, 1.0);
            }`,
    }), []);
    useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime; });
    return (
        <mesh material={mat} frustumCulled={false}>
            <planeGeometry args={[2, 2]} />
        </mesh>
    );
}

function DriftDust({ count = 140 }: { count?: number }) {
    const ref = useRef<THREE.Points>(null);
    const positions = useMemo(() => {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            arr[i * 3] = (Math.random() - 0.5) * 12;
            arr[i * 3 + 1] = (Math.random() - 0.5) * 14;
            arr[i * 3 + 2] = -2 - Math.random() * 6;
        }
        return arr;
    }, [count]);

    useFrame(({ clock }) => {
        if (ref.current) {
            ref.current.rotation.z = clock.elapsedTime * 0.012;
            ref.current.position.y = Math.sin(clock.elapsedTime * 0.18) * 0.4;
        }
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial size={0.035} color="#C9A86B" transparent opacity={0.5} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
    );
}

export default function AuroraField({ paused = false }: { paused?: boolean }) {
    return (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <Canvas
                frameloop={paused ? 'never' : 'always'}
                dpr={[1, 1.5]}
                camera={{ position: [0, 0, 5], fov: 50 }}
                gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
                onCreated={(state) => {
                    state.gl.setClearColor('#060410', 1);
                    // rAF 被节流(后台标签页 / 遮挡窗口)时也保证首帧可见
                    setTimeout(() => state.advance(performance.now()), 120);
                    setTimeout(() => state.advance(performance.now()), 400);
                }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            >
                <AuroraPlane />
                <DriftDust />
            </Canvas>
        </View>
    );
}
