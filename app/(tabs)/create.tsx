import { Colors } from '@/constants/colors';
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

// Lazy-load native date picker only on native platforms
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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: isVenue,
      quality: 0.8,
    });
    if (!result.canceled) {
      if (isVenue) {
        setVenueImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
      } else {
        setCoverImage(result.assets[0].uri);
      }
    }
  };

  const uploadImage = async (uri: string, path: string): Promise<string | null> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const fileExt = uri.split('.').pop() ?? 'jpg';
    const { data, error } = await supabase.storage
      .from('event-images')
      .upload(`${path}.${fileExt}`, blob, { contentType: `image/${fileExt}` });
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
      host_id: user!.id,
      title,
      description,
      date: date.toISOString(),
      venue_name: venueName || null,
      address,
      dress_code: dressCode || null,
      notes: notes || null,
      cover_image: coverUrl,
      venue_images: venueUrls,
      contact_numbers: contacts,
    }).select().single();

    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    router.push(`/event/${data.id}`);
  };

  // Web: format date for datetime-local input (YYYY-MM-DDTHH:MM)
  const toDatetimeLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Create Event</Text>

        {/* Cover Image */}
        <TouchableOpacity style={styles.coverPicker} onPress={() => pickImage(false)}>
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.coverPreview} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="camera" size={32} color={Colors.textMuted} />
              <Text style={styles.coverPlaceholderText}>Add cover photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.form}>
          <Field label="Event Title *" value={title} onChange={setTitle} placeholder="What's the occasion?" />
          <Field label="Description" value={description} onChange={setDescription} placeholder="Tell people about your event" multiline />

          {/* Date/Time */}
          <View>
            <Text style={styles.label}>Date & Time *</Text>
            {Platform.OS === 'web' ? (
              // Native HTML datetime input for web
              <View style={styles.webDateWrap}>
                <input
                  type="datetime-local"
                  value={toDatetimeLocal(date)}
                  onChange={(e) => {
                    if (e.target.value) setDate(new Date(e.target.value));
                  }}
                  style={{
                    backgroundColor: Colors.surface,
                    border: `1px solid ${Colors.border}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    color: Colors.text,
                    fontSize: 15,
                    width: '100%',
                    colorScheme: 'dark',
                    outline: 'none',
                    cursor: 'pointer',
                  } as any}
                />
              </View>
            ) : (
              <>
                <View style={styles.nativeDateRow}>
                  <TouchableOpacity style={[styles.input, { flex: 1 }]} onPress={() => { setShowTimePicker(false); setShowDatePicker(true); }}>
                    <Text style={styles.inputText}>
                      {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.input, { flex: 1 }]} onPress={() => { setShowDatePicker(false); setShowTimePicker(true); }}>
                    <Text style={styles.inputText}>
                      {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                {showDatePicker && DateTimePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_: any, d?: Date) => { setShowDatePicker(false); if (d) setDate(d); }}
                    themeVariant="dark"
                  />
                )}
                {showTimePicker && DateTimePicker && (
                  <DateTimePicker
                    value={date}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_: any, d?: Date) => { setShowTimePicker(false); if (d) setDate(d); }}
                    themeVariant="dark"
                  />
                )}
              </>
            )}
          </View>

          <Field label="Venue Name" value={venueName} onChange={setVenueName} placeholder="The Grand Ballroom" />
          <Field label="Address *" value={address} onChange={setAddress} placeholder="123 Main St, City, State" />
          <Field label="Dress Code" value={dressCode} onChange={setDressCode} placeholder="Black tie, Casual, etc." />
          <Field label="Notes to Guests" value={notes} onChange={setNotes} placeholder="Parking info, what to bring, etc." multiline />
          <Field label="Contact Numbers" value={contactNumbers} onChange={setContactNumbers} placeholder="+1 555-0100, +1 555-0101 (comma separated)" />

          {/* Venue Images */}
          <View>
            <Text style={styles.label}>Venue Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.venueImagesRow}>
              {venueImages.map((uri, i) => (
                <View key={i} style={styles.venueImgWrap}>
                  <Image source={{ uri }} style={styles.venueImg} />
                  <TouchableOpacity style={styles.removeBtn} onPress={() => setVenueImages((p) => p.filter((_, j) => j !== i))}>
                    <Ionicons name="close-circle" size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addVenueBtn} onPress={() => pickImage(true)}>
                <Ionicons name="add" size={28} color={Colors.textMuted} />
              </TouchableOpacity>
            </ScrollView>
          </View>

          <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={loading}>
            {loading ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.createBtnText}>Create Event</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  coverPicker: { marginHorizontal: 20, marginBottom: 8, borderRadius: 16, overflow: 'hidden' },
  coverPreview: { width: '100%', height: 200 },
  coverPlaceholder: { backgroundColor: Colors.surface, height: 200, justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, borderStyle: 'dashed' },
  coverPlaceholderText: { color: Colors.textMuted, fontSize: 14 },
  form: { paddingHorizontal: 20, gap: 16, paddingBottom: 100 },
  label: { color: Colors.textSecondary, fontSize: 13, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputText: { color: Colors.text, fontSize: 15 },
  webDateWrap: { width: '100%' },
  nativeDateRow: { flexDirection: 'row', gap: 8 },
  venueImagesRow: { marginTop: 4 },
  venueImgWrap: { marginRight: 8, position: 'relative' },
  venueImg: { width: 80, height: 80, borderRadius: 10 },
  removeBtn: { position: 'absolute', top: -6, right: -6 },
  addVenueBtn: { width: 80, height: 80, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  createBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  createBtnText: { color: Colors.background, fontSize: 17, fontWeight: '700' },
});
