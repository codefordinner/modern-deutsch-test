import { Router, Request, Response } from 'express';
import {
  clearAuthCookie,
  isAdminRequest,
  isValidAdminPassword,
  setAuthCookie,
  signAdminToken,
} from '../middleware/auth.middleware';

const router = Router();

// The session token is set as an HttpOnly cookie and is intentionally NOT part of
// the response body: the frontend never sees it, so it cannot end up in
// localStorage where an XSS bug could read it.
router.post('/login', (req: Request, res: Response) => {
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
