# Kiki Bookmark — Agent Guidelines & Project Instructions

## Project Overview
**Kiki Bookmark** is a cross-platform mobile bookmark manager built with **Expo (SDK 57)**, **React Native (0.86)**, **React 19**, and **TypeScript**.

- **Authentication:** Auth0 (`react-native-auth0`) with Universal Login & biometric protection.
- **Biometrics:** `expo-local-authentication` for app lock & sensitive collection access.
- **Local Storage:** `expo-sqlite` modern API (`SQLiteProvider`, repository pattern).
- **Navigation:** `@react-navigation/native` & `@react-navigation/native-stack` (v7).
- **Testing:** Jest, `jest-expo`, and `@testing-library/react-native`.

---

## Expo SDK 57 Standards
> **IMPORTANT:** Expo has evolved significantly. Always follow the exact versioned documentation for **Expo v57**:
> https://docs.expo.dev/versions/v57.0.0/

- Use modern `expo-sqlite` APIs (`useSQLiteContext`, `SQLiteProvider`, `onInit={migrateDbIfNeeded}`) rather than deprecated legacy APIs.
- Ensure config plugins and native permissions in [app.json](file:///Users/zeemyself/Projects/kiki-bookmark/app.json) are properly configured when adding native modules.

---

## Directory Structure
```
kiki-bookmark/
├── assets/                 # App icons, splash screens, and image assets
├── src/
│   ├── auth/               # Auth0 configuration, biometrics helper, userinfo mapping
│   ├── components/         # Reusable UI components & modals (e.g. BiometricLockOverlay)
│   ├── db/                 # SQLite schema, migrations, and repository layer
│   ├── navigation/         # React Navigation stacks, navigators, and route types
│   └── screens/            # Application screens (Home, Details, Profile, Login, etc.)
├── __tests__/              # Unit and integration tests
├── App.tsx                 # Application root with context providers
├── app.json                # Expo application config and plugins
└── package.json            # Dependencies and npm scripts
```

---

## Development Commands

```bash
# Start development server
npm start

# Run on iOS Simulator / Android Emulator
npm run ios
npm run android

# Type checking
npm run typecheck

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Releases & Versioning
npm run release
npm run release:dry
npm run release:patch
npm run release:minor
npm run release:major
```

---

## Coding Guidelines & Architectural Rules

### 1. Database Access & Repositories
- Keep all direct database operations within the repository files under [`src/db/`](file:///Users/zeemyself/Projects/kiki-bookmark/src/db).
- Never execute raw SQL queries inside screen or UI components; call repository functions instead.
- Always use parameterized queries to prevent SQL injection and data corruption.
- Manage schema migrations inside [`src/db/schema.ts`](file:///Users/zeemyself/Projects/kiki-bookmark/src/db/schema.ts) via `migrateDbIfNeeded`.

### 2. TypeScript & Component Design
- Strict typing: Avoid `any`. Define strong interfaces and types for database entities, navigation parameters, and component props.
- Navigation types must be kept in sync in [`src/navigation/types.ts`](file:///Users/zeemyself/Projects/kiki-bookmark/src/navigation/types.ts).
- Prefer functional components with React hooks.
- Use `SafeAreaView` / `useSafeAreaInsets` from `react-native-safe-area-context` to handle notches and navigation bars.

### 3. Authentication & Biometrics
- Auth0 configuration is centralized in [`src/auth/config.ts`](file:///Users/zeemyself/Projects/kiki-bookmark/src/auth/config.ts).
- Biometric verification logic lives in [`src/auth/biometrics.ts`](file:///Users/zeemyself/Projects/kiki-bookmark/src/auth/biometrics.ts).
- Ensure user privacy by guarding locked collections and app resume states with [`BiometricLockOverlay`](file:///Users/zeemyself/Projects/kiki-bookmark/src/components/BiometricLockOverlay.tsx) when enabled in user settings.

### 4. Verification Workflow
Whenever you make modifications:
1. Run `npm run typecheck` to verify TypeScript types.
2. Run `npm test` to ensure existing and new tests pass.

