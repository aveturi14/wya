export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  date: string;
  end_date: string | null;
  venue_name: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  dress_code: string | null;
  notes: string | null;
  cover_image: string | null;
  venue_images: string[];
  contact_numbers: string[];
  allow_guest_invites: boolean;
  // One of constants/eventThemes.ts
  theme: string;
  // Pledges (Phase 3): see lib/pledges.ts
  deposit_mode: 'none' | 'pledge';
  deposit_cents: number;
  cutoff_hours: number;
  created_at: string;
  host?: Profile;
}

export interface Rsvp {
  id: string;
  event_id: string;
  user_id: string;
  // 'invited' until the guest answers (created when they open the invite link)
  status: 'invited' | 'yes' | 'no' | 'maybe';
  additional_details: string | null;
  created_at: string;
  // The pledge this guest agreed to (null = not pledged)
  pledge_cents: number | null;
  attended: boolean | null;
  profile?: Profile;
}

export interface ChatMessage {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}

export type RsvpStatus = 'invited' | 'yes' | 'no' | 'maybe' | null;
