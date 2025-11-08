import { Global, Module } from '@nestjs/common';

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