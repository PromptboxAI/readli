/**
 * Narration cost model (ElevenLabs pricing correction, Kevin 2026-10-10). Standard monthly prices,
 * not promotions. Model consumption is configurable and must be benchmarked against real usage
 * before final allowances are set; the ledger records actual characters, credits and duration.
 */
export interface ProviderPlan {
  name: string;
  monthlyUsd: number;
  credits: number;
  approxV4Minutes: number;
  customVoices: number;
  concurrentRequests: number;
  overageUsdPerMinute: number;
}

export const ELEVENLABS_PLANS: ProviderPlan[] = [
  { name: "Pro", monthlyUsd: 99, credits: 600_000, approxV4Minutes: 600, customVoices: 160, concurrentRequests: 10, overageUsdPerMinute: 0.17 },
  { name: "Scale", monthlyUsd: 299, credits: 1_800_000, approxV4Minutes: 1_800, customVoices: 660, concurrentRequests: 15, overageUsdPerMinute: 0.17 },
  { name: "Business", monthlyUsd: 990, credits: 6_000_000, approxV4Minutes: 6_000, customVoices: 2_200, concurrentRequests: 15, overageUsdPerMinute: 0.17 },
];

export interface ModelCost {
  modelId: string;
  /** Provider credits charged per input character (provisional; benchmark before launch). */
  creditsPerCharacter: number;
  /** Characters of storybook text per minute of narration (provisional). */
  charactersPerMinute: number;
}

export const MODEL_COSTS: Record<string, ModelCost> = {
  eleven_multilingual_v2: { modelId: "eleven_multilingual_v2", creditsPerCharacter: 1, charactersPerMinute: 900 },
  eleven_v3: { modelId: "eleven_v3", creditsPerCharacter: 1, charactersPerMinute: 900 },
  eleven_v4: { modelId: "eleven_v4", creditsPerCharacter: 1, charactersPerMinute: 1000 },
  eleven_flash_v2_5: { modelId: "eleven_flash_v2_5", creditsPerCharacter: 0.5, charactersPerMinute: 900 },
};

export function modelCost(modelId: string): ModelCost {
  return MODEL_COSTS[modelId] ?? { modelId, creditsPerCharacter: 1, charactersPerMinute: 900 };
}

/** Provider dollars per narration minute on a plan, counting included credits at their plan price. */
export function usdPerMinute(plan: ProviderPlan, model: ModelCost): number {
  const creditsPerMinute = model.charactersPerMinute * model.creditsPerCharacter;
  return (plan.monthlyUsd / plan.credits) * creditsPerMinute;
}

export function estimateSeconds(characters: number, modelId: string): number {
  return Math.max(1, Math.ceil((characters / modelCost(modelId).charactersPerMinute) * 60));
}
