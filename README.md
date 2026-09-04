# FitVerse Elite (FVE) Mobile App

> **Discipline • Strength • Transformation**  
> Luxury Gym Management System built with React Native, Expo SDK 57, and Supabase.

---

## 📌 Overview

**FitVerse Elite Mobile** is the native companion application for the FitVerse Elite SaaS gym management ecosystem. Designed with a luxury dark-gold aesthetic, strict native mobile standards, fluid gestures, and instant real-time Supabase integration, it provides gym owners, administrators, and staff with full operational control on both iOS and Android.

---

## ⚡ Core Features

### 🏋️ Member Management
- **Member Directory & Search**: Real-time multi-field search (by Full Name, Member ID, or Mobile).
- **Comprehensive Profiles**: View active plans, expiry dates, attendance history, and payment records.
- **Member Registration & Editing**: Full member onboarding with Date of Birth, Emergency Contact, and Profile Photo uploads.
- **Workout Plan Assignment**: Custom exercise routines with sets, reps, and day scheduling.

### 💳 Payments & Receipt Management
- **Payment Invoicing**: Record subscription payments with Cash, UPI, Card, and Bank Transfer modes.
- **Branded PDF Receipts**: On-device generation of high-resolution PDF receipts featuring the official gym logo, QR verification codes, and validity breakdowns.
- **Unified 1-Tap WhatsApp Sharing**: Share official PDF receipts directly to member WhatsApp chats, or copy pre-formatted receipt breakdowns with one tap.
- **Native AirPrint & File Saving**: Print receipts or export to device storage.

### 📅 Attendance & QR Check-In
- **Real-Time Attendance**: One-tap Check-In and Check-Out with live duration tracking.
- **QR Code Scanner**: Fullscreen camera scanner for instant member check-in.
- **Monthly Attendance Calendar**: Interactive visual calendar modal displaying historical attendance days.

### 📊 Analytics & Reporting
- **Revenue Overview**: Today, Weekly, Monthly, and Yearly revenue reporting with expense tracking.
- **Membership Health**: Active, Expiring Soon (within 7 days), and Expired counts with quick renewals.
- **Popular Plans Ranking**: Visual ranking of most subscribed gym plans.

### 🔔 Birthday & Status Notifications
- **Automated Birthday Alerts**: Notifies admins and owners on member birthdays with member name and ID.
- **Subscription Expiry Alerts**: Real-time alerts for impending membership renewals.

### 🎨 Mobile Native UX & Design Standards
- **Luxury Theme**: Curated dark palette (`#050505`, `#0F1216`) with metallic gold accents (`#EFA100`).
- **Typography**: Google Fonts pairing (**Orbitron**, **Rajdhani**, and **Inter**).
- **Micro-Interactions**: Haptic feedback on all actions, spring tab bar button physics, and Android Material ink ripples (`android_ripple`).
- **Gestures**: Drag-down-to-dismiss interactive sheet modals (`PanResponder`).
- **Form Focus Coordination**: Global input focus coordinator ensuring clean, single-field focus states.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [React Native 0.86.3](https://reactnative.dev/) with [Expo SDK 57](https://expo.dev/) |
| **Language** | [TypeScript 5+](https://www.typescriptlang.org/) (Strict Mode) |
| **Backend / DB** | [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage, PostgREST) |
| **Data Fetching** | [TanStack React Query v5](https://tanstack.com/query) |
| **Navigation** | [React Navigation v7](https://reactnavigation.org/) (Native Stack + Bottom Tabs) |
| **Document Engine**| [Expo Print](https://docs.expo.dev/versions/latest/sdk/print/) & [Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/) |
| **Icons** | [Lucide React Native](https://lucide.dev/) |
| **Fonts** | `@expo-google-fonts/orbitron`, `rajdhani`, `inter` |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: Version `22.x` recommended (minimum `>=20.x`).
- **NVM**: (Optional, `.nvmrc` configured for `22.16.0`).
- **Expo Go App**: Installed on your iOS or Android physical device, or Xcode/Android Studio simulator.

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/TarunSaie/FVE-Hybrid.git
cd FVE-Hybrid
npm install
```

### 2. Configure Environment Variables

Create an `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Run the Development Server

Start the Metro development server:

```bash
npm start
```

- Press `a` to launch on connected **Android device / emulator**.
- Press `i` to launch on **iOS simulator**.
- Scan the printed QR code with **Expo Go** (Android) or the **Camera app** (iOS).

---

## 🧪 Verification & Typecheck

Run static type checking:

```bash
npm run typecheck
```

Export and bundle dry-run (Hermes bytecode test):

```bash
npx expo export --platform android
npx expo export --platform ios
```

---

## 📁 Project Structure

```
fve-mobile/
├── assets/                  # Brand logos, icons, and generated assets
├── src/
│   ├── api/                 # Supabase client configuration
│   ├── components/
│   │   ├── common/          # Reusable UI (FVEButton, FVEInput, FVEModal, FVEHeader, etc.)
│   │   ├── features/        # Modals & cards (MemberCard, AttendanceModal, WorkoutModal, etc.)
│   │   └── layout/          # Navigation drawer modal
│   ├── constants/           # Colors, typography, permissions, branding, logoBase64
│   ├── contexts/            # Authentication context provider
│   ├── navigation/          # React Navigation stacks, bottom tabs, route types
│   ├── screens/             # Screen views grouped by module
│   │   ├── attendance/      # Attendance & QR scanner screens
│   │   ├── auth/            # Login screen
│   │   ├── dashboard/       # Metric overview screen
│   │   ├── expenses/        # Expense tracking screen
│   │   ├── members/         # Member list & detailed profile views
│   │   ├── notifications/   # Alerts & birthday reminders
│   │   ├── payments/        # Payment listing & branded receipt screen
│   │   ├── plans/           # Membership plan screens
│   │   ├── reports/         # Financial & member health reports
│   │   ├── settings/        # App configuration & profile settings
│   │   └── staff/           # Staff directory & role guards
│   ├── types/               # TypeScript data models and interfaces
│   └── utils/               # PDF builder, date formatting, haptics, helpers
├── app.json                 # Expo project manifest
├── package.json             # NPM dependencies & scripts
└── tsconfig.json            # Strict TypeScript configuration
```

---

## 📄 License & Credits

- **FitVerse Elite Gym Management System**
- **Powered by Chirvex** — [chirvex.in](https://chirvex.in/)
