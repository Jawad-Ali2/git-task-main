import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { TasksService } from '../tasks/tasks.service';
import { RepositoriesService } from '../repositories/repositories.service';
import { BadRequestException } from '@nestjs/common';

describe('WebhooksService', () => {
  let service: WebhooksService;

  // So the parameters are passed in the actual service. We are providing the implementations. Can we not pass the parameters too xd?
  const mockUserRepository = {
    findOne: jest.fn(), // Adding a mocked return implementation here would make this mock repository fixed for one test case only, so you send return values inside tests tailored to needs.
    save: jest.fn()
  }

  const mockTasksService = {

  }

  const mockRepositoriesService = {

  }

  beforeEach(async () => {
    jest.clearAllMocks(); // The mockreturnvalues stay active even in next test

    const module: TestingModule = await Test.createTestingModule({ // Creates a mock Nest.js runtime
      providers: [
        WebhooksService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: TasksService, useValue: mockTasksService },
        { provide: RepositoriesService, useValue: mockRepositoriesService },
      ],
    }).compile(); // compile needs to be awaited as it is an async method

    service = module.get<WebhooksService>(WebhooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('linkInstallationToUser', () => {
    const userId: string = "1";
    const installationId: number = 1

    // HAPPY PATH
    it('should link installation to user', async () => {
      // Arrange
      const mockUser = { id: userId, githubId: '123', githubInstallationId: undefined };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockImplementation(updatedUser => updatedUser);

      // Act
      const result = await service.linkInstallationToUser(userId, installationId);

      // Assert - Also check if functions are called correctly with the right arguments
      expect(result).toEqual({ id: userId, githubId: '123', githubInstallationId: installationId });
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: userId } });
      expect(mockUserRepository.save).toHaveBeenCalledWith(expect.objectContaining({ githubInstallationId: installationId }));
    })

    // ERROR CASE
    it('should throw BadException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act and Assert
      await expect(service.linkInstallationToUser(userId, installationId)).rejects.toThrow(BadRequestException);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: userId } });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    })

    it('should propagate error if findOne fails', async () => {
      mockUserRepository.findOne.mockRejectedValue(new Error)

      await expect(service.linkInstallationToUser(userId, installationId)).rejects.toThrow();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    })

    it('should propagate error if save fails', async () => {
      const mockUser = { id: userId, githubId: '123', githubInstallationId: undefined };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockRejectedValue(new Error);

      await expect(service.linkInstallationToUser(userId, installationId)).rejects.toThrow();
    })

    // EDGE CASE
    it('should overwrite existing installation ID', async () => {
      const mockUser = { id: userId, githubId: '123', githubInstallationId: 123 };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockImplementation(updatedUser => updatedUser)

      const result = await service.linkInstallationToUser(userId, installationId);

      expect(result.githubInstallationId).toBe(installationId);
      expect(mockUserRepository.save).toHaveBeenCalledWith(expect.objectContaining({ githubInstallationId: installationId }))
    })

    // 6. VERIFY DEPENDENCIES
    it('should call findOne with correct parameters', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      // Can skip other parts like this to test a single function
      try {
        await service.linkInstallationToUser(userId, installationId);
      } catch (e) {
        // Expected to throw, but we're testing the findOne call
      }

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: userId } });
    });

    // 7. EDGE CASE
    it('should handle empty userId', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.linkInstallationToUser('', installationId)
      ).rejects.toThrow(BadRequestException);
    });

    // 8. EDGE CASE
    it('should accept zero as valid installation ID', async () => {
      const mockUser = { id: userId, githubId: '456', githubInstallationId: undefined };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.linkInstallationToUser(userId, 0);

      expect(result.githubInstallationId).toBe(0);
    });
  })

});
