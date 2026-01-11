import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { View } from 'react-native';
import "../global.css";

export default function Layout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F1A' }}>
      <Head>
        <title>坑了么 | 葡萄酒避坑指南</title>
        <meta name="apple-mobile-web-app-title" content="坑了么" />
        <meta name="application-name" content="坑了么" />
        <meta name="theme-color" content="#0F0F1A" />

        {/* PWA Icons - served from public/ folder */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" href="/icon.png" />

        {/* Open Graph for WeChat / Social Sharing */}
        <meta property="og:title" content="坑了么 | 葡萄酒避坑指南" />
        <meta property="og:description" content="AI 毒舌点评，一秒识破酒单溢价。喝酒不踩坑，就用坑了么！" />
        <meta property="og:image" content="https://kenleme.zeabur.app/icon.png" />
        <meta property="og:url" content="https://kenleme.zeabur.app" />
        <meta property="og:type" content="website" />
      </Head>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="camera" />
        <Stack.Screen name="result" />
      </Stack>
    </View>
  );
}
