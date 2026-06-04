import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Type } from '@/constants/typography';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>wya</Text>
          <View style={styles.logoDot} />
        </View>
        <Text style={styles.tagline}>where are you at</Text>
        <View style={styles.divider} />
        <Text style={styles.subtitle}>
          Host extraordinary events.{'\n'}Share moments. Show up.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/register')} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
          <Text style={styles.secondaryBtnText}>Sign In</Text>
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
    paddingTop: 130,
    paddingBottom: 56,
    overflow: 'hidden',
  },
  glowTop: { position: 'absolute', top: -100, left: -80, width: 340, height: 340, borderRadius: 170, backgroundColor: Colors.accentGlow, opacity: 0.6 },
  glowBottom: { position: 'absolute', bottom: 0, right: -100, width: 280, height: 280, borderRadius: 140, backgroundColor: Colors.accentGlow, opacity: 0.4 },
  hero: { alignItems: 'center', gap: 16 },
  logoWrap: { alignItems: 'center', position: 'relative' },
  logo: { fontSize: 92, fontFamily: Fonts.displayBold, color: Colors.text, letterSpacing: -4, lineHeight: 96 },
  logoDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent, position: 'absolute', bottom: 10, right: -4 },
  tagline: { fontSize: 13, fontFamily: Fonts.bodySemiBold, color: Colors.accentLight, letterSpacing: 5, textTransform: 'uppercase' },
  divider: { width: 40, height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  subtitle: { fontSize: 19, fontFamily: Fonts.displayItalic, color: Colors.textSecondary, textAlign: 'center', lineHeight: 30 },
  actions: { gap: 12 },
  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryBtnText: { fontFamily: Fonts.bodySemiBold, color: Colors.white, fontSize: 16, letterSpacing: 1 },
  secondaryBtn: { borderRadius: 16, paddingVertical: 17, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight, backgroundColor: Colors.surfaceElevated },
  secondaryBtnText: { fontFamily: Fonts.bodyMedium, color: Colors.textSecondary, fontSize: 16 },
});
