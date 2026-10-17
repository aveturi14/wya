import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Text, TextInput, TextInputProps, View } from 'react-native';
import PressableScale from './PressableScale';

/**
 * Labelled input on the surface colour with a hairline edge; the edge turns the text
 * colour while focused. `secure` adds a show/hide toggle for passwords, `optional`
 * marks the label, and `hint` sits under the field.
 */
export default function TextField({ label, required, optional, hint, secure, multiline, style, ...input }: TextInputProps & {
  label?: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  secure?: boolean;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  return (
    <View style={styles.wrap}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={{ color: theme.colors.dangerText }}> *</Text>}
          {optional && <Text style={styles.optional}> (optional)</Text>}
        </Text>
      )}
      <View style={[styles.box, multiline && styles.multi, focused && styles.focused]}>
        <TextInput
          placeholderTextColor={theme.colors.textMuted}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          secureTextEntry={secure && !shown}
          {...input}
          onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
          style={[styles.input, multiline && styles.multiInput, style]}
        />
        {secure && (
          <PressableScale
            onPress={() => setShown((s) => !s)}
            haptic={false}
            hitSlop={10}
            style={styles.eye}
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          >
            <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.colors.textSecondary} />
          </PressableScale>
        )}
      </View>
      {hint && <Text style={theme.type.micro}>{hint}</Text>}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: 6 },
  label: { fontFamily: Fonts.bodySemiBold, fontSize: 13, color: t.colors.textSecondary },
  optional: { fontFamily: Fonts.body, color: t.colors.textMuted },
  box: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: t.colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: t.isDark ? t.colors.outline : t.colors.border,
  },
  multi: { alignItems: 'stretch' },
  input: {
    ...t.type.input,
    flex: 1,
    minHeight: 46,
    paddingHorizontal: Space.md + 2,
    paddingVertical: 12,
    outlineStyle: 'none',
  } as any,
  multiInput: { minHeight: 104, paddingTop: 12 },
  // A colour change alone is easy to miss, so the web also gets a ring like the buttons' focus ring
  focused: {
    borderColor: t.colors.text,
    ...(Platform.OS === 'web' ? { outlineWidth: 2, outlineStyle: 'solid', outlineColor: t.colors.primary, outlineOffset: 2 } : {}),
  } as any,
  eye: { paddingHorizontal: Space.md, alignSelf: 'stretch', justifyContent: 'center' },
}));
