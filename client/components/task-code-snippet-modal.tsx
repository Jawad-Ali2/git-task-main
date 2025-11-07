'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Code, Copy, ExternalLink, User } from 'lucide-react';
import { useState } from 'react';

interface Task {
  id: string;
  type: string;
  description: string;
  filePath: string;
  lineNumber: number;
  priority: string;
  status: string;
  codeSnippet?: string;
  context?: string;
  author?: string;
  authorEmail?: string;
  authorAvatar?: string;
}

interface TaskCodeSnippetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
}

export function TaskCodeSnippetModal({ open, onOpenChange, task }: TaskCodeSnippetModalProps) {
  const [copied, setCopied] = useState(false);

  if (!task) return null;

  const handleCopy = () => {
    if (task.codeSnippet) {
      navigator.clipboard.writeText(task.codeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Dummy code snippet if not provided
  const codeSnippet = task.codeSnippet || `// ${task.filePath}:${task.lineNumber}
function calculateTotal(items) {
  // ${task.type}: ${task.description}
  let total = 0;
  for (let item of items) {
    total += item.price;
  }
  return total;
}`;

  // Dummy context if not provided
  const context = task.context || `This task requires updating the ${task.filePath} file. The current implementation needs to be reviewed and improved according to the ${task.type} comment found at line ${task.lineNumber}.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Task Details & Code Context
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{task.type}</Badge>
              <Badge variant="outline">{task.priority} priority</Badge>
              <Badge variant="outline">{task.status}</Badge>
            </div>

            <div>
              <p className="font-medium text-lg">{task.description}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {task.filePath}:{task.lineNumber}
              </p>
            </div>

            {/* Author Info */}
            {task.author && (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {task.authorAvatar ? (
                    <img
                      src={task.authorAvatar}
                      alt={task.author}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <User className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{task.author}</p>
                  {task.authorEmail && (
                    <p className="text-xs text-muted-foreground">{task.authorEmail}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Context Section */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">What needs to be done?</h4>
            <div className="p-4 border rounded-lg bg-blue-500/5 border-blue-500/20">
              <p className="text-sm text-foreground/90">{context}</p>
            </div>
          </div>

          {/* Code Snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Code Snippet</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8"
              >
                <Copy className="h-3 w-3 mr-2" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="relative">
              <pre className="p-4 border rounded-lg bg-black/90 text-green-400 overflow-x-auto text-xs font-mono">
                <code>{codeSnippet}</code>
              </pre>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" asChild>
              <a
                href={`vscode://file/${task.filePath}:${task.lineNumber}`}
                className="flex items-center justify-center"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in VS Code
              </a>
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
