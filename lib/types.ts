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
  is_private: boolean;
  invite_code: string;
  created_at: string;
  host?: Profile;
}

export interface Rsvp {
  id: string;
  event_id: string;
  user_id: string;
  status: 'yes' | 'no' | 'maybe';
  additional_details: string | null;
  created_at: string;
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

export type RsvpStatus = 'yes' | 'no' | 'maybe' | null;
