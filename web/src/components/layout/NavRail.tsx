import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Settings, BookOpen, Menu, Layers } from "lucide-react";

interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    path: string;
}

const navItems: NavItem[] = [
    { id: "chat", label: "Chat", path: "/", icon: <MessageSquare className="w-5 h-5" /> },
    { id: "docs", label: "Docs", path: "/docs", icon: <BookOpen className="w-5 h-5" /> },
    { id: "settings", label: "Settings", path: "/settings", icon: <Settings className="w-5 h-5" /> },
];

export function NavRail() {
    const location = useLocation();
    const [sidebarExpanded, setSidebarExpanded] = useState(false);

    const toggleSidebar = () => setSidebarExpanded((prev) => !prev);

    // Keyboard shortcut: [ to toggle sidebar
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (
                e.key === "[" &&
                !(
                    e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLTextAreaElement ||
                    (e.target as HTMLElement)?.isContentEditable
                )
            ) {
                e.preventDefault();
                toggleSidebar();
            }
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    return (
        <>
            {/* Desktop: Grouped sidebar */}
            <nav
                role="navigation"
                aria-label="Main navigation"
                className={`hidden md:flex flex-col bg-card border-r border-border shrink-0 transition-all duration-200 ease-in-out z-20 ${sidebarExpanded ? "w-[220px]" : "w-14"
                    }`}
            >
                {/* Header: Logo + toggle */}
                <div
                    className={`flex items-center shrink-0 ${sidebarExpanded ? "px-3 py-3 gap-2.5" : "flex-col py-3 gap-2"
                        }`}
                >
                    <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5 text-primary-foreground" />
                    </div>
                    {sidebarExpanded && (
                        <span className="text-sm font-semibold text-foreground truncate flex-1">
                            Clio Second Brain
                        </span>
                    )}
                    <button
                        onClick={toggleSidebar}
                        title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-smooth shrink-0"
                    >
                        <Menu className="w-4 h-4" />
                    </button>
                </div>

                {/* Nav groups */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
                    <div className="flex flex-col items-center gap-1 mt-2">
                        {navItems.map((item) => (
                            <NavButton
                                key={item.id}
                                item={item}
                                active={location.pathname === item.path}
                                expanded={sidebarExpanded}
                            />
                        ))}
                    </div>
                </div>
            </nav>

            {/* Mobile: Bottom tab bar */}
            <MobileBottomBar currentPath={location.pathname} />
        </>
    );
}

function NavButton({
    item,
    active,
    expanded,
}: {
    item: NavItem;
    active: boolean;
    expanded: boolean;
}) {
    if (expanded) {
        return (
            <Link
                to={item.path}
                aria-current={active ? "page" : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-smooth relative ${active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    } mx-2`}
                style={{ width: "calc(100% - 16px)" }}
            >
                {active && <span className="absolute left-0 w-1 h-6 bg-primary rounded-r" />}
                <div className="shrink-0">{item.icon}</div>
                <span className="text-sm font-medium truncate">{item.label}</span>
            </Link>
        );
    }

    return (
        <Link
            to={item.path}
            title={item.label}
            aria-current={active ? "page" : undefined}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-smooth group relative ${active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
        >
            <div>{item.icon}</div>
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium bg-popover text-popover-foreground border border-border rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                {item.label}
            </span>
            {/* Active indicator */}
            {active && <span className="absolute left-0 w-0.5 h-5 bg-primary rounded-r" />}
        </Link>
    );
}

function MobileBottomBar({ currentPath }: { currentPath: string }) {
    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
            <div className="flex items-center justify-around px-1 h-16">
                {navItems.map((item) => (
                    <Link
                        key={item.id}
                        to={item.path}
                        className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-smooth min-w-[64px] min-h-[48px] ${currentPath === item.path ? "text-primary" : "text-muted-foreground"
                            }`}
                    >
                        <div>{item.icon}</div>
                        <span className="text-[10px] font-medium truncate">{item.label}</span>
                    </Link>
                ))}
            </div>
        </nav>
    );
}
