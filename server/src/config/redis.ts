import Redis from 'ioredis';
import env from './env.js';

const redisUrl = env.redisUrl || 'redis://localhost:6379';

// Main and subscription Redis clients
export const redis = new Redis(redisUrl);
export const redisSub = new Redis(redisUrl);


redis.on('error', (err : Error) => {
    console.error('Redis (Main) connection error:', err);
});

redisSub.on('error', (err : Error) => {
    console.error('Redis (Sub) connection error:', err);
})

redis.on('connect', () => {
  console.log('Redis (Main) connected successfully');
});

redisSub.on('connect', () => {
  console.log('Redis (Sub) connected successfully');
});

// Verify Redis connectivity on startup
async function testRedis() {
    try {
        await redis.set('test_key', 'Redis is working!');
        const value = await redis.get('test_key');
        console.log('Redis Test GET:', value);
    } catch (err) {
        console.error('Redis Test Failed:', err);
    }
}

testRedis();