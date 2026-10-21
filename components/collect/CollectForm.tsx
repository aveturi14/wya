import GetPaidCard, { useMyPayid } from '@/components/pledges/GetPaidCard';
import Button from '@/components/ui/Button';
import PressableScale from '@/components/ui/PressableScale';
import Sheet from '@/components/ui/Sheet';
import TextField from '@/components/ui/TextField';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { showAlert } from '@/lib/alert';
import { createCollection, MAX_PER_PERSON_CENTS } from '@/lib/collections';
import { friendlyError } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { formatMoney } from '@/lib/pledges';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';

let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

const MAX_DAYS = 60;

function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Default deadline: 2 days out at 6pm, or a day before the event if that's sooner
function defaultDeadline(eventDate?: string) {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(18, 0, 0, 0);
  if (eventDate) {
    const before = new Date(new Date(eventDate).getTime() - 24 * 3600_000);
    if (before.getTime() > Date.now() + 3600_000 && before < d) return before;
  }
  return d;
}

// "60", "60.50", "$60" → cents
const parseCents = (text: string) => {
  const n = Number(text.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};
const parseCount = (text: string) => {
  const n = Number(text.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * "Collect money" (stage 1.1): what it's for, the amount each, the minimum people,
 * an optional maximum, and a deadline. The money goes to the organiser's PayID, so
 * without one the form asks for it first. Without an event it makes a standalone
 * collection (1.1b), shared by its link.
 */
export default function CollectForm({ eventId, eventTitle, eventDate, visible, onClose, onCreated }: {
  // None: a collection on its own
  eventId?: string;
  eventTitle?: string;
  eventDate?: string;
  visible: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const { payid, loaded, reload: reloadPayid } = useMyPayid();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [minPeople, setMinPeople] = useState('');
  const [maxPeople, setMaxPeople] = useState('');
  const [note, setNote] = useState('');
  const [deadline, setDeadline] = useState(() => defaultDeadline(eventDate));
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [saving, setSaving] = useState(false);

  // Each time it opens: a fresh PayID check (they may have just added one)
  useEffect(() => { if (visible) reloadPayid(); }, [visible, reloadPayid]);

  const cents = parseCents(amount);
  const min = parseCount(minPeople);
  const max = maxPeople.trim() ? parseCount(maxPeople) : null;
  const maxBad = maxPeople.trim() !== '' && (max == null || (min != null && max < min));
  const amountBad = amount.trim() !== '' && (cents == null || cents < 100 || cents > MAX_PER_PERSON_CENTS);
  const tooFar = deadline.getTime() > Date.now() + MAX_DAYS * 24 * 3600_000;
  const past = deadline.getTime() <= Date.now();
  const ready = !!title.trim() && cents != null && !amountBad && min != null && min <= 200 && !maxBad && !past && !tooFar;

  const submit = async () => {
    if (!ready || cents == null || min == null) return;
    setSaving(true);
    try {
      const id = await createCollection({ eventId, title: title.trim(), perPersonCents: cents, minPeople: min, maxPeople: max, deadline, note: note.trim() || null });
      haptics.success();
      setTitle(''); setAmount(''); setMinPeople(''); setMaxPeople(''); setNote('');
      onCreated(id);
    } catch (e) {
      showAlert("Couldn't start collecting", friendlyError(e));
    }
    setSaving(false);
  };

  const needsPayid = loaded && !payid;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Collect money"
      subtitle={eventTitle
        ? `For ${eventTitle}. Everyone pays you by PayID before you book.`
        : "No event needed. You'll get a link for your group chat, and everyone pays you by PayID before you book."}
      footer={needsPayid ? undefined : (
        <View style={styles.row}>
          <Button title="Cancel" variant="soft" onPress={onClose} style={{ flex: 1 }} />
          <Button
            title={cents && min ? `Collect ${formatMoney(cents)} each` : 'Start collecting'}
            disabled={!ready}
            loading={saving}
            onPress={submit}
            style={{ flex: 1.4 }}
          />
        </View>
      )}
    >
      {needsPayid ? (
        <View style={{ gap: Space.md }}>
          <Text style={theme.type.body}>First, add your PayID. That's where everyone sends their share.</Text>
          <GetPaidCard />
          <Button title="Done, carry on" variant="soft" onPress={reloadPayid} />
        </View>
      ) : (
        <View style={{ gap: Space.md }}>
          <TextField label="What's it for?" value={title} onChangeText={setTitle} placeholder="Karting at Kart World" maxLength={80} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField label="Each person pays" value={amount} onChangeText={setAmount} placeholder="$60" keyboardType="decimal-pad"
                hint={amountBad ? `Between $1 and ${formatMoney(MAX_PER_PERSON_CENTS)}` : `Up to ${formatMoney(MAX_PER_PERSON_CENTS)}`} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Need at least" value={minPeople} onChangeText={setMinPeople} placeholder="6 people" keyboardType="number-pad"
                hint="Not counting you" />
            </View>
          </View>
          <TextField label="At most" optional value={maxPeople} onChangeText={setMaxPeople} placeholder="No limit" keyboardType="number-pad"
            hint={maxBad ? "Can't be less than the minimum" : 'Joins stop once it fills up'} />

          <View style={{ gap: 6 }}>
            <Text style={styles.fieldLabel}>Pay by</Text>
            {Platform.OS === 'web' ? (
              <input
                type="datetime-local"
                aria-label="Pay by"
                value={toDatetimeLocal(deadline)}
                min={toDatetimeLocal(new Date())}
                onChange={(e) => { if (e.target.value) setDeadline(new Date(e.target.value)); }}
                style={webInput(theme)}
              />
            ) : (
              <>
                <View style={styles.row}>
                  <PickerButton icon="calendar-clear-outline" label={deadline.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })} onPress={() => setPicker('date')} />
                  <PickerButton icon="time-outline" label={deadline.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })} onPress={() => setPicker('time')} />
                </View>
                {picker && DateTimePicker && (
                  <View>
                    <DateTimePicker
                      value={deadline}
                      mode={picker}
                      minimumDate={new Date()}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      themeVariant={theme.isDark ? 'dark' : 'light'}
                      onValueChange={(_: unknown, d: Date) => {
                        setDeadline(d);
                        // The iOS wheel fires on every move, so it closes on Done (CLAUDE.md gotcha)
                        if (Platform.OS !== 'ios') setPicker(null);
                      }}
                      onDismiss={() => setPicker(null)}
                    />
                    {Platform.OS === 'ios' && <Button title="Done" variant="soft" size="sm" onPress={() => setPicker(null)} style={{ alignSelf: 'flex-end' }} />}
                  </View>
                )}
              </>
            )}
            {(past || tooFar) && <Text style={[theme.type.caption, { color: theme.colors.dangerText }]}>Pick a time in the next {MAX_DAYS} days</Text>}
          </View>

          <TextField label="Where you'll book" optional value={note} onChangeText={setNote} placeholder="kartworld.com.au, Saturday 2pm" maxLength={200} />

          {cents != null && min != null && (
            <View style={styles.summary}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.textSecondary} style={{ marginTop: 1 }} />
              <Text style={[theme.type.caption, { flex: 1 }]}>
                Funded once {min} {min === 1 ? 'person has' : 'people have'} paid you and you've confirmed it: {formatMoney(cents * min)}.
                If that hasn't happened by the deadline, it closes and you refund anyone who paid. The amount can't change once someone joins.
              </Text>
            </View>
          )}
        </View>
      )}
    </Sheet>
  );
}

function PickerButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <PressableScale onPress={onPress} style={styles.pickerBtn}>
      <Ionicons name={icon} size={16} color={theme.colors.text} />
      <Text style={theme.type.value}>{label}</Text>
    </PressableScale>
  );
}

function webInput(t: ReturnType<typeof useTheme>['theme']) {
  return {
    backgroundColor: t.colors.surface, color: t.colors.text, fontSize: 15, fontFamily: Fonts.body,
    border: `1px solid ${t.isDark ? t.colors.outline : t.colors.border}`, borderRadius: Radius.md,
    padding: '12px 12px', minHeight: 46, width: '100%', minWidth: 0, boxSizing: 'border-box', colorScheme: t.isDark ? 'dark' : 'light', outline: 'none', cursor: 'pointer',
  } as any;
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', gap: Space.sm },
  fieldLabel: { fontFamily: Fonts.bodySemiBold, fontSize: 13, color: t.colors.textSecondary },
  pickerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Space.sm, minHeight: 46, paddingHorizontal: Space.md,
    borderRadius: Radius.md, backgroundColor: t.colors.surfaceAlt,
  },
  summary: { flexDirection: 'row', gap: Space.sm, padding: Space.md, borderRadius: Radius.md, backgroundColor: t.colors.surfaceAlt },
}));
