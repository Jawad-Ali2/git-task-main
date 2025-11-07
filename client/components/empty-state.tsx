import { Loader2, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  loading?: boolean;
  loadingText?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  loading = false,
  loadingText = 'Loading...',
}: EmptyStateProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{loadingText}</p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="py-12 text-center">
        {Icon && <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />}
        <p className="text-muted-foreground mb-2 font-medium">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground mb-4">
            {description}
          </p>
        )}
        {action && (
          <Button onClick={action.onClick}>
            {action.icon && <action.icon className="h-4 w-4 mr-2" />}
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface LoadingStateProps {
  text?: string;
}

export function LoadingState({ text = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="text-center py-12">
      <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}
