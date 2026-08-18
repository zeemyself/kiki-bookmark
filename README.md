# 🔖 Kiki Bookmark

> [!IMPORTANT]
> **Remark for Reviewers:** This repository is public solely for evaluation and grading purposes. Once the review process is completed, the repository will be reverted to private.

A secure, offline-first cross-platform mobile bookmark and collection manager built with **Expo (SDK 57)**, **React Native (0.86)**, **React 19**, and **TypeScript**.

---

## 🎯 Reviewer Quick Start & Target Platform

- **Primary Target Platform:** **Android** (API 24+ / Tested on Android 14 API 34).
- **Secondary Target Platform:** **iOS** (iOS 17+ / Compatible via Expo & CocoaPods).
- **Installable Build (Pre-built Debug APK):**
  - An installable Android build is provided in this repository at [`app/app-debug.apk`](app/app-debug.apk).
  - You can test the app immediately without building native toolchains or setting up JDK/Android Studio.

### Quick Install via ADB
```bash
# Ensure your Android emulator or physical device is connected
adb install app/app-debug.apk
```
*Or drag and drop `app/app-debug.apk` directly onto a running Android emulator.*

---

## ⚖️ What Was Completed vs. Skipped & Why

To assist the review and grading process, here is a transparent summary of what was completed versus what was intentionally omitted:

| Scope Area | Status | Implementation Details & Rationale |
| :--- | :---: | :--- |
| **OIDC Auth (Auth0 + PKCE)** | ✅ Completed | Universal Login via OAuth 2.0 with **PKCE (`S256`)**, ID token claim decoder, user profile metadata, and universal logout via `react-native-auth0`. |
| **Secure Token Storage** | ✅ Completed | Tokens stored using hardware-backed keystores (Android KeyStore / EncryptedSharedPreferences, iOS Keychain Secure Enclave) via Auth0 `CredentialsManager`. |
| **Biometric Security** | ✅ Completed | Integrated with `expo-local-authentication`. Features both an **App-Level Biometric Lock** (on launch/resume) and **Per-Collection Privacy Lock** for sensitive bookmarks. |
| **Offline-First Persistence** | ✅ Completed | Modern `expo-sqlite` repository architecture with parameterized SQL queries, foreign keys, cascade deletes, and automated migration runner (`migrateDbIfNeeded`). |
| **Bookmark & Collection CRUD** | ✅ Completed | Create, read, update, delete, tag, favorite, search/filter bookmarks, and assign color-coded collections. External links open via secure system browser. |
| **Automated Test Suite** | ✅ Completed | 24 automated unit & integration tests across 7 test suites (auth, database, screens, userinfo) using Jest, `jest-expo`, and `@testing-library/react-native`. |
| **An "everything" screen** | ⏭️ *Skipped* | Collections shown together with the bookmarks inside them, rather than two lists. **Why:** Focused on dedicated collection filtering tabs and modular list views for better biometric privacy isolation and cleaner mobile layout. |
| **Full-text search** | ⏭️ *Skipped* | Across bookmark titles and notes. **Why:** Implemented direct substring search across titles, URLs, and tags; omitted SQLite FTS5 full-text indexing to keep the schema lightweight and performant. |

---

## 🌟 Key Features

- 🔐 **OIDC Authentication with Auth0:**
  - Secure login flow powered by Universal Login and OAuth 2.0 with **PKCE (`S256`)**.
  - Hardware-backed token storage via iOS Keychain (Secure Enclave) and Android KeyStore / EncryptedSharedPreferences through `react-native-auth0`'s `CredentialsManager`.
  - Seamless token rotation and authenticated session management.
- 🛡️ **Biometric Security:**
  - Integrated biometric authentication (Face ID, Touch ID, Android Biometrics) via `expo-local-authentication`.
  - App-level biometric lock overlay on launch and resume from background.
  - Granular privacy protection for individual sensitive bookmark collections.
- 💾 **Local-First SQLite Persistence:**
  - High-performance on-device storage utilizing modern `expo-sqlite` (`SQLiteProvider` and repository pattern).
  - Parameterized queries to ensure data integrity and prevent SQL injection.
  - Automated schema migration support (`migrateDbIfNeeded`).
- 📑 **Bookmark & Collection Management:**
  - Create, view, edit, search, and delete bookmarks.
  - Organize bookmarks into color-coded collections with custom privacy levels.
  - Tagging, favorites, search filtering, and external link launching.
- 👤 **Profile & Identity Inspector:**
  - Inspect decoded ID token claims, scopes, access tokens, and raw user profile payloads.
  - Biometric preference toggles and secure session termination (Universal Logout).
- ⚡ **Asynchronous State Management:**
  - Fast query caching and background revalidation using **TanStack React Query v5**.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Expo SDK 57](https://docs.expo.dev/) (Bare / Prebuild workflow) |
| **Mobile Runtime** | [React Native 0.86](https://reactnative.dev/) & [React 19](https://react.dev/) |
| **Language** | [TypeScript 5.9+](https://www.typescriptlang.org/) |
| **Authentication** | [`react-native-auth0`](https://github.com/auth0/react-native-auth0) |
| **Biometrics** | [`expo-local-authentication`](https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/) |
| **Database** | [`expo-sqlite`](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/) |
| **Navigation** | [`@react-navigation/native-stack` v7](https://reactnavigation.org/) |
| **State / Caching**| [`@tanstack/react-query` v5](https://tanstack.com/query/latest) |
| **Testing** | Jest, `jest-expo`, and `@testing-library/react-native` |

---

## 📁 Project Structure

```
kiki-bookmark/
├── app/
│   └── app-debug.apk       # Pre-built Android debug APK for reviewers
├── assets/                 # App icons, splash screens, adaptive icons
├── src/
│   ├── auth/               # Auth0 configuration, biometrics helper, userinfo mapping
│   ├── components/         # Reusable UI components & modals (e.g. BiometricLockOverlay)
│   ├── db/                 # SQLite schema, migrations, and repository layer
│   ├── navigation/         # React Navigation stacks, navigators, and route types
│   └── screens/            # Application screens (Login, Home, Details, Profile, etc.)
├── __tests__/              # Unit and integration test suites
├── App.tsx                 # Root application component with Context Providers
├── app.json                # Expo config, native plugins, and permissions
├── eas.json                # Expo Application Services (EAS) build profiles
├── DECISIONS.md            # Architecture Decision Records (ADRs)
├── AUTH_DESIGN.md          # Detailed OIDC & Biometric Security Design Document
└── package.json            # Dependencies and scripts
```

---

## 📋 Prerequisites

To run from source code:

- **Node.js**: `v20.x` or higher (Active LTS recommended)
- **Package Manager**: `npm` (v10+)
- **Mobile Development Environments**:
  - **Android (Primary Target):**
    - Android Studio with Android SDK (API Level 34+)
    - Java Development Kit (JDK 17)
    - Configured Android Emulator or physical test device with USB debugging enabled
  - **iOS (macOS only):**
    - Xcode 16+ & Command Line Tools
    - CocoaPods (`sudo gem install cocoapods` or Homebrew)
    - iOS Simulator (iOS 17+)

---

## 🚀 Setup & Run Steps (Clean Checkout)

### 1. Clone the Repository

```bash
git clone https://github.com/zeemyself/kiki-bookmark.git
cd kiki-bookmark
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Auth0 Configuration (Pre-configured)

The application comes pre-configured with active development credentials in [`src/auth/config.ts`](src/auth/config.ts) and [`app.json`](app.json), enabling immediate login without manual credential setup.

*(Optional: If you wish to use your own Auth0 tenant, configure the domain, client ID, and callback URL `com.bbl.bookmarks://oauth/callback` in `src/auth/config.ts` and `app.json`.)*

### 4. Running the App

#### Android (Recommended)
```bash
# Starts the Android emulator and launches the debug build
npm run android
```

#### iOS (macOS only)
```bash
# Builds native CocoaPods and launches the iOS Simulator
npm run ios
```

#### Start Metro Bundler (if build is already installed)
```bash
npm start
```

---

## 🧪 Running Tests & Quality Checks

Run the automated test suites and static type checks:

```bash
# 1. Run TypeScript typecheck
npm run typecheck

# 2. Run Jest unit and integration test suites
npm test

# 3. Run Jest tests in interactive watch mode
npm run test:watch

# 4. Generate test coverage report
npm run test:coverage
```

### Continuous Integration (CI)

A GitHub Actions workflow is configured in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) to automatically run typechecks and the test suite with coverage reporting on pull requests and main pushes.

---

## 🏗️ Production & Cloud Builds

### Local Release Builds

```bash
# Android Release APK
npx expo run:android --variant release

# iOS Release Build
npx expo run:ios --configuration Release
```

### Cloud Builds via EAS

Pre-configured profiles exist in [`eas.json`](eas.json):

```bash
# Build Android APK preview in EAS Cloud
eas build --profile preview --platform android

# Build all platforms
eas build --profile preview --platform all
```

---

## 🏷️ Release Management

The repository uses [`release-it`](https://github.com/release-it/release-it) with [`@release-it/conventional-changelog`](https://github.com/release-it/conventional-changelog) to automate semantic versioning, `CHANGELOG.md` generation, Expo `app.json` version bumping, and GitHub releases based on [Conventional Commits](https://www.conventionalcommits.org/).

```bash
# Interactive release prompt (with typecheck & test hooks)
npm run release

# Dry-run release to preview version bump & changelog
npm run release:dry

# Automated release bumps
npm run release:patch
npm run release:minor
npm run release:major
```

---

## 📖 Architectural Decisions

Refer to the dedicated documentation files for in-depth design specifications:
- [`DECISIONS.md`](DECISIONS.md) — Architecture Decision Records (ADR 01: Redirect URI Scheme, ADR 02: Auth SDK & Secure Storage).
- [`AUTH_DESIGN.md`](AUTH_DESIGN.md) — Comprehensive OIDC Authentication, PKCE flow diagrams, and Biometric Security architecture.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
