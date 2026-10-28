import { zite } from '../zite/db.js';
import { ZiteError } from '../zite/backend.js';
const LIMITS = { read: 300, write: 100 };
/** Records a failed or blocked action so admins can review it under System health. Never throws. */
export async function logFailure(summary, errorCode, userEmail, details, endpoint) {
    try {
        await zite.failedActions.create({ record: { summary: summary.slice(0, 250), errorCode, userEmail: userEmail || undefined, details: details?.slice(0, 2000), endpoint } });
    }
    catch (e) {
        console.error('Could not log failed action', e);
    }
}
const PRE_LOGGED = new Set(['RATE_LIMITED', 'FORBIDDEN', 'UNAUTHORIZED']);
export function withLog(endpoint, run) {
    const wrapped = async (params) => {
        try {
            return await run(params);
        }
        catch (e) {
            const code = e instanceof ZiteError ? String(e.code ?? 'ERROR') : 'INTERNAL_ERROR';
            if (!PRE_LOGGED.has(code)) {
                const message = e instanceof Error ? e.message : String(e);
                const email = params?.context?.user?.email;
                await logFailure(`${endpoint} failed`, code, email, message, endpoint);
            }
            throw e;
        }
    };
    return wrapped;
}
export async function throttle(user, kind) {
    const now = new Date();
    const minute = now.toISOString().slice(0, 16);
    const bucketKey = `${user.id}|${kind}|${minute}`;
    let count = 1;
    try {
        const existing = await zite.rateLimitBuckets.findOne({ filters: { bucketKey } });
        count = (existing?.requestCount ?? 0) + 1;
        await zite.rateLimitBuckets.bulkCreate({ records: [{ bucketKey, requestCount: count, windowStart: `${minute}:00.000Z` }], matchOn: ['bucketKey'] });
    }
    catch (e) {
        // Degrade gracefully: never block legitimate traffic solely because the
        // rate-limit store is unavailable.
        console.error('Rate limit counter unavailable', e);
        try {
            await logFailure('Rate limit service unavailable', 'INTERNAL', user.email, e.message);
        } catch {}
        return;
    }
    if (count > LIMITS[kind]) {
        if (count === LIMITS[kind] + 1)
            await logFailure(`Rate limit hit (${kind})`, 'RATE_LIMITED', user.email, `More than ${LIMITS[kind]} ${kind} requests in one minute`);
        throw new ZiteError({ code: 'RATE_LIMITED', message: `Rate limit exceeded for ${user.id} (${kind})`, userFacingMessage: 'Too many requests, please wait a moment.' });
    }
}
