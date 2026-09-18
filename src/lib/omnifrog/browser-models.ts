/**
 * OmniFrog AI — PART 04 browser model catalog.
 *
 * Only model IDs intended for WebLLM/WebGPU browser inference are listed here.
 * The catalog is additive: it does not change PART 03 provider routing.
 */

export type BrowserModelFamily =
  | "Llama"
  | "Qwen"
  | "Gemma"
  | "Phi"
  | "Mistral"
  | "SmolLM"
  | "DeepSeek"
  | "Hermes"
  | "Other";

export type BrowserModelTask =
  | "general"
  | "coding"
  | "math"
  | "reasoning"
  | "vision";

export interface BrowserModelDefinition {
  id: string;
  name: string;
  family: BrowserModelFamily;
  tasks: BrowserModelTask[];
  approximateVramMb: number | null;
  lowResource: boolean;
  contextTokens: number;
  requiresShaderF16?: boolean;
}

export const BROWSER_MODELS: readonly BrowserModelDefinition[] = [
  {
    id: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
    name: "Llama 3.2 1B Instruct",
    family: "Llama",
    tasks: ["general", "coding"],
    approximateVramMb: 1400,
    lowResource: true,
    contextTokens: 4096,
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 3B Instruct",
    family: "Llama",
    tasks: ["general", "coding"],
    approximateVramMb: 2300,
    lowResource: true,
    contextTokens: 4096,
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
    name: "Qwen 2.5 1.5B Instruct",
    family: "Qwen",
    tasks: ["general", "coding", "math"],
    approximateVramMb: 1900,
    lowResource: true,
    contextTokens: 4096,
  },
  {
    id: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 Coder 1.5B",
    family: "Qwen",
    tasks: ["coding"],
    approximateVramMb: 1600,
    lowResource: true,
    contextTokens: 4096,
  },
  {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 3B Instruct",
    family: "Qwen",
    tasks: ["general", "coding", "math"],
    approximateVramMb: 2500,
    lowResource: false,
    contextTokens: 4096,
  },
  {
    id: "Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 Coder 3B",
    family: "Qwen",
    tasks: ["coding"],
    approximateVramMb: 2500,
    lowResource: false,
    contextTokens: 4096,
  },
  {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    name: "Qwen 3 0.6B",
    family: "Qwen",
    tasks: ["general", "coding", "reasoning"],
    approximateVramMb: 1000,
    lowResource: true,
    contextTokens: 4096,
  },
  {
    id: "Qwen3-1.7B-q4f16_1-MLC",
    name: "Qwen 3 1.7B",
    family: "Qwen",
    tasks: ["general", "coding", "reasoning"],
    approximateVramMb: 1800,
    lowResource: true,
    contextTokens: 4096,
  },
  {
    id: "Qwen3-4B-q4f16_1-MLC",
    name: "Qwen 3 4B",
    family: "Qwen",
    tasks: ["general", "coding", "reasoning"],
    approximateVramMb: 3200,
    lowResource: false,
    contextTokens: 4096,
  },
  {
    id: "gemma-2-2b-it-q4f16_1-MLC",
    name: "Gemma 2 2B IT",
    family: "Gemma",
    tasks: ["general", "coding"],
    approximateVramMb: 1900,
    lowResource: true,
    contextTokens: 4096,
    requiresShaderF16: true,
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    name: "Phi 3.5 Mini Instruct",
    family: "Phi",
    tasks: ["general", "coding", "reasoning"],
    approximateVramMb: 3700,
    lowResource: false,
    contextTokens: 4096,
  },
  {
    id: "Phi-4-mini-instruct-q4f16_1-MLC",
    name: "Phi 4 Mini Instruct",
    family: "Phi",
    tasks: ["general", "coding", "reasoning"],
    approximateVramMb: 3400,
    lowResource: false,
    contextTokens: 4096,
  },
  {
    id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
    name: "Mistral 7B Instruct v0.3",
    family: "Mistral",
    tasks: ["general", "coding"],
    approximateVramMb: 4600,
    lowResource: false,
    contextTokens: 4096,
    requiresShaderF16: true,
  },
  {
    id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
    name: "DeepSeek R1 Distill Qwen 7B",
    family: "DeepSeek",
    tasks: ["reasoning", "coding", "math"],
    approximateVramMb: 5100,
    lowResource: false,
    contextTokens: 4096,
  },
  {
    id: "DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC",
    name: "DeepSeek R1 Distill Llama 8B",
    family: "DeepSeek",
    tasks: ["reasoning", "coding", "math"],
    approximateVramMb: 5000,
    lowResource: false,
    contextTokens: 4096,
  },
  {
    id: "Hermes-3-Llama-3.2-3B-q4f16_1-MLC",
    name: "Hermes 3 Llama 3.2 3B",
    family: "Hermes",
    tasks: ["general", "coding"],
    approximateVramMb: 2300,
    lowResource: true,
    contextTokens: 4096,
  },
  {
    id: "SmolLM2-135M-Instruct-q4f32_1-MLC",
    name: "SmolLM2 135M Instruct",
    family: "SmolLM",
    tasks: ["general", "coding"],
    approximateVramMb: 300,
    lowResource: true,
    contextTokens: 2048,
  },
] as const;

export const DEFAULT_BROWSER_MODEL_ID = "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC";

export function getBrowserModel(id: string): BrowserModelDefinition | undefined {
  return BROWSER_MODELS.find((model) => model.id === id);
}

export function getBrowserModelsForTask(task: BrowserModelTask): BrowserModelDefinition[] {
  return BROWSER_MODELS.filter((model) => model.tasks.includes(task));
}
