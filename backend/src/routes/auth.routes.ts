import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { validTokens, getAdminPassword } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const expected = getAdminPassword();

  if (password && password === expected) {
    const token = crypto.randomBytes(24).toString('hex');
    validTokens.add(token);

    res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    res.json({ success: true, token, message: 'Authenticated successfully' });
  } else {
    res.status(401).json({ success: false, error: 'Неверный пароль' });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) validTokens.delete(token);

  res.setHeader('Set-Cookie', 'admin_token=; Path=/; HttpOnly; Max-Age=0');
  res.json({ success: true, message: 'Logged out' });
});

router.get('/check', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = req.headers.cookie
    ?.split(';')
    .find((c) => c.trim().startsWith('admin_token='))
    ?.split('=')[1];

  const activeToken = token || cookieToken;
  const isAuth = Boolean(activeToken && validTokens.has(activeToken));

  res.json({ authenticated: isAuth });
});

export default router;
