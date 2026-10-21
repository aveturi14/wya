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
  // Null when hidden from this viewer (pledge event, not committed): see lib/events.ts
  address: string | null;
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
  // Most people who can say I'm in (null = no limit)
  max_guests: number | null;
  // 'open' (8.7): the time is still being picked; `date` is only the earliest candidate
  // 'collection': the hidden event behind a standalone collection (never listed as an event)
  kind: 'fixed' | 'open' | 'collection';
  // The poster (9.3): the italic serif line and up to two host stickers
  poster_line: string | null;
  stickers: string[];
  created_at: string;
  host?: Profile;
}

export interface Rsvp {
  id: string;
  event_id: string;
  user_id: string;
  // 'invited' until the guest answers (created when they open the invite link);
  // 'requested' while waiting for the host to approve (not yet a guest)
  status: 'invited' | 'requested' | 'yes' | 'no' | 'maybe';
  additional_details: string | null;
  created_at: string;
  // The pledge this guest agreed to (null = not pledged)
  pledge_cents: number | null;
  attended: boolean | null;
  // When they tapped "I'm here" (8.4)
  checked_in_at?: string | null;
  profile?: Profile;
}

// Clients write only 'text' and 'image'; the rest are cards posted by database
// functions (polls, splits, plans, bills) or replies from the wya assistant ('bot')
export type ChatMessageKind = 'text' | 'image' | 'poll' | 'split' | 'plan' | 'bot' | 'system' | 'receipt' | 'collect';

export interface ChatMessage {
  id: string;
  event_id: string;
  // Null for 'bot' and 'system' messages
  user_id: string | null;
  kind: ChatMessageKind;
  content: string | null;
  image_path: string | null;
  data: Record<string, any> | null;
  created_at: string;
  profile?: Profile | null;
}

export type RsvpStatus = 'invited' | 'requested' | 'yes' | 'no' | 'maybe' | null;
