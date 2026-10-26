# Optix — Technical Documentation

**Product name:** Optix  
**Repo / npm name:** `Optix`  
**Audience:** parent on a phone  
**Platform:** Expo (React Native) — iOS first, Android and web for development  
**Status:** parent face unlock and product shell are live; eye screening is not built yet

This document describes the product we are building, the architecture that is already in the repo, and the screening pipeline that comes next.

---

## 1. What Optix is

Optix is a **consumer parent app** for watching how a child’s vision is changing over time.

It is not a clinic device and not a photo classifier.

| Optix leads with | Optix does not do |
| --- | --- |
| Longitudinal **trends** from repeated scans | Instant “this child has myopia” |
| **Personalized Tips** tied to *this* child’s measurements | One broadcast reminder for every child |
| One flash photo that yields several classical readings | A trained CNN / Kaggle classifier |
| On-device storage, no account | Cloud diagnosis or a patient portal |

The closest public precedent is Apple’s Screen Distance: a phone used as a **sensor**, not as a social camera. The clinical precedent for the photo itself is a **photoscreener** (photorefraction + Hirschberg), not an ENT-style image classifier.

Copy rules, everywhere:

- Never say a child *has* a condition.
- A flag is a reason to **consider a real exam**, not a diagnosis.
- The enrolled face is the **parent**, never the child.

---

## 2. Product thesis

Clinic tools (for example GoCheck) stay in the exam room. Parents need something that lives on the phone they already hold.

A single photo is a weak claim. A **series** of photos, stored on the same device, can show direction: near vision moving, left versus right drifting, alignment changing. Tips stay quiet until a trend says they matter — outdoor time from trial doses, 20-20-20 as a supporting habit, “see an eye doctor” only on a declining trend or a hard flag.

That is the pitch: **measure → watch the trend → change the plan**.

---

## 3. Constraints we accepted

| Constraint | Why |
| --- | --- |
| Expo + TypeScript, developed on Windows | No Mac or iPhone on the build machine |
| Phone from day one via Expo Go + LAN QR | The product is a phone, not a desktop site |
| On-device only | No backend, no account, scans never leave the phone |
| Face unlock, not OS Face ID | Expo Go cannot use TrueDepth / LocalAuthentication as the product lock |
| PIN fallback | Lighting, hats, and model load can fail |
| No TrueDepth in v1 | Requires a custom iOS build and a physical iPhone |
| No CNN training for screening | There is no honest public dataset for this task; v1 uses classical measurements |
| Continuous Native Generation | Do not hand-edit `ios/` or `android/` — they are not in the repo |

---

## 4. Tech stack

| Layer | Choice | Version (see `package.json`) |
| --- | --- | --- |
| Runtime | Expo | SDK 57 |
| UI | React Native + React | 0.86 / 19 |
| Language | TypeScript | 5.x / 6.x in repo |
| Camera | `expo-camera` (`CameraView`) | SDK-aligned |
| Photos | `expo-image-picker` | SDK-aligned |
| Storage | `@react-native-async-storage/async-storage` | 2.2 |
| PIN hash | `expo-crypto` SHA-256 | SDK-aligned |
| Face embed (web) | `face-api.js` 0.22.2 UMD from jsDelivr | weights in `/public/models` |
| Face embed (native) | Hidden `react-native-webview` running the same face-api bridge | 13.16 |
| Dev on phone | Expo Go, same Wi‑Fi as the PC | `npx expo start --lan` |

Navigation is **not** Expo Router yet. `App.tsx` is a status gate: welcome → enroll → lock → home.

---

## 5. Architecture

```
┌─────────────────────────────────────────────┐
│                   App.tsx                   │
│     AuthProvider  +  FaceEngineProvider     │
│                      Gate                   │
└───────────┬─────────────────────────────────┘
            │ status
            ▼
   welcome | needs-enroll | locked | unlocked
            │
            ├── WelcomeScreen
            ├── EnrollScreen  ──► PhoneCamera + FaceEngine
            ├── UnlockScreen  ──► PhoneCamera + FaceEngine
            └── HomeScreen    ──► Home / Scan / Tips / You  (shell)

Storage (AsyncStorage, this device only)
   Optix.auth.v1      enrolled embedding + PIN hash + child name
   Optix.welcome.v1   intro already seen

Face path
   web     FaceEngine.tsx  → face.ts → window.faceapi + /models
   native  FaceEngine.native.tsx → hidden WebView → faceBridgeHtml.ts
```

**Rule:** keep route-like screens in `src/screens/`. Keep auth, camera, and UI primitives out of `App.tsx`.

### 5.1 Why a WebView on the phone

`face-api.js` is a browser library (TensorFlow.js + canvas). Metro cannot run that graph the same way on iOS/Android inside Expo Go.

So:

1. `expo-camera` takes a JPEG and we turn it into a `data:` URL.
2. Native injects that URL into a 1×1 hidden WebView.
3. The WebView loads face-api, runs Tiny Face Detector + 68 landmarks + Face Recognition net.
4. It posts a **128-d descriptor** back to React Native.
5. Unlock is Euclidean distance against the stored average of three enroll samples.

Web skips the WebView and calls `face.ts` directly.

### 5.2 Why this is not a custom native build (yet)

Expo Go already ships `expo-camera` and `react-native-webview`. A development build is only required after we add a native module Go does not include (TrueDepth, a custom vision plugin, etc.).

---

## 6. Authentication

Parent-only. The child’s face is never enrolled and never used to unlock.

### 6.1 Enrollment

1. Three stills of the **parent** (live camera or a photo already on the phone).
2. Each still becomes a 128-d vector.
3. The three vectors are **averaged** (`averageVectors` in `src/auth/match.ts`).
4. Child’s first name is stored for home copy only.
5. A 4-digit PIN is hashed with SHA-256 (`Optix-parent-unlock:{pin}`) and stored. The raw PIN is not kept.

### 6.2 Unlock

- **Face:** live descriptor vs stored average. Match if Euclidean distance **≤ 0.52**.
- **PIN:** compare hash. Used when the model is cold, the room is dark, or the face is not the enrolled parent.

`lastDistance` is shown on the unlock screen for debugging the threshold. It is not a clinical number.

### 6.3 Auth record

```ts
type AuthRecord = {
  pinHash: string;
  embedding: number[];      // 128-d FaceNet-style descriptor
  enrolledAt: string;       // ISO
  sampleCount: number;
  childName: string;
};
```

Reset (You tab) requires the PIN, then clears both storage keys and returns to welcome.

### 6.4 Auth statuses

| Status | Screen |
| --- | --- |
| `loading` | Spinner |
| `welcome` | Three-page intro |
| `needs-enroll` | Parent unlock setup |
| `locked` | Scan face / PIN |
| `unlocked` | Home shell |

---

## 7. Screens (current)

| Screen | Role |
| --- | --- |
| **Welcome** | Product story: trends, one flash photo, on-device. Skip allowed. |
| **Enroll** | 3 parent stills, child name, PIN. Face oval in a dark well. |
| **Unlock** | Front camera + PIN fallback. |
| **Home** | Empty-state journal: date, `{child}’s eyes`, first-scan card, five condition rows. |
| **Scan** | Guide only (oval, dim room, rear camera + flash). No capture pipeline yet. |
| **Tips** | Three placeholder cards (outdoor, 20-20-20, see a doctor) — not yet measurement-gated. |
| **You** | Safety copy, lock, reset. |

`InsideScreen.tsx` is an older unlocked stub. Home replaced it; do not wire it back into the gate.

---

## 8. Design system

Phone-first. The web preview is a centered column (`maxWidth: 440`) so desktop does not stretch into a site.

| Token | Value | Use |
| --- | --- | --- |
| Paper | `#F3EEE6` | App background |
| Ink | `#1C1915` | Titles |
| Teal | `#1F6B63` | Primary actions |
| Gold | `#C9894A` | Waiting / idle condition |
| Display | Fraunces (web) / Georgia (native) | Headlines |
| UI | DM Sans (web) / system (native) | Body, buttons |

Layout hook: `src/ui/useLayout.ts` — compact under 420 px width, tighter type and a shorter camera on short phones.

Text wrapping: `SafeText` puts block copy in a full-width `View`. Do not replace spaces with non-breaking spaces; that is what made words overlap on mobile.

Camera chrome: `FaceWell` + `PhoneCamera` (square frame, front camera, `maxHeight` from layout).

Notch: `Screen` uses `StatusBar.currentHeight` / iOS top pad. `expo-safe-area-context` is **not** a package; do not add it. If we need real insets later, install `react-native-safe-area-context` via `npx expo install`.

---

## 9. Privacy and safety

- No server. No analytics. No account.
- Face photos are used **only** to compute a descriptor, then discarded. The stored secret is the vector + PIN hash, not the JPEG.
- Eye-scan photos (when built) stay on device. Same rule.
- Permission strings in `app.json` say camera/photos are for **parent enroll**, not for diagnosing a child.
- Clinical language is banned in UI strings: no “has myopia”, no “you need glasses”.

This is a screening **companion**, not a medical device claim. Treat future store listing and pitch copy the same way.

---

## 10. Screening pipeline (not built — target design)

Do not train a classifier. The photo is a sensor. Extract numbers, then trend them.

### 10.1 Capture

- Parent holds the phone. **Rear** camera + flash.
- Child looks at the phone. Dim room, still face, both eyes in the oval.
- One still. Later: optional second still if pupils are not found.

### 10.2 Measurements (classical, on-device)

| Reading | Method (intent) | Home label |
| --- | --- | --- |
| Near / far risk | Photorefraction (crescent in the red reflex) | Near vision / Far vision |
| Astigmatism | Reflex shape / meridian | Astigmatism |
| Left vs right | Anisometropia from the two eyes | Left vs right |
| Alignment | Hirschberg (light reflex vs pupil center) | Alignment |
| Working distance | Later: iris diameter / MediaPipe; Apple Screen Distance is pitch only | (internal) |

v1 implementation should be **geometry + photometry**, not “upload to a model that outputs a disease name”.

### 10.3 Trends

Each scan is a row: timestamp + five readings + quality flags.

Home shows **direction** (waiting → watch → ok), not a diagnosis. Tips unlock when a series says they matter (for example outdoor-time dose from published school-day trials if near vision is moving).

### 10.4 What we will not do in v1

- TrueDepth / Face ID as the clinical sensor
- Cloud inference
- Kaggle training for “detect myopia from a selfie”
- Child face as the lock

---

## 11. Repository map

```
App.tsx                 Gate + providers
index.ts                Expo entry
app.json                Name Optix, camera + photo permissions
metro.config.js         Web alias for @vladmandic/face-api (unused by the UMD path)
public/models/          TinyFaceDetector, landmarks, recognition shards

src/auth/
  types.ts              FaceVector, AuthRecord
  store.ts              AsyncStorage + PIN hash
  match.ts              Euclidean, average, threshold 0.52
  face.ts               Web face-api
  faceBridgeHtml.ts     Native WebView HTML
  FaceEngine.tsx        Web provider
  FaceEngine.native.tsx Phone provider
  AuthContext.tsx       Status machine
  imageData.ts          URI → data URL

src/screens/            Welcome, Enroll, Unlock, Home
src/components/         PhoneCamera (WebCamera is legacy)
src/ui/                 Screen, SafeText, Type, Button, Logo, FaceWell, IrisMark
src/data/demoHome.ts    Five condition rows for the empty state
src/theme.ts            Color, type, web fonts
```

---

## 12. How to run

On the Windows PC, from the repo root:

```bash
npx expo start --lan
```

- **Phone:** install Expo Go, join the same Wi‑Fi, scan the QR.
- **Browser:** open the local Metro URL (often `http://localhost:8081` or `8082`) to check layout. Face enroll on web needs camera permission and `/models` served from `public/`.

Useful checks:

```bash
npx tsc --noEmit
npx expo-doctor
npx expo install --fix
```

Adding a native module: use `npx expo install <package>` so the version matches SDK 57. Then Expo Go may no longer be enough — use a development build.

Shipping an iPhone binary later: EAS Build (`npx eas-cli@latest build`). That is how a Windows-only developer gets an `.ipa` without Xcode on this machine.

---

## 13. What is done vs next

### Done

- Expo TypeScript app named Optix
- On-device parent face enroll + match + PIN
- Welcome, enroll, unlock, home shell
- Mobile-safe type and a phone-width layout
- Demo condition list and Tips placeholders

### Next (product order)

1. Guided **rear-camera + flash** capture (child in oval, quality checks).
2. Pupil / reflex geometry (photorefraction + Hirschberg).
3. Persist a scan history on device; plot simple trends on Home.
4. Gate Tips off those trends (outdoor dose, 20-20-20, see a doctor).
5. Working-distance assist (iris size or MediaPipe) so the photo is taken at a known range.
6. EAS iOS build when we leave Expo Go.

`InsideScreen` can be deleted once nothing imports it.

---

## 14. Decisions log

| Decision | Choice |
| --- | --- |
| Clinic vs parent | Parent consumer app |
| iPhone-only vs Expo | Expo now, iPhone as the pitch device later |
| Lock | Parent embedding + PIN, not OS Face ID |
| Screening model | Classical measurements, not a CNN |
| Data | On-device AsyncStorage only |
| Navigation | Status gate in `App.tsx` until Expo Router is worth the move |
| Safe area | Status bar padding, not a missing `expo-safe-area-context` package |

---

## 15. Glossary

| Term | Meaning here |
| --- | --- |
| **Descriptor / embedding** | 128 numbers that represent one face still |
| **Photorefraction** | Infer refractive error from the crescent in a flashed pupil |
| **Hirschberg** | Infer alignment from where the flash sits in the pupil |
| **Photoscreener** | Clinic camera that does the above; Optix’s photo is the consumer analogue |
| **Trend** | Change across scans, not a one-shot label |
| **Tips** | Advice that appears only when a measurement says it should |
