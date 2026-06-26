import { Request, Response, NextFunction } from 'express';
import { reconcileAccount, reconcileAllAccounts } from '../services/reconciliation.service.js';

// POST /api/admin/reconcile

export const reconcile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId } = req.body ?? {};

    if (accountId) {
      const result = await reconcileAccount(accountId);
      res.status(200).json({ results: [result] });
    } else {
      const results = await reconcileAllAccounts();
      res.status(200).json({ results });
    }
  } catch (err) {
    next(err);
  }
};
