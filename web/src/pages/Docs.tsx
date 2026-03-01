import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const DOC_TITLES: Record<string, string> = {
  "getting-started": "Getting Started",
  commands: "Commands",
  providers: "Providers",
  memory: "Memory System",
  skills: "Skills",
  configuration: "Configuration",
};

export default function Docs() {
  const [docs, setDocs] = useState<string[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((data) => {
        setDocs(data.docs);
        if (data.docs.length > 0 && !activeSlug) {
          setActiveSlug(data.docs[0]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeSlug) {
      return;
    }
    fetch(`/api/docs/${activeSlug}`)
      .then((r) => r.json())
      .then((data) => setContent(data.content ?? ""))
      .catch(() => setContent("Failed to load document."));
  }, [activeSlug]);

  const filteredDocs = search
    ? docs.filter(
        (slug) =>
          slug.includes(search.toLowerCase()) ||
          (DOC_TITLES[slug] ?? slug).toLowerCase().includes(search.toLowerCase()),
      )
    : docs;

  return (
    <div className="flex h-full">
      <aside className="w-52 border-r p-4 flex flex-col gap-3">
        <h2 className="font-semibold text-sm">Documentation</h2>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
        <nav className="space-y-1">
          {filteredDocs.map((slug) => (
            <button
              key={slug}
              onClick={() => setActiveSlug(slug)}
              className={cn(
                "block w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
                activeSlug === slug
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground",
              )}
            >
              {DOC_TITLES[slug] ?? slug}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl mx-auto prose prose-sm dark:prose-invert">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </main>
    </div>
  );
}
