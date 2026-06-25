import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import validate from '../middleware/validate.js';
import { createTransactionSchema, reverseTransactionSchema } from '../validators/index.js';
import {
  createTransaction,
  getTransaction,
  reverseTransactionController,
} from '../controllers/transaction.controller.js';

const router = Router();

router.use(authMiddleware);

router.post('/', idempotency, validate(createTransactionSchema), createTransaction);
router.get('/:transactionId', getTransaction);
router.post('/:transactionId/reverse', validate(reverseTransactionSchema), reverseTransactionController);

export default router;
