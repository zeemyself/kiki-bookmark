/**
 * Auth0 OIDC Configuration
 */
export const AUTH0_CONFIG = {
  domain: 'dev-yg.us.auth0.com',
  clientId: 'pSy06qYaqa5WT6sAgN537lFlWMC2d0uN',
  discoveryEndpoint: 'https://dev-yg.us.auth0.com/.well-known/openid-configuration',
  jwksUri: 'https://dev-yg.us.auth0.com/.well-known/jwks.json',
  userinfoEndpoint: 'https://dev-yg.us.auth0.com/userinfo',
  bundleId: 'com.bbl.bookmarks',
  customScheme: 'com.bbl.bookmarks',
  redirectUri: 'com.bbl.bookmarks://oauth/callback',
  logoutUri: 'com.bbl.bookmarks://oauth/callback',
  scope: 'openid profile email offline_access',
  audience: 'https://bbl-candidate-test-api',
} as const;

export type Auth0Configuration = typeof AUTH0_CONFIG;
