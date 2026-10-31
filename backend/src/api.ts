import { Router } from 'express';
import authRoutes from './routes/auth.routes';
import wordsRoutes from './routes/words.routes';
import wordsAdminRoutes from './routes/words-admin.routes';
import categoriesRoutes from './routes/categories.routes';
import analyticsRoutes from './routes/analytics.routes';
import settingsRoutes from './routes/settings.routes';
import syncRoutes from './routes/sync.routes';
import { requireSameOrigin } from './middleware/csrf.middleware';
import { normalizeWordBody } from './middleware/normalizeWordBody.middleware';

const router = Router();

// The admin session lives in a cookie, so every state-changing request must come from our own origin.
router.use(requireSameOrigin);

router.use('/auth', authRoutes);
router.use('/admin', authRoutes); // alias for admin login
router.use('/words', normalizeWordBody);
// Admin-only bulk tools; mounted before the CRUD router (their paths never clash with it).
router.use('/words', wordsAdminRoutes);
router.use('/words', wordsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/settings', settingsRoutes);
router.use('/sync', syncRoutes);

export const apiRouter = router;
export default router;
