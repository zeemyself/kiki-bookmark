# SSO Token Storage Location

- **Cascade ID**: `f9b3f0a6-5434-4148-a387-9dac9ac154ae`
- **Steps**: 19
- **Status**: CASCADE_RUN_STATUS_IDLE
- **Created**: 2026-08-17T00:05:05.510221Z
- **Last Modified**: 2026-08-17T00:06:14.807763Z
- **Workspace**: file:///Users/zeemyself/Projects/kiki-bookmark
- **Exported**: 2026-08-18 07:05:12

---

## [User] 用户  `2026-08-17T00:05:05`
Question on token that get from sso where is it store in our application

### [Tool] 工具: `view_file`  `2026-08-17T00:05:09`
`file:///Users/zeemyself/Projects/kiki-bookmark/AUTH_DESIGN.md` (448 行, 29948 字节)

### [Tool] 工具: `view_file`  `2026-08-17T00:05:11`
`file:///Users/zeemyself/Projects/kiki-bookmark/App.tsx` (25 行, 901 字节)

### [Tool] 工具: `list_dir`  `2026-08-17T00:05:12`
`[List Directory]`

### [Tool] 工具: `view_file`  `2026-08-17T00:05:13`
`file:///Users/zeemyself/Projects/kiki-bookmark/src/screens/LoginScreen.tsx` (368 行, 10114 字节)

### [Tool] 工具: `view_file`  `2026-08-17T00:05:15`
`file:///Users/zeemyself/Projects/kiki-bookmark/src/screens/ProfileScreen.tsx` (1335 行, 40794 字节)

## [Assistant] 助手  `2026-08-17T00:05:15`
<details><summary>思考过程 (Thinking)</summary>

**Defining Secure Storage Methods**

I'm now focusing on hardware-backed native secure storage. Specifically, I'm examining how `react-native-auth0` handles tokens internally through its `CredentialsManager`, especially within the iOS context. This is a foundational step in addressing the user's question, so I'm keen to get this right.




</details>

In **Kiki Bookmark**, tokens received from SSO / Auth0 are stored securely in **hardware-backed OS secure storage**, managed by the `react-native-auth0` SDK (`CredentialsManager`). They are **never** stored in plain text or unencrypted storage.

---

### 1. Hardware-Backed Native Secure Storage (Primary Token Storage)

Tokens (`access_token`, `id_token`, and `refresh_token`) are persisted natively across app restarts:

* **iOS (Apple Keychain Services)**:
  * Stored with accessibility level `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` under `kSecClassGenericPassword`.
  * Protected by hardware-level AES-256 encryption managed by Apple's **Secure Enclave**.
* **Android (Android KeyStore & EncryptedSharedPreferences)**:
  * Encrypted with AES-256 GCM using a master key backed by the hardware **Trusted Execution Environment (TEE)** or **StrongBox Keymaster**.

---

### 2. Runtime Memory (JavaScript Engine)

* **Auth0 React Context (`useAuth0`)**:
  * Decodes and holds the user profile claims (`sub`, `name`, `email`, `picture`) in memory.
  * Access tokens and credentials are read from Keychain/KeyStore on demand via [`getCredentials()`](file:///Users/zeemyself/Projects/kiki-bookmark/src/screens/ProfileScreen.tsx#L46).
* **UserInfo In-Memory Session Cache**:
  * [`src/auth/userinfo.ts`](file:///Users/zeemyself/Projects/kiki-bookmark/src/auth/userinfo.ts) maintains a one-shot in-memory cache of `/userinfo` claims to avoid rate limiting (HTTP 429).

---

### 3. What is Stored in SQLite (and what is NOT)

* **SQLite (`kiki_bookmarks.db`)**: Only stores non-sensitive user profile metadata (e.g., `id`, `name`, `email`, `role`, `avatarColor`) in the `users` table to support offline browsing.
* **No Plaintext Storage**: Access tokens, ID tokens, and refresh tokens are **never written to SQLite or `AsyncStorage`**, adhering to [RFC 8252 (BCP 212)](file:///Users/zeemyself/Projects/kiki-bookmark/AUTH_DESIGN.md#L63-L98) security practices.

---

For full architectural diagrams and specifications, refer to [AUTH_DESIGN.md — Section 10 (Mobile Token Storage & Hardware Security Architecture)](file:///Users/zeemyself/Projects/kiki-bookmark/AUTH_DESIGN.md#L330-L360).

*停止原因: `STOP_REASON_STOP_PATTERN`*

## [User] 用户  `2026-08-17T00:06:12`
oh so it is all handled by react-native-auth0 without me implementing react-native-keychain or anything like that?

## [Assistant] 助手  `2026-08-17T00:06:12`
<details><summary>思考过程 (Thinking)</summary>

**Confirming the Integration**

Okay, it looks like I've got a handle on how `react-native-auth0` handles everything. It manages the authentication flow internally, so I won't have to deal with `react-native-keychain` directly, which simplifies things considerably. I'm double-checking the documentation now to provide the expert a clearer confirmation.




</details>

**Yes, exactly!** 

You do **not** need to install or configure `react-native-keychain` or `expo-secure-store` for Auth0 tokens.

### How `react-native-auth0` Handles It Out-Of-The-Box:

1. **Built-In Native Credentials Manager**:
   * The SDK includes its own native modules (`A0CredentialsManager` for iOS and `CredentialsManager` for Android) written in Swift/Objective-C and Java/Kotlin.
   * These native modules directly interface with **iOS Keychain** (`Security.framework`) and **Android KeyStore / EncryptedSharedPreferences**.

2. **Automatic Lifecycle on `authorize()` and `clearSession()`**:
   * **Login (`authorize()`)**: When the Universal Login / PKCE flow completes, the SDK automatically stores the `accessToken`, `idToken`, and `refreshToken` into secure storage.
   * **Token Retrieval & Refresh (`getCredentials()`)**: When you call `getCredentials()`, it fetches the tokens from the Keychain/KeyStore and even automatically performs silent **Refresh Token Rotation (RTR)** if the access token is close to expiry.
   * **Logout (`clearSession()`)**: It automatically wipes the saved tokens from the native Keychain/KeyStore.

### When would you need `expo-secure-store` / `react-native-keychain`?
Only if you need to store **custom app secrets** unrelated to Auth0 (such as an encrypted local database encryption key, custom API private keys, etc.). For all Auth0 SSO authentication tokens, `react-native-auth0` handles 100% of the secure storage for you.

*停止原因: `STOP_REASON_STOP_PATTERN`*
