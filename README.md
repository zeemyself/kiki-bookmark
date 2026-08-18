# 🔖 Kiki Bookmark

> [!IMPORTANT]
> **Remark:** This repository is currently public solely for interview assignment evaluation purposes. Once the review process is completed, the repository will be changed back to private.

A secure, offline-first cross-platform mobile bookmark and collection manager built with **Expo (SDK 57)**, **React Native (0.86)**, **React 19**, and **TypeScript**.

---

## 🌟 Features

- 🔐 **OIDC Authentication with Auth0:**
  - Secure login flow powered by Universal Login and OAuth 2.0 with **PKCE (`S256`)**.
  - Hardware-backed token storage via iOS Keychain (Secure Enclave) and Android KeyStore / EncryptedSharedPreferences through `react-native-auth0`'s `CredentialsManager`.
  - Seamless token rotation and authenticated session management.
- 🛡️ **Biometric Security:**
  - Integrated biometric authentication (Face ID, Touch ID, Android Biometrics) via `expo-local-authentication`.
  - App-level biometric lock overlay on launch/resume.
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
└── package.json            # Dependencies and scripts
```

---

## 📋 Prerequisites

Ensure you have the following installed on your development machine:

- **Node.js**: `v20.x` or higher (Active LTS recommended)
- **Package Manager**: `npm` (v10+)
- **Mobile Development Environments**:
  - **iOS (macOS only):**
    - Xcode 16+
    - Command Line Tools
    - CocoaPods (`sudo gem install cocoapods` or via Homebrew)
    - Simulator runtime installed (iOS 17+)
  - **Android:**
    - Android Studio with Android SDK (API Level 34+)
    - Android SDK Command-line Tools & Build-Tools
    - Java Development Kit (JDK 17)
    - Configured Android Emulator or physical test device with USB debugging

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/zeemyself/kiki-bookmark.git
cd kiki-bookmark
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Auth0 Configuration

The application is pre-configured with default Auth0 development credentials in [`src/auth/config.ts`](src/auth/config.ts) and [`app.json`](app.json).

If you are setting up your own Auth0 tenant:
1. Create a **Native Application** in the [Auth0 Dashboard](https://manage.auth0.com/).
2. Add the following to **Allowed Callback URLs** and **Allowed Logout URLs**:
   ```
   com.bbl.bookmarks://oauth/callback
   ```
3. Update [`src/auth/config.ts`](src/auth/config.ts):
   ```typescript
   export const AUTH0_CONFIG = {
     domain: 'YOUR_AUTH0_DOMAIN',
     clientId: 'YOUR_AUTH0_CLIENT_ID',
     // ...
   };
   ```
4. Update the `react-native-auth0` plugin configuration in [`app.json`](app.json):
   ```json
   "plugins": [
     [
       "react-native-auth0",
       {
         "domain": "YOUR_AUTH0_DOMAIN",
         "customScheme": "com.bbl.bookmarks"
       }
     ]
   ]
   ```

---

## 📱 Running the Application

### Development Build (iOS Simulator)

Because this app utilizes native modules (`react-native-auth0`, `expo-sqlite`, `expo-local-authentication`), run it using native runtime builds:

```bash
# Builds and launches the iOS Simulator
npm run ios
```

> **Note:** For iOS on macOS, the build command will automatically run `npx expo prebuild` and install native CocoaPods.

### Development Build (Android Emulator)

```bash
# Starts Android emulator and launches the debug build
npm run android
```

### Start Metro Bundler

If the native build is already installed on your device or simulator:

```bash
npm start
```

---

## 🏗️ Building for Production / Release

### Local Native Builds

#### iOS Release Build
```bash
npx expo run:ios --configuration Release
```

#### Android Release APK / Bundle
```bash
# Release APK
npx expo run:android --variant release
```

### Cloud Builds via EAS (Expo Application Services)

The repository includes pre-configured profiles in [`eas.json`](eas.json):

```bash
# Install EAS CLI globally if needed
npm install -g eas-cli

# Log in to your Expo account
eas login

# Build internal preview (APK for Android / Simulator/TestFlight for iOS)
eas build --profile preview --platform all

# Build production bundle (AAB for Google Play / IPA for App Store)
eas build --profile production --platform all
```

---

## 🧪 Testing & Code Quality

```bash
# Run TypeScript typecheck
npm run typecheck

# Run test suite with Jest
npm test

# Run tests in interactive watch mode
npm run test:watch

# Run tests and generate code coverage report
npm run test:coverage
```

### Continuous Integration (CI)

The repository includes a GitHub Actions workflow in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) that automatically runs:
- TypeScript type checking (`tsc --noEmit`)
- Jest test suite with coverage report generation and artifact upload

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

Refer to [`DECISIONS.md`](DECISIONS.md) for Architecture Decision Records (ADRs) covering:
- **ADR 01:** Redirect URI Scheme Selection (`com.bbl.bookmarks://oauth/callback` with PKCE `S256`).
- **ADR 02:** Authentication SDK Selection (`react-native-auth0` with hardware-backed Secure Enclave / KeyStore encryption).
- Detailed OIDC sequence flows and security design in [`AUTH_DESIGN.md`](AUTH_DESIGN.md).

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
