import { Activity, MessageCircle, BarChart3, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Stats {
    totalSessions: number;
    activeSessions: number;
    totalMessages: number;
    uptime: string;
    errors: number;
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: "up" | "down" | "stable";
    subtitle?: string;
    color?: "default" | "success" | "warning" | "danger";
}

function StatCard({ title, value, icon, trend, subtitle, color = "default" }: StatCardProps) {
    const colorClasses = {
        default: "bg-card/80 border-border/50",
        success: "bg-success/10 border-success/30",
        warning: "bg-warning/10 border-warning/30",
        danger: "bg-destructive/10 border-destructive/30",
    };

    const iconColorClasses = {
        default: "text-primary",
        success: "text-success",
        warning: "text-warning",
        danger: "text-destructive",
    };

    return (
        <div className={`p-6 rounded-2xl border backdrop-blur-xl ${colorClasses[color]} transition-smooth hover:border-primary/50 group`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground/80 transition-colors">{title}</p>
                    <div className="flex items-baseline space-x-2 mt-2">
                        <p className="text-3xl font-bold text-foreground font-mono-tight">{value}</p>
                        {trend && (
                            <span
                                className={`text-sm ${trend === "up"
                                        ? "text-success"
                                        : trend === "down"
                                            ? "text-destructive"
                                            : "text-muted-foreground"
                                    }`}
                            >
                                {trend === "up" ? "↗" : trend === "down" ? "↘" : "→"}
                            </span>
                        )}
                    </div>
                    {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
                </div>
                <div className={`p-3 rounded-lg bg-background/50 ${iconColorClasses[color]}`}>{icon}</div>
            </div>
        </div>
    );
}

export function DashboardStats({ stats }: { stats: Stats }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 w-full">
            <StatCard
                title="Total Sessions"
                value={stats.totalSessions}
                icon={<BarChart3 className="w-6 h-6" />}
                trend="stable"
                color="default"
            />

            <StatCard
                title="Active Sessions"
                value={stats.activeSessions}
                icon={<Activity className="w-6 h-6" />}
                trend="up"
                subtitle={`${stats.totalSessions > 0
                        ? Math.round((stats.activeSessions / stats.totalSessions) * 100)
                        : 0
                    }% active capacity`}
                color="success"
            />

            <StatCard
                title="Messages"
                value={stats.totalMessages.toLocaleString()}
                icon={<MessageCircle className="w-6 h-6" />}
                trend="up"
                subtitle="Total processed"
                color="default"
            />

            <StatCard
                title="Uptime"
                value={stats.uptime}
                icon={<Clock className="w-6 h-6" />}
                trend="stable"
                subtitle="System running"
                color="default"
            />

            <StatCard
                title="Errors"
                value={stats.errors}
                icon={stats.errors > 0 ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                trend={stats.errors > 0 ? "up" : "stable"}
                subtitle="Past 24h"
                color={stats.errors > 0 ? "danger" : "success"}
            />
        </div>
    );
}
