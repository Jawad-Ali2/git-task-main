import { Global, Module, Logger } from '@nestjs/common';
import Redis from 'ioredis';

// Create a singleton Redis instance
let redisClient: Redis | null = null;
const logger = new Logger('RedisModule');

const createRedisClient = (): Redis => {
    if (redisClient) {
        return redisClient;
    }

    // Use REDIS_URL for Upstash (includes TLS support)
    const redisUrl = process.env.REDIS_URL;
    
    if (redisUrl) {
        // Upstash requires TLS - convert redis:// to rediss://
        const tlsUrl = redisUrl.replace('redis://', 'rediss://');
        
        redisClient = new Redis(tlsUrl, {
            maxRetriesPerRequest: null, // Required for BullMQ/queue compatibility
            enableReadyCheck: false,
            retryStrategy: (times) => {
                if (times > 10) {
                    logger.error(`Redis connection failed after ${times} retries`);
                    return null;
                }
                return Math.min(times * 500, 5000);
            },
        });
    } else {
        // Fallback to host/port for local Redis
        redisClient = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: +(process.env.REDIS_PORT || 6379),
            maxRetriesPerRequest: null,
            retryStrategy: (times) => {
                if (times > 10) {
                    logger.error(`Redis connection failed after ${times} retries`);
                    return null;
                }
                return Math.min(times * 500, 5000);
            },
        });
    }

    redisClient.on('connect', () => logger.log('Redis connected'));
    redisClient.on('ready', () => logger.log('Redis ready'));
    redisClient.on('error', (err) => logger.error(`Redis error: ${err.message}`));
    redisClient.on('close', () => logger.warn('Redis connection closed'));
    redisClient.on('reconnecting', () => logger.log('Redis reconnecting...'));

    return redisClient;
};

@Global()
@Module({
    providers: [{
        provide: 'REDIS_CLIENT',
        useFactory: async () => {
            const Redis = require('ioredis');
            
            // Use REDIS_URL if available (for Upstash/production)
            if (process.env.REDIS_URL) {
                const client = new Redis(process.env.REDIS_URL, {
                    tls: {
                        rejectUnauthorized: false
                    },
                    maxRetriesPerRequest: 3,
                    enableReadyCheck: false,
                    retryStrategy: (times) => {
                        if (times > 3) {
                            console.error('❌ Redis connection failed after 3 retries');
                            return null;
                        }
                        return Math.min(times * 200, 2000);
                    }
                });

                client.on('connect', () => console.log('✅ Redis connected (TLS)'));
                client.on('error', (err) => console.error('❌ Redis error:', err.message));
                
                return client;
            }
            
            // Fallback to host/port for local development
            const client = new Redis({
                host: process.env.REDIS_HOST,
                port: +process.env.REDIS_PORT!,
                maxRetriesPerRequest: 3,
            });
            
            client.on('connect', () => console.log('✅ Redis connected (local)'));
            client.on('error', (err) => console.error('❌ Redis error:', err.message));

            return client;
        }
    }],
    exports: ['REDIS_CLIENT']
})
export class RedisModule {}