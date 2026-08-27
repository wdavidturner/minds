export const MODEL_OPTIONS = [
  { id: "@cf/zai-org/glm-4.7-flash", label: "GLM 4.7 Flash" },
  { id: "@cf/zai-org/glm-5.3-flash", label: "GLM 5.3 Flash" },
  { id: "@cf/meta/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout" },
  { id: "@cf/qwen/qwen3-30b-a3b-fp8", label: "Qwen3 30B" },
  { id: "@cf/moonshotai/kimi-k2.7-code", label: "Kimi K2.7 Code" },
] as const;

export type AllowedModelId = (typeof MODEL_OPTIONS)[number]["id"];

export function isAllowedModel(id: string): id is AllowedModelId {
  return MODEL_OPTIONS.some((option) => option.id === id);
}

export function modelLabel(id: string): string {
  return MODEL_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

export function resolveMindModel(
  override: string | null | undefined,
  envModel: string | undefined,
): string {
  if (!envModel) throw new Error("MODEL is required");
  if (override && isAllowedModel(override)) return override;
  return envModel;
}
