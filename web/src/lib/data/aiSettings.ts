import { isKnownProvider, type AgentConfig, type ExternalChatProviderId, type ProviderCredential } from "modeldispatcher-browser-agent";
import { SINGLETON_ID, type JsonObject, type JsonValue } from "../store";
import { portfolioStore } from "../store/shared";

/** The AI settings kept on this device in local mode: providers and keys, and a favorite free AI app. */
export interface DeviceAiSettings {
  readonly config: AgentConfig;
  readonly favorite: ExternalChatProviderId | null;
}

const EMPTY: DeviceAiSettings = { config: { providers: [], ollamaUrl: "" }, favorite: null };
const FAVORITES: readonly ExternalChatProviderId[] = ["chatgpt", "claude", "gemini", "geminiApp", "groq"];

function credentialOf(value: JsonValue): ProviderCredential | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { provider, model, apiKeys } = value as JsonObject;
  if (typeof provider !== "string" || !isKnownProvider(provider) || typeof model !== "string") return null;
  if (!Array.isArray(apiKeys) || !apiKeys.every((k): k is string => typeof k === "string")) return null;
  return { provider, model, apiKeys };
}

/**
 * The stored config as an AgentConfig. It may come from a restored backup, so anything that isn't a
 * well-formed provider entry is dropped rather than handed to the AI library.
 */
export function agentConfigOf(json: JsonObject): AgentConfig {
  const providers = Array.isArray(json["providers"]) ? json["providers"] : [];
  return {
    providers: providers.map(credentialOf).filter((c): c is ProviderCredential => c !== null),
    ollamaUrl: typeof json["ollamaUrl"] === "string" ? json["ollamaUrl"] : "",
  };
}

function favoriteOf(value: string | null): ExternalChatProviderId | null {
  return FAVORITES.find((f) => f === value) ?? null;
}

/** The AI settings saved on this device, or none configured yet. */
export async function loadDeviceAiSettings(): Promise<DeviceAiSettings> {
  const record = await (await portfolioStore()).get("aiSettings", SINGLETON_ID);
  return record ? { config: agentConfigOf(record.config), favorite: favoriteOf(record.favorite) } : EMPTY;
}

/** Save the AI settings on this device only; the keys never reach the server. */
export async function saveDeviceAiSettings(settings: DeviceAiSettings): Promise<void> {
  const config: JsonObject = {
    providers: settings.config.providers.map((p) => ({ provider: p.provider, model: p.model, apiKeys: [...p.apiKeys] })),
    ollamaUrl: settings.config.ollamaUrl,
  };
  await (await portfolioStore()).put("aiSettings", { id: SINGLETON_ID, config, favorite: settings.favorite });
}
