import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

export function CenteredLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function AuthPageSkeleton() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function MarketingPageSkeleton() {
  return (
    <div className="space-y-10 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-4 text-center">
        <Skeleton className="mx-auto h-10 w-3/4" />
        <Skeleton className="mx-auto h-5 w-2/3" />
        <Skeleton className="mx-auto h-10 w-40" />
      </div>

      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function DashboardSectionSkeleton({
  cards = 3,
  rows = 5,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {cards > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: cards }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-36" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-52" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full" />
          <div className="flex justify-end gap-3">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-28" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
