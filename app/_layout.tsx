import { GluestackUIProvider } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useShareIntent } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    debug: false,
    resetOnBackground: true,
  });

  useEffect(() => {
    if (!hasShareIntent) return;
    const url = shareIntent.webUrl ?? extractUrl(shareIntent.text);
    if (url) {
      router.push({ pathname: '/add', params: { url } });
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent, router]);

  return (
    <GluestackUIProvider config={config}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0b0b0f' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#0b0b0f' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Mes reels' }} />
        <Stack.Screen name="add" options={{ title: 'Ajouter', presentation: 'modal' }} />
        <Stack.Screen name="reel/[id]" options={{ title: 'Détail' }} />
        <Stack.Screen name="folder/[id]" options={{ title: 'Dossier' }} />
      </Stack>
    </GluestackUIProvider>
  );
}

function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s]+/);
  return m?.[0] ?? null;
}
