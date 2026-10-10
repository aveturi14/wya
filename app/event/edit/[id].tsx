import EventForm, { EventFormValues } from '@/components/EventForm';
import { Colors } from '@/constants/colors';
import { Type } from '@/constants/typography';
import { useAuth } from '@/hooks/useAuth';
import { confirmAction, showAlert } from '@/lib/alert';
import { deleteEventPhotos } from '@/lib/eventPhotos';
import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.from('events').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      setEvent(data);
      setLoading(false);
    });
  }, [id]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(`/event/${id}`));

  const save = async (values: EventFormValues, removedPhotoUrls: string[]) => {
    const { error } = await supabase.from('events').update(values).eq('id', id);
    if (error) throw error;
    await deleteEventPhotos(removedPhotoUrls);
    goBack();
  };

  const remove = async () => {
    if (!event) return;
    const ok = await confirmAction(
      'Delete event',
      `Delete "${event.title}"? Guests will lose access, and the chat and photos will be deleted. This can't be undone.`,
      'Delete',
      true,
    );
    if (!ok) return;
    setDeleting(true);
    // RSVPs, chat and the invite code are deleted with the event
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) { setDeleting(false); showAlert('Could not delete event', error.message); return; }
    await deleteEventPhotos([event.cover_image, ...(event.venue_images ?? [])]);
    router.replace('/(tabs)/home');
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>;

  // Only the host gets here through the app; anyone else sees a dead end
  if (!event || event.host_id !== user?.id) return (
    <View style={styles.center}>
      <Text style={styles.errorText}>Event not found</Text>
      <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)/home')}>
        <Text style={styles.homeBtnText}>Go Home</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <EventForm
      heading="Edit Event"
      subheading={event.title}
      submitLabel="Save Changes"
      initial={event}
      onBack={goBack}
      onSubmit={save}
      footer={
        <TouchableOpacity style={styles.deleteBtn} onPress={remove} disabled={deleting}>
          {deleting
            ? <ActivityIndicator color={Colors.danger} />
            : <>
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                <Text style={styles.deleteText}>Delete Event</Text>
              </>}
        </TouchableOpacity>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', gap: 14 },
  errorText: { ...Type.description },
  homeBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 40 },
  homeBtnText: { ...Type.buttonPrimary },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 14, borderWidth: 1, borderColor: Colors.danger + '55', backgroundColor: Colors.dangerSubtle },
  deleteText: { ...Type.buttonSecondary, color: Colors.danger },
});
