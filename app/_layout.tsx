import { Stack } from 'expo-router';

import { colors } from '@/theme/colors';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerTitleStyle: { color: colors.ink },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="write" options={{ title: 'Grabar NFC' }} />
      <Stack.Screen name="read" options={{ title: 'Leer NFC' }} />
      <Stack.Screen name="rewrite" options={{ title: 'Reescribir NFC' }} />
      <Stack.Screen name="batch" options={{ title: 'Grabación en serie' }} />
      <Stack.Screen name="history" options={{ title: 'Historial' }} />
      <Stack.Screen name="lock" options={{ title: 'Bloqueo permanente' }} />
      <Stack.Screen name="+not-found" options={{ title: 'No encontrado' }} />
    </Stack>
  );
}
