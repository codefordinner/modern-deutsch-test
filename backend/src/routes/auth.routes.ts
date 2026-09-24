import { Router, Request, Response } from 'express';
import {
  AUTH_COOKIE_NAME,
  TOKEN_TTL_SECONDS,
  isAdminRequest,
  isValidAdminPassword,
  signAdminToken,
} from '../middleware/auth.middleware';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body ?? {};

  if (!isValidAdminPassword(password)) {
    return res.status(401).json({ success: false, error: 'Неверный пароль' });
  }

  const token = signAdminToken();
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TOKEN_TTL_SECONDS}`);
  res.json({ success: true, token, message: 'Authenticated successfully' });
});

// Tokens are stateless JWTs, so there is nothing to revoke server-side: logging
// out drops the cookie (the client also discards its copy) and the token simply
// expires on its own after TOKEN_TTL_SECONDS.
router.post('/logout', (_req: Request, res: Response) => {
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ success: true, message: 'Logged out' });
});

router.get('/check', (req: Request, res: Response) => {
  res.json({ authenticated: isAdminRequest(req) });
});

export default router;
