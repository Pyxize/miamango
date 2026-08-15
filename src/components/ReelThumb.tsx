import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radii } from '../theme';

export function ReelThumb({
  uri,
  width,
  height,
  radius = radii.lg,
  style,
}: {
  uri?: string | null;
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        styles.wrap,
        { width: width as any, height, borderRadius: radius },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.paperSunken,
    overflow: 'hidden',
  },
});
