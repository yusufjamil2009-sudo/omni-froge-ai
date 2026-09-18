import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Eye, EyeOff, Loader2, Plus, RefreshCw, TriangleAlert, X } from "lucide-react";

import { CAPABILITY_LABELS, type CapabilityId, type ProviderDefinition } from "@/lib/omnifrog/providers/catalog";
import type { ModelInfo, ProviderConfig, ProviderStatus } from "@/lib/omnifrog/types";
import {
  disconnectProviderFn,
  refreshProviderModelsFn,
  saveProvider,
  setManualModelsFn,
  setDefaultProviderFn,
  testProvider,
  toggleProviderFallbackFn,
  toggleProviderFn,
} from "@/lib/providers.functions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const STATUS_STYLE: Record<ProviderStatus, { dot: string; text: string }> = {
  WORKING: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  TESTING: { dot: "text-cyan-600 dark:text-cyan-400", text: "text-cyan-600 dark:text-cyan-400" },
  CONFIGURED: { dot: "bg-sky-400", text: "text-sky-700 dark:text-sky-300" },
  "NOT CONFIGURED": { dot: "bg-slate-400", text: "text-muted-foreground" },
  "RATE LIMITED": { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  "AUTH ERROR": { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  "MODEL ERROR": { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  UNAVAILABLE: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  DISABLED: { dot: "bg-slate-400", text: "text-muted-foreground" },
};

function StatusChip({ status }: { status: ProviderStatus }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE["NOT CONFIGURED"];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${style.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function formatWhen(value: string | null): string {
  if (!value) return "never";
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

function ModelBadges({ model }: { model: ModelInfo | undefined }) {
  if (!model) return null;
  const flags: string[] = [];
  if (model.reasoning) flags.push(CAPABILITY_LABELS.reasoning);
  if (model.vision) flags.push(CAPABILITY_LABELS.vision);
  if (model.image) flags.push(CAPABILITY_LABELS.image);
  if (model.embeddings) flags.push(CAPABILITY_LABELS.embeddings);
  if (flags.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {flags.map((flag) => (
        <Badge key={flag} variant="outline" className="text-[10px] font-normal px-1.5">
          {flag}
        </Badge>
      ))}
    </div>
  );
}

interface ProviderCardProps {
  config: ProviderConfig;
  definition: ProviderDefinition;
  expanded: boolean;
  onToggle: () => void;
}

export function ProviderCard({ config, definition, expanded, onToggle }: ProviderCardProps) {
  const queryClient = useQueryClient();

  const [values, setValues] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [selectedModel, setSelectedModel] = useState<string | null>(config.selectedModel);
  const [makeDefault, setMakeDefault] = useState(config.isDefault);
  const [manualInput, setManualInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Awaited<ReturnType<typeof testProvider>> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [busy, setBusy] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["omnifrog", "providers"] });
  };

  const setField = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));
  const toggleVisible = (key: string) => setVisible((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    const credentials: Record<string, string> = {};
    for (const field of definition.fields) {
      const value = values[field.key]?.trim();
      if (value) credentials[field.key] = value;
    }
    try {
      const result = await saveProvider({
        data: {
          providerId: config.id,
          credentials,
          selectedModel,
          makeDefault,
          enabled: config.enabled,
          fallbackEligible: config.fallbackEligible,
        },
      });
      setSaveMessage(
        result.ok
          ? { ok: true, message: "Saved." }
          : { ok: false, message: result.message },
      );
      setValues({});
      invalidate();
    } catch {
      setSaveMessage({ ok: false, message: "Saving failed. Try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testProvider({ data: { providerId: config.id } });
      setTestResult(result);
      invalidate();
    } catch {
      setTestResult({
        ok: false,
        status: "UNAVAILABLE",
        model: null,
        testedAt: new Date().toISOString(),
        errorClass: "UNKNOWN_ERROR",
        reason: "The connection test could not run.",
        retryAfterSeconds: null,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSetDefault = async () => {
    setBusy(true);
    try {
      await setDefaultProviderFn({ data: { providerId: config.id } });
      invalidate();
    } finally {
      setBusy(false);
    }
  };

  const handleToggleEnabled = async (next: boolean) => {
    setBusy(true);
    try {
      await toggleProviderFn({ data: { providerId: config.id, enabled: next } });
      invalidate();
    } finally {
      setBusy(false);
    }
  };

  const handleToggleFallback = async (next: boolean) => {
    setBusy(true);
    try {
      await toggleProviderFallbackFn({ data: { providerId: config.id, eligible: next } });
      invalidate();
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnectProviderFn({ data: { providerId: config.id } });
      setConfirmDisconnect(false);
      setTestResult(null);
      setSaveMessage(null);
      setSelectedModel(null);
      setMakeDefault(false);
      invalidate();
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshModels = async () => {
    setBusy(true);
    try {
      await refreshProviderModelsFn({ data: { providerId: config.id } });
      invalidate();
    } finally {
      setBusy(false);
    }
  };

  const addManualModel = async () => {
    const id = manualInput.trim();
    if (!id) return;
    setBusy(true);
    try {
      const ids = [...config.models.map((model) => model.id), id];
      await setManualModelsFn({ data: { providerId: config.id, ids } });
      setManualInput("");
      invalidate();
    } finally {
      setBusy(false);
    }
  };

  const removeManualModel = async (id: string) => {
    setBusy(true);
    try {
      const ids = config.models.map((model) => model.id).filter((modelId) => modelId !== id);
      await setManualModelsFn({ data: { providerId: config.id, ids } });
      if (selectedModel === id) setSelectedModel(null);
      invalidate();
    } finally {
      setBusy(false);
    }
  };

  const hasModels = config.models.length > 0;

  return (
    <div className="glass rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-sm truncate">{definition.name}</span>
            {config.isDefault ? (
              <Badge className="text-[10px] px-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/10">
                Default
              </Badge>
            ) : null}
            {!config.enabled ? (
              <Badge variant="outline" className="text-[10px] px-1.5">
                Disabled
              </Badge>
            ) : null}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <StatusChip status={config.status} />
            {config.selectedModel ? <span className="truncate">{config.selectedModel}</span> : null}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="border-t border-border/60 px-4 py-4 space-y-5">
          {definition.blurb ? <p className="text-xs text-muted-foreground">{definition.blurb}</p> : null}

          {/* Credentials */}
          <div className="space-y-3">
            {definition.fields.map((field) => {
              const stored = config.fields[field.key]?.set ?? false;
              const isSecret = field.secret;
              const inputType = isSecret && !visible[field.key] ? "password" : "text";
              return (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs" htmlFor={`${config.id}-${field.key}`}>
                    {field.label}
                    {field.required ? <span className="text-red-500"> *</span> : null}
                    {stored ? (
                      <span className="ml-2 text-[10px] font-normal text-emerald-600 dark:text-emerald-400">
                        stored securely
                      </span>
                    ) : null}
                  </Label>
                  <div className="relative">
                    <Input
                      id={`${config.id}-${field.key}`}
                      type={inputType}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={stored ? "••••••••" : field.placeholder}
                      value={values[field.key] ?? ""}
                      onChange={(event) => setField(field.key, event.target.value)}
                      className={isSecret ? "pr-9" : undefined}
                    />
                    {isSecret ? (
                      <button
                        type="button"
                        onClick={() => toggleVisible(field.key)}
                        aria-label={visible[field.key] ? "Hide value" : "Show value"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                      >
                        {visible[field.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    ) : null}
                  </div>
                  {field.help ? <p className="text-[10px] text-muted-foreground">{field.help}</p> : null}
                </div>
              );
            })}
          </div>

          {/* Models */}
          {definition.modelDiscovery !== "none" ? (
            <div className="space-y-2">
              <Label className="text-xs">Model</Label>
              {definition.modelDiscovery === "api" ? (
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedModel ?? ""}
                    onValueChange={(value) => setSelectedModel(value === "" ? null : value)}
                  >
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder={hasModels ? "Choose a model" : "No models loaded yet"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {config.models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshModels}
                    disabled={busy}
                    className="shrink-0 gap-1.5"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Refresh
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {hasModels ? (
                    <div className="flex flex-wrap gap-1.5">
                      {config.models.map((model) => (
                        <span
                          key={model.id}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-accent/40 px-2 py-0.5 text-xs"
                        >
                          {model.id}
                          <button
                            type="button"
                            onClick={() => removeManualModel(model.id)}
                            aria-label={`Remove model ${model.id}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No models added yet — enter model ids manually.</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      value={manualInput}
                      onChange={(event) => setManualInput(event.target.value)}
                      placeholder="e.g. stability-ai/sdxl"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void addManualModel();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void addManualModel()}
                      disabled={busy || manualInput.trim().length === 0}
                      className="shrink-0 gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                </div>
              )}
              {selectedModel ? <ModelBadges model={config.models.find((m) => m.id === selectedModel)} /> : null}
            </div>
          ) : null}

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={makeDefault}
                onCheckedChange={(checked) => setMakeDefault(checked === true)}
                aria-label="Use as default provider"
              />
              Use as default
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch checked={config.enabled} onCheckedChange={(next) => void handleToggleEnabled(next)} />
              Enabled
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch
                checked={config.fallbackEligible}
                onCheckedChange={(next) => void handleToggleFallback(next)}
              />
              Fallback eligible
            </label>
          </div>

          {/* Test */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleTest}
                disabled={testing || !definition.testable}
                className="gap-1.5"
              >
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {testing ? "Testing…" : "Test connection"}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSave()}
                disabled={saving}
                className="gap-1.5"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </Button>
              {config.configured ? (
                confirmDisconnect ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleDisconnect()}
                    disabled={busy}
                  >
                    Confirm disconnect
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDisconnect(true)}
                    className="text-red-600 dark:text-red-400 hover:text-red-600"
                  >
                    Disconnect
                  </Button>
                )
              ) : null}
              {!definition.testable ? (
                <span className="text-[10px] text-muted-foreground">{definition.testNote}</span>
              ) : null}
            </div>

            {testResult ? (
              testResult.ok ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Connection successful{testResult.model ? ` — ${testResult.model} responded` : ""}. Tested just now.
                </p>
              ) : (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Connection failed: {testResult.reason ?? "unknown reason"}
                  {testResult.errorClass ? ` (${testResult.errorClass})` : ""}
                  {testResult.retryAfterSeconds ? ` — retry after ${testResult.retryAfterSeconds}s` : ""}
                </p>
              )
            ) : null}

            {saveMessage ? (
              <p className={`text-xs ${saveMessage.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {saveMessage.message}
              </p>
            ) : null}

            {config.lastError ? (
              <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Last error: {config.lastError.reason} ({config.lastError.errorClass}) — {formatWhen(config.lastError.at)}
                </span>
              </p>
            ) : null}
            <p className="text-[10px] text-muted-foreground">
              Last tested: {formatWhen(config.lastTestedAt)}
              {config.usage.requests ? ` · ${config.usage.requests} request${config.usage.requests === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
