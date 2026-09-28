# MOViDO Driver

Native iOS/Android app for HGV drivers. It is a second client of the same MOViDO backend as the
office app at https://www.movidologistics.uk. There is no separate driver backend.

Expo SDK 57 · React Native 0.86 · expo-router · Supabase (RLS + `driver_*` RPCs) · TomTom (native key).

## Architecture

| Area | How it works |
|---|---|
| Auth | Supabase email/password. The office invites a driver, the driver sets a password on the web page, then signs in here. The session is stored in the Keychain/Keystore. Disabled and non-driver accounts are refused. |
| Jobs | Read through RLS (the driver's own jobs only), with live updates via Supabase Realtime and a per-driver offline cache. |
| Multi-stop | `driver_start_job`, `driver_confirm_stop(job, stop, status, at, lat, lng, accuracy)` with the position taken at the tap. A late sync keeps the time the driver acted (max 12 h back), and replays never move a stop back. |
| GPS | Background task (`expo-location` + `expo-task-manager`) → local queue → `driver_report_locations` (batch, timestamped). Server geofencing marks arrivals once. Runs only while a job is in progress, at 100 m / 60 s by default (per company: `app_settings.driver_gps_*`). |
| POD | Photo resized to ≤1600 px JPEG → `pod-photos/<company>/<job>/<request>.jpg`, plus signature, recipient, notes, time and location, then `driver_complete_job`. |
| Checks / incidents / fuel | `driver_submit_vehicle_check`, `driver_report_incident`, `driver_log_fuel`. Photos go to `driver-uploads/<company>/<driver>/…`. The server computes the check result and fuel cost. |
| Messages | `messages` table (RLS) with idempotent send via `client_request_id`, and `driver_mark_messages_read`. |
| Offline | Every action is written to the on-device outbox first, then sent in order with backoff. Every write is idempotent, so a lost response never duplicates a record. |
| Push | The device registers an Expo push token on `drivers.push_token`. Database triggers send job assigned/changed and message notifications through Expo push (pg_net). No secret is in the app. |
| Navigation | TomTom truck route (vehicle dimensions + traffic) for distance/ETA in the app. Turn-by-turn opens Google Maps / Apple Maps. |

Backend migration: `movido-app/supabase/migrations/20260927192241_driver_app_backend.sql`.

## Configuration

Public client values only (see `.env.example`):

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_TOMTOM_API_KEY`: the **native** key ("API key Movido"), not the domain-locked web key.

For EAS builds, set them as EAS environment variables for `preview` and `production`. `.env` is not committed.

## Commands

```
npm install
npm run check          # TypeScript
npm test               # core logic against the real backend (QA accounts, env vars in test/run.ts)
npm run doctor         # expo-doctor
npm run export:check   # bundle iOS + Android JavaScript (Hermes)
npm run test:ui        # layout/a11y of every screen at 375/390/430 px (React Native Web + test doubles)
```

## Release (EAS)

1. `npx eas login`, then `npx eas init` (writes `extra.eas.projectId`; push notifications need it).
2. Set the three `EXPO_PUBLIC_*` variables in EAS for `preview` and `production`.
3. iOS: Apple Developer account, bundle id `uk.movidologistics.driver`, push key (EAS can create it).
   Android: package `uk.movidologistics.driver`. Google Play requires a background-location declaration and video for `ACCESS_BACKGROUND_LOCATION`.
4. `npm run build:preview` → install on real phones → run the device checklist below.
5. `npm run build:production`, then `eas submit`.

## Physical-device checklist (not verifiable in CI)

- [ ] Sign in; kill the app; reopen while signed in (Keychain session)
- [ ] Location prompt at first job start; "Always" upgrade flow (iOS "Always", Android "Allow all the time")
- [ ] Background GPS with the screen locked for 30+ min while navigating in Google Maps; positions on the office live map
- [ ] Geofence arrival at a real stop (≈100 m) without pressing Arrive
- [ ] Airplane mode: arrive/complete stop, POD with photo + signature, fuel with receipt, check with defect photo → back online → all synced once
- [ ] Camera permission denied → Settings path; photo retake; photo size < 500 KB
- [ ] Push: office assigns a job / sends a message (app closed and open); tap opens the job/messages
- [ ] Android 14 foreground-service notification visible while tracking; battery over a 9-hour shift
- [ ] Sign out stops tracking and push; a second driver on the same phone sees none of the first driver's data
