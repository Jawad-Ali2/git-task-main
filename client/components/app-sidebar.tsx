"use client";

import {
  BookOpen,
  Bot,
  FolderGit2,
  LayoutDashboard,
  Settings2,
  ListTodo,
} from "lucide-react";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { SidebarHeader, SidebarContent, SidebarFooter, SidebarRail, Sidebar, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/authHook";
import Image from "next/image";

const data = {
  navMain: [
    {
      title: "Repositories",
      url: "repositories",
      icon: FolderGit2,
      items: [
        {
          title: "All Repositories",
          url: "repositories",
        },
        {
          title: "Add New",
          url: "repositories/add",
        },
      ],
    },
    {
      title: "Tasks",
      url: "tasks",
      icon: ListTodo,
      items: [
        {
          title: "All Tasks",
          url: "tasks",
        },
        {
          title: "By Priority",
          url: "tasks/priority",
        },
        {
          title: "By Status",
          url: "tasks/status",
        },
      ],
    },
    {
      title: "AI Insights",
      url: "insights",
      icon: Bot,
      items: [
        {
          title: "Summary",
          url: "insights",
        },
        {
          title: "Recommendations",
          url: "insights/recommendations",
        },
      ],
    },
    {
      title: "Documentation",
      url: "docs",
      icon: BookOpen,
      items: [
        {
          title: "Getting Started",
          url: "docs/getting-started",
        },
        {
          title: "API Reference",
          url: "docs/api",
        },
      ],
    },
    {
      title: "Settings",
      url: "settings",
      icon: Settings2,
      items: [
        {
          title: "Profile",
          url: "settings/profile",
        },
        {
          title: "Integrations",
          url: "settings/integrations",
        },
        {
          title: "Preferences",
          url: "settings/preferences",
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();

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
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
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
