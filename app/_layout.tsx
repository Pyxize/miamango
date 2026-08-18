import { GluestackUIProvider } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useShareIntent } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import { colors, fonts } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    debug: __DEV__,
    resetOnBackground: true,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (!hasShareIntent) return;
    const url = shareIntent.webUrl ?? extractUrl(shareIntent.text);
    if (__DEV__) {
      console.log('[share-intent] received', {
        webUrl: shareIntent.webUrl,
        text: shareIntent.text,
        extractedUrl: url,
      });
    }
    if (url) {
      router.replace({ pathname: '/add', params: { url } });
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent, router]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GluestackUIProvider config={config}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fonts.serifBold, fontSize: 18, color: colors.ink },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Mes reels' }} />
        <Stack.Screen
          name="add"
          options={{ title: 'Ajouter', presentation: 'modal' }}
        />
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
