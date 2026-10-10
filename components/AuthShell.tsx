import PressableScale from '@/components/ui/PressableScale';
import Screen from '@/components/ui/Screen';
import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

/** Shared frame for sign-in and sign-up: back button, big heading, form. */
export default function AuthShell({ heading, subheading, error, notice, children }: {
  heading: string;
  subheading: string;
  error?: string;
  notice?: string;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <PressableScale
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/welcome'))}
            style={styles.back}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
          </PressableScale>
          <View style={{ gap: Space.sm }}>
            <Text style={theme.type.display}>{heading}</Text>
            <Text style={theme.type.bodySecondary}>{subheading}</Text>
          </View>
          {!!error && <View style={[styles.banner, styles.error]}><Text style={[theme.type.value, { color: theme.colors.danger }]}>{error}</Text></View>}
          {!!notice && <View style={[styles.banner, styles.notice]}><Text style={[theme.type.value, { color: theme.colors.onStatus }]}>{notice}</Text></View>}
          <View style={styles.form}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  content: { padding: Space.xl, paddingTop: Space.xxxl, gap: Space.xl },
  back: {
    width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center',
    backgroundColor: t.colors.surface, borderWidth: t.outlineWidth, borderColor: t.colors.outline,
  },
  banner: { borderRadius: Radius.md, padding: Space.md, borderWidth: t.outlineWidth },
  error: { borderColor: t.colors.danger, backgroundColor: t.colors.surface },
  notice: { borderColor: t.isDark ? t.colors.success : t.colors.outline, backgroundColor: t.colors.success },
  form: { gap: Space.lg },
}));
