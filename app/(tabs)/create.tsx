import EventForm, { EventFormValues } from '@/components/EventForm';
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

  const create = async (values: EventFormValues) => {
    const { data, error } = await supabase.from('events').insert({ ...values, host_id: user!.id }).select().single();
    if (error) throw error;
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
