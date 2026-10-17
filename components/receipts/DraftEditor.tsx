import Card from '@/components/ui/Card';
import PressableScale from '@/components/ui/PressableScale';
import TextField from '@/components/ui/TextField';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { billMoney, DraftLine, parseCents, Receipt } from '@/lib/receipts';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

export type Draft = {
  description: string;
  lines: DraftLine[];
  total: string;     // as typed
  subtotal: string;  // as typed; empty when the receipt doesn't print one
};

export const draftFrom = (r: Receipt): Draft => ({
  description: r.description,
  lines: r.lines.map((l) => ({ key: l.id, name: l.name, quantity: l.quantity, amount_cents: l.amount_cents, kind: l.kind, rate_bp: l.rate_bp, flagged: l.flagged })),
  total: r.total_cents ? (r.total_cents / 100).toFixed(2) : '',
  subtotal: r.printed_subtotal_cents != null ? (r.printed_subtotal_cents / 100).toFixed(2) : '',
});

/** Whether a draft adds up, and if not, by how much (the database checks the same before sending). */
export function draftCheck(d: Draft) {
  const items = d.lines.filter((l) => l.kind === 'item').reduce((s, l) => s + l.amount_cents, 0);
  const all = d.lines.reduce((s, l) => s + l.amount_cents, 0);
  const total = parseCents(d.total);
  const subtotal = d.subtotal.trim() ? parseCents(d.subtotal) : null;
  const itemCount = d.lines.filter((l) => l.kind === 'item').length;
  const badLine = d.lines.some((l) => !l.name.trim() || (l.kind === 'item' && l.amount_cents <= 0));
  const subtotalOff = subtotal != null && subtotal !== items ? items - subtotal : 0;
  const totalOff = total != null ? all - total : 0;
  const ok = itemCount > 0 && !badLine && total != null && total > 0 && subtotalOff === 0 && totalOff === 0
    && (d.subtotal.trim() === '' || subtotal != null);
  return { items, all, total, subtotal, itemCount, badLine, subtotalOff, totalOff, ok };
}

/**
 * The payer checks what was read against the paper (Phase 8.18): fix any line
 * with a tap, add what was missed. Lines the scan wasn't sure about, or whose
 * maths didn't work, are highlighted. Sending stays off until it adds up.
 */
export default function DraftEditor({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const { theme } = useTheme();
  const styles = useStyles();
  const check = draftCheck(draft);
  const items = draft.lines.filter((l) => l.kind === 'item');
  const extras = draft.lines.filter((l) => l.kind === 'adjustment');

  const setLine = (key: string, patch: Partial<DraftLine>) =>
    onChange({ ...draft, lines: draft.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  const removeLine = (key: string) => onChange({ ...draft, lines: draft.lines.filter((l) => l.key !== key) });
  const addLine = (kind: DraftLine['kind']) =>
    onChange({ ...draft, lines: [...draft.lines, { key: Crypto.randomUUID(), name: '', quantity: 1, amount_cents: 0, kind }] });

  let banner: { text: string; good: boolean };
  if (check.itemCount === 0) banner = { text: 'Add what was on the bill, line by line.', good: false };
  else if (check.ok) banner = { text: `${check.itemCount} ${check.itemCount === 1 ? 'item' : 'items'}. They add up to the ${check.subtotal != null ? 'printed subtotal' : 'total'}.`, good: true };
  else if (check.badLine) banner = { text: 'Every line needs a name and an amount.', good: false };
  else if (check.subtotalOff !== 0) banner = { text: `The items come to ${billMoney(check.items)}, but the receipt says ${billMoney(check.subtotal!)}. Check the highlighted lines.`, good: false };
  else if (check.total == null || check.total <= 0) banner = { text: 'Add the total from the receipt.', good: false };
  else banner = { text: `The lines come to ${billMoney(check.all)}, but the total is ${billMoney(check.total)}. ${check.totalOff > 0 ? 'Something extra crept in' : 'Something is missing'}.`, good: false };

  return (
    <View style={styles.wrap}>
      <TextField label="What was it?" value={draft.description} onChangeText={(description) => onChange({ ...draft, description })} maxLength={80} placeholder="Dinner at Nonna's" />

      <View style={[styles.banner, banner.good ? styles.bannerGood : styles.bannerBad]}>
        <Ionicons name={banner.good ? 'checkmark-circle' : 'alert-circle'} size={18} color={theme.colors.text} />
        <Text style={[theme.type.value, { flex: 1, fontSize: 14 }]}>{banner.text}</Text>
      </View>

      <Card padded={false}>
        {items.map((l, i) => (
          <LineRow key={l.key} line={l} divider={i > 0} highlight={!!l.flagged}
            onChange={(p) => setLine(l.key, p)} onRemove={() => removeLine(l.key)} />
        ))}
        <PressableScale onPress={() => addLine('item')} style={[styles.add, items.length > 0 && styles.divider]} haptic={false}>
          <Ionicons name="add-circle-outline" size={18} color={theme.colors.textSecondary} />
          <Text style={theme.type.bodySecondary}>Add an item</Text>
        </PressableScale>
      </Card>

      <View style={{ gap: Space.sm }}>
        <Text style={theme.type.sectionHeading}>Surcharges, tips and discounts</Text>
        <Text style={theme.type.caption}>Shared by what each person ordered. GST is already in the prices, so leave it out.</Text>
        <Card padded={false}>
          {extras.map((l, i) => (
            <LineRow key={l.key} line={l} divider={i > 0} highlight={!!l.flagged} onChange={(p) => setLine(l.key, p)} onRemove={() => removeLine(l.key)} />
          ))}
          <PressableScale onPress={() => addLine('adjustment')} style={[styles.add, extras.length > 0 && styles.divider]} haptic={false}>
            <Ionicons name="add-circle-outline" size={18} color={theme.colors.textSecondary} />
            <Text style={theme.type.bodySecondary}>Add a surcharge or discount</Text>
          </PressableScale>
        </Card>
      </View>

      <Card style={{ gap: Space.md }}>
        <AmountRow label="Subtotal on the receipt" hint="Leave empty if it doesn't print one" value={draft.subtotal}
          onChange={(subtotal) => onChange({ ...draft, subtotal })} bad={check.subtotalOff !== 0} />
        <AmountRow label="Total (incl. GST)" value={draft.total} onChange={(total) => onChange({ ...draft, total })}
          bad={check.total == null || check.totalOff !== 0} bold />
      </Card>
    </View>
  );
}

function LineRow({ line, divider, highlight, onChange, onRemove }: {
  line: DraftLine; divider: boolean; highlight: boolean; onChange: (p: Partial<DraftLine>) => void; onRemove: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  // Typed text is kept as-is while editing; the cents update whenever it parses
  const [amount, setAmount] = useState(line.amount_cents ? (line.amount_cents / 100).toFixed(2) : '');
  const parsed = parseCents(amount);
  return (
    <View style={[styles.line, divider && styles.divider, highlight && styles.lineFlagged]}>
      <View style={{ flex: 1, gap: 2 }}>
        <TextInput
          value={line.name}
          onChangeText={(name) => onChange({ name, flagged: false })}
          placeholder={line.kind === 'item' ? 'Item' : 'Sunday surcharge 10%'}
          placeholderTextColor={theme.colors.textMuted}
          maxLength={80}
          style={styles.nameInput}
          accessibilityLabel="Line name"
        />
        {line.quantity > 1 && <Text style={theme.type.caption}>×{line.quantity}</Text>}
        {highlight && <Text style={[theme.type.caption, { color: theme.colors.text }]}>Check this line</Text>}
      </View>
      <TextInput
        value={amount}
        onChangeText={(text) => {
          setAmount(text);
          const cents = parseCents(text);
          if (cents != null) onChange({ amount_cents: cents, flagged: false, rate_bp: null });
        }}
        placeholder="0.00"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="numbers-and-punctuation"
        style={[styles.amountInput, amount !== '' && parsed == null && { color: theme.colors.danger }]}
        accessibilityLabel={`${line.name || 'Line'} amount`}
      />
      <PressableScale onPress={onRemove} accessibilityLabel={`Remove ${line.name || 'line'}`} style={styles.remove}>
        <Ionicons name="close" size={16} color={theme.colors.textSecondary} />
      </PressableScale>
    </View>
  );
}

function AmountRow({ label, hint, value, onChange, bad, bold }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; bad: boolean; bold?: boolean;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.amountRow}>
      <View style={{ flex: 1 }}>
        <Text style={[theme.type.value, bold && { fontFamily: Fonts.bodyBold }]}>{label}</Text>
        {hint && <Text style={theme.type.caption}>{hint}</Text>}
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="0.00"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="numbers-and-punctuation"
        style={[styles.amountInput, styles.amountBox, bad && value.trim() !== '' && { borderColor: theme.colors.danger }]}
        accessibilityLabel={label}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: Space.lg },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: Space.sm, padding: Space.md, borderRadius: Radius.md,
    borderWidth: t.outlineWidth, borderColor: t.colors.outline,
  },
  bannerGood: { backgroundColor: t.colors.surfaceAlt },
  bannerBad: { backgroundColor: t.colors.highlight },
  line: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 10, paddingHorizontal: Space.md },
  lineFlagged: { backgroundColor: t.colors.surfaceAlt },
  divider: { borderTopWidth: 1, borderTopColor: t.colors.border },
  nameInput: { ...t.type.input, paddingVertical: 4 },
  amountInput: { ...t.type.input, fontFamily: Fonts.bodyBold, width: 84, textAlign: 'right', paddingVertical: 4 },
  amountBox: {
    width: 104, paddingHorizontal: Space.sm, paddingVertical: 8, borderRadius: Radius.sm,
    borderWidth: t.outlineWidth, borderColor: t.isDark ? t.colors.border : t.colors.outline, backgroundColor: t.colors.surface,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  remove: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 12, paddingHorizontal: Space.md },
}));
