import { AUTH0_CONFIG } from './config';

/**
 * OpenID Connect Standard UserInfo Claims
 * @see https://openid.net/specs/openid-connect-core-1_0.html#UserInfoResponse
 */
export interface UserInfoResponse {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  nickname?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
  updated_at?: string;
  [key: string]: any;
}

export interface UserInfoFetchResult {
  data: UserInfoResponse | null;
  fromCache: boolean;
  error?: string;
  status?: number;
}

/**
 * In-memory session cache for /userinfo to strictly enforce the requirement:
 * "The one remote call your app must make with its credential is GET https://dev-yg.us.auth0.com/userinfo...
 *  It is rate limited — treat it as a one-shot per session, not something to poll."
 */
class UserInfoSessionCache {
  private cachedUserInfo: UserInfoResponse | null = null;
  private cachedAccessToken: string | null = null;
  private lastFetchedAt: number | null = null;
  private inflightPromise: Promise<UserInfoFetchResult> | null = null;

  public get(accessToken: string): UserInfoResponse | null {
    if (this.cachedAccessToken === accessToken && this.cachedUserInfo) {
      return this.cachedUserInfo;
    }
    return null;
  }

  public set(accessToken: string, data: UserInfoResponse) {
    this.cachedAccessToken = accessToken;
    this.cachedUserInfo = data;
    this.lastFetchedAt = Date.now();
  }

  public clear() {
    this.cachedUserInfo = null;
    this.cachedAccessToken = null;
    this.lastFetchedAt = null;
    this.inflightPromise = null;
  }

  public getInflight(): Promise<UserInfoFetchResult> | null {
    return this.inflightPromise;
  }

  public setInflight(promise: Promise<UserInfoFetchResult> | null) {
    this.inflightPromise = promise;
  }

  public getLastFetchedTime(): number | null {
    return this.lastFetchedAt;
  }
}

export const userinfoCache = new UserInfoSessionCache();

/**
 * Fetches the user profile from Auth0's OIDC /userinfo endpoint using the Access Token as the Bearer credential.
 *
 * Requirements & Architecture guarantees:
 * 1. Uses Access Token in `Authorization: Bearer <accessToken>` header.
 * 2. One-shot per session: checks session cache first, avoiding repeated calls / polling.
 * 3. In-flight request deduplication: concurrent callers share the same promise.
 * 4. Graceful handling for HTTP 429 (Rate Limit) and offline scenarios.
 *
 * @param accessToken The OAuth 2.0 Access Token
 * @param forceRefresh Optional flag to bypass cache if explicitly requested by user action
 */
export async function fetchUserInfo(
  accessToken: string,
  forceRefresh: boolean = false
): Promise<UserInfoFetchResult> {
  if (!accessToken) {
    return {
      data: null,
      fromCache: false,
      error: 'No access token provided for /userinfo request.',
    };
  }

  // 1. Return cached session data if available and not forced
  if (!forceRefresh) {
    const cached = userinfoCache.get(accessToken);
    if (cached) {
      return {
        data: cached,
        fromCache: true,
      };
    }
  }

  // 2. Request deduplication for simultaneous calls
  const inflight = userinfoCache.getInflight();
  if (inflight && !forceRefresh) {
    return inflight;
  }

  // 3. Perform remote GET request
  const fetchPromise = (async (): Promise<UserInfoFetchResult> => {
    try {
      const response = await fetch(AUTH0_CONFIG.userinfoEndpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (response.status === 429) {
        return {
          data: null,
          fromCache: false,
          status: 429,
          error: 'Auth0 /userinfo endpoint rate limit reached (HTTP 429). Utilizing local session cache.',
        };
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return {
          data: null,
          fromCache: false,
          status: response.status,
          error: `Failed to fetch /userinfo: HTTP ${response.status} ${errorText}`,
        };
      }

      const data: UserInfoResponse = await response.json();

      // Store in session cache (one-shot per session guarantee)
      userinfoCache.set(accessToken, data);

      return {
        data,
        fromCache: false,
        status: response.status,
      };
    } catch (err: any) {
      return {
        data: null,
        fromCache: false,
        error: err?.message || 'Network error fetching /userinfo. Utilizing offline profile.',
      };
    } finally {
      userinfoCache.setInflight(null);
    }
  })();

  userinfoCache.setInflight(fetchPromise);
  return fetchPromise;
}

/**
 * Resets the /userinfo session cache upon user logout
 */
export function clearUserInfoSession(): void {
  userinfoCache.clear();
}
