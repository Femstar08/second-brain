import { SettingsForm } from "@/components/SettingsForm";
import { useConfig } from "@/hooks/useConfig";

export default function Settings() {
  const { config, loading, error, updateConfig } = useConfig();

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading settings...</div>;
  }

  if (error || !config) {
    return <div className="p-6 text-destructive">Failed to load settings: {error}</div>;
  }

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold mb-6">Settings</h2>
        <SettingsForm config={config} onSave={updateConfig} />
      </div>
    </div>
  );
}
