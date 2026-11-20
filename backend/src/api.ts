import { Router } from 'express';
import wordsRoutes from './routes/words.routes';
import wordsAdminRoutes from './routes/words-admin.routes';
import categoriesRoutes from './routes/categories.routes';
import analyticsRoutes from './routes/analytics.routes';
import settingsRoutes from './routes/settings.routes';
import { requireSameOrigin } from './middleware/csrf.middleware';
import { normalizeWordBody } from './middleware/normalizeWordBody.middleware';
import audioRoutes from './routes/audio.routes';
import picturesRoutes from './routes/pictures.routes';
import internalRoutes from './routes/internal.routes';
import telegramAuthRoutes from './routes/telegram-auth.routes';
import usersAdminRoutes from './routes/users-admin.routes';

const router = Router();

// The admin session lives in a cookie, so every state-changing request must come from our own origin.
router.use(requireSameOrigin);

// Telegram session is also the sole authentication mechanism for admin access.
router.use('/learner-auth', telegramAuthRoutes);
router.use('/users', usersAdminRoutes);
router.use('/words', normalizeWordBody);
// Admin-only bulk tools; mounted before the CRUD router (their paths never clash with it).
router.use('/words', wordsAdminRoutes);
router.use('/words', wordsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/settings', settingsRoutes);
router.use('/audio', audioRoutes);
router.use('/pictures', picturesRoutes);
// Token-authenticated local automation endpoints; mounted separately from browser admin auth.
router.use('/internal', internalRoutes);

export const apiRouter = router;
export default router;
