# ADR 01: Redirect URI Scheme Selection

## Status
Accepted (per assignment spec)

## Context
The OAuth 2.0 authorization flow requires redirecting the user back to the mobile application after authenticating in the system browser. We needed to choose between a Custom URL Scheme (`com.bbl.bookmarks://oauth/callback`) and Universal Links / App Links (`https://auth.example.com/callback`).

## Decision
We implemented a **Custom URL Scheme with Reverse Domain Notation** (`com.bbl.bookmarks://oauth/callback`) combined with **OAuth 2.0 PKCE** (`S256`).

## Alternatives Considered
- **Universal Links (iOS) / Android App Links:** 
  - *Protection:* Prevents scheme hijacking where a malicious app registers the same protocol to intercept the auth code.
  - *Cost:* Requires a dedicated HTTPS domain, hosted `.well-known` verification files, Apple Developer Team IDs, and complicates zero-config local testing.

## Trade-offs & Security Stance
Using a custom scheme introduces the theoretical risk of URI collision. We mitigated this by:
1. Using reverse-DNS notation (`com.bbl.bookmarks`) per RFC 8252 recommendations.
2. Enforcing **PKCE** (generating a dynamic `code_challenge` and keeping the `code_verifier` in memory). An intercepting app cannot exchange the code without the verifier.

---

# ADR 02: Authentication SDK Selection (`react-native-auth0`)

## Status
Accepted

## Context
Implementing OAuth 2.0 and OpenID Connect (OIDC) in a React Native mobile app requires handling the system browser lifecycle (`ASWebAuthenticationSession` / Android Custom Tabs), PKCE challenge generation, token exchange, token rotation, session clearing, and secure persistence of sensitive credentials (refresh and access tokens).

We evaluated three approaches:
1. **`react-native-auth0`** (Official Auth0 SDK)
2. **`react-native-app-auth`** (Generic AppAuth wrapper)
3. **Custom In-House Implementation** (`expo-auth-session` / `expo-crypto` / custom API calls)

## Decision
We selected **`react-native-auth0`** as the primary authentication SDK.

## Rationale & Key Drivers
- **Built-in Native Hardware Encryption (`CredentialsManager`):** 
  `react-native-auth0` handles token persistence automatically out-of-the-box using native OS security hardware:
  - **iOS:** iOS Keychain Services backed by the Secure Enclave (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`).
  - **Android:** Android KeyStore and `EncryptedSharedPreferences` backed by TEE / StrongBox.
  This eliminates the need to add and maintain a separate sensitive storage library (such as `react-native-keychain` or custom bridging code) solely for auth tokens, reducing third-party dependency sprawl and security misconfiguration risks.
- **Active Maintenance & First-Party Support:** 
  Maintained directly by Auth0/Okta, ensuring up-to-date compliance with OIDC specs, OAuth 2.0 BCP for Native Apps (RFC 8252), and seamless compatibility with modern Expo SDK config plugins (`react-native-auth0` Expo plugin).
- **Out-of-the-Box Session & Token Lifecycle:** 
  Provides native helpers for silent token refresh via Refresh Token Rotation (RTR), session revocation, and Universal Logout without manual state machine orchestration.

## Alternatives Considered
- **`react-native-app-auth`:** 
  A solid generic OAuth2 client, but does **not** include built-in encrypted token storage. It requires orchestrating a separate keychain library, manual refresh token management, and custom session caching logic.
- **Custom In-House Flow:** 
  Building the PKCE generation, browser redirection, token exchange, and keychain bridging from scratch introduces high engineering overhead, higher maintenance burden, and greater risk of security flaws (e.g., non-cryptographic entropy, improper token storage).

## Trade-offs
- **Vendor Specificity:** Tightly couples the client to Auth0's SDK. However, because Auth0 is the designated Identity Provider for the project, this trade-off provides substantial security and development velocity benefits.