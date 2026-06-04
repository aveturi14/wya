import { Colors } from '@/constants/colors';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>wya</Text>
        <Text style={styles.tagline}>where are you at?</Text>
        <Text style={styles.subtitle}>
          Create and share unforgettable events.{'\n'}RSVP in seconds.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.primaryBtnText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.secondaryBtnText}>I already have an account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 120,
    paddingBottom: 60,
  },
  hero: { alignItems: 'center' },
  logo: { fontSize: 80, fontWeight: '800', color: Colors.accent, letterSpacing: -4, marginBottom: 8 },
  tagline: { fontSize: 18, color: Colors.textSecondary, letterSpacing: 2, marginBottom: 32, fontStyle: 'italic' },
  subtitle: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  actions: { gap: 12 },
  primaryBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: Colors.background, fontSize: 17, fontWeight: '700' },
  secondaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  secondaryBtnText: { color: Colors.text, fontSize: 17, fontWeight: '500' },
});
