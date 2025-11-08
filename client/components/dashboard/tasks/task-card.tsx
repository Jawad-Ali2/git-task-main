import { Code, FileText, User, ExternalLink, ChartNoAxesCombined } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { PriorityBadge, StatusBadge, TypeBadge } from '../badges';

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

interface TaskCardProps {
  task: Task;
  onViewCode?: (task: Task) => void;
  onCreateCard?: (task: Task) => void;
  onUpdateStatus?: (taskId: string, status: 'pending' | 'in-progress' | 'completed') => void;
  onUpdatePriority?: (taskId: string, priority: 'low' | 'medium' | 'high') => void;
  showRepository?: boolean;
  showActions?: boolean;
  showStatusSelect?: boolean;
  showPrioritySelect?: boolean;
  layout?: 'compact' | 'detailed';
}

export function TaskCard({
  task,
  onViewCode,
  onCreateCard,
  onUpdateStatus,
  onUpdatePriority,
  showRepository = false,
  showActions = true,
  showStatusSelect = false,
  showPrioritySelect = false,
  layout = 'detailed',
}: TaskCardProps) {
  if (layout === 'compact') {
    return (
      <div className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <TypeBadge type={task.type} />
                <PriorityBadge priority={task.priority} variant="outline" />
                <StatusBadge status={task.status} />
              </div>

              <p className="text-lg font-medium mb-2">{task.description}</p>

              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap mb-3">
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  <span className="truncate">{task.filePath}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Code className="h-4 w-4" />
                  <span>Line {task.lineNumber}</span>
                </div>
                {showRepository && (
                  <Badge variant="secondary">{task.repository.name}</Badge>
                )}
              </div>

              {task.author && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-3 w-3 text-primary" />
                    </div>
                    <span>{task.author}</span>
                  </div>
                </div>
              )}
            </div>

            {showActions && (
              <div className="flex flex-col gap-2">
                {onViewCode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewCode(task)}
                  >
                    <Code className="h-4 w-4 mr-2" />
                    View Code
                  </Button>
                )}
                {onCreateCard && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCreateCard(task)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Create Card
                  </Button>
                )}
              </div>
            )}
          </div>
      </div>
    );
  }

  // Detailed layout (for repository tasks page)
  return (
    <div className="flex items-center gap-3 py-4">
      <div className="flex-1">
        <div className="flex items-stretch justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {task.author && task.authorAvatar && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Image 
                      src={task.authorAvatar} 
                      alt={task.author} 
                      width={30} 
                      height={30} 
                      className="rounded-full" 
                    />
                  </div>
                </div>
              )}
              <TypeBadge type={task.type} />
              <p className="text-lg font-medium">{task.description}</p>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap mb-3">
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                <span className="truncate">{task.filePath}</span>
              </div>
              <div className="flex items-center gap-1">
                <Code className="h-4 w-4" />
                <span>Line {task.lineNumber}</span>
              </div>
              <div className="flex items-center gap-1">
                <ChartNoAxesCombined className="h-4 w-4" />
                <span>Debt: {task.lineNumber}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-col items-end gap-2">
              {showPrioritySelect && onUpdatePriority ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">priority:</span>
                  <Select
                    value={task.priority}
                    onValueChange={(value) => onUpdatePriority(task.id, value as any)}
                  >
                    <SelectTrigger className="w-[110px] h-8">
                      <SelectValue>
                        <span className={`text-sm capitalize ${
                          task.priority === 'high' ? 'text-red-500' : 
                          task.priority === 'medium' ? 'text-yellow-500' : 
                          'text-green-500'
                        }`}>
                          {task.priority}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <PriorityBadge priority={task.priority} />
              )}

              {showStatusSelect && onUpdateStatus ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">status:</span>
                  <Select
                    value={task.status}
                    onValueChange={(value) => onUpdateStatus(task.id, value as any)}
                  >
                    <SelectTrigger className="w-[140px] h-7">
                      <StatusBadge status={task.status} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <StatusBadge status={task.status} />
              )}
            </div>
          </div>
        </div>
      </div>

      {showActions && (
        <>
          <div className="h-[65px] w-px bg-gray-300" />
          <div className="flex items-center shrink-0">
            <div className="flex flex-col gap-2">
              {onViewCode && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => onViewCode(task)}
                  title="View Code"
                >
                  <Code className="h-4 w-4" />
                </Button>
              )}
              {onCreateCard && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => onCreateCard(task)}
                  title="Create Trello Card"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
