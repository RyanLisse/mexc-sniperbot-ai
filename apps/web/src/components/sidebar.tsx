"use client";

import {
  Activity,
  LayoutDashboard,
  Settings,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ModeToggle } from "./mode-toggle";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Trading", href: "/trading", icon: Zap },
  { name: "New Coins", href: "/new-coins", icon: Activity },
  { name: "Settings", href: "/settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "flex h-screen flex-col border-r bg-background transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!isCollapsed && <h2 className="font-bold text-lg">MEXC SNIPER</h2>}
        <Button
          onClick={() => setIsCollapsed(!isCollapsed)}
          size="icon"
          variant="ghost"
        >
          <LayoutDashboard className="h-5 w-5" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link href={item.href} key={item.href}>
              <Button
                className={cn(
                  "w-full justify-start",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                  isCollapsed && "justify-center px-0"
                )}
                variant={isActive ? "default" : "ghost"}
              >
                <Icon className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
                {!isCollapsed && <span>{item.name}</span>}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <div
          className={cn(
            "flex items-center",
            isCollapsed ? "justify-center" : "justify-between"
          )}
        >
          {!isCollapsed && (
            <span className="text-muted-foreground text-sm">Theme</span>
          )}
          <ModeToggle />
        </div>
      </div>
    </div>
  );
}
