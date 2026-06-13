import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * 静态导出的 HTML 文档外壳。
 * 内联关键 CSS:HTML 一到达就是深色品牌底色,不等外部 CSS 往返、无白屏闪烁。
 * (注:首字节前的 TLS 握手耗时属服务器/CDN 层,代码无法影响。)
 */
const CRITICAL_CSS = `
  html, body { margin: 0; padding: 0; background-color: #060410; }
  #root { display: flex; min-height: 100%; }
  /* 首帧居中的极简品牌占位,SSR 内容挂载后即被覆盖 */
  #boot {
    position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(120% 90% at 50% 35%, #170A26 0%, #0E0818 45%, #060410 100%);
    z-index: -1;
  }
  #boot .mark { color: #F7F3F9; font-weight: 800; font-size: 22px; letter-spacing: 2px; opacity: .9; }
  #boot .sub { color: #E8C268; font-size: 10px; letter-spacing: 6px; margin-top: 6px; }
`;

export default function Root({ children }: PropsWithChildren) {
    return (
        <html lang="zh-CN">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
                <meta name="color-scheme" content="dark" />
                <ScrollViewStyleReset />
                <style dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
            </head>
            <body>
                {/* 极简首帧底图:深色渐变 + 品牌字,内容渲染前即可见,无白屏 */}
                <div id="boot" aria-hidden="true">
                    <div style={{ textAlign: 'center' }}>
                        <div className="mark">坑了么</div>
                        <div className="sub">WINE GUARD</div>
                    </div>
                </div>
                {children}
            </body>
        </html>
    );
}
