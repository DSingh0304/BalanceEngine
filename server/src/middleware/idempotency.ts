import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis";
import env from "../config/env";
import { error } from "node:console";

const IDEMPOTENCY_TTL = env.idempotencyTtlSeconds || 86400;

export const idempotency = (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers['idempotency-key'] as string | undefined;
    if(!key){
        return res.status(400).json({
            error: 'Idempotency key header is required for this endpoint'
        });
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if(!uuidRegex.test(key)){
        return res.status(400).json({
            error: 'Idempotency key must be a valid UUID'
        });
    }

};