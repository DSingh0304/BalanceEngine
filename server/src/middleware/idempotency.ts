import { Request, Response, NextFunction, response } from "express";
import { redis } from "../config/redis.js";
import env from "../config/env.js";

const IDEMPOTENCY_TTL = env.idempotencyTtlSeconds || 86400;

export const idempotency = async (req: Request, res: Response, next: NextFunction) => {
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

    const redisKey = `idempotency:${key}`;
    const existing = await redis.get(redisKey);

    if(existing){
        const parsed = JSON.parse(existing);
        if(parsed.status == 'processing') {
            return res.status(409).json({
                error: 'A request with the same idempotency key already being processed. Retry after some time.'
            })
        }
        if(parsed.status == 'completed'){
            res.setHeader('X-Idempotent-Replayed', 'true');
            return res.status(parsed.statusCode).json(parsed.response)
        }
    }
    await redis.set(
        redisKey,
        JSON.stringify({status:'processing'}),
        'EX',
        IDEMPOTENCY_TTL
    )

    const originalJson = res.json.bind(res);

    res.json = ( body: unknown ) => {
        if(res.statusCode >= 200 && res.statusCode < 300){
            redis.set(
                redisKey,
                JSON.stringify({
                    status: 'completed',
                    statusCode: res.statusCode,
                    response: body
                }),
                'EX',
                IDEMPOTENCY_TTL
            ).catch((error) => {
                console.error('[idempotency] Failed to store complete result', error)
            })
        } else {
            redis.del(redisKey).catch((error) => {
                console.error('[idempotency] Failed to delete failed key:', error)
            })
        }
        return originalJson(body);
    }
    next();
};