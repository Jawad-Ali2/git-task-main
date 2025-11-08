import { Search, FilterX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TaskFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeChange: (value: string) => void;
  priorityFilter: string;
  onPriorityChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  repoFilter?: string;
  onRepoChange?: (value: string) => void;
  repositories?: Array<{ id: string; name: string }>;
  onClearFilters: () => void;
  showRepoFilter?: boolean;
  totalCount: number;
  filteredCount: number;
  layout?: 'horizontal' | 'vertical';
}

export function TaskFilters({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeChange,
  priorityFilter,
  onPriorityChange,
  statusFilter,
  onStatusChange,
  repoFilter,
  onRepoChange,
  repositories,
  onClearFilters,
  showRepoFilter = false,
  totalCount,
  filteredCount,
  layout = 'horizontal',
}: TaskFiltersProps) {
  return (
    <div className="space-y-2">
      <div className={`flex items-center ${layout === 'horizontal' ? 'justify-between' : 'flex-col gap-4'}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 w-full rounded-full md:w-96"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={onTypeChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="TODO">TODO</SelectItem>
              <SelectItem value="FIXME">FIXME</SelectItem>
              <SelectItem value="HACK">HACK</SelectItem>
              <SelectItem value="NOTE">NOTE</SelectItem>
              <SelectItem value="BUG">BUG</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={onPriorityChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          {showRepoFilter && repositories && onRepoChange && (
            <Select value={repoFilter} onValueChange={onRepoChange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Repository" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Repositories</SelectItem>
                {repositories.map((repo) => (
                  <SelectItem key={repo.id} value={repo.id}>
                    {repo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={onClearFilters}
            title="Clear Filters"
          >
            <FilterX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <p className="pl-0.5 text-xs text-muted-foreground">
          Showing {filteredCount} of {totalCount} tasks
        </p>
      </div>
    </div>
  );
}
