import CollectForm from '@/components/collect/CollectForm';
import EventForm, { EventFormValues, InviteLinkValues } from '@/components/EventForm';
import ListRow, { ListGroup } from '@/components/ui/ListRow';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export default function CreateScreen() {
  const { user } = useAuth();
  const router = useRouter();
  usePageTitle('Plan something');
  // Changing the key remounts the form, so it starts fresh after each event
  const [formKey, setFormKey] = useState(0);
  // Collect money without an event (stage 1.1b)
  const [collecting, setCollecting] = useState(false);

  const create = async (values: EventFormValues, _removed: string[], { inviteLink, slots }: { inviteLink: InviteLinkValues; slots: string[] | null }) => {
    const { data, error } = await supabase.from('events').insert({ ...values, host_id: user!.id }).select('id').single(); // `*` would include the (unreadable) address
    if (error) throw error;
    // The invite link is created with the event; only touch it if the host changed something
    if (inviteLink.expiresAt || inviteLink.maxUses != null || inviteLink.requiresApproval) {
      const { error: linkError } = await supabase.rpc('set_invite_limits', {
        p_event_id: data.id, p_expires_at: inviteLink.expiresAt, p_max_uses: inviteLink.maxUses, p_requires_approval: inviteLink.requiresApproval,
      });
      if (linkError) throw linkError;
    }
    // "Find a time" (8.7): the candidate times go on once the event exists
    if (slots) {
      const { error: slotsError } = await supabase.rpc('add_slots', { p_event_id: data.id, p_slots: slots.map((starts_at) => ({ starts_at })) });
      if (slotsError) throw slotsError;
    }
    setFormKey((k) => k + 1);
    router.push(`/event/${data.id}`);
  };

  return (
    <>
      <EventForm
        key={formKey}
        heading="Plan something"
        subheading="Your poster builds itself as you type. You can change anything later."
        submitLabel="Create event"
        onSubmit={create}
        aside={
          <ListGroup>
            <ListRow
              icon="cash-outline"
              title="Just collecting money?"
              subtitle="Skip the event: get a link, everyone pays you before you book"
              chevron
              onPress={() => setCollecting(true)}
            />
          </ListGroup>
        }
      />
      <CollectForm
        visible={collecting}
        onClose={() => setCollecting(false)}
        onCreated={(id) => { setCollecting(false); router.push(`/collect/${id}`); }}
      />
    </>
  );
}
