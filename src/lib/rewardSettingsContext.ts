import { createContext, useContext } from "react";
import type { RewardSettings } from "../types";
import { DEFAULT_REWARD_SETTINGS, formatAmount, type FormatOptions } from "./rewards";

/**
 * The family's saved reward settings, loaded once at login by App. Screens read them from here so what they
 * display (amounts, pass mark) follows Settings instead of the house defaults. Until the settings arrive, or if
 * they fail to load, this holds the house defaults, same as the server's own fallback.
 */
export const RewardSettingsContext = createContext<RewardSettings>(DEFAULT_REWARD_SETTINGS);

export function useRewardSettings(): RewardSettings {
  return useContext(RewardSettingsContext);
}

/** `fmt(3)` -> "$3.00" / "3 pts" / "3 min" / "3 stars", following the family's saved reward type. */
export function useFormatAmount(): (amount: number, opts?: FormatOptions) => string {
  const settings = useRewardSettings();
  return (amount, opts) => formatAmount(amount, settings, opts);
}
