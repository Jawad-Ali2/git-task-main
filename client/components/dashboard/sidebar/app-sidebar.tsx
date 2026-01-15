"use client";

import { NavMain } from "@/components/dashboard/sidebar/nav-main";
import { NavUser } from "@/components/dashboard/sidebar/nav-user";
import { SidebarHeader, SidebarContent, SidebarFooter, Sidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/authHook";
import { Bot, Folder, FolderGit2, FolderLock, LayoutDashboard, ListTodo, Loader2 } from "lucide-react";
import Image from "next/image";
import { NavProjects } from "./nav-projects";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { fetchRepositories, selectRepositories, selectRepositoriesLoading } from "@/redux/repositoriesSlice";
import { useEffect, useMemo, useRef } from "react";
import { NotificationCenter } from "@/components/dashboard";

const mainMenuItems = [
  {
    key: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
  },
  {
    key: "repositories",
    href: "/dashboard/repositories",
    icon: FolderGit2,
    label: "Repositories",
  },
  {
    key: "tasks",
    href: "/dashboard/tasks",
    icon: ListTodo,
    label: "All Tasks",
  },
  {
    key: "ai-insights",
    href: "/ai-insights",
    icon: Bot,
    label: "AI Insights",
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const repositories = useAppSelector(selectRepositories);
  const repositoriesLoading = useAppSelector(selectRepositoriesLoading);
  const hasFetchedRepos = useRef(false);

  // Defer repository fetching slightly to prioritize initial render
  useEffect(() => {
    if (user && !hasFetchedRepos.current) {
      // Use setTimeout to defer this until after initial render
      // const timer = setTimeout(() => {
        dispatch(fetchRepositories());
        hasFetchedRepos.current = true;
      // }, 10);
      
      // return () => clearTimeout(timer);s
    }
  }, [user, dispatch]);

  // Memoize projects to avoid unnecessary re-renders
  const projects = useMemo(() => {
    return repositories.map(repo => ({
      name: repo.name,
      url: `/dashboard/repositories/${repo.id}/tasks`,
      icon: repo.private ? FolderLock : Folder,
      id: repo.id,
    }));
  }, [repositories]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:justify-center">
          <Image
            src="/logo.png"
            alt="GitTask Logo"
            className="size-auto"
            width={32}
            height={32}
          />
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold">GitTask</span>
            <span className="truncate text-xs text-muted-foreground">
              Track your TODOs
            </span>
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <NotificationCenter />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainMenuItems} />
        {repositoriesLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length > 0 ? (
          <NavProjects projects={projects} />
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        {user && (
          <NavUser
            user={{
              name: user.name ?? "",
              email: user.email ?? "",
              avatarUrl: user.avatarUrl ?? "",
            }}
          />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
