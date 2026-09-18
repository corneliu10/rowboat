import container from '../di/container.js';
import { IOAuthRepo, isAppSignIn } from '../auth/repo.js';
import { staticSpinrunKey } from '../auth/static-key.js';

/** Signed in to the APP (auth/repo.ts isAppSignIn — one session, two uses). */
export async function isSignedIn(): Promise<boolean> {
    // Spike (lane G): static bearer counts as signed in. OAuth path intact.
    if (staticSpinrunKey()) return true;
    const oauthRepo = container.resolve<IOAuthRepo>('oauthRepo');
    return isAppSignIn(await oauthRepo.read('rowboat'));
}
