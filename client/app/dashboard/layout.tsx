'use client';

import { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppSidebar } from "@/components/dashboard/sidebar/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { NotificationProvider, ScanNotificationContainer } from '@/components/dashboard';
import { NotificationContextProvider } from '@/contexts/NotificationContext';
import { useAuth } from '@/hooks/authHook';
import { CenteredLoader } from '@/components/common/page-loading';

interface DashboardLayoutProps {
  children: ReactNode;
}

// Map of routes to breadcrumb labels
const routeLabels: Record<string, string> = {
  '/repositories': 'Select Repositories',
  '/dashboard': 'Dashboard',
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { initialized, isAuthenticated } = useAuth();

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.replace('/login');
    }
  }, [initialized, isAuthenticated, router]);

  if (!initialized || !isAuthenticated) {
    return <CenteredLoader label="Checking authentication..." />;
  }

  // Generate breadcrumbs based on current path
  const generateBreadcrumbs = () => {
    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs = [];

    // Always add home/dashboard as first item
    breadcrumbs.push({
      label: 'Dashboard',
      href: '/dashboard',
    });

    // Build breadcrumbs from path segments
    let currentPath = '';
    for (let i = 0; i < paths.length; i++) {
      currentPath += `/${paths[i]}`;

      // Skip if it's the dashboard itself (already added)
      if (currentPath === '/dashboard') {
        continue;
      }

      const label = routeLabels[currentPath] || paths[i].charAt(0).toUpperCase() + paths[i].slice(1);

      // Last item should not have href (current page)
      if (i === paths.length - 1) {
        breadcrumbs.push({ label });
      } else {
        breadcrumbs.push({ label, href: currentPath });
      }
    }

    // If we're on dashboard page, show current page as last item without link
    if (pathname === '/dashboard') {
      return [{ label: 'Dashboard' }];
    }

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();
  return (
    <NotificationContextProvider enabled={isAuthenticated}>
      <NotificationProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            {/* TODO: Fix the header on top */}
            <header className="bg-bg flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator
                  orientation="vertical"
                  className="mr-2 data-[orientation=vertical]:h-4"
                />
                <Breadcrumb>
                  <BreadcrumbList>
                    {breadcrumbs.map((item, index) => (
                      <div key={index} className="flex items-center">
                        {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                        <BreadcrumbItem className={index === 0 ? "hidden md:block" : ""}>
                          {item.href ? (
                            <BreadcrumbLink href={item.href}>
                              {item.label}
                            </BreadcrumbLink>
                          ) : (
                            <BreadcrumbPage>{item.label}</BreadcrumbPage>
                          )}
                        </BreadcrumbItem>
                      </div>
                    ))}
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="bg-bg flex flex-1 flex-col gap-4 p-4 pt-0 pb-10">
              {children}
            </div>
          </SidebarInset>

          {/* Scan Notification System */}
          <ScanNotificationContainer />
        </SidebarProvider>
      </NotificationProvider>
    </NotificationContextProvider>
  );
}
