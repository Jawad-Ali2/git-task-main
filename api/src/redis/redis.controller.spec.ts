import { Test, TestingModule } from '@nestjs/testing';
import { RedisController } from './redis.controller'; // The controller to test

describe('RedisController', () => {
  let controller: RedisController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({ // Create a testing Sandbox module for the RedisController
      controllers: [RedisController],
    }).compile();

    controller = module.get<RedisController>(RedisController); // Pull the controller instance from the testing module
  });

  it('should be defined', () => { // Test Case
    expect(controller).toBeDefined();
  });
});
