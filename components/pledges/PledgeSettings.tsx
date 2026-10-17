import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Segmented from '@/components/ui/Segmented';
import TextField from '@/components/ui/TextField';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { haptics } from '@/lib/haptics';
import { CUTOFF_PRESETS_HOURS, DepositMode, formatMoney, MAX_PLEDGE_CENTS, MIN_PLEDGE_CENTS, PLEDGE_PRESETS_CENTS } from '@/lib/pledges';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

export type PledgeValues = { mode: DepositMode; cents: number; cutoffHours: number };

/** The event form's Pledge section. Needs the host to have a PayID. */
export default function PledgeSettings({ value, onChange, hasPayid, pledgedCount = 0, release, onReleaseChange, wasPledge }: {
  value: PledgeValues;
  onChange: (v: PledgeValues) => void;
  hasPayid: boolean;
  // Editing only: guests who already pledged, and whether to release them if pledges are turned off (R4)
  pledgedCount?: number;
  release?: boolean;
  onReleaseChange?: (release: boolean) => void;
  wasPledge?: boolean;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const c = theme.colors;
  const on = value.mode === 'pledge';
  const [customAmount, setCustomAmount] = useState(PLEDGE_PRESETS_CENTS.includes(value.cents) ? '' : String(value.cents / 100));
  const [customCutoff, setCustomCutoff] = useState(CUTOFF_PRESETS_HOURS.includes(value.cutoffHours) ? '' : String(value.cutoffHours));
  const amountKey = PLEDGE_PRESETS_CENTS.includes(value.cents) && !customAmount ? String(value.cents) : 'other';
  const cutoffKey = CUTOFF_PRESETS_HOURS.includes(value.cutoffHours) && !customCutoff ? String(value.cutoffHours) : 'other';

  const setAmount = (raw: string) => {
    setCustomAmount(raw);
    const cents = Math.round(Number(raw) * 100);
    if (cents >= MIN_PLEDGE_CENTS && cents <= MAX_PLEDGE_CENTS) onChange({ ...value, cents });
  };
  const setCutoff = (raw: string) => {
    setCustomCutoff(raw);
    const hours = Math.round(Number(raw));
    if (hours >= 0 && hours <= 336) onChange({ ...value, cutoffHours: hours });
  };

  return (
    <Card style={{ gap: Space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={theme.type.value}>Ask for a pledge</Text>
          <Text style={theme.type.caption}>
            {on
              ? `Guests who say I'm in pledge ${formatMoney(value.cents)} if they don't show. They pay you directly by PayID.`
              : 'Ask guests to pledge a small amount they pay you only if they flake.'}
          </Text>
        </View>
        <Switch
          value={on}
          disabled={!hasPayid && !on}
          onValueChange={(next) => { haptics.select(); onChange({ ...value, mode: next ? 'pledge' : 'none' }); }}
          trackColor={{ false: c.surfaceAlt, true: c.primary }}
          thumbColor={theme.isDark && on ? c.onPrimary : c.thumb}
        />
      </View>

      {!hasPayid && !on && (
        <View style={{ gap: Space.sm }}>
          <Text style={theme.type.caption}>Add your PayID first, so people who flake know where to pay you.</Text>
          <Button title="Add PayID" icon="wallet-outline" variant="outline" size="sm" onPress={() => router.push('/(tabs)/account')} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}

      {on && (
        <>
          <View style={{ gap: Space.sm }}>
            <Text style={theme.type.label}>Amount</Text>
            <Segmented
              options={[...PLEDGE_PRESETS_CENTS.map((cents) => ({ value: String(cents), label: formatMoney(cents) })), { value: 'other', label: 'Other' }]}
              value={amountKey}
              onChange={(key) => {
                if (key === 'other') { setCustomAmount(String(value.cents / 100)); return; }
                setCustomAmount('');
                onChange({ ...value, cents: Number(key) });
              }}
            />
            {amountKey === 'other' && (
              <TextField value={customAmount} onChangeText={setAmount} placeholder="Amount in dollars ($1–$50)" keyboardType="decimal-pad" />
            )}
          </View>

          <View style={{ gap: Space.sm }}>
            <Text style={theme.type.label}>Free to cancel until (hours before)</Text>
            <Segmented
              options={[...CUTOFF_PRESETS_HOURS.map((h) => ({ value: String(h), label: `${h}h` })), { value: 'other', label: 'Other' }]}
              value={cutoffKey}
              onChange={(key) => {
                if (key === 'other') { setCustomCutoff(String(value.cutoffHours)); return; }
                setCustomCutoff('');
                onChange({ ...value, cutoffHours: Number(key) });
              }}
            />
            {cutoffKey === 'other' && (
              <TextField value={customCutoff} onChangeText={setCutoff} placeholder="Hours before the start (0–336)" keyboardType="number-pad" />
            )}
            <Text style={theme.type.caption}>After this, cancelling counts as a flake, and Maybes become Can't go.</Text>
          </View>
        </>
      )}

      {/* R4: turning pledges off on an event where people already pledged */}
      {wasPledge && !on && pledgedCount > 0 && onReleaseChange && (
        <View style={{ gap: Space.sm }}>
          <Text style={theme.type.label}>{pledgedCount} {pledgedCount === 1 ? 'person has' : 'people have'} already pledged</Text>
          <Segmented
            options={[{ value: 'keep', label: 'Keep their pledges' }, { value: 'release', label: 'Release them' }]}
            value={release ? 'release' : 'keep'}
            onChange={(v) => onReleaseChange(v === 'release')}
          />
          <Text style={theme.type.caption}>
            {release ? "They'll be told they no longer owe anything if they can't make it." : 'Only new I\'m-ins won\'t be pledged.'}
          </Text>
        </View>
      )}
    </Card>
  );
}
