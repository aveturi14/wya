import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { useState } from 'react';
import { Platform, Text, TextInput, TextInputProps, View } from 'react-native';

/** Labelled input; the border lights up in the primary color while focused. */
export default function TextField({ label, required, multiline, style, ...input }: TextInputProps & { label?: string; required?: boolean }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label && (
        <Text style={theme.type.label}>
          {label}{required && <Text style={{ color: theme.colors.secondary }}> *</Text>}
        </Text>
      )}
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...input}
        onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
        style={[styles.input, multiline && styles.multi, focused && styles.focused, style]}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: Space.sm },
  input: {
    ...t.type.input,
    backgroundColor: t.colors.surface,
    borderRadius: Radius.md,
    borderWidth: t.outlineWidth,
    borderColor: t.isDark ? t.colors.border : t.colors.outline,
    paddingHorizontal: Space.lg,
    paddingVertical: 14,
    outlineStyle: 'none',
  } as any,
  multi: { minHeight: 96, paddingTop: 14 },
  // A colour change alone is easy to miss, so the web also gets a ring like the buttons' focus ring
  focused: { borderColor: t.colors.primary, ...(Platform.OS === 'web' ? { outlineWidth: 2, outlineStyle: 'solid', outlineColor: t.colors.primary, outlineOffset: 2 } : {}) } as any,
}));
