"use client";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { SidebarHeader, SidebarContent, SidebarFooter, Sidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/authHook";
import { Bot, Folder, FolderGit2, FolderLock, LayoutDashboard, ListTodo } from "lucide-react";
import Image from "next/image";
import { NavProjects } from "./nav-projects";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { fetchRepositories, selectRepositories, selectRepositoriesLoading } from "@/redux/repositoriesSlice";
import { useEffect } from "react";
import { NotificationCenter } from "@/components/NotificationCenter";

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

  useEffect(() => {
    if (user) {
      dispatch(fetchRepositories());
    }
  }, [user, dispatch]);

  const projects = repositories.map(repo => ({
    name: repo.name,
    url: `/dashboard/repositories/${repo.id}/tasks`,
    icon: repo.private ? FolderLock : Folder,
    id: repo.id,
  }));

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
        {!repositoriesLoading && projects.length > 0 && (
          <NavProjects projects={projects} />
        )}
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
