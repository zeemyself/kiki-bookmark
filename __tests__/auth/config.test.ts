import { AUTH0_CONFIG } from '../../src/auth/config';

describe('Auth0 Configuration', () => {
  it('has all required OIDC configuration parameters', () => {
    expect(AUTH0_CONFIG.domain).toBe('dev-yg.us.auth0.com');
    expect(AUTH0_CONFIG.clientId).toBeDefined();
    expect(AUTH0_CONFIG.clientId.length).toBeGreaterThan(0);
    expect(AUTH0_CONFIG.scope).toContain('openid');
    expect(AUTH0_CONFIG.scope).toContain('profile');
    expect(AUTH0_CONFIG.scope).toContain('email');
  });

  it('configures proper redirect and logout schemes matching app bundle ID', () => {
    expect(AUTH0_CONFIG.customScheme).toBe('com.bbl.bookmarks');
    expect(AUTH0_CONFIG.bundleId).toBe('com.bbl.bookmarks');
    expect(AUTH0_CONFIG.redirectUri).toBe('com.bbl.bookmarks://oauth/callback');
    expect(AUTH0_CONFIG.logoutUri).toBe('com.bbl.bookmarks://oauth/callback');
  });

  it('configures valid discovery and userinfo endpoints', () => {
    expect(AUTH0_CONFIG.discoveryEndpoint).toBe(
      `https://${AUTH0_CONFIG.domain}/.well-known/openid-configuration`
    );
    expect(AUTH0_CONFIG.userinfoEndpoint).toBe(
      `https://${AUTH0_CONFIG.domain}/userinfo`
    );
  });
});
