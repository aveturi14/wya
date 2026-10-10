import EventForm, { EventFormValues } from '@/components/EventForm';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Screen from '@/components/ui/Screen';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { deleteEventPhotos } from '@/lib/eventPhotos';
import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  usePageTitle(event ? `Edit ${event.title}` : 'Edit event');

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

  if (loading) return <Screen style={{ justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={theme.colors.primary} size="large" /></Screen>;

  // Only the host gets here through the app; anyone else sees a dead end
  if (!event || event.host_id !== user?.id) return (
    <Screen style={{ justifyContent: 'center' }}>
      <EmptyState icon="eye-off-outline" title="Event not found" action={<Button title="Go home" onPress={() => router.replace('/(tabs)/home')} />} />
    </Screen>
  );

  return (
    <EventForm
      heading="Edit event"
      subheading={event.title}
      submitLabel="Save changes"
      initial={event}
      onBack={goBack}
      onSubmit={save}
      footer={<Button title="Delete event" icon="trash-outline" variant="danger" loading={deleting} onPress={remove} />}
    />
  );
}
