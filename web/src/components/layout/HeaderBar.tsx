import { useState, useEffect } from "react";
import { Search, Bell, Sun, Moon, Zap } from "lucide-react";

export function HeaderBar() {
    const [theme, setTheme] = useState<"light" | "dark">("dark");
    const [currentTime, setCurrentTime] = useState("");

    useEffect(() => {
        const isDark = document.documentElement.classList.contains("dark");
        setTheme(isDark ? "dark" : "light");

        const updateTime = () => {
            const now = new Date();
            setCurrentTime(
                now.toLocaleTimeString("en-US", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                })
            );
        };
        updateTime();
        const timer = setInterval(updateTime, 1000);
        return () => clearInterval(timer);
    }, []);

    const toggleTheme = () => {
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.remove("dark");
            setTheme("light");
        } else {
            root.classList.add("dark");
            setTheme("dark");
        }
    };

    return (
        <header
            role="banner"
            aria-label="Application header"
            className="h-14 bg-card/80 backdrop-blur-md border-b border-border px-4 flex items-center justify-between shrink-0 z-10 sticky top-0"
        >
            {/* Left: Page title + breadcrumb */}
            <div className="flex items-center gap-3">
                <h1 className="text-sm font-semibold text-foreground">Clio Console</h1>
                <span className="text-xs text-muted-foreground font-mono-tight px-2 py-0.5 bg-secondary rounded-md border border-border">
                    v0.1
                </span>
            </div>

            {/* Center: Search trigger + Quick stats (desktop only) */}
            <div className="hidden md:flex items-center gap-4 flex-1 max-w-md mx-6">
                <button className="flex-1 flex items-center gap-2 h-8 px-3 rounded-md bg-secondary/70 border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors w-full cursor-not-allowed opacity-70">
                    <Search className="w-4 h-4" />
                    <span>Search memory...</span>
                    <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border font-mono">
                        &#8984;K
                    </kbd>
                </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                {/* Connection status */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success rounded-md border border-success/20">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                    </span>
                    <span className="text-xs font-medium font-mono-tight">Core Online</span>
                </div>

                <div className="hidden lg:flex items-center justify-center px-3 py-1.5 bg-secondary rounded-md border border-border digital-clock text-xs">
                    {currentTime || "00:00:00"}
                </div>

                <button className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-smooth flex items-center justify-center relative">
                    <Bell className="w-4 h-4" />
                </button>

                <button
                    onClick={toggleTheme}
                    className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-smooth flex items-center justify-center"
                >
                    {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>

                <div className="h-8 w-8 rounded-full bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center border border-primary/30 ml-1">
                    <Zap className="w-4 h-4" />
                </div>
            </div>
        </header>
    );
}
