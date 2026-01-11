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
      </Head>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="camera" />
        <Stack.Screen name="result" />
      </Stack>
    </View>
  );
}
