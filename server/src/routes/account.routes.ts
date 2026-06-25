import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { createAccountSchema } from '../validators/index.js';
import {
  createAccount,
  getAccounts,
  getAccountById,
  getAccountEntries,
  getAccountAudit,
} from '../controllers/account.controller.js';
import { getAccountBalance } from '../controllers/balance.controller.js';

const router = Router();

// All account routes require authentication
router.use(authMiddleware);

router.post('/', validate(createAccountSchema), createAccount);
router.get('/', getAccounts);
router.get('/:accountId', getAccountById);
router.get('/:accountId/entries', getAccountEntries);
router.get('/:accountId/balance', getAccountBalance);
router.get('/:accountId/audit', getAccountAudit);

export default router;
