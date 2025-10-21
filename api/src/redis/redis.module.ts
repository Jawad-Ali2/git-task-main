import { Global, Module } from '@nestjs/common';

@Global()
@Module({
    providers: [{
        provide: 'REDIS_CLIENT',
        useFactory: async () => {
            const client = new (require('ioredis'))({
                host: process.env.REDIS_HOST,
                port: +process.env.REDIS_PORT!,
            });
            client.on('connect', () => console.log("Redis connected"));

            return client;
        }
    }
    ],

    exports: ['REDIS_CLIENT']
})
export class RedisModule {

}
