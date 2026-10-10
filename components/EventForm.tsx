import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Type } from '@/constants/typography';
import { useAuth } from '@/hooks/useAuth';
import { showAlert } from '@/lib/alert';
import { Event } from '@/lib/types';
import { uploadImage } from '@/lib/upload';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

// A photo already saved on the event (url) or newly picked (asset, uploaded on save)
type Photo = { url: string; asset?: ImagePicker.ImagePickerAsset };

export type EventFormValues = Pick<
  Event,
  'title' | 'description' | 'date' | 'end_date' | 'venue_name' | 'address' | 'dress_code' | 'notes' | 'cover_image' | 'venue_images' | 'contact_numbers' | 'allow_guest_invites'
>;

type Props = {
  heading: string;
  subheading: string;
  submitLabel: string;
  initial?: Event;
  onBack?: () => void;
  // Receives the saved values and photos that were removed (to clean up from storage after saving)
  onSubmit: (values: EventFormValues, removedPhotoUrls: string[]) => Promise<void>;
  footer?: ReactNode;
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

export default function EventForm({ heading, subheading, submitLabel, initial, onBack, onSubmit, footer }: Props) {
  const { user } = useAuth();
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
  const [allowGuestInvites, setAllowGuestInvites] = useState(initial?.allow_guest_invites ?? true);

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
    if (!title || !address) { showAlert('Missing fields', 'Title and address are required'); return; }
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
        allow_guest_invites: allowGuestInvites,
      }, removed);
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <View style={styles.headerWrap}>
          <View style={styles.headerGlow} />
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={Colors.text} />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>{heading}</Text>
          <Text style={styles.titleSub}>{subheading}</Text>
        </View>

        {/* Cover image */}
        <TouchableOpacity style={styles.coverPicker} onPress={() => pickImage(false)} activeOpacity={0.8}>
          {cover ? (
            <Image source={{ uri: cover.url }} style={styles.coverPreview} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <View style={styles.coverIconWrap}>
                <Ionicons name="camera-outline" size={28} color={Colors.accent} />
              </View>
              <Text style={styles.coverPlaceholderText}>Add cover photo</Text>
              <Text style={styles.coverPlaceholderSub}>Tap to upload</Text>
            </View>
          )}
        </TouchableOpacity>
        {cover && (
          <TouchableOpacity style={styles.removeCover} onPress={() => setCover(null)}>
            <Text style={styles.removeCoverText}>Remove cover photo</Text>
          </TouchableOpacity>
        )}

        <View style={styles.form}>
          <Field label="Event Title" value={title} onChange={setTitle} placeholder="What's the occasion?" required />
          <Field label="Description" value={description} onChange={setDescription} placeholder="Tell people about your event…" multiline />

          {/* Start date & time */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Date & Time <Text style={styles.required}>*</Text></Text>
            {Platform.OS === 'web' ? (
              <input
                type="datetime-local"
                value={toDatetimeLocal(date)}
                onChange={(e) => { if (e.target.value) setDate(new Date(e.target.value)); }}
                style={webInputStyle}
              />
            ) : (
              <View style={styles.dateRow}>
                <TouchableOpacity style={[styles.input, styles.dateBtn]} onPress={() => setPicker('date')}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
                  <Text style={styles.inputText}>{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.input, styles.dateBtn]} onPress={() => setPicker('time')}>
                  <Ionicons name="time-outline" size={16} color={Colors.accent} />
                  <Text style={styles.inputText}>{date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Optional end */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Ends (optional)</Text>
            {Platform.OS === 'web' ? (
              <input
                type="datetime-local"
                value={endDate ? toDatetimeLocal(endDate) : ''}
                min={toDatetimeLocal(date)}
                onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
                style={webInputStyle}
              />
            ) : (
              <View style={styles.dateRow}>
                <TouchableOpacity style={[styles.input, styles.dateBtn]} onPress={() => setPicker('end')}>
                  <Ionicons name="time-outline" size={16} color={Colors.accent} />
                  <Text style={styles.inputText}>
                    {endDate ? endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Add end time'}
                  </Text>
                </TouchableOpacity>
                {endDate && (
                  <TouchableOpacity style={styles.clearEnd} onPress={() => setEndDate(null)}>
                    <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {picker && DateTimePicker && (
            <DateTimePicker
              value={picker === 'end' ? endDate ?? new Date(date.getTime() + 3 * 3600_000) : date}
              mode={picker === 'date' ? 'date' : 'time'}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              themeVariant="dark"
              onChange={(_: any, d?: Date) => {
                const which = picker;
                setPicker(null);
                if (!d) return;
                if (which === 'end') setEndTime(d);
                else setDate(d);
              }}
            />
          )}

          <Field label="Venue Name" value={venueName} onChange={setVenueName} placeholder="The Grand Hall" />
          <Field label="Address" value={address} onChange={setAddress} placeholder="123 Main St, City" required />
          <Field label="Dress Code" value={dressCode} onChange={setDressCode} placeholder="Black tie, Smart casual…" />
          <Field label="Notes to Guests" value={notes} onChange={setNotes} placeholder="Parking, accessibility, what to bring…" multiline />
          <Field label="Contact Numbers" value={contactNumbers} onChange={setContactNumbers} placeholder="+1 555-0100, +1 555-0101" />

          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>Let guests share the invite link</Text>
              <Text style={styles.toggleSub}>When off, only you can invite people</Text>
            </View>
            <Switch
              value={allowGuestInvites}
              onValueChange={setAllowGuestInvites}
              trackColor={{ false: Colors.surfaceHigh, true: Colors.accent }}
              thumbColor={Colors.white}
            />
          </View>

          {/* Venue photos */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Venue Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.photoRow}>
                {venuePhotos.map((photo, i) => (
                  <View key={`${i}-${photo.url}`} style={styles.photoThumb}>
                    <Image source={{ uri: photo.url }} style={styles.thumbImg} />
                    <TouchableOpacity style={styles.removeBtn} onPress={() => setVenuePhotos((p) => p.filter((_, j) => j !== i))}>
                      <Ionicons name="close-circle" size={20} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addPhotoBtn} onPress={() => pickImage(true)}>
                  <Ionicons name="add" size={26} color={Colors.accent} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={saving} activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator color={Colors.white} />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
                  <Text style={styles.submitBtnText}>{submitLabel}</Text>
                </>}
          </TouchableOpacity>

          {footer}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, multiline, required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; required?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

const webInputStyle = { backgroundColor: Colors.surface, border: `1px solid ${Colors.border}`, borderRadius: 14, padding: '14px 18px', color: Colors.text, fontSize: 15, width: '100%', colorScheme: 'dark', outline: 'none', cursor: 'pointer', boxSizing: 'border-box', fontFamily: 'inherit' } as any;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 100 },
  headerWrap: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 28, overflow: 'hidden' },
  headerGlow: { position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: Colors.accentGlow, opacity: 0.45 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceElevated, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { ...Type.screenTitle },
  titleSub: { ...Type.subtitle, marginTop: 6 },

  coverPicker: { marginHorizontal: 20, marginBottom: 4, borderRadius: 20, overflow: 'hidden' },
  coverPreview: { width: '100%', height: 210 },
  coverPlaceholder: { height: 210, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 8 },
  coverIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accentSubtle, justifyContent: 'center', alignItems: 'center' },
  coverPlaceholderText: { ...Type.buttonSecondary, color: Colors.text },
  coverPlaceholderSub: { ...Type.metaSmall },
  removeCover: { alignSelf: 'flex-end', marginRight: 24, marginTop: 6 },
  removeCoverText: { ...Type.metaSmall, color: Colors.danger },

  form: { paddingHorizontal: 20, paddingTop: 16, gap: 18 },
  fieldWrap: { gap: 8 },
  label: { ...Type.label },
  required: { color: Colors.accent },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    ...Type.input,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputMulti: { height: 90, textAlignVertical: 'top', paddingTop: 14 },
  inputText: { ...Type.value, fontSize: 14 },
  dateRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dateBtn: { flex: 1, gap: 8 },
  clearEnd: { padding: 4 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 18, paddingVertical: 14 },
  toggleText: { flex: 1, gap: 4 },
  toggleLabel: { ...Type.value, fontSize: 14 },
  toggleSub: { ...Type.metaSmall },

  photoRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  photoThumb: { position: 'relative' },
  thumbImg: { width: 82, height: 82, borderRadius: 12 },
  removeBtn: { position: 'absolute', top: -6, right: -6 },
  addPhotoBtn: { width: 82, height: 82, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },

  submitBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  submitBtnText: { fontFamily: Fonts.bodySemiBold, color: Colors.white, fontSize: 16, letterSpacing: 0.8 },
});
