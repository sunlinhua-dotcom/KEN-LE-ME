import React, { Suspense, useEffect, useState } from 'react';

/**
 * 3D 场景延迟挂载包裹器
 * - 首屏先绘制(UI 立即可交互),浏览器空闲后才开始加载 Three.js chunk;
 * - 配合 React.lazy 使用,Three.js 会被打成独立 chunk,不进首屏主包;
 * - 跨平台:web 用 requestIdleCallback,原生降级为 setTimeout。
 */
export default function Deferred({ children }: { children: React.ReactNode }) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const g: any = globalThis;
        const ric: (cb: () => void) => any = g.requestIdleCallback
            ? (cb) => g.requestIdleCallback(cb, { timeout: 800 })
            : (cb) => setTimeout(cb, 200);
        const cancel: (id: any) => void = g.cancelIdleCallback || clearTimeout;
        const id = ric(() => setShow(true));
        return () => cancel(id);
    }, []);

    if (!show) return null;
    return <Suspense fallback={null}>{children}</Suspense>;
}
