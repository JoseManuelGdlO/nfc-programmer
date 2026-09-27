import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  fullWidth?: boolean;
};

function variantStyles(variant: Variant, disabled: boolean) {
  if (disabled) {
    return {
      container: { backgroundColor: colors.border },
      label: { color: colors.muted },
    };
  }
  switch (variant) {
    case 'secondary':
      return {
        container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        label: { color: colors.ink },
      };
    case 'danger':
      return {
        container: { backgroundColor: colors.danger },
        label: { color: colors.surface },
      };
    case 'primary':
    default:
      return {
        container: { backgroundColor: colors.accent },
        label: { color: colors.surface },
      };
  }
}

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  fullWidth = false,
}: Props) {
  const palette = variantStyles(variant, disabled);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        fullWidth && styles.fullWidth,
        palette.container,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.label, palette.label]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    alignSelf: 'stretch',
    width: '100%',
  },
  button: {
    minHeight: 52,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  pressed: {
    opacity: 0.88,
  },
});
