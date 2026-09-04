Antigravity Prompt — Convert FVE React Web App to React Native Mobile

You are working inside an existing codebase containing the FitVerse Elite (FVE) React web application.

Your task is to create a production-ready React Native mobile application named fve-mobile based on the existing FVE web application.

PRODUCT GOAL

The purpose of this project is to make FitVerse Elite customers happy by allowing them to use their FVE account and experience on any device.

The customer should feel that:

FVE Mobile is the mobile version of the exact same FitVerse Elite product — not a separate product.

The existing web application is the source of truth for functionality, branding, design system, terminology, user flows, and business logic.

Do not redesign the FVE product.

Adapt it intelligently for mobile.

PHASE 1 — INSPECT THE EXISTING PROJECT FIRST

Before modifying or creating anything, inspect the entire existing FVE web application.

Do not immediately start coding.

Analyze:

Project structure
package.json
React version
TypeScript configuration
Routing
Pages
Components
Hooks
Context/providers
State management
API/services
Authentication
Environment variables
Assets
Images
Logo
Icons
Fonts
CSS
Tailwind/theme configuration if present
Design tokens
Colors
Typography
Spacing
Border radius
Shadows
Animations
Forms
Modals
Tables
Charts
Dashboard
Profile
Settings
Notifications
Workout functionality
Nutrition functionality
Progress functionality
Any other customer-facing functionality

Search the repository rather than assuming how the application works.

Identify reusable business logic that can be shared or adapted.

PHASE 2 — CREATE AN IMPLEMENTATION PLAN

After inspecting the repository, create a concise implementation plan.

The plan must contain:

1. Web architecture

Explain:

Framework
Routing
State management
API architecture
Authentication
Important dependencies
2. Design system

Identify:

Primary colors
Secondary colors
Background colors
Surface colors
Text colors
Typography
Font weights
Spacing
Border radius
Shadows
Buttons
Inputs
Cards
Navigation
Other reusable UI patterns
3. Asset inventory

Identify:

FVE logo
App icons
Images
Illustrations
Fonts
Other important assets
4. Route inventory

Create a table:

Web Route | Purpose | Mobile Screen | Priority

5. API inventory

Identify:

Authentication endpoints
User endpoints
Workout endpoints
Nutrition endpoints
Progress endpoints
Profile endpoints
Settings endpoints
Notification endpoints
Other APIs
6. Mobile architecture

Propose:

fve-mobile/
  src/
    api/
    assets/
    components/
    hooks/
    navigation/
    screens/
    services/
    store/
    theme/
    types/
    utils/


Adapt this structure if the existing project suggests a better architecture.

IMPORTANT: DO NOT STOP AFTER THE PLAN

The plan is only the first step.

After producing the plan, start implementing the application.

Do not wait for another confirmation unless you encounter a genuinely blocking issue that cannot reasonably be resolved.

PHASE 3 — CREATE fve-mobile

Create a separate React Native application:

fve-mobile


Do not destroy or rewrite the existing web application.

The existing web application must continue working.

Use:

React Native
TypeScript
React Navigation
Appropriate production-ready libraries
Existing FVE APIs
Existing authentication system

Choose Expo or React Native CLI based on what is most appropriate for the existing project and required native functionality.

If there is no strong reason to require custom native modules, prefer a modern Expo-based architecture.

PHASE 4 — FVE DESIGN SYSTEM

This is one of the highest-priority requirements.

The mobile application MUST use the existing FVE visual identity.

Logo

Find the existing FVE logo in the repository.

Reuse the same logo.

Do NOT generate a new logo.

Colors

Extract the actual colors from the existing application.

Create centralized tokens:

colors
spacing
typography
radius
shadows


Example:

export const colors = {
  primary: "...",
  secondary: "...",
  background: "...",
  surface: "...",
  text: "...",
  mutedText: "...",
  border: "...",
  success: "...",
  warning: "...",
  error: "...",
};


Use the real FVE values rather than these placeholders.

Typography

Preserve:

Font family
Font sizes
Font weights
Heading hierarchy
Body text
Captions
Labels

If the web app uses custom fonts, determine whether those fonts can legally/technically be bundled into the mobile application and reuse them where appropriate.

Components

Create reusable mobile components based on the existing FVE components.

For example:

FVEButton
FVECard
FVEInput
FVEHeader
FVEAvatar
FVEBadge
FVEProgress
FVESection
FVEListItem
FVEIconButton
FVEEmptyState
FVEErrorState
FVESkeleton


Only create components that are actually needed.

PHASE 5 — MOBILE NAVIGATION

Inspect the existing web routes and design the appropriate mobile navigation.

Do not blindly copy the web sidebar.

If the web application has a sidebar, translate it into an appropriate mobile navigation pattern.

Use:

Bottom tabs where appropriate
Stack navigation
Nested navigation
Modal screens
Detail screens
Back navigation

The exact navigation structure must be derived from the actual FVE application.

Example only:

Home
Workouts
Nutrition
Progress
Profile


Do not use this example if it does not match the real FVE functionality.

PHASE 6 — AUTHENTICATION

Reuse the existing FVE authentication system.

Do not create fake authentication.

Implement:

Login
Registration if available
Logout
Session persistence
Token handling
Password reset if available
Authentication errors
Expired sessions
Loading states

Use secure mobile storage for authentication credentials/tokens where appropriate.

The customer should use the same FVE account on web and mobile.

PHASE 7 — API INTEGRATION

Reuse the existing backend.

Do not create a second backend.

Inspect the existing API implementation and reproduce the required mobile API calls.

Create a clean service layer.

For example:

src/api/
  client.ts
  auth.ts
  user.ts
  workouts.ts
  nutrition.ts
  progress.ts
  profile.ts
  notifications.ts


Adapt this structure to the actual FVE API.

Use proper TypeScript types.

Do not replace real API data with hardcoded mock data when the real API already exists.

PHASE 8 — CONVERT EVERY IMPORTANT SCREEN

Perform a complete web → mobile conversion.

For every important customer-facing route:

Understand what the web screen does.
Identify the data it requires.
Identify the API calls.
Identify its reusable components.
Convert the UX to mobile.
Preserve the FVE visual design.
Connect it to the real API.
Test the complete flow.

Create a mapping internally such as:

Web Page
    ↓
Mobile Screen
    ↓
Required Components
    ↓
Required API
    ↓
Navigation
    ↓
Loading/Error/Empty States


Do not leave major customer functionality unimplemented.

PHASE 9 — WEB UI → NATIVE UI

Do NOT simply copy HTML/CSS into React Native.

Translate the experience properly.

Desktop sidebar

→ Mobile tab/navigation

Desktop table

→ Mobile cards/list

Multi-column layout

→ Vertical mobile sections

Hover interactions

→ Touch interactions

Desktop modal

→ Mobile modal/bottom sheet where appropriate

Large dashboard

→ Scrollable mobile dashboard

Desktop form

→ Touch-friendly native form

Desktop charts

→ Responsive mobile charts

Maintain the same FVE design language.

PHASE 10 — MOBILE UX

The app must feel good on real phones.

Implement:

Safe areas
Keyboard avoidance
Correct status bar behavior
Touch-friendly controls
Scrollable content
Pull-to-refresh where appropriate
Loading indicators
Skeleton states
Empty states
Error states
Retry actions
Android back button
iOS back navigation
Appropriate modal behavior
Responsive layouts

Do not simply make the desktop UI smaller.

PHASE 11 — PERFORMANCE

Build the application with mobile performance in mind.

Pay attention to:

Large lists
Images
Charts
API calls
Re-renders
Navigation
Memory
Startup time

Use appropriate React Native patterns such as:

FlatList
SectionList
Memoization where useful
Pagination where supported
Image optimization
API caching where appropriate

Do not over-engineer.

PHASE 12 — ACCESSIBILITY

Implement:

Accessible labels
Screen reader support
Appropriate accessibility roles
Sufficient contrast
Touch target sizes
Dynamic text considerations
PHASE 13 — ERROR HANDLING

Every important API-driven screen should handle:

Loading
Success
Empty
Error
Retry


Do not allow uncaught API failures to produce broken screens.

Use the FVE design system for error and empty states.

PHASE 14 — DATA CONSISTENCY

This is critical.

The web and mobile applications must use the same customer data.

If a customer:

Updates profile on web
        ↓
Opens mobile
        ↓
Mobile shows updated profile


Similarly:

Customer completes workout on mobile
        ↓
Backend updates
        ↓
Web shows updated workout/progress


The backend remains the source of truth.

PHASE 15 — SECURITY

Do not expose:

API secrets
Private credentials
Server secrets
Sensitive configuration

Do not put server-only environment variables into the mobile bundle.

Review authentication/token handling carefully.

PHASE 16 — TESTING

After implementation, run the appropriate checks.

At minimum:

npm install
npm run lint
npm run typecheck
npm test


Use the actual scripts available in the project.

Build/run the application on Android and iOS where the environment permits.

Fix errors rather than ignoring them.

PHASE 17 — VISUAL QA

Compare the mobile application against the existing web application.

Check:

Branding
Logo
Colors
Fonts
Icons
Theme
UI
Buttons
Cards
Inputs
Headers
Navigation
Spacing
Typography
Functionality
Authentication
Navigation
API
Forms
Data loading
Updates
Error states
Mobile behavior
Small phones
Large phones
Android
iOS
Keyboard
Safe areas
Back navigation
DO NOT DO THESE THINGS

Do NOT:

Create a new brand.
Create a different theme.
Generate a different logo.
Rewrite the web application.
Break existing web functionality.
Create a fake backend.
Replace working APIs with mock data.
Hardcode customer data.
Remove important FVE functionality.
Copy desktop UI blindly.
Use tiny web-style controls.
Ignore TypeScript errors.
Ignore build errors.
Leave TODO placeholders for core functionality.
Stop after creating a plan.
DEFINITION OF DONE

The implementation is complete only when:

fve-mobile exists as a separate application.
The application builds successfully.
Android runs successfully.
iOS runs successfully where the environment supports it.
Existing FVE authentication works.
Existing FVE backend/API works.
Existing customer accounts work.
Existing FVE logo is reused.
Existing FVE theme is reused.
Existing FVE design language is preserved.
Core web functionality has mobile equivalents.
Mobile navigation is intuitive.
Forms work.
Keyboard behavior works.
Loading states work.
Empty states work.
Error states work.
Retry flows work.
Android back navigation works.
iOS navigation works.
No unnecessary mock data remains.
No major TypeScript errors remain.
No major lint/build errors remain.
Existing web application remains functional.
FINAL UX PRINCIPLE

Always make decisions using this principle:

Same FVE product. Same customer. Same account. Same data. Same brand. Different device.

The customer should never feel that they have moved to a completely different application.

The mobile app should be:

FitVerse Elite — optimized for mobile.

Not:

FitVerse Elite — redesigned from scratch.

Start by inspecting the repository now.

After inspection, create the implementation plan and immediately begin building fve-mobile.