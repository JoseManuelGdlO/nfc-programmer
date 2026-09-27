import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';

const PRIMARY_ACTIONS = [
  { label: 'Grabar NFC', href: '/write' as const },
  { label: 'Leer NFC', href: '/read' as const },
  { label: 'Reescribir NFC', href: '/rewrite' as const },
  { label: 'Grabación en serie', href: '/batch' as const },
  { label: 'Historial', href: '/history' as const },
] as const;

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.hero}>NFC Programmer</Text>

      <View style={styles.actions}>
        {PRIMARY_ACTIONS.map(({ label, href }) => (
          <PrimaryButton
            key={href}
            label={label}
            fullWidth
            onPress={() => router.push(href)}
          />
        ))}
      </View>

      <View style={styles.dangerSection}>
        <Link href="/lock" asChild>
          <Pressable accessibilityRole="button" style={({ pressed }) => [pressed && styles.dangerPressed]}>
            <Text style={styles.dangerLabel}>Bloqueo permanente</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  hero: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 32,
  },
  actions: {
    gap: 12,
  },
  dangerSection: {
    marginTop: 'auto',
    paddingTop: 32,
    alignItems: 'center',
  },
  dangerLabel: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  dangerPressed: {
    opacity: 0.75,
  },
});
