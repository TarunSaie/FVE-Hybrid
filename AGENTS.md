# FitVerse Elite Mobile — Repository Guide

## Tech Stack & Architecture

- **Framework**: Expo SDK 57 (Managed with Native Prebuild / `android` and `ios` folders)
- **Runtime**: React Native 0.86.3, React 19.2.3, Hermes JS Engine enabled
- **Language**: Strict TypeScript (`tsconfig.json`)
- **Navigation**: React Navigation 7 (`@react-navigation/native-stack`, `@react-navigation/bottom-tabs`)
- **Backend / Storage**: `@supabase/supabase-js` with AsyncStorage session persistence
- **State & Data Fetching**: `@tanstack/react-query`
- **Styling**: Vanilla React Native `StyleSheet.create` following the FitVerse Elite Dark + Gold design system
- **Hardware & Native**: `expo-camera` (QR scanner), `expo-haptics`, `expo-sharing`, `expo-print` (receipts)

---

## Dev & Build Commands

| Command | Notes |
|---------|-------|
| `npm run start` | Start Expo Metro bundler server |
| `npm run android` | Run on connected Android device/emulator in debug mode |
| `npm run typecheck` | Run TypeScript type check (`tsc --noEmit`) |
| `npm run build:apk` | Run `./gradlew assembleRelease` to compile standalone signed Release APK |

---

## Directory Structure

```
fve-mobile/
├── android/                  # Native Android project with Gradle wrapper
│   └── app/build/outputs/apk/release/  # Generated release APKs
├── assets/                   # App icons, splash screens, foreground graphics
├── src/
│   ├── api/                  # Supabase query functions (members, attendance, payments, etc.)
│   ├── components/
│   │   ├── common/           # FVEButton, FVECard, FVEHeader, FVEInput, FVEDialog, etc.
│   │   └── features/         # Feature modals (MemberFormModal, PaymentModal, etc.)
│   ├── constants/            # Theme colors, fonts, layout constants
│   ├── contexts/             # AuthContext, DialogContext
│   ├── hooks/                # Custom React Query hooks & lifecycle hooks
│   ├── navigation/           # RootNavigator, AppTabs, types.ts
│   ├── screens/              # Screen components grouped by domain
│   ├── types/                # Domain models & TypeScript interfaces
│   └── utils/                # Date formatting (IST), Supabase client, WhatsApp links
├── app.json                  # Expo configuration (permissions, icons, splash)
└── package.json
```

---

## UI Conventions & Styling

- **Theme Palette** (`src/constants/theme.ts`):
  - Background: `#050505` (Deep Black)
  - Surface / Card: `#121212` / `#1A1A1A`
  - Border: `#262626`
  - Gold Accent: `#EFA100` (Primary action, active tab indicator, badges)
  - Blue Accent: `#0066FF`
  - Text Primary: `#FFFFFF`, Text Muted: `#A1A1AA`
- **Fonts**:
  - `Rajdhani-Bold` / `Rajdhani-SemiBold`: Stat values, headers, currency displays
  - `Orbitron-Bold`: Futuristic logo, brand badges
  - `Inter`: General body, labels, form input text
- **Layout Standards**:
  - Use `react-native-safe-area-context` (`useSafeAreaInsets`, `SafeAreaView`) to prevent clipping under status bar and navigation gestures.
  - Haptics: Trigger subtle feedback on key actions via `expo-haptics` (`selectionAsync`, `notificationAsync`).

---

## Data & Business Logic Conventions

1. **Dates**:
   Always use `getLocalDateStr()` from `src/utils/date.ts` for database date fields (`YYYY-MM-DD`). Never use UTC `toISOString()` which causes date misalignments in Indian Standard Time (IST).
2. **Attendance Check-ins**:
   The database enforces a unique constraint on `(member_id, date)`. Attendance check-ins must be deduplicated and handle existing check-ins gracefully.
3. **Visit-Day Limits**:
   When memberships have `visit_day_limit` specified, check that `visit_days_used < visit_day_limit` before permitting check-in.
4. **Offline JS Bundling**:
   Debug builds require Metro to be running. Production standalone builds must be built with `npm run build:apk` (`assembleRelease`) so `index.android.bundle` and assets are packaged directly into the APK.
