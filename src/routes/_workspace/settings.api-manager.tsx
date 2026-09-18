import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Loader2, Search } from "lucide-react";

import { providersQuery } from "@/lib/omnifrog/queries";
import {
  PROVIDERS,
  PROVIDER_CATEGORIES,
  findProvider,
  type ProviderCategoryId,
} from "@/lib/omnifrog/providers/catalog";
import type { ProviderConfig } from "@/lib/omnifrog/types";
import { reorderProvidersFn } from "@/lib/providers.functions";
import { SettingsBackLink } from "@/routes/_workspace/settings";
import { ProviderCard } from "@/components/omnifrog/provider-card";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_workspace/settings/api-manager")({
  head: () => ({
    meta: [
      { title: "API Manager — OmniFrog AI" },
      {
        name: "description",
        content: "Manage AI models, API providers, connections and secure credentials.",
      },
      { property: "og:title", content: "API Manager — OmniFrog AI" },
      {
        property: "og:description",
        content: "Manage AI models, API providers, connections and secure credentials.",
      },
    ],
  }),
  component: ApiManagerScreen,
});

type StatusFilter = "all" | "connected" | "not-connected" | "enabled" | "disabled";

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "connected", label: "Connected" },
  { id: "not-connected", label: "Not connected" },
  { id: "enabled", label: "Enabled" },
  { id: "disabled", label: "Disabled" },
];

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass rounded-xl border border-border/60 px-4 py-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function isConfigured(config: ProviderConfig): boolean {
  return config.status !== "NOT CONFIGURED";
}

function ApiManagerScreen() {
  const queryClient = useQueryClient();
  const { data: configs, isPending, isError, error } = useQuery(providersQuery);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ProviderCategoryId>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [reordering, setReordering] = useState(false);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!configs) return [];
    const needle = search.trim().toLowerCase();
    return configs.filter((config) => {
      if (needle && !config.name.toLowerCase().includes(needle) && !config.id.toLowerCase().includes(needle)) {
        return false;
      }
      switch (statusFilter) {
        case "connected":
          if (!isConfigured(config)) return false;
          break;
        case "not-connected":
          if (isConfigured(config)) return false;
          break;
        case "enabled":
          if (!config.enabled) return false;
          break;
        case "disabled":
          if (config.enabled) return false;
          break;
      }
      if (categoryFilter !== "all") {
        const definition = findProvider(config.id);
        if (definition?.category !== categoryFilter) return false;
      }
      return true;
    });
  }, [configs, search, statusFilter, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<ProviderCategoryId, Array<{ config: ProviderConfig }>>();
    for (const config of filtered) {
      const definition = findProvider(config.id);
      if (!definition) continue;
      const list = map.get(definition.category) ?? [];
      list.push({ config });
      map.set(definition.category, list);
    }
    return map;
  }, [filtered]);

  const aiOrder = useMemo(() => {
    if (!configs) return [];
    return configs
      .filter((config) => findProvider(config.id)?.category === "ai")
      .sort((a, b) => a.priority - b.priority);
  }, [configs]);

  const moveProvider = async (id: string, direction: "up" | "down") => {
    if (!configs) return;
    const ordered = [...configs].sort((a, b) => a.priority - b.priority);
    const index = ordered.findIndex((config) => config.id === id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= ordered.length) return;
    const moved = ordered[index]!;
    const target = ordered[swapWith]!;
    ordered[index] = target;
    ordered[swapWith] = moved;
    setReordering(true);
    try {
      await reorderProvidersFn({ data: { order: ordered.map((config) => config.id) } });
      await queryClient.invalidateQueries({ queryKey: ["omnifrog", "providers"] });
    } finally {
      setReordering(false);
    }
  };

  if (isPending) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 rounded-lg" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !configs) {
    return (
      <div className="soft-panel rounded-xl p-6 text-center">
        <p className="text-sm text-muted-foreground">
          The API Manager could not load provider configuration.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          {error instanceof Error ? error.message : "Try again shortly."}
        </p>
      </div>
    );
  }

  const connectedCount = configs.filter(isConfigured).length;
  const modelCount = configs
    .filter((config) => ["ai", "image"].includes(findProvider(config.id)?.category ?? ""))
    .reduce((total, config) => total + config.models.length, 0);
  const workingCount = configs.filter((config) => config.status === "WORKING").length;
  const errorCount = configs.filter((config) => config.lastError !== null).length;

  return (
    <div className="space-y-5">
      <SettingsBackLink />

      <header>
        <h2 className="text-xl font-semibold">API Manager</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage AI models, API providers, connections and secure credentials.
        </p>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Connected providers" value={connectedCount} />
        <SummaryCard label="Available AI models" value={modelCount} />
        <SummaryCard label="Working providers" value={workingCount} />
        <SummaryCard label="Providers with errors" value={errorCount} />
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search providers…"
            aria-label="Search providers"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              aria-pressed={statusFilter === filter.id}
              className={
                statusFilter === filter.id
                  ? "rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {filter.label}
            </button>
          ))}
          <span className="mx-1 hidden w-px self-stretch bg-border sm:block" aria-hidden />
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            aria-pressed={categoryFilter === "all"}
            className={
              categoryFilter === "all"
                ? "rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            }
          >
            All categories
          </button>
          {PROVIDER_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryFilter(category.id)}
              aria-pressed={categoryFilter === category.id}
              className={
                categoryFilter === category.id
                  ? "rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority (stored only — the PART 03 router will consume it) */}
      {aiOrder.length > 1 ? (
        <section className="soft-panel rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Provider priority</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Order of preference for AI providers. Stored only — automatic routing arrives in a
                later part.
              </p>
            </div>
            {reordering ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden /> : null}
          </div>
          <ol className="mt-3 space-y-1.5">
            {aiOrder.map((config, index) => (
              <li
                key={config.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
              >
                <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{config.name}</span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => void moveProvider(config.id, "up")}
                    disabled={index === 0 || reordering}
                    aria-label={`Move ${config.name} up`}
                    className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void moveProvider(config.id, "down")}
                    disabled={index === aiOrder.length - 1 || reordering}
                    aria-label={`Move ${config.name} down`}
                    className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* Provider cards grouped by category */}
      {filtered.length === 0 ? (
        <p className="soft-panel rounded-xl p-6 text-center text-sm text-muted-foreground">
          No providers match the current search and filters.
        </p>
      ) : (
        PROVIDER_CATEGORIES.map((category) => {
          const entries = grouped.get(category.id);
          if (!entries || entries.length === 0) return null;
          return (
            <section key={category.id} className="space-y-2.5">
              <div>
                <h3 className="text-sm font-medium">{category.label}</h3>
                <p className="text-xs text-muted-foreground">{category.note}</p>
              </div>
              <div className="space-y-2.5">
                {entries.map(({ config }) => {
                  const definition = PROVIDERS.find((provider) => provider.id === config.id);
                  if (!definition) return null;
                  return (
                    <ProviderCard
                      key={config.id}
                      config={config}
                      definition={definition}
                      expanded={expandedIds.has(config.id)}
                      onToggle={() => toggleExpanded(config.id)}
                    />
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
