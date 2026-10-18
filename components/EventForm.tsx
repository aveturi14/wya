import InviteSettings, { DEFAULT_INVITE_LIMITS, expiresAtFor, InviteLimits } from '@/components/InviteSettings';
import { useMyPayid } from '@/components/pledges/GetPaidCard';
import PledgeSettings, { PledgeValues } from '@/components/pledges/PledgeSettings';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import IconButton from '@/components/ui/IconButton';
import ListRow, { ListGroup } from '@/components/ui/ListRow';
import Poster from '@/components/ui/Poster';
import PressableScale from '@/components/ui/PressableScale';
import Segmented from '@/components/ui/Segmented';
import TabScreen from '@/components/ui/TabScreen';
import TextField from '@/components/ui/TextField';
import { EVENT_THEME_NAMES, EventThemeName, EventThemes, POSTER_PILL_STRONG, posterGradient } from '@/constants/eventThemes';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { showAlert } from '@/lib/alert';
import { gradient } from '@/lib/gradient';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';
import { uploadImage } from '@/lib/upload';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useEffect, useState } from 'react';
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
  | 'deposit_mode' | 'deposit_cents' | 'cutoff_hours' | 'max_guests' | 'kind' | 'poster_line' | 'stickers'
>;

// The poster's serif line and the host's stickers (9.3); the database checks the same limits
const POSTER_LINE_MAX = 40;
const STICKER_MAX = 24;
const STICKERS_MAX = 2;

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
  // slots: candidate times for a "Find a time" event (8.7), added after it's created
  onSubmit: (values: EventFormValues, removedPhotoUrls: string[], options: { releasePledges: boolean; inviteLink: InviteLinkValues; slots: string[] | null }) => Promise<void>;
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
  const [posterLine, setPosterLine] = useState(initial?.poster_line ?? '');
  const [stickers, setStickers] = useState<string[]>(initial?.stickers ?? []);
  const [stickerDraft, setStickerDraft] = useState<string | null>(null);
  // Create runs in three steps (DES-2); edit is one page
  const [step, setStep] = useState(0);
  // Dress code, contacts, notes and venue photos fold away until asked for
  const [moreOpen, setMoreOpen] = useState(!!(initial?.dress_code || initial?.notes || initial?.contact_numbers?.length || initial?.venue_images?.length));
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
  // "Find a time" (8.7): only when creating; an open event's times live on its page
  const [timeMode, setTimeMode] = useState<'fixed' | 'open'>(initial?.kind ?? 'fixed');
  const [slots, setSlots] = useState<Date[]>(() => {
    const first = defaultStart();
    return [first, new Date(first.getTime() + 24 * 3_600_000)];
  });
  const [slotPicker, setSlotPicker] = useState<{ index: number; mode: 'date' | 'time' } | null>(null);
  const isOpen = timeMode === 'open';

  // R13: hosts who've used pledges before start with one, at their last amount (flakes pay into
  // the host's wya wallet, so no PayID is needed any more)
  useEffect(() => {
    if (initial || !user) return;
    supabase.from('events').select('deposit_cents').eq('host_id', user.id).eq('deposit_mode', 'pledge')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setPledge((p) => ({ ...p, mode: 'pledge', cents: data.deposit_cents ?? p.cents })); });
  }, [initial, user]);
  // New events start on a random theme so they don't all look alike
  const [eventThemeName, setEventThemeName] = useState<EventThemeName>(
    (initial?.theme as EventThemeName) ?? EVENT_THEME_NAMES[Math.floor(Math.random() * EVENT_THEME_NAMES.length)],
  );

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
    if (!isOpen && endDate && endDate <= date) { showAlert('Check the end time', 'The event has to end after it starts.'); return; }
    const times = [...new Set(slots.map((d) => d.getTime()))].sort((a, b) => a - b);
    if (isOpen && !initial) {
      if (times.length < 2) { showAlert('Add another time', 'Give people at least two times to choose from.'); return; }
      if (times[0] <= Date.now()) { showAlert('Check the times', 'Every time has to be in the future.'); return; }
    }
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
        title, description: description || null,
        // An open event's date is its earliest candidate time (the database keeps it that way)
        date: isOpen && !initial ? new Date(times[0]).toISOString() : date.toISOString(),
        end_date: isOpen ? null : endDate?.toISOString() ?? null,
        kind: timeMode,
        venue_name: venueName || null, address, dress_code: dressCode || null, notes: notes || null,
        cover_image: coverUrl, venue_images: venueUrls,
        contact_numbers: contactNumbers.split(',').map((s) => s.trim()).filter(Boolean),
        allow_guest_invites: invite.allowGuestInvites,
        max_guests: invite.maxGuests,
        theme: eventThemeName,
        poster_line: posterLine.trim() || null,
        stickers,
        // Nobody pledges to a time that doesn't exist yet (OPEN-3)
        deposit_mode: isOpen ? 'none' : pledge.mode,
        deposit_cents: pledge.cents,
        cutoff_hours: pledge.cutoffHours,
      }, removed, {
        releasePledges: initial?.deposit_mode === 'pledge' && pledge.mode === 'none' && releasePledges,
        inviteLink: { expiresAt: expiresAtFor(invite, date), maxUses: invite.maxUses, requiresApproval: invite.requiresApproval },
        slots: isOpen && !initial ? times.map((t) => new Date(t).toISOString()) : null,
      });
      haptics.success();
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const creating = !initial;
  const STEPS = ['poster', 'where', 'count'] as const;
  const show = (part: (typeof STEPS)[number]) => !creating || STEPS[step] === part;

  // Each step checks what it needs before moving on
  const next = () => {
    if (step === 0 && !title.trim()) { showAlert('Name it first', 'Give your event a name.'); return; }
    if (step === 1 && !address.trim()) { showAlert('Where is it?', 'Add an address. Guests only see it once they say they\'re coming.'); return; }
    haptics.select();
    setStep((n) => n + 1);
  };
  const back = () => (creating && step > 0 ? setStep((n) => n - 1) : onBack?.());
  const lastStep = !creating || step === STEPS.length - 1;

  const addSticker = () => {
    const text = (stickerDraft ?? '').trim();
    if (text) setStickers((list) => [...list, text].slice(0, STICKERS_MAX));
    setStickerDraft(null);
  };

  const header = (
    <View style={styles.topRow}>
      {creating && step === 0 && !onBack
        ? <View style={{ width: 44 }} />
        : <IconButton icon={creating && step > 0 ? 'chevron-back' : onBack ? 'close' : 'chevron-back'} label={creating && step > 0 ? 'Back a step' : 'Close'} onPress={back} />}
      {creating && (
        <View style={styles.dots} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => <View key={i} style={[styles.dot, i === step && styles.dotOn]} />)}
        </View>
      )}
      <Button
        title={lastStep ? (creating ? 'Create' : 'Save') : 'Next'}
        size="sm"
        loading={lastStep && saving}
        onPress={lastStep ? handleSubmit : next}
      />
    </View>
  );

  const posterPreview = (
    <View>
      <Poster
        title={title.trim() || 'Your thing'}
        theme={eventThemeName}
        imageUrl={cover?.url}
        line={posterLine.trim() || null}
        date={isOpen ? null : date.toISOString()}
        open={isOpen}
        place={venueName || null}
        stickers={stickers.map((t, i) => ({ label: t, tone: i === 0 ? 'lime' : 'pink' }))}
        height={creating && step > 0 ? 130 : 200}
        maxTitleSize={70}
      />
      {show('poster') && stickers.length < STICKERS_MAX && stickerDraft === null && (
        <PressableScale onPress={() => setStickerDraft('')} style={styles.addSticker} accessibilityLabel="Add a sticker">
          <Text style={styles.addStickerText}>add a sticker +</Text>
        </PressableScale>
      )}
    </View>
  );

  return (
    // Create is a tab (floating bar below); edit is pushed on top (has onBack, no bar)
    <TabScreen keyboardAvoiding withTabBar={!onBack} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
      glow={{ theme: eventThemeName, imageUrl: cover?.url, strength: 0.8 }}>
      {header}

      {creating && step === 1 && <Text style={theme.type.title}>When and <Text style={styles.serif}>where</Text></Text>}
      {creating && step === 2 && <Text style={theme.type.title}>Make it <Text style={styles.serif}>count</Text></Text>}
      {!creating && <Text style={theme.type.title} accessibilityRole="header">{heading}</Text>}
      {creating && step === 0 && <Text style={theme.type.caption}>{subheading}</Text>}

      {posterPreview}

      {show('poster') && (
        <>
          {stickerDraft !== null && (
            <View style={styles.stickerRow}>
              <View style={{ flex: 1 }}>
                <TextField value={stickerDraft} onChangeText={setStickerDraft} placeholder="bring a plus one" maxLength={STICKER_MAX} autoFocus onSubmitEditing={addSticker} accessibilityLabel="Sticker text" />
              </View>
              <Button title="Add" size="sm" onPress={addSticker} />
            </View>
          )}
          {stickers.length > 0 && (
            <View style={styles.chipRow}>
              {stickers.map((t, i) => (
                <Chip key={`${i}-${t}`} label={`${t}  ×`} onPress={() => setStickers((list) => list.filter((_, j) => j !== i))} accessibilityLabel={`Remove sticker ${t}`} />
              ))}
            </View>
          )}

          {/* The seven looks as gradient chips */}
          <View style={styles.looks} accessibilityRole="radiogroup">
            {EVENT_THEME_NAMES.map((name) => {
              const t = EventThemes[name];
              const active = name === eventThemeName;
              return (
                <PressableScale
                  key={name}
                  haptic={false}
                  onPress={() => { haptics.select(); setEventThemeName(name); }}
                  style={[styles.look, { backgroundColor: t.a }, gradient(posterGradient(t)), active && styles.lookOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`${t.label} look`}
                >
                  {null}
                </PressableScale>
              );
            })}
          </View>
          <View style={styles.row}>
            <Button title={cover ? 'Change photo' : 'Add a photo'} icon="camera-outline" variant="soft" style={{ flex: 1 }} onPress={() => pickImage(false)} />
            {cover && <Button title="Use the look" variant="soft" style={{ flex: 1 }} onPress={() => setCover(null)} />}
          </View>

          <TextField label="Event name" value={title} onChangeText={setTitle} placeholder="Jess's 30th" />
          <TextField label="Serif line" optional value={posterLine} onChangeText={setPosterLine} placeholder="Jess turns" maxLength={POSTER_LINE_MAX} hint="One short line over the title, in italics." />
          <TextField label="What's the plan?" value={description} onChangeText={setDescription} placeholder="Dinner, drinks, dancing…" multiline />
        </>
      )}

      {show('where') && (
        <>
          {!creating && <Text style={theme.type.label}>When and where</Text>}
          {creating && (
            <Segmented<'fixed' | 'open'>
              stretch
              options={[{ value: 'fixed', label: 'Fixed time' }, { value: 'open', label: 'Find a time' }]}
              value={timeMode}
              onChange={setTimeMode}
            />
          )}
          {initial?.kind === 'open' ? (
            <Text style={theme.type.bodySecondary}>Guests are picking from your candidate times on the event page. Lock one in there.</Text>
          ) : isOpen ? (
            <SlotEditor value={slots} onChange={setSlots} picker={slotPicker} onPicker={setSlotPicker} />
          ) : (
            <>
              {Platform.OS === 'web' ? (
                <View style={styles.row}>
                  <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
                    <Text style={styles.fieldLabel}>Starts</Text>
                    <input type="datetime-local" aria-label="Starts" value={toDatetimeLocal(date)} onChange={(e) => { if (e.target.value) setDate(new Date(e.target.value)); }} style={webInput(theme)} />
                  </View>
                  <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
                    <Text style={styles.fieldLabel}>Ends <Text style={{ color: c.textMuted, fontFamily: Fonts.body }}>(optional)</Text></Text>
                    <input type="datetime-local" aria-label="Ends" value={endDate ? toDatetimeLocal(endDate) : ''} min={toDatetimeLocal(date)} onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)} style={webInput(theme)} />
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.row}>
                    <PickerButton icon="calendar-clear-outline" label={date.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })} onPress={() => setPicker('date')} />
                    <PickerButton icon="time-outline" label={date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })} onPress={() => setPicker('time')} />
                  </View>
                  <View style={styles.row}>
                    <PickerButton icon="flag-outline" label={endDate ? `Ends ${endDate.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}` : 'Add an end time'} onPress={() => setPicker('end')} />
                    {endDate && <IconButton icon="close" label="Remove end time" onPress={() => setEndDate(null)} />}
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
                        <Button title="Done" variant="soft" size="sm" onPress={() => setPicker(null)} style={{ alignSelf: 'flex-end' }} />
                      )}
                    </View>
                  )}
                </>
              )}
            </>
          )}

          <TextField label="Venue name" optional value={venueName} onChangeText={setVenueName} placeholder="Bar Italia" />
          <TextField label="Address" value={address} onChangeText={setAddress} placeholder="169 Norton St, Leichhardt" hint="Guests see it once they say they're coming." />

          <ListGroup>
            <ListRow
              icon={moreOpen ? 'remove' : 'add'}
              title="More details"
              subtitle="Dress code, contacts, notes, venue photos"
              onPress={() => setMoreOpen((o) => !o)}
              accessibilityLabel={moreOpen ? 'Hide more details' : 'Show more details'}
              trailing={<Ionicons name={moreOpen ? 'chevron-up' : 'chevron-down'} size={16} color={c.textMuted} />}
            />
          </ListGroup>
          {moreOpen && (
            <>
              <TextField label="Dress code" optional value={dressCode} onChangeText={setDressCode} placeholder="Something sparkly" />
              <TextField label="Notes for guests" optional value={notes} onChangeText={setNotes} placeholder="Parking, what to bring, door code…" multiline />
              <TextField label="Contact numbers" optional value={contactNumbers} onChangeText={setContactNumbers} placeholder="0412 345 678, 0498 765 432" keyboardType="phone-pad" />
              <Text style={styles.fieldLabel}>Venue photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.photoRow}>
                  {venuePhotos.map((photo, i) => (
                    <View key={`${i}-${photo.url}`}>
                      <Image source={{ uri: photo.url }} style={styles.thumb} />
                      <PressableScale onPress={() => setVenuePhotos((p) => p.filter((_, j) => j !== i))} style={styles.removeThumb} accessibilityLabel="Remove photo">
                        <Ionicons name="close" size={14} color={c.onPrimary} />
                      </PressableScale>
                    </View>
                  ))}
                  <PressableScale onPress={() => pickImage(true)} style={styles.addThumb} accessibilityLabel="Add venue photos">
                    <Ionicons name="add" size={26} color={c.textSecondary} />
                  </PressableScale>
                </View>
              </ScrollView>
            </>
          )}
        </>
      )}

      {show('count') && (
        <>
          {!creating && <Text style={theme.type.label}>Pledge</Text>}
          {isOpen ? (
            <Text style={theme.type.bodySecondary}>Pledges come once the time is locked in: nobody pledges to a time that doesn't exist yet.</Text>
          ) : (
            <PledgeSettings
              value={pledge}
              onChange={setPledge}
              hasPayid
              wasPledge={initial?.deposit_mode === 'pledge'}
              pledgedCount={pledgedCount}
              release={releasePledges}
              onReleaseChange={setReleasePledges}
              startsAt={date}
            />
          )}
          <Text style={theme.type.label}>Who can get in</Text>
          <InviteSettings value={invite} onChange={setInvite} uses={inviteUses} />
        </>
      )}

      <Button
        title={lastStep ? submitLabel : 'Next'}
        size="lg"
        loading={lastStep && saving}
        onPress={lastStep ? handleSubmit : next}
      />
      {/* Delete (edit only) sits apart at the bottom */}
      {footer && <View style={styles.footer}>{footer}</View>}
    </TabScreen>
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

// Candidate times for a "Find a time" event (8.7): 2 to 12, each removable
function SlotEditor({ value, onChange, picker, onPicker }: {
  value: Date[];
  onChange: (v: Date[]) => void;
  picker: { index: number; mode: 'date' | 'time' } | null;
  onPicker: (p: { index: number; mode: 'date' | 'time' } | null) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const set = (i: number, d: Date) => onChange(value.map((v, j) => (j === i ? d : v)));
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
  // A new time: the day after the last one, same hour
  const add = () => onChange([...value, new Date((value[value.length - 1] ?? new Date()).getTime() + 24 * 3_600_000)]);
  return (
    <View style={{ gap: Space.sm }}>
      <Text style={theme.type.caption}>Add a few times that work for you. Everyone marks which they can make, and you lock in the best one.</Text>
      {value.map((d, i) => (
        <View key={i} style={styles.row}>
          {Platform.OS === 'web' ? (
            <View style={{ flex: 1 }}>
              <input type="datetime-local" value={toDatetimeLocal(d)} onChange={(e) => { if (e.target.value) set(i, new Date(e.target.value)); }} style={webInput(theme)} />
            </View>
          ) : (
            <PickerButton icon="calendar" label={d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} onPress={() => onPicker({ index: i, mode: 'date' })} />
          )}
          {value.length > 2 && (
            <IconButton icon="close" label="Remove this time" onPress={() => remove(i)} />
          )}
        </View>
      ))}
      {picker && DateTimePicker && value[picker.index] && (
        <View>
          <DateTimePicker
            value={value[picker.index]}
            mode={Platform.OS === 'ios' ? 'datetime' : picker.mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant={theme.isDark ? 'dark' : 'light'}
            onValueChange={(_: unknown, d: Date) => {
              set(picker.index, d);
              // Android picks the date, then the time, one dialog each; the iOS wheel stays open until Done
              if (Platform.OS !== 'ios') onPicker(picker.mode === 'date' ? { index: picker.index, mode: 'time' } : null);
            }}
            onDismiss={() => onPicker(null)}
          />
          {Platform.OS === 'ios' && <Button title="Done" variant="soft" size="sm" onPress={() => onPicker(null)} style={{ alignSelf: 'flex-end' }} />}
        </View>
      )}
      {value.length < 12 && <Button title="Add a time" icon="add" variant="soft" size="sm" onPress={add} style={{ alignSelf: 'flex-start' }} />}
    </View>
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
  // Phones: TabScreen sets the top and bottom padding (safe area, floating bar)
  content: { paddingHorizontal: Space.lg, paddingTop: Space.md, paddingBottom: Space.xxxl, gap: Space.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.chipStrong },
  dotOn: { width: 18, backgroundColor: t.colors.text },
  serif: { fontFamily: Fonts.serif, fontSize: 31 },
  addSticker: {
    position: 'absolute', top: 14, right: 14, paddingHorizontal: 11, paddingVertical: 5, borderRadius: Radius.pill,
    backgroundColor: POSTER_PILL_STRONG, transform: [{ rotate: '-6deg' }],
  },
  addStickerText: { fontFamily: Fonts.bodyBold, fontSize: 13, color: t.colors.scrim },
  stickerRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  looks: { flexDirection: 'row', gap: 6 },
  look: { flex: 1, height: 32, borderRadius: 9 },
  lookOn: { boxShadow: `0px 0px 0px 2px ${t.colors.background}, 0px 0px 0px 4px ${t.colors.text}` },
  row: { flexDirection: 'row', gap: Space.sm, alignItems: 'center' },
  fieldLabel: { fontFamily: Fonts.bodySemiBold, fontSize: 13, color: t.colors.textSecondary },
  pickerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Space.sm, backgroundColor: t.colors.surface, borderRadius: Radius.md,
    paddingHorizontal: Space.md + 2, minHeight: 46, borderWidth: 1, borderColor: t.isDark ? t.colors.outline : t.colors.border,
  },
  photoRow: { flexDirection: 'row', gap: Space.sm, paddingVertical: Space.sm, paddingRight: Space.sm },
  thumb: { width: 88, height: 88, borderRadius: Radius.md },
  removeThumb: { position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: t.colors.primary, justifyContent: 'center', alignItems: 'center' },
  addThumb: { width: 88, height: 88, borderRadius: Radius.md, borderStyle: 'dashed', borderWidth: 1.5, borderColor: t.colors.lineStrong, justifyContent: 'center', alignItems: 'center' },
  footer: { marginTop: Space.xl, gap: Space.sm },
}));
