import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { reconcile } from '../controllers/admin.controller.js';

const router = Router();

// Admin routes still require auth (in prod you'd add an admin role check)
router.use(authMiddleware);

router.post('/reconcile', reconcile);

export default router;
