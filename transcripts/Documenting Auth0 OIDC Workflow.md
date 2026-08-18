# Documenting Auth0 OIDC Workflow

- **Cascade ID**: `7019a6a7-7893-4028-8302-b579b353dddb`
- **Steps**: 25
- **Status**: CASCADE_RUN_STATUS_IDLE
- **Created**: 2026-08-16T06:17:36.512987Z
- **Last Modified**: 2026-08-16T06:18:21.215233Z
- **Workspace**: file:///Users/zeemyself/Projects/kiki-bookmark
- **Exported**: 2026-08-18 07:03:37

---

## [User] 用户  `2026-08-16T06:17:36`
Generate AUTH_DESIGN.md at the root of the project explaining process of login with OICD auth0 and how Authorization code with PKCE works and store

### [Tool] 工具: `list_dir`  `2026-08-16T06:17:40`
`[List Directory]`

### [Tool] 工具: `view_file`  `2026-08-16T06:17:41`
`file:///Users/zeemyself/Projects/kiki-bookmark/src/auth/config.ts` (17 行, 567 字节)

### [Tool] 工具: `view_file`  `2026-08-16T06:17:43`
`file:///Users/zeemyself/Projects/kiki-bookmark/package.json` (29 行, 699 字节)

### [Tool] 工具: `view_file`  `2026-08-16T06:17:45`
`file:///Users/zeemyself/Projects/kiki-bookmark/app.json` (39 行, 968 字节)

### [Tool] 工具: `view_file`  `2026-08-16T06:17:47`
`file:///Users/zeemyself/Projects/kiki-bookmark/src/screens/LoginScreen.tsx` (204 行, 5163 字节)

### [Tool] 工具: `view_file`  `2026-08-16T06:17:49`
`file:///Users/zeemyself/Projects/kiki-bookmark/src/navigation/RootNavigator.tsx` (99 行, 2356 字节)

### [Tool] 工具: `view_file`  `2026-08-16T06:17:52`
`file:///Users/zeemyself/Projects/kiki-bookmark/src/db/userRepository.ts` (92 行, 2573 字节)

### [Tool] 工具: `code_edit`  `2026-08-16T06:18:16`
[Code Edit] file:///Users/zeemyself/Projects/kiki-bookmark/AUTH_DESIGN.md
Generate comprehensive AUTH_DESIGN.md documenting OIDC Auth0 login, Authorization Code Flow with PKCE, and mobile token storage architecture.

## [Assistant] 助手  `2026-08-16T06:18:18`
<details><summary>思考过程 (Thinking)</summary>

**Verifying Document Accuracy**

I've confirmed the document's creation and accuracy. Now I am reviewing the contents of the `AUTH_DESIGN.md` file, and I can confirm that the architectural overview, the OIDC vs OAuth 2.0 comparison, and the need for Authorization Code with PKCE are all included, so I'm happy so far.




</details>

Generated [AUTH_DESIGN.md](file:///Users/zeemyself/Projects/kiki-bookmark/AUTH_DESIGN.md) at the root of the project.

### Summary of Documentation Included

1. **Architectural Overview**:
   - High-level architecture mapping interactions between Kiki Bookmark (Public Client), Auth0 (Identity & Authorization Server), the backend Resource Server API, and local storage layers.

2. **OIDC vs OAuth 2.0**:
   - Clear distinction between Authentication (OIDC, ID Tokens, user claims) and Authorization (OAuth 2.0, Access Tokens, API permissions).

3. **Why Authorization Code with PKCE (RFC 7636)**:
   - Security rationale for mobile public clients (inability to securely store a `client_secret` in mobile binaries).
   - Mitigation of Authorization Code interception attacks on custom URI schemes (`com.bbl.bookmarks://`).

4. **End-to-End Authentication Sequence**:
   - Detailed Mermaid sequence diagram from user tap to token issuance, profile sync, and authenticated navigation.

5. **PKCE Cryptographic Mechanics**:
   - Equations and specifications for generating `code_verifier` (high-entropy 43–128 char random string) and `code_challenge` (`BASE64URL-ENCODE(SHA256(code_verifier))`) using the `S256` method.
   - HTTP request parameters for `/authorize` and the back-channel POST `/oauth/token`.

6. **Token Types & Scopes**:
   - Specifications for `id_token` (RS256 JWT), `access_token`, and `refresh_token` with Refresh Token Rotation (RTR).
   - Scope definitions (`openid`, `profile`, `email`, `offline_access`) and `audience` configuration.

7. **Mobile Token Storage & Security**:
   - Token isolation in hardware-backed storage via `react-native-auth0` Credentials Manager (**iOS Keychain** `kSecClassGenericPassword` and **Android KeyStore** with `EncryptedSharedPreferences`).
   - Architectural separation: tokens reside exclusively in native secure storage, while non-sensitive user identity details are synced to local SQLite for offline access.

8. **Local Database Synchronization & Session Management**:
   - SQLite `users` table upsert pattern and relational linking.
   - Silent token renewal via `getCredentials()` and logout session termination via `clearSession()`.

*停止原因: `STOP_REASON_STOP_PATTERN`*
