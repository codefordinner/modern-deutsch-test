import { Router } from 'express';
import authRoutes from './routes/auth.routes';
import wordsRoutes from './routes/words.routes';
import categoriesRoutes from './routes/categories.routes';
import analyticsRoutes from './routes/analytics.routes';

const router = Router();

const getRouter = (mod: any) => (mod && mod.default ? mod.default : mod);

router.use('/auth', getRouter(authRoutes));
router.use('/admin', getRouter(authRoutes)); // alias for admin login
router.use('/words', getRouter(wordsRoutes));
router.use('/categories', getRouter(categoriesRoutes));
router.use('/analytics', getRouter(analyticsRoutes));

export const apiRouter = router;
export default router;
