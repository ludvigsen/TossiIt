import { GoogleSignin } from '@react-native-google-signin/google-signin';

let tokensInFlight: Promise<any> | null = null;

async function getTokensSerialized(forceRefresh: boolean) {
  // If a token fetch is already in progress:
  // - for non-force refresh, reuse it
  // - for force refresh, wait for it to finish, then start a new one
  if (tokensInFlight) {
    if (!forceRefresh) return await tokensInFlight;
    try {
      await tokensInFlight;
    } catch {
      // ignore
    }
  }

  const p = GoogleSignin.getTokens(forceRefresh ? ({ forceRefresh: true } as any) : undefined);
  tokensInFlight = p.finally(() => {
    if (tokensInFlight === p) tokensInFlight = null;
  });
  return await tokensInFlight;
}

export async function getAuthHeaders(options?: { forceRefresh?: boolean }) {
  const forceRefresh = !!options?.forceRefresh;

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
  let userInfo = await GoogleSignin.getCurrentUser();
  if (!userInfo) {
    await GoogleSignin.signInSilently();
    userInfo = await GoogleSignin.getCurrentUser();
  }

  const tokens = await getTokensSerialized(forceRefresh);
  const bearer = tokens?.idToken;
  if (!bearer) {
    throw new Error('No idToken available; please sign in again.');
  }

  return {
    Authorization: `Bearer ${bearer}`,
    'X-User-Id': userInfo?.user.id,
  };
}


