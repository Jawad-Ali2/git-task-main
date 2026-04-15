import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let webhooksService: jest.Mocked<WebhooksService>;

  // The names should match the actual methods in WebhooksService
  const mockWebhooksService = {
    verifySignature: jest.fn(),
    handlePushEvent: jest.fn(),
    handleInstallationEvent: jest.fn(),
    handleInstallationRepositoriesEvent: jest.fn(),
  };

  // Run each test with a fresh instance of the controller and mocked service
  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhooksService,
          useValue: mockWebhooksService,
        }
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    webhooksService = module.get(WebhooksService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleGithubWebhook', () => {
    const mockPayload = { repository: { full_name: 'test/repo' }, commits: [] };
    const mockReq = { rawBody: JSON.stringify(mockPayload) };

    // Parameterized test for handled events
    test.each([
      [
        'push',
        'handlePushEvent',
        {
          message: 'Incremental scan completed successfully.',
          repository: 'test/repo',
          commits: 0,
          results: { tasksCompleted: 0, tasksAdded: 0, tasksModified: 0 }
        }
      ],
      [
        'installation',
        'handleInstallationEvent',
        {
          message: 'Installation event handled.',
          installationId: 123,
          repositoriesAdded: 1
        }
      ],
      [
        'installation_repositories',
        'handleInstallationRepositoriesEvent',
        {
          message: 'Installation repositories event processed.',
          added: 2,
          removed: 0
        }
      ]
    ])('should handle %s event with valid signature', async (event, methodName, expectedResult) => {
      // Arrange
      webhooksService.verifySignature.mockReturnValue(true);
      webhooksService[methodName].mockResolvedValue(expectedResult);

      // Act
      const result = await controller.handleGithubWebhook(
        'valid-signature',
        event,
        'delivery-123',
        mockPayload,
        mockReq as any,
      );

      // Assert
      expect(result).toEqual(expectedResult);
      expect(webhooksService.verifySignature).toHaveBeenCalledWith(JSON.stringify(mockPayload), 'valid-signature');
      expect(webhooksService[methodName]).toHaveBeenCalledWith(mockPayload);
    });

    it('should return ignored message for unhandled event with valid signature', async () => {
      webhooksService.verifySignature.mockReturnValue(true);

      const result = await controller.handleGithubWebhook(
        'valid-signature',
        'pull_request',
        'delivery-123',
        mockPayload,
        mockReq as any,
      );

      expect(result).toEqual({ message: 'Event ignored' });
      expect(webhooksService.handlePushEvent).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid signature', async () => {
      webhooksService.verifySignature.mockReturnValue(false);

      await expect(
        controller.handleGithubWebhook('invalid-signature', 'push', 'delivery-123', mockPayload, mockReq as any),
      ).rejects.toThrow('Invalid signature');
      expect(webhooksService.verifySignature).toHaveBeenCalledWith(JSON.stringify(mockPayload), 'invalid-signature');
      expect(webhooksService.handlePushEvent).not.toHaveBeenCalled();
    });

    it('should re-throw errors from service handlers', async () => {
      webhooksService.verifySignature.mockReturnValue(true);
      webhooksService.handlePushEvent.mockRejectedValue(new Error('Service failed'));

      await expect(
        controller.handleGithubWebhook('valid-signature', 'push', 'delivery-123', mockPayload, mockReq as any),
      ).rejects.toThrow('Service failed');
    });
  });
});
