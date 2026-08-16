import { fetchUserInfo, clearUserInfoSession } from '../../src/auth/userinfo';
import { AUTH0_CONFIG } from '../../src/auth/config';

describe('UserInfo Fetch and Session Cache', () => {
  beforeEach(() => {
    clearUserInfoSession();
    jest.clearAllMocks();
  });

  it('fetches userinfo successfully on initial request', async () => {
    const mockUser = {
      sub: 'auth0|user123',
      name: 'Jane Doe',
      email: 'jane@example.com',
      picture: 'https://example.com/avatar.png',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockUser,
    }) as jest.Mock;

    const result = await fetchUserInfo('test-token-123');

    expect(result.data).toEqual(mockUser);
    expect(result.fromCache).toBe(false);
    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `https://${AUTH0_CONFIG.domain}/userinfo`,
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test-token-123',
          Accept: 'application/json',
        },
      })
    );
  });

  it('returns cached userinfo on subsequent calls with the same token without making network requests', async () => {
    const mockUser = {
      sub: 'auth0|user123',
      name: 'Jane Doe',
      email: 'jane@example.com',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockUser,
    }) as jest.Mock;

    const firstResult = await fetchUserInfo('test-token-123');
    expect(firstResult.fromCache).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second call with same token
    const secondResult = await fetchUserInfo('test-token-123');
    expect(secondResult.data).toEqual(mockUser);
    expect(secondResult.fromCache).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1); // Not called again!
  });

  it('clears cache when clearUserInfoSession is invoked', async () => {
    const mockUser = {
      sub: 'auth0|user123',
      name: 'Jane Doe',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockUser,
    }) as jest.Mock;

    await fetchUserInfo('test-token-123');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    clearUserInfoSession();

    await fetchUserInfo('test-token-123');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('handles rate limiting (HTTP 429) gracefully', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Too Many Requests',
    }) as jest.Mock;

    const result = await fetchUserInfo('test-token-429');

    expect(result.data).toBeNull();
    expect(result.status).toBe(429);
    expect(result.error).toContain('429');
  });

  it('handles network errors cleanly', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network unavailable'));

    const result = await fetchUserInfo('test-token-error');

    expect(result.data).toBeNull();
    expect(result.fromCache).toBe(false);
    expect(result.error).toContain('Network unavailable');
  });
});
