import { Stack } from 'expo-router';
import { View } from 'react-native';
import "../global.css";

export default function Layout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F1A' }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="camera" />
        <Stack.Screen name="result" />
      </Stack>
    </View>
  );
}
