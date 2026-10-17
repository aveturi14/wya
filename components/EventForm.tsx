import InviteSettings, { DEFAULT_INVITE_LIMITS, expiresAtFor, InviteLimits } from '@/components/InviteSettings';
import { useMyPayid } from '@/components/pledges/GetPaidCard';
import PledgeSettings, { PledgeValues } from '@/components/pledges/PledgeSettings';
import Button from '@/components/ui/Button';
import EventCover from '@/components/ui/EventCover';
import PressableScale from '@/components/ui/PressableScale';
import TabScreen from '@/components/ui/TabScreen';
import TextField from '@/components/ui/TextField';
import { EVENT_THEME_NAMES, EventThemeName, EventThemes } from '@/constants/eventThemes';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { showAlert } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';
import { uploadImage } from '@/lib/upload';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Platform, ScrollView, Text, View } from 'react-native';

let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

// A photo already saved on the event (url) or newly picked (asset, uploaded on save)
type Photo = { url: string; asset?: ImagePicker.ImagePickerAsset };

export type EventFormValues = Pick<
  Event,
  'title' | 'description' | 'date' | 'end_date' | 'venue_name' | 'address' | 'dress_code' | 'notes' | 'cover_image' | 'venue_images' | 'contact_numbers' | 'allow_guest_invites' | 'theme'
  | 'deposit_mode' | 'deposit_cents' | 'cutoff_hours' | 'max_guests'
>;

// Invite-link settings, saved with set_invite_limits after the event itself
export type InviteLinkValues = { expiresAt: string | null; maxUses: number | null; requiresApproval: boolean };

type Props = {
  heading: string;
  subheading: string;
  submitLabel: string;
  initial?: Event;
  onBack?: () => void;
  // Receives the saved values and photos that were removed (to clean up from storage after saving)
  // releasePledges: the host turned pledges off and chose to release everyone (R4a)
  onSubmit: (values: EventFormValues, removedPhotoUrls: string[], options: { releasePledges: boolean; inviteLink: InviteLinkValues }) => Promise<void>;
  footer?: ReactNode;
  // Editing: how many guests have already pledged
  pledgedCount?: number;
  // Editing: the saved invite-link settings, and how many have joined through the link
  initialInvite?: InviteLimits;
  inviteUses?: number;
};

// New events default to tomorrow at 7 PM, so they don't land under "Past"
function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return d;
}

function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventForm({ heading, subheading, submitLabel, initial, onBack, onSubmit, footer, pledgedCount, initialInvite, inviteUses }: Props) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [date, setDate] = useState(initial ? new Date(initial.date) : defaultStart());
  const [endDate, setEndDate] = useState<Date | null>(initial?.end_date ? new Date(initial.end_date) : null);
  const [picker, setPicker] = useState<'date' | 'time' | 'end' | null>(null);
  const [venueName, setVenueName] = useState(initial?.venue_name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [dressCode, setDressCode] = useState(initial?.dress_code ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [contactNumbers, setContactNumbers] = useState((initial?.contact_numbers ?? []).join(', '));
  const [cover, setCover] = useState<Photo | null>(initial?.cover_image ? { url: initial.cover_image } : null);
  const [venuePhotos, setVenuePhotos] = useState<Photo[]>((initial?.venue_images ?? []).map((url) => ({ url })));
  const [invite, setInvite] = useState<InviteLimits>(initialInvite ?? {
    ...DEFAULT_INVITE_LIMITS,
    maxGuests: initial?.max_guests ?? null,
    allowGuestInvites: initial?.allow_guest_invites ?? true,
  });
  const { payid, loaded: payidLoaded, reload: reloadPayid } = useMyPayid();
  // Re-check PayID when the user navigates back from Account after adding one
  useFocusEffect(useCallback(() => { reloadPayid(); }, [reloadPayid]));
  const [pledge, setPledge] = useState<PledgeValues>({
    mode: initial?.deposit_mode ?? 'none',
    cents: initial?.deposit_cents ?? 500,
    cutoffHours: initial?.cutoff_hours ?? 24,
  });
  const [releasePledges, setReleasePledges] = useState(false);

  // R13: new events default to a pledge once the host has a PayID, at their last-used amount
  useEffect(() => {
    if (initial || !payidLoaded || !payid || !user) return;
    supabase.from('events').select('deposit_cents').eq('host_id', user.id).eq('deposit_mode', 'pledge')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setPledge((p) => ({ ...p, mode: 'pledge', cents: data?.deposit_cents ?? p.cents })));
  }, [initial, payidLoaded, payid, user]);
  // New events start on a random theme so they don't all look alike
  const [eventThemeName, setEventThemeName] = useState<EventThemeName>(
    (initial?.theme as EventThemeName) ?? EVENT_THEME_NAMES[Math.floor(Math.random() * EVENT_THEME_NAMES.length)],
  );
  // Stable preview seed so the generated art doesn't reshuffle while typing
  const previewSeed = useMemo(() => initial?.id ?? String(Math.random()), [initial?.id]);

  const pickImage = async (isVenue: boolean) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: isVenue, quality: 0.8 });
    if (result.canceled) return;
    const picked = result.assets.map((asset) => ({ url: asset.uri, asset }));
    if (isVenue) setVenuePhotos((prev) => [...prev, ...picked]);
    else setCover(picked[0]);
  };

  // Native pickers set only the time for the end; keep it after the start (next day if needed)
  const setEndTime = (t: Date) => {
    const end = new Date(date);
    end.setHours(t.getHours(), t.getMinutes(), 0, 0);
    if (end <= date) end.setDate(end.getDate() + 1);
    setEndDate(end);
  };

  const handleSubmit = async () => {
    if (!title || !address) { showAlert('Missing fields', 'Give your event a name and an address.'); return; }
    if (endDate && endDate <= date) { showAlert('Check the end time', 'The event has to end after it starts.'); return; }
    setSaving(true);
    let coverUrl: string | null = null;
    const venueUrls: string[] = [];
    try {
      // Upload new photos before saving, so the event never points at missing files
      if (cover) coverUrl = cover.asset ? await uploadImage('event-images', `covers/${user!.id}/${Date.now()}`, cover.asset) : cover.url;
      for (const [i, photo] of venuePhotos.entries()) {
        venueUrls.push(photo.asset ? await uploadImage('event-images', `venues/${user!.id}/${Date.now()}-${i}`, photo.asset) : photo.url);
      }
    } catch (e: any) {
      setSaving(false);
      showAlert('Photo upload failed', e?.message ?? 'Please try again.');
      return;
    }
    const kept = new Set([coverUrl, ...venueUrls]);
    const removed = [initial?.cover_image, ...(initial?.venue_images ?? [])].filter((u): u is string => !!u && !kept.has(u));
    try {
      await onSubmit({
        title, description: description || null, date: date.toISOString(), end_date: endDate?.toISOString() ?? null,
        venue_name: venueName || null, address, dress_code: dressCode || null, notes: notes || null,
        cover_image: coverUrl, venue_images: venueUrls,
        contact_numbers: contactNumbers.split(',').map((s) => s.trim()).filter(Boolean),
        allow_guest_invites: invite.allowGuestInvites,
        max_guests: invite.maxGuests,
        theme: eventThemeName,
        deposit_mode: pledge.mode,
        deposit_cents: pledge.cents,
        cutoff_hours: pledge.cutoffHours,
      }, removed, {
        releasePledges: initial?.deposit_mode === 'pledge' && pledge.mode === 'none' && releasePledges,
        inviteLink: { expiresAt: expiresAtFor(invite, date), maxUses: invite.maxUses, requiresApproval: invite.requiresApproval },
      });
      haptics.success();
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    // Create is a tab (floating bar below); edit is pushed on top (has onBack, no bar)
    <TabScreen keyboardAvoiding withTabBar={!onBack} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <View style={styles.header}>
            {onBack && (
              <PressableScale onPress={onBack} style={styles.backBtn} accessibilityLabel="Back">
                <Ionicons name="arrow-back" size={20} color={c.text} />
              </PressableScale>
            )}
            <Text style={theme.type.display}>{heading}</Text>
            <Text style={theme.type.bodySecondary}>{subheading}</Text>
          </View>

          {/* Cover: photo or the theme's generated art, with the theme picker underneath */}
          <View style={styles.section}>
            <PressableScale onPress={() => pickImage(false)} scaleTo={0.98} style={styles.coverWrap}>
              <EventCover seed={previewSeed} title={title || 'Your event'} theme={eventThemeName} imageUrl={cover?.url} style={styles.cover} initialSize={140} />
              <View style={styles.coverAction}>
                <Ionicons name={cover ? 'swap-horizontal' : 'camera'} size={16} color={c.text} />
                <Text style={[theme.type.caption, { color: c.text }]}>{cover ? 'Change photo' : 'Add a photo'}</Text>
              </View>
            </PressableScale>
            {cover && <Button title="Use the theme art instead" variant="ghost" size="sm" onPress={() => setCover(null)} style={{ alignSelf: 'flex-end' }} />}

            <Text style={theme.type.label}>Theme</Text>
            <View style={styles.swatches}>
              {EVENT_THEME_NAMES.map((name) => {
                const t = EventThemes[name];
                const active = name === eventThemeName;
                return (
                  <PressableScale
                    key={name}
                    haptic={false}
                    onPress={() => { haptics.select(); setEventThemeName(name); }}
                    style={[styles.swatch, { backgroundColor: t.base }, active && styles.swatchActive]}
                    accessibilityLabel={`${t.label} theme`}
                  >
                    {active && <Ionicons name="checkmark" size={20} color={t.ink} />}
                  </PressableScale>
                );
              })}
            </View>
            <Text style={theme.type.caption}>{EventThemes[eventThemeName].label} · colors your event page and invite</Text>
          </View>

          <Section title="The basics">
            <TextField label="Event name" required value={title} onChangeText={setTitle} placeholder="Rooftop birthday" />
            <TextField label="What's the plan?" value={description} onChangeText={setDescription} placeholder="Drinks, music, and the best view in town…" multiline />
          </Section>

          <Section title="When">
            {Platform.OS === 'web' ? (
              <>
                <Text style={theme.type.label}>Starts <Text style={{ color: c.secondary }}>*</Text></Text>
                <input type="datetime-local" value={toDatetimeLocal(date)} onChange={(e) => { if (e.target.value) setDate(new Date(e.target.value)); }} style={webInput(theme)} />
                <Text style={theme.type.label}>Ends (optional)</Text>
                <input type="datetime-local" value={endDate ? toDatetimeLocal(endDate) : ''} min={toDatetimeLocal(date)} onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)} style={webInput(theme)} />
              </>
            ) : (
              <>
                <View style={styles.dateRow}>
                  <PickerButton icon="calendar" label={date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} onPress={() => setPicker('date')} />
                  <PickerButton icon="time" label={date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} onPress={() => setPicker('time')} />
                </View>
                <View style={styles.dateRow}>
                  <PickerButton icon="flag" label={endDate ? `Ends ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'Add end time'} onPress={() => setPicker('end')} />
                  {endDate && (
                    <PressableScale onPress={() => setEndDate(null)} style={styles.clearEnd} accessibilityLabel="Remove end time">
                      <Ionicons name="close" size={18} color={c.textSecondary} />
                    </PressableScale>
                  )}
                </View>
                {picker && DateTimePicker && (
                  <View>
                    <DateTimePicker
                      value={picker === 'end' ? endDate ?? new Date(date.getTime() + 3 * 3600_000) : date}
                      mode={picker === 'date' ? 'date' : 'time'}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      themeVariant={theme.isDark ? 'dark' : 'light'}
                      onValueChange={(_: unknown, d: Date) => {
                        if (picker === 'end') setEndTime(d);
                        else setDate(d);
                        // Android's dialog is done after one pick; the iOS wheel stays open until Done
                        if (Platform.OS !== 'ios') setPicker(null);
                      }}
                      onDismiss={() => setPicker(null)}
                    />
                    {Platform.OS === 'ios' && (
                      <Button title="Done" variant="outline" size="sm" onPress={() => setPicker(null)} style={{ alignSelf: 'flex-end' }} />
                    )}
                  </View>
                )}
              </>
            )}
          </Section>

          <Section title="Where">
            <TextField label="Venue name" value={venueName} onChangeText={setVenueName} placeholder="The Grand Hall" />
            <TextField label="Address" required value={address} onChangeText={setAddress} placeholder="123 Main St, City" />
          </Section>

          <Section title="Details">
            <TextField label="Dress code" value={dressCode} onChangeText={setDressCode} placeholder="Smart casual, all black, pajamas…" />
            <TextField label="Notes for guests" value={notes} onChangeText={setNotes} placeholder="Parking, what to bring, door code…" multiline />
            <TextField label="Contact numbers" value={contactNumbers} onChangeText={setContactNumbers} placeholder="+1 555 0100, +1 555 0101" keyboardType="phone-pad" />
          </Section>

          <Section title="Venue photos">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.photoRow}>
                {venuePhotos.map((photo, i) => (
                  <View key={`${i}-${photo.url}`}>
                    <Image source={{ uri: photo.url }} style={styles.thumb} />
                    <PressableScale onPress={() => setVenuePhotos((p) => p.filter((_, j) => j !== i))} style={styles.removeThumb} accessibilityLabel="Remove photo">
                      <Ionicons name="close" size={14} color={c.onSecondary} />
                    </PressableScale>
                  </View>
                ))}
                <PressableScale onPress={() => pickImage(true)} style={styles.addThumb} accessibilityLabel="Add venue photos">
                  <Ionicons name="add" size={28} color={c.textSecondary} />
                </PressableScale>
              </View>
            </ScrollView>
          </Section>

          <Section title="Pledge">
            <PledgeSettings
              value={pledge}
              onChange={setPledge}
              hasPayid={!!payid}
              wasPledge={initial?.deposit_mode === 'pledge'}
              pledgedCount={pledgedCount}
              release={releasePledges}
              onReleaseChange={setReleasePledges}
            />
          </Section>

          <Section title="Who can get in">
            <InviteSettings value={invite} onChange={setInvite} uses={inviteUses} />
          </Section>

          <Button title={submitLabel} icon="sparkles" size="lg" loading={saving} onPress={handleSubmit} />
          {footer}
    </TabScreen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={theme.type.heading}>{title}</Text>
      {children}
    </View>
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
    border: `${t.outlineWidth}px solid ${t.isDark ? t.colors.border : t.colors.outline}`, borderRadius: Radius.md,
    padding: '14px 16px', width: '100%', boxSizing: 'border-box', colorScheme: t.isDark ? 'dark' : 'light', outline: 'none', cursor: 'pointer',
  } as any;
}

const useStyles = makeStyles((t) => {
  const outline = { borderWidth: t.outlineWidth, borderColor: t.isDark ? t.colors.border : t.colors.outline };
  return {
    // Phones: TabScreen sets the top and bottom padding (safe area, floating bar)
    content: { padding: Space.xl, paddingTop: Space.xxxl, paddingBottom: Space.xxxl, gap: Space.xxl },
    header: { gap: Space.sm },
    backBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', backgroundColor: t.colors.surface, marginBottom: Space.sm, ...outline },
    section: { gap: Space.md },
    coverWrap: { borderRadius: Radius.xl },
    cover: {
      height: 220, borderRadius: Radius.xl, borderWidth: t.outlineWidth, borderColor: t.colors.outline,
      ...(t.isDark ? {} : { boxShadow: `4px 4px 0px ${t.colors.outline}` }),
    },
    coverAction: {
      position: 'absolute', bottom: Space.md, right: Space.md, flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: t.colors.surface, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7, ...outline,
    },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.md },
    swatch: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: t.isDark ? 0 : t.outlineWidth, borderColor: t.colors.outline },
    swatchActive: { borderWidth: 3, borderColor: t.colors.text, transform: [{ scale: 1.12 }] },
    dateRow: { flexDirection: 'row', gap: Space.sm, alignItems: 'center' },
    pickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Space.sm, backgroundColor: t.colors.surface, borderRadius: Radius.md, paddingHorizontal: Space.lg, paddingVertical: 14, ...outline },
    clearEnd: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: t.colors.surfaceAlt },
    photoRow: { flexDirection: 'row', gap: Space.md, paddingVertical: Space.sm, paddingRight: Space.sm },
    thumb: { width: 96, height: 96, borderRadius: Radius.md, ...outline },
    removeThumb: { position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: t.colors.secondary, justifyContent: 'center', alignItems: 'center' },
    addThumb: { width: 96, height: 96, borderRadius: Radius.md, borderStyle: 'dashed', borderWidth: 2, borderColor: t.colors.textMuted, justifyContent: 'center', alignItems: 'center' },
  };
});
