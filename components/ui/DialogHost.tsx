import { Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { closeDialog, Dialog, subscribeDialogs } from '@/lib/alert';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import Button from './Button';

/**
 * wya's own message and confirm dialog on the web (lib/alert.ts), in place of the
 * browser's alert() and confirm(). Errors get a red mark and say what happened in
 * plain words. Esc cancels, Enter confirms. One at a time, in order.
 */
export default function DialogHost() {
  const { theme } = useTheme();
  const styles = useStyles();
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  useEffect(() => subscribeDialogs(setDialogs), []);
  const dialog = dialogs[0];

  useEffect(() => {
    if (Platform.OS !== 'web' || !dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDialog(dialog.id, false);
      if (e.key === 'Enter') closeDialog(dialog.id, true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  if (Platform.OS !== 'web' || !dialog) return null;
  const c = theme.colors;
  const icon = dialog.tone === 'error'
    ? { name: 'alert-circle' as const, color: c.danger }
    : dialog.tone === 'confirm'
      ? { name: (dialog.destructive ? 'warning' : 'help-circle') as 'warning' | 'help-circle', color: dialog.destructive ? c.danger : c.textSecondary }
      : { name: 'information-circle' as const, color: c.textSecondary };

  return (
    // No animation: React Native Web modals never finish animating in a hidden tab
    <Modal transparent visible animationType="none" onRequestClose={() => closeDialog(dialog.id, false)}>
      <Pressable style={styles.scrim} onPress={() => closeDialog(dialog.id, false)} accessibilityLabel="Close">
        <Pressable style={styles.card} onPress={() => {}} accessibilityRole={dialog.tone === 'error' ? 'alert' : undefined}>
          <View style={styles.head}>
            <Ionicons name={icon.name} size={22} color={icon.color} />
            <Text style={[theme.type.heading, { flex: 1 }]}>{dialog.title}</Text>
          </View>
          {!!dialog.message && <Text style={theme.type.bodySecondary}>{dialog.message}</Text>}
          <View style={styles.buttons}>
            {dialog.tone === 'confirm' ? (
              <>
                <Button title="Cancel" variant="ghost" onPress={() => closeDialog(dialog.id, false)} />
                <Button
                  title={dialog.confirmText ?? 'OK'}
                  variant={dialog.destructive ? 'danger' : 'primary'}
                  onPress={() => closeDialog(dialog.id, true)}
                />
              </>
            ) : (
              <Button title="OK" variant={dialog.tone === 'error' ? 'soft' : 'primary'} onPress={() => closeDialog(dialog.id, true)} />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  scrim: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'center', alignItems: 'center', padding: Space.lg },
  card: {
    width: '100%', maxWidth: 420, gap: Space.md, padding: Space.xl, borderRadius: Radius.xl,
    backgroundColor: t.colors.sheet, ...t.shadow(5),
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: Space.sm, marginTop: Space.xs },
}));
