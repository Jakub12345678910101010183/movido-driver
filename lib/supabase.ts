import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// SecureStore adapter for native (replaces localStorage)
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          role: 'admin' | 'dispatcher' | 'driver';
          avatar_url: string | null;
          phone: string | null;
          created_at: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          reference: string;
          customer: string;
          address: string;
          postcode: string;
          lat: number | null;
          lng: number | null;
          status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
          driver_id: string | null;
          vehicle_id: string | null;
          eta: string | null;
          notes: string | null;
          instructions: string | null;
          weight_kg: number | null;
          items: number | null;
          pod_photo_url: string | null;
          pod_signature_url: string | null;
          pod_recipient: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      vehicles: {
        Row: {
          id: string;
          registration: string;
          model: string;
          type: 'HGV' | 'LGV' | 'VAN';
          status: 'active' | 'idle' | 'maintenance';
          fuel_level: number | null;
          mileage: number | null;
          driver_id: string | null;
        };
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string | null;
          content: string;
          read: boolean;
          created_at: string;
        };
      };
    };
  };
};
