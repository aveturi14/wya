import IconButton from '@/components/ui/IconButton';
import TabScreen from '@/components/ui/TabScreen';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Text, View } from 'react-native';

/**
 * Shared frame for sign-in, sign-up and password resets: back, a big heading whose
 * last word is set in the serif ("Welcome *back*"), a line under it, then the form.
 * `glow` lights the top in one of the event looks.
 */
export default function AuthShell({ heading, accent, subheading, error, notice, glow, children, footer }: {
  heading: string;
  accent?: string; // the serif word after the heading
  subheading: string;
  error?: string;
  notice?: string;
  glow?: string;
  children: ReactNode;
  footer?: ReactNode; // pinned to the bottom of the form ("New here? Create an account")
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  return (
    // TabScreen (without the tab bar) gives the status-bar strip and safe-area spacing
    <TabScreen withTabBar={false} keyboardAvoiding contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
      glow={glow ? { theme: glow, strength: 0.7 } : null}>
      <View style={{ alignSelf: 'flex-start' }}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/welcome'))} />
      </View>
      <View style={{ gap: Space.sm }}>
        <Text style={theme.type.title} accessibilityRole="header">
          {heading}{accent ? <Text style={styles.serif}> {accent}</Text> : null}
        </Text>
        <Text style={theme.type.bodySecondary}>{subheading}</Text>
      </View>
      {!!error && (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle-outline" size={17} color={theme.colors.dangerText} />
          <Text style={[theme.type.value, { color: theme.colors.dangerText, flex: 1 }]}>{error}</Text>
        </View>
      )}
      {!!notice && (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <Ionicons name="mail-outline" size={17} color={theme.colors.successText} />
          <Text style={[theme.type.value, { flex: 1 }]}>{notice}</Text>
        </View>
      )}
      <View style={styles.form}>{children}</View>
      {footer}
    </TabScreen>
  );
}

const useStyles = makeStyles((t) => ({
  content: { paddingHorizontal: Space.lg, paddingTop: Space.md, gap: Space.lg },
  serif: { fontFamily: Fonts.serif, fontSize: 31 },
  banner: { flexDirection: 'row', gap: Space.sm, alignItems: 'flex-start', borderRadius: Radius.md, padding: Space.md, backgroundColor: t.colors.surfaceAlt },
  form: { gap: Space.md },
}));
