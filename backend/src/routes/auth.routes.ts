import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  clearAuthCookie,
  isAdminRequest,
  isValidAdminPassword,
  setAuthCookie,
  signAdminToken,
} from '../middleware/auth.middleware';

const router = Router();

// Brute-force protection: at most LOGIN_MAX_ATTEMPTS failed sign-ins per IP per
// minute (successful logins are not counted). Behind nginx the real client IP
// comes from X-Forwarded-For, so the app must be told to trust the proxy
// (see TRUST_PROXY in index.ts / server.ts) — otherwise everyone shares one bucket.
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_ATTEMPTS = 8;

const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: LOGIN_MAX_ATTEMPTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ success: false, error: 'Слишком много попыток входа. Подождите минуту и попробуйте снова.' });
  },
});

// The session token is set as an HttpOnly cookie and is intentionally NOT part of
// the response body: the frontend never sees it, so it cannot end up in
// localStorage where an XSS bug could read it.
router.post('/login', loginLimiter, (req: Request, res: Response) => {
  const { password } = req.body ?? {};

  if (!isValidAdminPassword(password)) {
    return res.status(401).json({ success: false, error: 'Неверный пароль' });
  }

  const token = signAdminToken();
  setAuthCookie(req, res, token);
  res.json({ success: true, message: 'Authenticated successfully', token });
});

// Tokens are stateless JWTs, so there is nothing to revoke server-side: logging
// out drops the cookie and the token simply expires on its own after TOKEN_TTL_SECONDS.
router.post('/logout', (req: Request, res: Response) => {
  clearAuthCookie(req, res);
  res.json({ success: true, message: 'Logged out' });
});

// The client cannot read the HttpOnly cookie, so it asks the server whether it is signed in.
router.get('/check', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ authenticated: isAdminRequest(req) });
});

export default router;
