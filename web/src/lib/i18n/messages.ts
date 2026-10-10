import * as ai from "./messages/ai";
import * as common from "./messages/common";
import * as dashboard from "./messages/dashboard";
import * as risk from "./messages/risk";
import * as shell from "./messages/shell";
import * as stock from "./messages/stock";
import type { Lang } from "./translate";

// One module per area of the app; add a module here and its keys become valid for t().
export const MODULES = { common, shell, dashboard, risk, stock, ai } as const;

export type MessageKey = { [M in keyof typeof MODULES]: keyof (typeof MODULES)[M]["en"] }[keyof typeof MODULES];

type Dictionary = Readonly<Record<MessageKey, string>>;

// Each module's `he` is typed against its own `en`, so the merged dictionaries have the same keys
// as long as no two modules share one (messages.test.ts checks that).
const merge = (lang: Lang): Dictionary => Object.assign({}, ...Object.values(MODULES).map((m) => m[lang])) as Dictionary;

export const MESSAGES: Readonly<Record<Lang, Dictionary>> = { en: merge("en"), he: merge("he") };
