# Building FitVerse Elite Mobile (`fve-mobile`): From Scratch to Production

> **A Complete Engineering Guide & Product Blueprint**
> 
> *How FitVerse Elite was translated from a desktop web dashboard into a high-performance, native mobile command center for gym owners — covering architecture, domain workflows, hardware integrations, build pipelines, and business value.*

---

## 1. Executive Summary & Product Vision

### 1.1 The Genesis of `fve-mobile`
FitVerse Elite (FVE) originally existed as a desktop and tablet React web application (`fitverse-elite-fve`). While powerful for front-desk administrative work, gym owners and managers are rarely glued to a desktop computer. They walk the gym floor, train clients, travel between branches, inspect equipment, and handle member queries on the move.

The objective of **`fve-mobile`** was not to create a stripped-down companion or a generic web wrapper, but to engineer a **first-class, native mobile platform** (iOS & Android) that acts as the gym owner's **pocket command center**. 

### 1.2 Core Product Philosophy
> **"Same FVE Product. Same Customer. Same Account. Same Database. Different Device."**

- **Zero Data Desynchronization**: Seamless, real-time shared Supabase PostgreSQL backend with web. Any action taken on mobile (recording payment, checking in a member, changing a plan) reflects instantly on web and vice versa.
- **Mobile-First UX Transformation**: Desktop sidebars transformed into thumb-friendly bottom tabs with haptic springs; complex multi-column tables transformed into swipeable interactive cards; desktop modals adapted to native bottom sheets; and hardware cameras turned into high-speed QR barcode scanners.
- **Luxury Aesthetic Continuity**: Preserved FitVerse Elite's brand identity — Obsidian Black (`#050505`), Polished Gold (`#EFA100`), Electric Blue (`#0066FF`), and athletic typography (`Rajdhani`, `Orbitron`, `Inter`).

---

## 2. What This App Solves for Gym Owners

Operating a fitness center is demanding. Gym owners face revenue leakages, high membership churn, front-desk chaos during peak hours, and awkward payment follow-ups. `fve-mobile` solves these specific operational pain points:

| Gym Owner Problem | How `fve-mobile` Solves It | Technical Implementation |
|---|---|---|
| **Desk Confinement** | Gym owners can manage the entire gym from anywhere — whether standing on the gym floor, commuting, or at home. | Cloud-synced React Native architecture with offline caching via TanStack Query. |
| **Check-in Congestion & Unauthorized Entry** | Peak hours (6:00–9:00 AM & 6:00–9:00 PM) create check-in queues. Expired or un-renewed members sneak in unnoticed. | Real-time **Camera QR Scanner** with sub-second validation, audio chimes, visual feedback, duplicate prevention, and strict visit-day limit checks. |
| **Membership Churn & Lost Renewals** | Gyms lose 20–30% of their revenue simply because staff forget to notify members before their plans expire. | **Automated 7-Day Renewal Radar** + **1-Tap WhatsApp Engine**: Queues personalized messages with payment links directly on the owner's phone. |
| **Reception Desk Financial Privacy** | When staff or owners view dashboard revenue at the counter, members or visitors standing nearby can view confidential earnings. | **One-Tap Confidentiality Mask (Eye Toggle)**: Instantly blurs/hides daily and monthly collections with masked bullets (`••••••`). |
| **Payment Friction & Cash Leakage** | Members forget their wallets, or cash payments get pocketed without a receipt. | **Dynamic Point-of-Sale UPI QR**: Instantly generates an NPCI-compliant UPI QR code on the phone screen for the exact fee amount; automatically generates GST/thermal receipts. |
| **No Marketing or Design Budget** | Owners struggle to make professional posters for festival discounts or member transformations. | **Brand Studio & Client Manager**: In-app poster generator that auto-injects the gym's logo, colors, and phone number onto promotional creatives. |
| **Member Retention & Absenteeism** | Members who stop coming for 7+ days are 80% more likely to cancel their subscriptions. | **Absentee Follow-Up Engine**: Detects members absent for 3, 7, or 14+ days and generates warm, encouraging WhatsApp check-in messages. |
| **Personal Training (PT) Disorganization** | PT sessions tracked on paper ledgers cause disputes over remaining sessions. | **PT Tracking Module**: Tracks client trainer assignments, session counters, remaining package limits, and renewal dates. |
| **Staff Delegation Without Risk** | Owners want staff to scan attendance without seeing confidential revenue numbers. | **Granular Role-Based Access Control (RBAC)**: Supports `OWNER`, `ADMIN`, `RECEPTIONIST`, `TRAINER`, and `ATTENDANCE_SCANNER` roles. |

---

## 3. Technology Stack & Technical Architecture

```
                    ┌──────────────────────────────────────────┐
                    │            fve-mobile App                │
                    │   React Native 0.86.3 + React 19.2.3     │
                    │         Expo SDK 57 (Prebuilt)           │
                    └─────────────────────┬────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
│ Native Hardware  │            │ Application Core │            │ Presentation     │
├──────────────────┤            ├──────────────────┤            ├──────────────────┤
│ • expo-camera    │            │ • React Nav 7    │            │ • Dark & Light   │
│ • expo-haptics   │            │ • TanStack Query │            │   Design System  │
│ • expo-audio     │            │ • AuthContext    │            │ • Rajdhani &     │
│ • expo-print     │            │ • ThemeContext   │            │   Orbitron Fonts │
│ • expo-sharing   │            │ • BrandingContext│            │ • Safe Area View │
│ • expo-clipboard │            │ • DialogContext  │            │ • Custom Modals  │
└──────────────────┘            └─────────┬────────┘            └──────────────────┘
                                          │
                                          ▼
                        ┌──────────────────────────────────┐
                        │     Supabase PostgreSQL API      │
                        │  (Auth, RLS, Realtime & Storage) │
                        └──────────────────────────────────┘
```

### 3.1 Core Specifications
- **Framework**: Expo SDK 57 (Managed workflow with native prebuild directories `android/` and `ios/`).
- **Core Runtime**: React Native `0.86.3` with React `19.2.3` and **Hermes Bytecode Engine** enabled for sub-second startup times and low memory consumption.
- **Language**: Strict TypeScript (`tsconfig.json`) — strictly typed contracts, interfaces, and zero `any` usage.
- **Navigation**: React Navigation 7 (`@react-navigation/native-stack`, `@react-navigation/bottom-tabs`) featuring spring-animated tab icons, native stack transitions, and `expo-blur` acrylic glass tabs on iOS.
- **Data Fetching & Cache**: `@tanstack/react-query` v5 with intelligent query key hierarchies, optimistic cache updates, and background invalidation.
- **Storage & Session**: `@supabase/supabase-js` v2 paired with `@react-native-async-storage/async-storage` for encrypted-at-rest session persistence.
- **Hardware Integrations**:
  - `expo-camera` (`CameraView`) for real-time QR scanning.
  - `expo-haptics` for tactile micro-interactions (light selection, medium impact, error buzzer).
  - `expo-audio` for native custom audio chimes on check-in.
  - `expo-print` & `expo-sharing` for generating 58mm/80mm thermal receipts and PDF financial audits.
  - `react-native-qrcode-svg` for dynamic member ID cards and UPI counter QRs.

---

## 4. Directory & Codebase Organization

The mobile application is structured according to Clean Architecture principles:

```
fve-mobile/
├── android/                         # Native Android Gradle project (Release APK generation)
├── assets/                          # App icon, splash screen, adaptive icons, audio assets
├── scripts/
│   └── patch-swift6.js              # Postinstall patch for Xcode 16 / Swift 6 concurrency
├── src/
│   ├── api/
│   │   └── supabase.ts              # Initialized Supabase client with AsyncStorage storage provider
│   ├── components/
│   │   ├── common/                  # Atomic design system components
│   │   │   ├── FVEAvatar.tsx        # Profile image with fallback initials and role borders
│   │   │   ├── FVEBadge.tsx         # Status & role badges with glowing border accents
│   │   │   ├── FVEButton.tsx        # High-impact gold/blue/outline buttons with haptic feedback
│   │   │   ├── FVECard.tsx          # Card container with dark glass surface & borders
│   │   │   ├── FVEDialog.tsx        # Custom non-blocking alert/confirmation dialogs
│   │   │   ├── FVEHeader.tsx        # Top navigation header with back button and quick actions
│   │   │   ├── FVEInput.tsx         # Floating/labeled text input with keyboard awareness
│   │   │   ├── FVELogoLoader.tsx    # Branded gym loader with animated pulse
│   │   │   ├── FVEModal.tsx         # Unified bottom sheet / slide-over container
│   │   │   ├── FVEDatePickerModal   # Custom native date picker with IST normalization
│   │   │   ├── M3Switch.tsx         # Material 3 toggle switch
│   │   │   └── ScreenContainer.tsx  # Safe area container preventing layout notch clipping
│   │   └── features/                # Complex domain feature modals
│   │       ├── AttendanceCalendarModal.tsx
│   │       ├── AttendanceFollowUpModal.tsx
│   │       ├── DailyPassFormModal.tsx
│   │       ├── DietPlanModal.tsx
│   │       ├── ExpenseFormModal.tsx
│   │       ├── MemberCard.tsx
│   │       ├── MemberFormModal.tsx
│   │       ├── PlanChangeModal.tsx
│   │       ├── PlanFormModal.tsx
│   │       ├── PaymentFormModal.tsx
│   │       ├── ProfilePhotoModal.tsx
│   │       ├── PTAssignmentModal.tsx
│   │       ├── PTSessionModal.tsx
│   │       ├── StaffFormModal.tsx
│   │       ├── UPIPaymentQRCard.tsx
│   │       ├── UPIQRCodeModal.tsx
│   │       ├── WhatsAppQueueModal.tsx
│   │       └── WorkoutPlanModal.tsx
│   ├── constants/
│   │   ├── colors.ts                # Obsidian Dark & Pearl Light color palette
│   │   ├── typography.ts            # Rajdhani, Orbitron, and Inter font scales
│   │   ├── permissions.ts           # Role-based capability matrices (RBAC)
│   │   └── branding.ts              # Gym branding defaults and links
│   ├── contexts/
│   │   ├── AuthContext.tsx          # Session state, staff impersonation, profile hydration
│   │   ├── ThemeContext.tsx         # Dark / Light / System theme provider
│   │   ├── BrandingContext.tsx      # Dynamic gym name, logo, GSTIN, UPI VPA
│   │   └── DialogContext.tsx        # App-wide modal dialog alerts
│   ├── hooks/
│   │   ├── useBirthdayAlerts.ts     # Daily background detector for member birthdays
│   │   ├── useMembershipSync.ts     # Automated status reconciliation (ACTIVE -> EXPIRED)
│   │   ├── useRenewalAlerts.ts      # 7-day expiration radar
│   │   └── useNotificationSoundListener.ts # Audio chime event bus
│   ├── navigation/
│   │   ├── AppTabs.tsx              # Bottom tab navigator with role gating and spring animations
│   │   ├── RootNavigator.tsx        # Stack navigator coordinating modal and full screens
│   │   └── types.ts                 # Type-safe route definitions & navigation prop types
│   ├── screens/                     # 20+ Domain screens grouped by feature
│   │   ├── attendance/              # AttendanceScreen, QRScannerScreen
│   │   ├── auth/                    # LoginScreen
│   │   ├── daily-pass/              # DailyPassScreen
│   │   ├── dashboard/               # DashboardScreen
│   │   ├── expenses/                # ExpensesScreen
│   │   ├── members/                 # MembersScreen, MemberDetailScreen
│   │   ├── notifications/           # NotificationsScreen, RenewalBatchScreen, FestivalCalendarScreen
│   │   ├── payments/                # PaymentsScreen, PaymentReceiptScreen, PaymentQRScreen
│   │   ├── plans/                   # MembershipPlansScreen, PlanDistributionScreen
│   │   ├── pt/                      # PersonalTrainingScreen
│   │   ├── reports/                 # ReportsScreen
│   │   ├── settings/                # SettingsScreen, BrandStudioScreen
│   │   └── staff/                   # StaffScreen
│   ├── types/
│   │   └── index.ts                 # Shared entity types (Member, Membership, Payment, etc.)
│   └── utils/
│       ├── date.ts                  # IST timezone engine (`YYYY-MM-DD`, `en-IN`)
│       ├── format.ts                # INR currency (`₹`), phone numbers, text truncations
│       ├── haptics.ts               # Custom haptic patterns via expo-haptics
│       ├── sounds.ts                # Audio player for check-in and alert chimes
│       ├── receiptPdf.ts            # 58mm/80mm thermal receipt HTML-to-PDF generator
│       ├── memberPdf.ts             # Member profile dossier PDF export
│       ├── expensePdf.ts            # Monthly expense statement PDF export
│       ├── reportPdf.ts             # Comprehensive gym business audit PDF
│       ├── renewalMessaging.ts      # WhatsApp dynamic message templates with tags
│       ├── attendanceMessaging.ts   # Absentee re-engagement message templates
│       ├── visitLimit.ts            # Visit-day check and quota decrementation
│       └── whatsAppPdfShare.ts      # Direct file sharing to WhatsApp
├── app.json                         # Expo configuration (permissions, scheme, splash)
└── package.json
```

---

## 5. End-to-End Feature Implementation Walkthrough

### 5.1 Authentication & Role-Based Access Control (RBAC)
- **`LoginScreen.tsx`**: High-security login with animated gym branding, floating password visibility toggle, validation, and auto-session recovery.
- **`AuthContext.tsx`**: Listens to Supabase Auth state changes. Upon login, hydrates the associated `user_profiles` record to determine the user's role:
  - `OWNER`: Full access across all financials, settings, staff, plans, and deletion.
  - `ADMIN`: Full operational access except master gym billing credentials.
  - `RECEPTIONIST`: Members, attendance check-ins, payments recording, daily passes; restricted from deleting records or altering system settings.
  - `TRAINER`: Assigned PT clients, attendance scanner, workout and diet assignment; restricted from gym revenues.
  - `ATTENDANCE_SCANNER`: Dedicated kiosk mode locked strictly to camera QR check-ins.
- **Staff Impersonation Mode**: Allows gym owners to switch to a staff member's view without logging out, verifying what front-desk employees can see.

### 5.2 The Owner's Pocket Dashboard (`DashboardScreen.tsx`)
- **Key Performance Indicators (KPIs)**:
  - Active Members vs Total Registered.
  - Today's Live Attendance counter.
  - Current Month Revenue (calculated dynamically from `payments`).
  - Expiring Members count (plans ending within 7 days).
  - New Joiners this month.
- **Confidentiality Revenue Toggle**: A tap on the eye icon immediately replaces all financial figures with `••••••`, allowing gym owners to use the app in public or at the reception desk without exposing turnover.
- **Quick Action Grid**: 1-tap shortcuts to *Add Member*, *Record Payment*, *Scan QR*, *Issue Daily Pass*, *Generate UPI QR*, and *Batch Renewals*.
- **Expiring Soon Radar**: Previews the closest expiring members with direct WhatsApp nudge buttons.
- **Members on Hold**: Highlights frozen memberships with remaining duration.
- **Live Activity Feed**: Displays the latest transactions with member photos, amounts, and receipt links.

### 5.3 360° Member Management (`MembersScreen.tsx` & `MemberDetailScreen.tsx`)
- **Search & Filter Matrix**: Instantly searches across hundreds of members by Name, Mobile Number, or Member ID. Tab filters for `ALL`, `ACTIVE`, `EXPIRING SOON`, `EXPIRED`, and `ON HOLD`.
- **Member Detail Command Center**:
  - **Identity Header**: Photo zoom viewer (`ProfilePhotoModal.tsx`), status badge, membership countdown, direct phone call and WhatsApp buttons.
  - **Digital Gym ID Card**: Generates a high-contrast QR code (`react-native-qrcode-svg`) carrying the member's unique UUID. Members can screenshot this card to scan at the entrance.
  - **Active Membership Details**: Tracks start date, expiry date, days remaining, and visit limit counters (`visit_days_used / visit_day_limit`).
  - **Plan Modifications (`PlanChangeModal.tsx`)**: Allows owners to Upgrade, Downgrade, Renew, or put memberships on Freeze/Hold with custom resume dates.
  - **Diet & Nutrition Builder (`DietPlanModal.tsx`)**: Build custom morning, afternoon, evening, and post-workout nutritional plans with macro targets.
  - **Workout Routine Manager (`WorkoutPlanModal.tsx`, `WorkoutActivityModal.tsx`)**: Assign split workouts (Push/Pull/Legs, Upper/Lower, Cardio) with exercise reps and sets.
  - **Financial Ledger**: Complete history of all payments made by the member, with 1-tap receipt generation.
  - **Attendance Calendar**: Visual calendar showing every day the member visited the gym.
  - **PDF Member Dossier (`memberPdf.ts`)**: Exports a complete medical, membership, and attendance report into a branded PDF.

### 5.4 High-Speed QR Scanner & Attendance Engine (`AttendanceScreen.tsx`, `QRScannerScreen.tsx`)
- **Real-Time Camera Scan**: Powered by `expo-camera` (`CameraView`) with custom laser animations and scanning bounds.
- **Sub-Second Validation Pipeline**:
  1. Camera reads QR code string (`member_id` or unique token).
  2. Software debouncer prevents duplicate scans within 3 seconds.
  3. Checks local date in Indian Standard Time (`YYYY-MM-DD`).
  4. Queries Supabase: Checks if member already checked in today (`unique(member_id, date)` constraint).
  5. Validates membership status (`ACTIVE`, `EXPIRING_SOON`, `EXPIRED`, `HOLD`).
  6. Evaluates Visit Day Limits: If plan has limit, checks `visit_days_used < visit_day_limit` and increments counter.
- **Multi-Sensory Feedback**:
  - **Valid Check-In**: High-pitched victory chime (`sounds.checkinSuccess()`) + Success vibration haptic + Green confirmation modal showing member photo and days remaining.
  - **Already Checked-In**: Double alert chime (`sounds.checkinAlready()`) + Warning vibration + Yellow warning modal displaying the exact time they checked in earlier today.
  - **Expired / Hold / Invalid**: Low buzzer (`sounds.qrInvalid()`) + Heavy error haptic + Red rejection banner indicating the membership is inactive.
- **Absentee Engagement (`AttendanceFollowUpModal.tsx`)**:
  - Detects members inactive for 3+, 7+, or 14+ days.
  - Generates warm WhatsApp re-engagement messages ("Hey Rahul! We noticed you haven't been to FitVerse in 5 days. Is everything okay?").

### 5.5 Payments, Invoicing & Thermal Receipts (`PaymentsScreen.tsx`, `PaymentReceiptScreen.tsx`)
- **Record Payment Modal (`PaymentFormModal.tsx`)**:
  - Member selector with instant balance lookup.
  - Plan assignment or miscellaneous fee (Supplements, Locker, Personal Training).
  - Payment modes: `CASH`, `UPI`, `CARD`, `NETBANKING`.
  - Discount engine and GST calculation.
- **Thermal POS & Digital Tax Invoices**:
  - Generates clean tax invoices with Gym Branding, GSTIN, Receipt Number, Member Details, Line Items, and Authorized Signature.
  - Supports 58mm & 80mm thermal receipt formats for Bluetooth/Wi-Fi receipt printers.
  - **1-Tap WhatsApp PDF Share**: Automatically converts the invoice to PDF and opens WhatsApp with the member's chat and receipt attached.

### 5.6 Point-of-Sale Counter UPI QR (`PaymentQRScreen.tsx`)
- **Dynamic Mode**: Gym owner enters fee amount (e.g. `₹2,500`) and member name. The app immediately encodes an NPCI-compliant UPI payment URI (`upi://pay?pa=gym@upi&pn=FitVerse&am=2500&cu=INR`) into a high-resolution QR code on the phone screen. The member scans with Google Pay, PhonePe, or Paytm — eliminating typing errors and payment discrepancies.
- **Static Counter QR**: Displays gym's permanent counter QR code with gym branding and accepted UPI partner badges.

### 5.7 Membership Plans & Analytics (`MembershipPlansScreen.tsx`, `PlanDistributionScreen.tsx`)
- **Custom Plan Creation**: Configure duration in months/days, pricing, admission fee, and optional visit-day caps (e.g., "12 Sessions Pass" vs "Unlimited Annual Gold").
- **Plan Distribution Analytics**: Visual distribution of member enrollment across tiers (Annual vs Half-Yearly vs Monthly), helping owners understand which packages drive recurring revenue.

### 5.8 Personal Training Management (`PersonalTrainingScreen.tsx`)
- Manage 1-on-1 PT coaching programs.
- Assign dedicated trainers to members.
- Package session tracking (e.g., 20 sessions purchased, 14 used, 6 remaining).
- Log sessions completed after workouts with trainer notes.

### 5.9 Daily Pass & Walk-In Visitor Capture (`DailyPassScreen.tsx`)
- Capture walk-in prospects trying out the gym for a day.
- Collect visitor name, phone, emergency contact, and trial fee.
- **1-Tap Conversion**: When a trial visitor decides to join as a full member, one button converts their visitor record into a permanent member profile without re-typing their details.

### 5.10 Operational Expense Tracking (`ExpensesScreen.tsx`)
- Complete gym expense bookkeeping categorized by:
  - `Rent`
  - `Staff Salaries`
  - `Electricity & Utilities`
  - `Equipment Maintenance`
  - `Supplements & Inventory`
  - `Marketing & Ads`
  - `Cleaning & Sanitation`
- Calculates **Net Operational Profit** (`Revenue - Expenses = Profit`) for full cashflow visibility.
- Export Monthly Expense Statements to PDF (`expensePdf.ts`).

### 5.11 Business Analytics & Reports (`ReportsScreen.tsx`)
- Revenue Growth Curves: Compare month-over-month income.
- Membership Retention vs Churn rates.
- Attendance Peak Hours analysis (identifies busiest gym hours to optimize staff scheduling).
- Comprehensive Executive Gym Report export to PDF (`reportPdf.ts`).

### 5.12 Automated Renewals & WhatsApp Batch Engine (`RenewalBatchScreen.tsx`)
- **7-Day Radar**: Gathers all memberships expiring today, tomorrow, or in the next 7 days.
- **Batch Processing**: Queues personalized WhatsApp messages with dynamic tags:
  - `{member_name}` -> "Tarun"
  - `{plan_name}` -> "12 Month Elite"
  - `{expiry_date}` -> "30 Oct 2026"
  - `{gym_name}` -> "FitVerse Elite"
  - `{upi_id}` -> "fitverse@icici"
- Tracks contact status (`useRenewalMessagingStatus`) so staff never double-message the same member on the same day.

### 5.13 Community Retention: Birthday Alerts & Festival Calendar
- **`useBirthdayAlerts.ts`**: Automatically checks member birth dates on app launch and notifies the owner with a 1-tap birthday greeting card to send to the member.
- **`FestivalCalendarScreen.tsx`**: Pre-scheduled calendar of Indian festivals and gym holidays (Diwali, Eid, New Year, Independence Day) with pre-crafted holiday greeting and promotional discount flyers.

### 5.14 Brand Studio & Social Media Generator (`BrandStudioScreen.tsx`)
- Allows gym owners to generate high-resolution marketing flyers directly inside the app:
  - *Transformation Tuesday* spotlight.
  - *Seasonal Discount Offer* (e.g. "Diwali Fitness Bonanza - 30% Off").
  - *Motivational Quote of the Day*.
- Injects the gym's official logo, brand colors, phone number, and address automatically.
- Direct share to Instagram Stories, WhatsApp Status, and Facebook.

### 5.15 Staff Management & Security (`StaffScreen.tsx`)
- Staff directory with assigned operational roles (`ADMIN`, `RECEPTIONIST`, `TRAINER`, `ATTENDANCE_SCANNER`).
- Manage staff contact details, salary records, and login permissions.

### 5.16 Multi-Theme & Native Hardware Diagnostics (`SettingsScreen.tsx`)
- **Obsidian Dark Theme** (`#050505`) and **Pearl Light Theme** (`#FAF8F5`).
- **Hardware Diagnostic Suite**: Built-in test buttons that trigger native audio chimes and vibration haptics on demand, ensuring device speakers and motors work properly.

---

## 6. Data Integrity & Business Logic Standards

### 6.1 Indian Standard Time (IST) Date Standard
In gym management, timezones can cause severe bugs. If an application records dates using UTC (`toISOString().split('T')[0]`), a member checking in at 11:30 PM in India (`UTC+5:30`) gets saved under the *next day's UTC date*. This causes attendance check-ins to fail, duplicate entries to corrupt database records, and memberships to expire hours early.

**The Golden Standard Implemented in `src/utils/date.ts`**:
```typescript
export function getLocalDateStr(d: Date = new Date()): string {
  // Always forces Asia/Kolkata timezone representation YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}
```
*Rule: Never use `toISOString()` for business date records in `fve-mobile`.*

### 6.2 Attendance Idempotency & Unique Constraints
The Supabase PostgreSQL database enforces a compound unique constraint:
```sql
UNIQUE (member_id, date)
```
Attendance check-ins use `upsert` with duplicate detection. If a member scans twice, the mobile application catches the conflict gracefully and displays the exact time of the earlier check-in.

### 6.3 Visit Day Limit Enforcement
For flexible passes (e.g., 10 visits/month), the database tracks `visit_day_limit` and `visit_days_used`. The check-in pipeline verifies:
```typescript
if (membership.visit_day_limit && membership.visit_days_used >= membership.visit_day_limit) {
  // Reject check-in: quota exhausted
  sounds.qrInvalid();
  haptics.error();
  return { success: false, reason: 'VISIT_LIMIT_REACHED' };
}
```

---

## 7. Step-by-Step Build & Production Engineering

Building `fve-mobile` from an empty directory to a signed production Android APK involved several rigorous engineering milestones:

```
[Phase 1] Web Inspection ➔ [Phase 2] Expo 57 Prebuild ➔ [Phase 3] Design Tokens
       │
[Phase 4] React Navigation ➔ [Phase 5] Supabase + Auth ➔ [Phase 6] Feature Modules
       │
[Phase 7] Camera & Hardware ➔ [Phase 8] Swift 6 Patches ➔ [Phase 9] Release APK
```

### 7.1 Phase 1: Deep Web Application Inspection
Inspected the existing `fitverse-elite-fve` web repository. Cataloged all 25+ database tables, RLS policies, color palettes, and business rules to guarantee 100% parity before writing mobile code.

### 7.2 Phase 2: Native Project Initialization
Initialized a clean React Native application with Expo SDK 57:
```bash
npx create-expo-app@latest fve-mobile --template blank-typescript
```
Prebuilt the native folders (`android/` and `ios/`) to enable direct native module compilation and custom Gradle configurations.

### 7.3 Phase 3: Tokenizing the FVE Design System
Extracted core colors, fonts, and dimensions into `@/constants/theme.ts`:
- Fonts loaded asynchronously via `@expo-google-fonts/rajdhani`, `@expo-google-fonts/orbitron`, and `@expo-google-fonts/inter`.
- Centralized elevation styles and dark glassmorphic styling tokens.

### 7.4 Phase 4: State & Navigation Infrastructure
Configured React Navigation 7 with typed parameter lists:
- `RootStackParamList` in `src/navigation/types.ts`.
- `MainTabParamList` with animated pill indicators and safe-area insets.
- TanStack Query client with a default 5-minute stale-time and smart garbage collection.

### 7.5 Phase 5: Domain Screens & Feature Modals Implementation
Built all 20+ screens and 25+ feature modals cleanly separating presentation from business logic. Every form includes input validation, numeric parsing, date normalization, and error handling.

### 7.6 Phase 6: Hardware & Native Integrations
Integrated `expo-camera`, `expo-haptics`, `expo-audio`, `expo-print`, and `expo-sharing`. Implemented audio feedback using preloaded chimes.

### 7.7 Phase 7: Swift 6 Concurrency Patching (`scripts/patch-swift6.js`)
When compiling native code on macOS with Xcode 16, Swift 6 introduces strict concurrency checks that cause third-party Expo modules (`expo-modules-core`, `expo-modules-jsi`) to throw compilation errors (`weak let` declarations, actor-isolated pointer captures).

We created a custom post-install Node script (`scripts/patch-swift6.js`) that automatically:
1. Replaces deprecated `weak let` with `weak var`.
2. Adds `nonisolated(unsafe)` annotations to mutable pointers across actor boundaries.
3. Strips invalid `SWIFT_RETURNS_RETAINED` attributes from C++ headers.
4. Hooked into `npm install` via `"postinstall": "node scripts/patch-swift6.js"`.

### 7.8 Phase 8: Standalone Android Release APK Compilation
Debug APKs require a live Metro development server. For gym owners to run the app on standalone Android phones and tablets, the JavaScript bundle must be pre-compiled into **Hermes Bytecode** and bundled directly inside the APK.

We configured the native Gradle release pipeline:
```bash
cd fve-mobile
npm run build:apk
# Runs: cd android && ./gradlew assembleRelease
```
- **Output Artifact**: `android/app/build/outputs/apk/release/app-release.apk`
- **Verification**: Verified offline bundle inclusion via:
  ```bash
  unzip -l android/app/build/outputs/apk/release/app-release.apk | grep "index.android.bundle"
  ```
  *Result: `assets/index.android.bundle` is embedded directly into the standalone binary.*

---

## 8. Summary of Completed Features

| Module | Features Included |
|---|---|
| **Authentication & RBAC** | Supabase Auth, persistent session, role-based screen gating (`OWNER`, `ADMIN`, `RECEPTIONIST`, `TRAINER`, `ATTENDANCE_SCANNER`), Staff Mode impersonation. |
| **Owner Dashboard** | Active members, attendance counter, monthly collection, expiring radar, confidential revenue mask (eye toggle), live transaction feed, time-based dynamic greeting. |
| **Member Management** | Member directory, instant search, status filters, 360° member profile, digital QR ID card, photo zoom viewer, plan upgrade/freeze/cancel, diet plan manager, workout routine assigner, dossier PDF export. |
| **Attendance & Check-in** | Camera QR barcode scanner, sub-second validation, duplicate prevention, visit-day limit checks, audio chimes, vibration haptics, manual check-in search, absentee re-engagement messaging. |
| **Billing & Payments** | Record payment, cash/UPI/card modes, GST calculation, discount engine, digital tax invoice, 58mm/80mm thermal receipt mode, instant WhatsApp PDF sharing. |
| **Point-of-Sale UPI QR** | Dynamic counter QR generation (custom fee amount encoded), static gym counter QR display, UPI partner badges, share sheet integration. |
| **Membership Plans** | Custom plan creation (duration, pricing, admission fee, visit limits), plan distribution analytics. |
| **Personal Training (PT)** | 1-on-1 coaching management, trainer assignments, package session tracking, session decrementing, PT payment records. |
| **Daily Pass** | Walk-in visitor capture, trial fee collection, 1-tap conversion to full member. |
| **Gym Expenses** | Categorized expense tracking (rent, salaries, maintenance, utilities), net profit calculation, expense statement PDF export. |
| **Reports & Analytics** | Revenue growth curves, member retention/churn metrics, peak hours velocity, executive gym report PDF export. |
| **Automated Renewals** | 7-day expiration radar, 1-tap WhatsApp renewal queue, dynamic message templates, contact status tracker. |
| **Community Engagement** | Automated member birthday alerts, festival and gym holiday calendar with promotional flyers. |
| **Brand Studio** | In-app marketing flyer generator, transformation cards, motivational posters, gym branding auto-injection, social media share. |
| **Staff Directory** | Staff directory, role assignments, salary tracking, access permissions. |
| **Settings & Diagnostics** | Obsidian Dark and Pearl Light modes, audio and haptic diagnostics suite, password updates, gym branding customization. |

---

## 9. Verification & Definition of Done Checklist

Every requirement of production-grade engineering has been fulfilled:

- [x] **Standalone Binary**: `app-release.apk` compiles cleanly and executes without any local Metro bundler connection.
- [x] **Zero TypeScript Errors**: Passes `npm run typecheck` (`tsc --noEmit`) with strict typing across all files.
- [x] **Database Parity**: Uses existing Supabase tables and RLS policies without altering the web app's data structures.
- [x] **Timezone Compliance**: Indian Standard Time (`YYYY-MM-DD`, `en-IN`) enforced on all date and timestamp operations.
- [x] **Responsive & Safe**: All screens wrapped in `SafeAreaView` / `useSafeAreaInsets` to eliminate notch and navigation bar clipping.
- [x] **Offline Stability**: TanStack Query caches all queried lists for instant render during spotty gym network connections.
- [x] **Haptic & Audio Quality**: Validated multi-sensory feedback on real hardware devices.

---

## 10. Conclusion

**`fve-mobile`** transforms FitVerse Elite from a desktop tool into an **indispensable mobile operating system for fitness clubs**. By pairing rock-solid backend data synchronization with native mobile capabilities — camera scanning, instant WhatsApp bridges, thermal receipt printing, confidential privacy toggles, and dynamic UPI generation — gym owners gain total freedom from the front desk while elevating member retention and eliminating revenue leakage.
