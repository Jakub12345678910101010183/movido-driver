# MOViDO Driver — Real-Device Test Checklist

Run the whole list on **one Android phone** and **one iPhone** with the *preview* build.
Use a QA company (not Movido Logistics Ltd). You need two people or two screens: the phone
(driver) and the office web app at https://www.movidologistics.uk (dispatcher/admin of the
same QA company).

Record each line as ✅ pass, ❌ fail (with a note/screenshot) or ➖ not applicable.
Do not tick anything that was not actually done on the phone.

**Setup before testing (office web):**
1. Team → the driver has an account (invited by email, password set on the web).
2. Fleet → the test vehicle has height, width, weight and length filled in.
3. Drivers → the driver has that vehicle assigned.
4. Jobs → create **Job A** with 3 stops near where you can drive (at least one stop you can
   physically reach), assigned to the driver, scheduled today. Create **Job B** for tomorrow.

---

## ANDROID

Device: __________ Android version: ____ Build: preview (EAS) ____

### A. Auth
- [ ] Install the APK from the EAS link; app name shows **MOViDO Driver** with the MOViDO icon
- [ ] Launch → splash → Sign in screen
- [ ] Wrong password → "Email or password is not correct."
- [ ] Correct sign-in → Home with the driver's first name and company
- [ ] Force-close the app, reopen → still signed in (no login screen)
- [ ] More → Sign out → back to Sign in; reopening the app stays signed out
- [ ] Forgot password → email arrives → set new password on the web page → sign in on the phone with it
- [ ] Office disables the driver (Team → Disable) → reopen app → "Your account is disabled"; office re-enables → sign in works

### B. Jobs
- [ ] Jobs → **Today** shows Job A; **Upcoming** shows Job B; **Done** shows completed jobs
- [ ] Home shows Today's counts (assigned / completed / remaining) that match the office
- [ ] Home "Next job" card shows reference, customer, collection, delivery, stops, vehicle
- [ ] Open Job A → details, special instructions, customer phone (tap → dialler opens)

### C. Multi-stop
- [ ] Job A → **Start job** → status In progress on the phone and in the office within a few seconds
- [ ] Current stop card shows Stop 1, time window, contact; "Then:" shows Stop 2
- [ ] **Arrive at stop 1** → button changes to **Complete stop 1**; office shows stop 1 arrived
- [ ] **Complete stop 1** → current stop becomes Stop 2 automatically
- [ ] Force-close and reopen → Stop 1 still completed, Stop 2 current
- [ ] Repeat for Stop 2 and Stop 3 → "All stops done" → **Complete delivery (POD)** appears

### D. Navigation
- [ ] Current stop shows Distance · ETA (TomTom truck route) and a traffic delay when there is one
- [ ] Change the vehicle height in the office to something very high (e.g. 5.0 m) → ETA/route length changes for a route with a low bridge (optional, if you know one)
- [ ] **Navigate** → Google Maps opens with directions to the stop

### E. GPS
- [ ] At job start the location prompt appears; choose **While using** → then the second prompt / Settings to **Allow all the time**
- [ ] Home status line: "Location active · sent HH:MM"
- [ ] Office live map shows the driver moving (foreground)
- [ ] Press Home (app in background) and drive/walk 10+ min → office map keeps updating
- [ ] Lock the phone for 10+ min while moving → office map keeps updating; the Android notification "Sharing your location…" is visible
- [ ] Office position times match the real times (not the time the phone reconnected)

### F. Geofence
- [ ] Go to within ~100 m of a real stop **without** pressing Arrive → stop becomes Arrived (phone and office) within 1–2 min
- [ ] Stay there / come back → no second arrival event in the office for the same stop

### G. POD
- [ ] **Take photo** → camera opens → preview shown
- [ ] **Retake** replaces the photo; **Remove** removes it
- [ ] **Get signature** → sign with a finger → **Clear** clears → sign again → **Confirm signature** → "Signature captured"
- [ ] Recipient name + notes → **Confirm delivery** → "Delivery completed"
- [ ] Office → POD page: photo opens, signature shown, "Received by: <name>", notes, time
- [ ] Photo in the office is sharp enough to read a label and loads quickly (resized, not the full camera file)

### H. Vehicle check
- [ ] Home banner "Vehicle check not done today" → **Start vehicle check**
- [ ] Mark items Pass / Fail / N/A; a Fail asks "What is wrong?"
- [ ] Fail **Brakes** → red "Safety-critical defect" banner; submit → "Do not drive"
- [ ] Add a defect photo
- [ ] Office → **Vehicle checks**: the check shows "Do not drive — critical defect", the note and the photo

### I. Incident
- [ ] Report issue from Job A → choose **Breakdown** → red "call 999 first" banner
- [ ] Also try **Accident**, **Vehicle damage**, **Traffic delay**, **Customer issue**, **Road closure** (one report each or change the type before sending)
- [ ] Add a photo, description → Send → "Issue reported"
- [ ] Office → Incidents: type, description, driver, vehicle, job, map location, time and the photo

### J. Fuel
- [ ] Record fuel: Diesel, litres, £/litre → "Calculated total" appears
- [ ] Enter a receipt total that differs by >2 % → warning shown
- [ ] Mileage, station, receipt photo → Save → "Fuel recorded"
- [ ] Office → Fuel: litres, cost, mileage, station and the **Receipt** link opens the photo

### K. Messages
- [ ] Driver sends a message → appears in office Messenger
- [ ] Office replies → appears on the phone; the MESSAGES tab shows an unread badge
- [ ] Opening Messages clears the badge; office sees the message as read
- [ ] Office broadcast → shown as Broadcast; urgent (alert) shown in red

### L. Offline
- [ ] Turn on **airplane mode** → status shows Offline; Home says "Showing work saved at …"
- [ ] Open Job A (still visible), Arrive/Complete a stop → "Saved on this phone — waiting to sync"
- [ ] Complete a POD with photo + signature offline → "Saved offline — it will sync automatically"
- [ ] Record fuel and an incident offline
- [ ] Force-close the app, reopen (still offline) → items still in More → Sync status
- [ ] Turn airplane mode off → everything syncs without tapping anything
- [ ] Office: each item appears **once** (no duplicates), with the times they were done offline

### M. Push
- [ ] More → Notifications shows **On** (after allowing)
- [ ] Office assigns a new job → notification "New job …" (app closed, and app open)
- [ ] Office changes a stop/address → "Job updated …"
- [ ] Office sends a message → notification; urgent → "Urgent message"
- [ ] Tap the job notification → opens that job; tap the message notification → opens Messages
- [ ] After Sign out, office messages no longer notify this phone

### N. Battery
- [ ] Full charge → run an in-progress job for **2+ hours** with the phone locked most of the time
- [ ] Battery use by MOViDO Driver (Settings → Battery) is reasonable (note the %)
- [ ] No job in progress → location sharing stops ("Location paused") and the Android notification disappears

### O. Permissions
- [ ] Deny location → red "Location permission required" banner → **Fix location** → Settings path works
- [ ] Allow location → banner disappears
- [ ] Deny camera → "Camera permission required" with **Open Settings**; allow → camera works
- [ ] Deny notifications → More shows "Off — allow in Settings"; allow → "On"

### P. Network
- [ ] Works on Wi-Fi
- [ ] Works on mobile data only
- [ ] Switch Wi-Fi ↔ mobile during a sync → no errors, no duplicates
- [ ] Drive through a no-signal area → queued GPS and actions sync afterwards

---

## IPHONE

Device: __________ iOS version: ____ Build: preview (EAS, internal) ____

Same sections **A–P** as Android, with these iPhone-specific checks:

### A. Auth
- [ ] Install from the EAS internal-distribution link (device must be registered first, see README)
- [ ] All Android A checks

### B–C. Jobs, Multi-stop
- [ ] All Android B and C checks

### D. Navigation
- [ ] **Navigate** → Google Maps if installed, otherwise **Apple Maps** opens with directions
- [ ] All other Android D checks

### E. GPS
- [ ] First prompt "Allow While Using App" → later iOS asks "Change to Always Allow?" (or set Settings → MOViDO Driver → Location → **Always**)
- [ ] Blue location indicator shows while tracking in the background
- [ ] Office map keeps updating with the phone locked for 10+ min and while Google/Apple Maps navigates
- [ ] All other Android E checks

### F–L. Geofence, POD, Check, Incident, Fuel, Messages, Offline
- [ ] All Android F–L checks

### M. Push
- [ ] iOS asks to allow notifications; notifications arrive on the lock screen
- [ ] All other Android M checks

### N–P. Battery, Permissions, Network
- [ ] All Android N–P checks (Settings → Battery shows MOViDO Driver usage)

---

## Sign-off

| Platform | Tester | Date | Result |
|---|---|---|---|
| Android | | | |
| iPhone | | | |

Failures: list the section/line, what happened, and attach a screenshot. Send this file back.
