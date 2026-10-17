import EventForm, { EventFormValues, InviteLinkValues } from '@/components/EventForm';
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

  const create = async (values: EventFormValues, _removed: string[], { inviteLink }: { inviteLink: InviteLinkValues }) => {
    const { data, error } = await supabase.from('events').insert({ ...values, host_id: user!.id }).select('id').single(); // `*` would include the (unreadable) address
    if (error) throw error;
    // The invite link is created with the event; only touch it if the host changed something
    if (inviteLink.expiresAt || inviteLink.maxUses != null || inviteLink.requiresApproval) {
      const { error: linkError } = await supabase.rpc('set_invite_limits', {
        p_event_id: data.id, p_expires_at: inviteLink.expiresAt, p_max_uses: inviteLink.maxUses, p_requires_approval: inviteLink.requiresApproval,
      });
      if (linkError) throw linkError;
    }
    setFormKey((k) => k + 1);
    router.push(`/event/${data.id}`);
  };

  return (
    <EventForm
      key={formKey}
      heading="Plan something"
      subheading="Set it up in a minute. You can change anything later."
      submitLabel="Create event"
      onSubmit={create}
    />
  );
}
