import { useState, useEffect } from 'react';

interface Task {
  id: string;
  type: string;
  description: string;
  filePath: string;
  lineNumber: number;
  priority: string;
  status: string;
  repository: {
    id: string;
    name: string;
  };
  author?: string;
  authorEmail?: string;
  authorAvatar?: string;
  codeSnippet?: string;
  context?: string;
}

interface UseTaskFiltersProps {
  tasks: Task[];
  initialTypeFilter?: string;
  initialPriorityFilter?: string;
  initialStatusFilter?: string;
  initialRepoFilter?: string;
}

export function useTaskFilters({
  tasks,
  initialTypeFilter = 'all',
  initialPriorityFilter = 'all',
  initialStatusFilter = 'all',
  initialRepoFilter = 'all',
}: UseTaskFiltersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter);
  const [priorityFilter, setPriorityFilter] = useState(initialPriorityFilter);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [repoFilter, setRepoFilter] = useState(initialRepoFilter);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>(tasks);

  useEffect(() => {
    filterTasks();
  }, [tasks, searchQuery, typeFilter, priorityFilter, statusFilter, repoFilter]);

  const filterTasks = () => {
    let filtered = [...tasks];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (task) =>
          task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.filePath.toLowerCase().includes(searchQuery.toLowerCase()) ||
          task.repository?.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((task) => task.type === typeFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((task) => task.priority === priorityFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((task) => task.status === statusFilter);
    }

    // Repository filter
    if (repoFilter !== 'all') {
      filtered = filtered.filter((task) => task.repository?.id === repoFilter);
    }

    setFilteredTasks(filtered);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setPriorityFilter('all');
    setStatusFilter('all');
    setRepoFilter('all');
  };

  return {
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    priorityFilter,
    setPriorityFilter,
    statusFilter,
    setStatusFilter,
    repoFilter,
    setRepoFilter,
    filteredTasks,
    clearFilters,
  };
}
