# 坑了么 🍷 — 葡萄酒避坑指南

拍下酒单,AI 一秒看穿溢价。毒舌点评帮你避坑,喝酒不踩坑,就用坑了么。

> 可鉴别:红酒 / 雪茄 / 酒单 / 菜单 / 消费小票 / 外卖平台截图

## 功能

- **拍酒单 / 相册多选**:一次最多 10 张,自动合并去重
- **AI 鉴定**:Gemini 视觉大模型识别酒款,估算电商参考价(京东 / 淘宝)
- **坑指数**:按店内价加权的整单溢价评分(0–100),三档判决:✅ 良心 / 👌 正常 / 💣 巨坑
- **坑王榜**:按"商家多赚金额"排序的逐款榜单,附印章、星级与价格对比条
- **毒舌点评**:AI 生成的犀利总结,支持语音朗读与一键分享

## 设计语言 — "Noir Cellar 酒窖暗夜"

深邃酒窖黑 `#060410` + 酒渍红 `#FF2E7E` + 香槟金 `#E8C268`,衬线数字,全暗色玻璃拟态。

### Three.js 三大场景(Web 端)

| 场景 | 页面 | 内容 |
| --- | --- | --- |
| `WineUniverse` | 首页 | 程序化高脚杯(菲涅尔玻璃着色器)、酒液渐变、升腾气泡、香槟金尘、星云辉光、指针视差 |
| `ScanTunnel` | 分析中 | 穿梭光环、雷达扇扫、汇聚粒子涡流、脉冲线框核心 |
| `AuroraField` | 报告页 | 全屏流动极光着色器 + 漂浮微尘(刻意克制,内容优先) |

全部程序化生成,零外部 3D 资源;iOS / Android 原生端自动降级为渐变 + 辉光动画(不引入 three)。

### SVG 组件库

`components/svg/`:品牌徽标(高脚杯 + 雷达环)、坑指数仪表盘、鉴定印章、排名奖牌(金银铜月桂)、价格对比条、星级、相机取景框。

## 技术栈

- Expo 54 / React Native 0.81 / React 19 / expo-router 6(Web 静态导出 PWA)
- three + @react-three/fiber 9(仅 Web,平台分文件 `*.web.tsx` 降级)
- NativeWind 4(Tailwind)+ react-native-reanimated 4
- react-native-svg 全平台矢量绘制

## 开发

```bash
npm install
npx expo start --web   # Web 开发
npx expo start         # 原生开发
npm run build          # 导出静态 Web(dist/)
```

`.env` 配置:

```
EXPO_PUBLIC_GEMINI_API_KEY=sk-xxx          # OpenAI 兼容代理 key(sk- 开头)或 Google 原生 key
EXPO_PUBLIC_GEMINI_BASE_URL=https://...    # 可选,默认 APIyi 代理
```

## 已知工程要点

- Reanimated 4 的 `entering` 布局动画在 react-native-web 上会卡帧,统一使用 `components/anim/Reveal.tsx`(style 驱动)
- NativeWind 不编译 `Animated.View` 上的 `className`,Reveal 内部用普通 View 承载样式
- 三个 Canvas 均开启 `preserveDrawingBuffer` 并在创建后手动 `advance` 两帧:后台标签页 / 被遮挡窗口(rAF 节流)下仍能呈现首帧,用户截图分享永远带 3D 内容

---

POWERED BY BRIGHT305 · WeChat: sunlinhuamj
