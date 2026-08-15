import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, fonts } from '../theme';

export function FolderChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
        {active ? '✓  ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.paperElevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipPressed: {
    opacity: 0.7,
  },
  text: {
    color: colors.ink,
    fontFamily: fonts.serifBold,
    fontSize: 14,
  },
  textActive: {
    color: colors.paper,
  },
});
