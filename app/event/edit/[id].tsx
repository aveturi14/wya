import EventForm, { EventFormValues } from '@/components/EventForm';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Screen from '@/components/ui/Screen';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTheme } from '@/hooks/useTheme';
import { confirmAction, showAlert } from '@/lib/alert';
import { deleteAlbumFiles } from '@/lib/album';
import { deleteEventPhotos } from '@/lib/eventPhotos';
import { EVENT_COLUMNS, withAddresses } from '@/lib/events';
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
  const [pledgedCount, setPledgedCount] = useState(0);
  usePageTitle(event ? `Edit ${event.title}` : 'Edit event');

  useEffect(() => {
    supabase.from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle().then(async ({ data }) => {
      // Only the host can edit, and the host always gets the address back
      setEvent(data ? (await withAddresses([data as Omit<Event, 'address'>]))[0] : null);
      setLoading(false);
    });
    supabase.rpc('get_guest_list', { p_event_id: id }).then(({ data }) => {
      setPledgedCount((data ?? []).filter((g: { pledge_cents: number | null }) => g.pledge_cents != null).length);
    });
  }, [id]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace(`/event/${id}`));

  const save = async (values: EventFormValues, removedPhotoUrls: string[], { releasePledges }: { releasePledges: boolean }) => {
    const { error } = await supabase.from('events').update(values).eq('id', id);
    if (error) throw error;
    if (releasePledges) {
      const { error: releaseError } = await supabase.rpc('release_pledges', { p_event_id: id });
      if (releaseError) throw releaseError;
    }
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
    // Album files first: their rows (and the host's right to delete them) go with the event
    await deleteAlbumFiles(id);
    // RSVPs, chat, photos rows and the invite code are deleted with the event
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
      pledgedCount={pledgedCount}
      onBack={goBack}
      onSubmit={save}
      footer={<Button title="Delete event" icon="trash-outline" variant="danger" loading={deleting} onPress={remove} />}
    />
  );
}
