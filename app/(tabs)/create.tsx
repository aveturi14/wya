import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Type } from '@/constants/typography';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

export default function CreateScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [notes, setNotes] = useState('');
  const [contactNumbers, setContactNumbers] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [venueImages, setVenueImages] = useState<string[]>([]);

  const pickImage = async (isVenue = false) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: isVenue, quality: 0.8 });
    if (!result.canceled) {
      if (isVenue) setVenueImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
      else setCoverImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string, path: string): Promise<string | null> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const fileExt = uri.split('.').pop() ?? 'jpg';
    const { data, error } = await supabase.storage.from('event-images').upload(`${path}.${fileExt}`, blob, { contentType: `image/${fileExt}` });
    if (error) return null;
    const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(data.path);
    return publicUrl;
  };

  const handleCreate = async () => {
    if (!title || !address) { Alert.alert('Missing fields', 'Title and address are required'); return; }
    setLoading(true);
    let coverUrl: string | null = null;
    if (coverImage) coverUrl = await uploadImage(coverImage, `covers/${user!.id}/${Date.now()}`);
    const venueUrls: string[] = [];
    for (const img of venueImages) {
      const url = await uploadImage(img, `venues/${user!.id}/${Date.now()}-${Math.random()}`);
      if (url) venueUrls.push(url);
    }
    const contacts = contactNumbers.split(',').map((s) => s.trim()).filter(Boolean);
    const { data, error } = await supabase.from('events').insert({
      host_id: user!.id, title, description, date: date.toISOString(),
      venue_name: venueName || null, address, dress_code: dressCode || null,
      notes: notes || null, cover_image: coverUrl, venue_images: venueUrls, contact_numbers: contacts,
    }).select().single();
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    router.push(`/event/${data.id}`);
  };

  const toDatetimeLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <View style={styles.headerWrap}>
          <View style={styles.headerGlow} />
          <Text style={styles.title}>New Event</Text>
          <Text style={styles.titleSub}>Fill in the details below</Text>
        </View>

        {/* Cover image */}
        <TouchableOpacity style={styles.coverPicker} onPress={() => pickImage(false)} activeOpacity={0.8}>
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.coverPreview} />
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

        <View style={styles.form}>
          <Field label="Event Title" value={title} onChange={setTitle} placeholder="What's the occasion?" required />
          <Field label="Description" value={description} onChange={setDescription} placeholder="Tell people about your event…" multiline />

          {/* Date & time */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Date & Time <Text style={styles.required}>*</Text></Text>
            {Platform.OS === 'web' ? (
              <input
                type="datetime-local"
                value={toDatetimeLocal(date)}
                onChange={(e) => { if (e.target.value) setDate(new Date(e.target.value)); }}
                style={{ backgroundColor: Colors.surface, border: `1px solid ${Colors.border}`, borderRadius: 14, padding: '14px 18px', color: Colors.text, fontSize: 15, width: '100%', colorScheme: 'dark', outline: 'none', cursor: 'pointer', boxSizing: 'border-box', fontFamily: 'inherit' } as any}
              />
            ) : (
              <>
                <View style={styles.dateRow}>
                  <TouchableOpacity style={[styles.input, styles.dateBtn]} onPress={() => { setShowTimePicker(false); setShowDatePicker(true); }}>
                    <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
                    <Text style={styles.inputText}>{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.input, styles.dateBtn]} onPress={() => { setShowDatePicker(false); setShowTimePicker(true); }}>
                    <Ionicons name="time-outline" size={16} color={Colors.accent} />
                    <Text style={styles.inputText}>{date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </TouchableOpacity>
                </View>
                {showDatePicker && DateTimePicker && (
                  <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_: any, d?: Date) => { setShowDatePicker(false); if (d) setDate(d); }} themeVariant="dark" />
                )}
                {showTimePicker && DateTimePicker && (
                  <DateTimePicker value={date} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_: any, d?: Date) => { setShowTimePicker(false); if (d) setDate(d); }} themeVariant="dark" />
                )}
              </>
            )}
          </View>

          <Field label="Venue Name" value={venueName} onChange={setVenueName} placeholder="The Grand Hall" />
          <Field label="Address" value={address} onChange={setAddress} placeholder="123 Main St, City" required />
          <Field label="Dress Code" value={dressCode} onChange={setDressCode} placeholder="Black tie, Smart casual…" />
          <Field label="Notes to Guests" value={notes} onChange={setNotes} placeholder="Parking, accessibility, what to bring…" multiline />
          <Field label="Contact Numbers" value={contactNumbers} onChange={setContactNumbers} placeholder="+1 555-0100, +1 555-0101" />

          {/* Venue photos */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Venue Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.photoRow}>
                {venueImages.map((uri, i) => (
                  <View key={i} style={styles.photoThumb}>
                    <Image source={{ uri }} style={styles.thumbImg} />
                    <TouchableOpacity style={styles.removeBtn} onPress={() => setVenueImages((p) => p.filter((_, j) => j !== i))}>
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

          <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
                  <Text style={styles.createBtnText}>Create Event</Text>
                </>}
          </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 100 },
  headerWrap: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 28, overflow: 'hidden' },
  headerGlow: { position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: Colors.accentGlow, opacity: 0.45 },
  title: { ...Type.screenTitle },
  titleSub: { ...Type.subtitle, marginTop: 6 },

  coverPicker: { marginHorizontal: 20, marginBottom: 4, borderRadius: 20, overflow: 'hidden' },
  coverPreview: { width: '100%', height: 210 },
  coverPlaceholder: { height: 210, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 8 },
  coverIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accentSubtle, justifyContent: 'center', alignItems: 'center' },
  coverPlaceholderText: { ...Type.buttonSecondary, color: Colors.text },
  coverPlaceholderSub: { ...Type.metaSmall },

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
  dateRow: { flexDirection: 'row', gap: 10 },
  dateBtn: { flex: 1, gap: 8 },

  photoRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  photoThumb: { position: 'relative' },
  thumbImg: { width: 82, height: 82, borderRadius: 12 },
  removeBtn: { position: 'absolute', top: -6, right: -6 },
  addPhotoBtn: { width: 82, height: 82, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },

  createBtn: {
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
  createBtnText: { fontFamily: Fonts.bodySemiBold, color: Colors.white, fontSize: 16, letterSpacing: 0.8 },
});
