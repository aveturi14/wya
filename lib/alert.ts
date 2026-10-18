import { friendlyError } from '@/lib/errors';
import { Alert, Platform } from 'react-native';

/**
 * Messages and confirmations. Phones use the system dialog; the web gets wya's own
 * dialog (components/ui/DialogHost.tsx), because the browser's alert() is ugly,
 * blocks the page, and can't show which kind of message it is. Every message goes
 * through friendlyError, so technical errors never reach people as-is.
 */
export type Dialog = {
  id: number;
  title: string;
  message?: string;
  tone: 'info' | 'error' | 'confirm';
  confirmText?: string;
  destructive?: boolean;
  resolve?: (ok: boolean) => void;
};

let queue: Dialog[] = [];
let nextId = 1;
const listeners = new Set<(dialogs: Dialog[]) => void>();
const emit = () => listeners.forEach((fn) => fn(queue));

export function subscribeDialogs(fn: (dialogs: Dialog[]) => void) {
  listeners.add(fn);
  fn(queue);
  return () => { listeners.delete(fn); };
}

export function closeDialog(id: number, ok: boolean) {
  const dialog = queue.find((d) => d.id === id);
  queue = queue.filter((d) => d.id !== id);
  emit();
  dialog?.resolve?.(ok);
}

function push(dialog: Omit<Dialog, 'id'>) {
  queue = [...queue, { ...dialog, id: nextId++ }];
  emit();
}

// Titles like "Could not send", "Couldn't save" or "Error" are failures: shown in the error style
const FAILURE_TITLE = /could ?n[o']t|couldn't|failed|error|went wrong|not allowed/i;

export function showAlert(title: string, message?: string) {
  const text = message ? friendlyError(message, message) : undefined;
  if (Platform.OS === 'web' && listeners.size > 0) {
    push({ title, message: text, tone: FAILURE_TITLE.test(title) ? 'error' : 'info' });
  } else if (Platform.OS === 'web') {
    window.alert(text ? `${title}\n\n${text}` : title);
  } else {
    Alert.alert(title, text);
  }
}

/** A failure with its error: plain words, whatever the error was. */
export function showError(title: string, error: unknown) {
  const text = friendlyError(error);
  if (Platform.OS === 'web' && listeners.size > 0) push({ title, message: text, tone: 'error' });
  else if (Platform.OS === 'web') window.alert(`${title}\n\n${text}`);
  else Alert.alert(title, text);
}

export function confirmAction(title: string, message: string, confirmText = 'OK', destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (listeners.size === 0) return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    return new Promise((resolve) => push({ title, message, tone: 'confirm', confirmText, destructive, resolve }));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
