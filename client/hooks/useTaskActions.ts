import axiosInstance from '@/lib/axios';

export function useTaskActions() {
  const updateStatus = async (taskId: string, status: 'pending' | 'in-progress' | 'completed') => {
    try {
      await axiosInstance.patch(`/tasks/${taskId}/status`, { status });
      return true;
    } catch (error) {
      console.error('Failed to update task status:', error);
      return false;
    }
  };

  const updatePriority = async (taskId: string, priority: 'low' | 'medium' | 'high') => {
    try {
      await axiosInstance.patch(`/tasks/${taskId}/priority`, { priority });
      return true;
    } catch (error) {
      console.error('Failed to update task priority:', error);
      return false;
    }
  };

  const scanRepository = async (repoId: string) => {
    try {
      await axiosInstance.post(`/tasks/scan/${repoId}`);
      return true;
    } catch (error) {
      console.error('Failed to scan repository:', error);
      return false;
    }
  };

  return {
    updateStatus,
    updatePriority,
    scanRepository,
  };
}
