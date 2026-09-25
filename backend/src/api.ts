import { Router } from 'express';
import authRoutes from './routes/auth.routes';
import wordsRoutes from './routes/words.routes';
import categoriesRoutes from './routes/categories.routes';
import analyticsRoutes from './routes/analytics.routes';
import { requireSameOrigin } from './middleware/csrf.middleware';

const router = Router();

// The admin session lives in a cookie, so every state-changing request must come from our own origin.
router.use(requireSameOrigin);

router.use('/auth', authRoutes);
router.use('/admin', authRoutes); // alias for admin login
router.use('/words', wordsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/analytics', analyticsRoutes);

export const apiRouter = router;
export default router;
