import { assets } from "./modules/assets";
import { company } from "./modules/company";
import { investing } from "./modules/investing";
import { markets } from "./modules/markets";
import { moatmine } from "./modules/moatmine";
import { portfolio } from "./modules/portfolio";
import { risk } from "./modules/risk";
import type { LearnModule } from "./types";

export type { LearnModule, Lesson, Localized } from "./types";

/** The finance course, from first principles to the app itself, in the order it is meant to be read. */
export const LEARN_MODULES: readonly LearnModule[] = [investing, assets, markets, risk, company, portfolio, moatmine];

export { LESSON_MEDIA, type MediaLink } from "./media";
