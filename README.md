# Movido Driver 🚛

Professional HGV driver app for Movido Logistics — built with Expo (React Native).
Matches the Movido web platform design system and connects to the same Supabase backend.

---

## Features

- **Jobs List** — real-time job assignments with status tracking
- **HGV Navigation** — TomTom routing with truck restrictions (weight, height, hazmat)
- **Auto-Arrive Geofencing** — auto status update when within 200m of destination
- **Proof of Delivery (POD)** — camera photo + recipient signature upload
- **Truck Check** — pre/post-trip vehicle inspection checklist with photo on fail
- **Messenger** — real-time chat with Dispatch (Supabase realtime)
- **WTD Timer** — UK Working Time Directive tracker with alerts at legal limits
- **Profile** — language switcher (EN 🇬🇧 / PL 🇵🇱 / RO 🇷🇴) + distance units
- **Dark theme** — matches Movido web app colour palette exactly

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 51 + Expo Router |
| Language | TypeScript |
| Backend | Supabase (auth, database, realtime, storage) |
| Maps | TomTom Maps API (react-native-maps + UrlTile) |
| i18n | i18next + react-i18next + expo-localization |
| Location | expo-location (background GPS + geofencing) |
| Camera | expo-image-picker |
| Notifications | expo-notifications |
| Storage | expo-secure-store (token storage) |
| Build | EAS Build (Expo Application Services) |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Jakub12345678910101010183/movido-driver.git
cd movido-driver
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://zjvozjnbvrtrrpehqdpf.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
EXPO_PUBLIC_TOMTOM_API_KEY=your_tomtom_api_key_here
```

**Where to find your keys:**
- Supabase anon key → [Supabase Dashboard](https://supabase.com/dashboard/project/zjvozjnbvrtrrpehqdpf/settings/api) → Project Settings → API → `anon public`
- TomTom API key → [TomTom Developer Portal](https://developer.tomtom.com/user/me/apps)

### 3. Run on device / simulator

```bash
# Install Expo Go on your phone, then:
npx expo start

# Or run on Android emulator:
npx expo start --android

# Or run on iOS simulator (Mac only):
npx expo start --ios
```

---

## Supabase Setup

The app connects to the existing Movido Supabase project. You need to add one extra table for truck checks and a storage bucket for POD photos.

Run this SQL in your Supabase SQL Editor:

```sql
-- Truck checks table
CREATE TABLE IF NOT EXISTS truck_checks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid REFERENCES users(id),
  vehicle_id uuid REFERENCES vehicles(id),
  check_type text CHECK (check_type IN ('pre_trip', 'post_trip')),
  items jsonb NOT NULL DEFAULT '[]',
  overall_pass boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE truck_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Drivers can manage own checks" ON truck_checks
  FOR ALL USING (driver_id = auth.uid());

-- Storage bucket for POD photos
INSERT INTO storage.buckets (id, name, public)
  VALUES ('pod-photos', 'pod-photos', true)
  ON CONFLICT DO NOTHING;

CREATE POLICY "Drivers can upload POD photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'pod-photos' AND auth.role() = 'authenticated');

CREATE POLICY "POD photos are publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'pod-photos');
```

---

## Build for Google Play

### Prerequisites

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Log in to Expo:
   ```bash
   eas login
   ```
   Use your Expo account (create one free at [expo.dev](https://expo.dev) if needed).

3. Link the project:
   ```bash
   eas build:configure
   ```

### Build APK (for testing)

```bash
# Development build (with dev menu):
eas build --platform android --profile development

# Preview APK (for sharing with testers):
eas build --platform android --profile preview
```

Once built, EAS will give you a download link. Install the `.apk` directly on Android.

### Build AAB (for Google Play)

```bash
eas build --platform android --profile production
```

This produces an `.aab` (Android App Bundle) file — this is what you upload to Google Play.

---

## Upload to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console) and sign in.

2. Click **Create app** → fill in:
   - App name: `Movido Driver`
   - Default language: `English (United Kingdom)`
   - App / Game: `App`
   - Free / Paid: `Free`

3. Complete the **Store listing**:
   - Short description: "Professional driver app for Movido Logistics"
   - Full description: describe the features
   - Screenshots: take screenshots from your phone or emulator
   - Icon: use `assets/icon.png` from this project

4. Go to **Testing → Internal testing** → Create a new release.

5. Upload the `.aab` file downloaded from EAS Build.

6. Add your email to the **Testers** list to test it yourself first.

7. Once happy, promote to **Production** → Submit for review.

> **Note:** First review by Google usually takes 1–3 days. Updates are faster (a few hours).

---

## Project Structure

```
movido-driver/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout (auth guard)
│   ├── login.tsx           # Login screen
│   └── (app)/              # Authenticated screens (tab navigation)
│       ├── _layout.tsx     # Tab bar layout
│       ├── index.tsx       # Jobs list
│       ├── navigate.tsx    # TomTom HGV navigation
│       ├── messenger.tsx   # Real-time chat
│       ├── wtd.tsx         # WTD timer
│       ├── profile.tsx     # Profile & settings
│       ├── job/[id].tsx    # Job detail
│       ├── pod/[jobId].tsx # Proof of delivery
│       └── truck-check.tsx # Vehicle inspection
├── components/             # Shared components
├── constants/
│   └── theme.ts            # Colours, spacing, fonts
├── hooks/
│   ├── useAuth.ts          # Supabase auth
│   ├── useJobs.ts          # Jobs + realtime
│   ├── useGeofencing.ts    # Auto-arrive GPS
│   └── useMessages.ts      # Chat + realtime
├── lib/
│   ├── supabase.ts         # Supabase client
│   ├── tomtom.ts           # TomTom API helpers
│   └── i18n.ts             # Localisation setup
├── locales/
│   ├── en.json             # English
│   ├── pl.json             # Polish
│   └── ro.json             # Romanian
├── .env.example            # Environment variable template
├── app.json                # Expo config
└── eas.json                # EAS Build profiles
```

---

## Colour Palette

Matches the Movido web app exactly:

| Token | Hex | Usage |
|---|---|---|
| `background` | `#0a0a0f` | App background |
| `surface` | `#111118` | Cards, inputs |
| `primary` | `#00d4ff` | Cyan accent, buttons |
| `textPrimary` | `#e8e8f0` | Main text |
| `textSecondary` | `#8888a0` | Labels, captions |
| `success` | `#22c55e` | Completed status |
| `warning` | `#f59e0b` | Pending status |
| `error` | `#ef4444` | Failed status |

---

## Questions?

Contact the Movido development team or raise an issue on GitHub.
