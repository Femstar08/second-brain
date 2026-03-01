import { MessageSquare, Settings, BookOpen } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "Chat", icon: MessageSquare },
  { path: "/settings", label: "Settings", icon: Settings },
  { path: "/docs", label: "Docs", icon: BookOpen },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-60 border-r bg-muted/30 flex flex-col h-full">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight">Clio</h1>
        <p className="text-xs text-muted-foreground">Second Brain</p>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              location.pathname === path
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
