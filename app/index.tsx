import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>NFC Programmer</Text>
      <Text style={styles.subtitle}>Pantallas NFC en tareas siguientes</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
