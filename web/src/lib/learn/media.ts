import type { Lang } from "@/lib/i18n";

/** A video or podcast made by someone else that explains a lesson's topic. MoatMine only links to it. */
export interface MediaLink {
  readonly kind: "video" | "podcast";
  readonly url: string;
  readonly title: string;
  readonly channel: string;
  readonly lang: Lang;
  readonly minutes: number;
}

/**
 * Outside explainers per lesson, in the same order as each module's `lessons`. Titles and
 * channels are as published by their authors, so they stay in their own language.
 */
export const LESSON_MEDIA: Readonly<Record<string, readonly (readonly MediaLink[])[]>> = {
  investing: [
    // Saving versus investing
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=y72iyLPOv8E", title: "5 Questions To Ask Before Investing", channel: "Two Cents (PBS)", lang: "en", minutes: 6 },
      { kind: "video", url: "https://www.youtube.com/watch?v=6UdC93aERMY", title: "Saving vs Investing: The Smartest Place For Your Money | NerdWallet", channel: "NerdWallet", lang: "en", minutes: 7 },
      { kind: "podcast", url: "https://www.kan.org.il/content/kan/podcasts/p-8127/34139/", title: "חיות כיס | מבוא לכסף", channel: "כאן 11 - תאגיד השידור הישראלי", lang: "he", minutes: 25 },
    ],
    // Inflation
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=unEUz90JP8A", title: "What Is the Fisher Effect?", channel: "Marginal Revolution University", lang: "en", minutes: 2 },
      { kind: "video", url: "https://www.youtube.com/watch?v=ezyzVdEdUBI", title: "Let's Talk Inflation (And How It Will Impact Your Portfolio)", channel: "The Plain Bagel", lang: "en", minutes: 14 },
      { kind: "podcast", url: "https://www.kan.org.il/content/kan/podcasts/p-8127/16543/", title: "כיסון 03: לקראת העלאת הריבית", channel: "כאן 11 - חיות כיס", lang: "he", minutes: 14 },
    ],
    // Compounding
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=mec-QpjQMXY", title: "The rule of 72 for compound interest | Interest and debt | Finance & Capital Markets | Khan Academy", channel: "Khan Academy", lang: "en", minutes: 9 },
      { kind: "video", url: "https://www.youtube.com/watch?v=wf91rEGw88Q", title: "What Is Compound Interest? | Investopedia", channel: "Investopedia", lang: "en", minutes: 2 },
      { kind: "video", url: "https://www.youtube.com/watch?v=4gn4F1VmTvM", title: "Waiting to Invest is Costing You... A Lot", channel: "The Plain Bagel", lang: "en", minutes: 13 },
    ],
    // Goals and time horizon
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=T1cqSZUviiQ", title: "Investing | 5 Steps for Getting Started", channel: "The Plain Bagel", lang: "en", minutes: 9 },
      { kind: "video", url: "https://www.youtube.com/watch?v=6JxWW4hLS1U", title: "Saving enough for retirement | Financial mathematics (TX TEKS) | Khan Academy", channel: "Khan Academy", lang: "en", minutes: 5 },
    ],
  ],
  assets: [
    // Stocks
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=2nrOQT8uOy0", title: "היכרות עם שוק ההון 1: מה זה בורסה מה זה שוק ההון", channel: "Micha.Stocks", lang: "he", minutes: 9 },
      { kind: "video", url: "https://www.youtube.com/watch?v=vZCGsi5pfso", title: "Stocks | How Equity Earns You Money", channel: "The Plain Bagel", lang: "en", minutes: 8 },
      { kind: "video", url: "https://www.youtube.com/watch?v=98qfFzqDKR8", title: "What it means to buy a company's stock | Stocks and bonds | Finance & Capital Markets | Khan Academy", channel: "Khan Academy", lang: "en", minutes: 14 },
    ],
    // Bonds
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=OTi0ulMapJs", title: "משתלם לדעת מור - איגרות חוב", channel: "MORE - מור בית השקעות", lang: "he", minutes: 4 },
      { kind: "video", url: "https://www.youtube.com/watch?v=vAdn7aLHpO0", title: "Investing Basics: Bonds", channel: "Charles Schwab", lang: "en", minutes: 5 },
      { kind: "video", url: "https://www.youtube.com/watch?v=I7FDx4DPapw", title: "Relationship between bond prices and interest rates | Finance & Capital Markets | Khan Academy", channel: "Khan Academy", lang: "en", minutes: 13 },
    ],
    // Funds and ETFs
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=bN9dLzWa2HY", title: "מה זה קרן סל/קרן מחקה(במה זה שונה מתעודת סל, קרנות עוקבות מדדים)", channel: "Noam Madar", lang: "he", minutes: 3 },
      { kind: "video", url: "https://www.youtube.com/watch?v=KRR8ufNJLbM", title: "What Are ETFs? | Fidelity Investments", channel: "Fidelity Investments", lang: "en", minutes: 5 },
      { kind: "video", url: "https://www.youtube.com/watch?v=ICBgPBswovQ", title: "Managed Solutions | Mutual Funds & More", channel: "The Plain Bagel", lang: "en", minutes: 9 },
    ],
    // Cash and equivalents
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=mtcBKGbyE70", title: "Cash Equivalents & Alternatives | Non Traditional Investments", channel: "The Plain Bagel", lang: "en", minutes: 9 },
      { kind: "video", url: "https://www.youtube.com/watch?v=9eKqNb_jTb8", title: "Asset Classes: Cash and Cash Equivalents | Investment Basics #9", channel: "SeeWhy Learning", lang: "en", minutes: 4 },
    ],
  ],
  markets: [
    // Exchanges and tickers
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=5Q7AmzyiLPE", title: "מה זה בורסה?", channel: "מיטב בית השקעות", lang: "he", minutes: 2 },
      { kind: "video", url: "https://www.youtube.com/watch?v=p7HKvqRI_Bo", title: "How does the stock market work? - Oliver Elfenbaum", channel: "TED-Ed", lang: "en", minutes: 5 },
      { kind: "video", url: "https://www.youtube.com/watch?v=IMJVp3tIX9c", title: "The IPO Process", channel: "The Plain Bagel", lang: "en", minutes: 9 },
    ],
    // Why prices move
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=A76SdJqOej0", title: "Is the Stock Market Irrational?", channel: "Two Cents (PBS)", lang: "en", minutes: 10 },
      { kind: "video", url: "https://www.youtube.com/watch?v=sQQDe0hWLgQ", title: "How is the Stock Price Determined? | Stock Market for Beginners (Part 1) | Lumovest", channel: "Lumovest", lang: "en", minutes: 12 },
      { kind: "podcast", url: "https://www.kan.org.il/content/kan/podcasts/p-8127/33780/", title: "חיות כיס | איש של יציבות", channel: "כאן 11 - תאגיד השידור הישראלי", lang: "he", minutes: 28 },
    ],
    // Orders
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=Tiyystl8x40", title: "Understanding Market, Limit, and Stop Orders", channel: "Charles Schwab", lang: "en", minutes: 6 },
      { kind: "video", url: "https://www.youtube.com/watch?v=C8javNC7pwQ", title: "What Does The Bid & Ask Mean? (Investing In The Stock Market)", channel: "Whyze", lang: "en", minutes: 4 },
    ],
    // Market cap and indices
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=5A4lp_oZ5zg", title: "Stock Indices & Index Fund Investing", channel: "The Plain Bagel", lang: "en", minutes: 9 },
      { kind: "video", url: "https://www.youtube.com/watch?v=S77ms4xtmXw", title: "What's an Index? The Dow, S&P 500, and Nasdaq Explained", channel: "Charles Schwab", lang: "en", minutes: 4 },
    ],
  ],
  risk: [
    // Risk and reward go together
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=249Gc7FDWRI", title: "How Risky Is The Stock Market?", channel: "Two Cents (PBS)", lang: "en", minutes: 7 },
      { kind: "video", url: "https://www.youtube.com/watch?v=TETSZeSoAlk", title: "Risk - Understanding Investment Uncertainty", channel: "The Plain Bagel", lang: "en", minutes: 9 },
      { kind: "video", url: "https://www.youtube.com/watch?v=thNrIsU88y8", title: "What \"Risk\" Actually Means in Investing", channel: "Ben Felix", lang: "en", minutes: 11 },
    ],
    // Volatility
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=v6j8ewrcxd8", title: "Why Price Volatility is NOT Risk", channel: "The Plain Bagel", lang: "en", minutes: 12 },
      { kind: "video", url: "https://www.youtube.com/watch?v=WhYHrHiOS_E", title: "What Are Normal Stock Returns?", channel: "Ben Felix", lang: "en", minutes: 10 },
      { kind: "video", url: "https://www.youtube.com/watch?v=3axbSYKv3Fw", title: "Episode 353: On Market Volatility | RR Highlights", channel: "Rational Reminder Highlights", lang: "en", minutes: 19 },
    ],
    // Drawdown
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=_9c-DkBFS3w", title: "Market Crashes (2025 Edition)", channel: "Ben Felix", lang: "en", minutes: 10 },
      { kind: "video", url: "https://www.youtube.com/watch?v=HvYaOP5bVKU", title: "5 Things to Do During a Bear Market", channel: "Morningstar, Inc.", lang: "en", minutes: 8 },
    ],
    // Diversification
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=vqK74Tz3AKU", title: "פיזור סיכונים בשוק ההון", channel: "שור פיננסי", lang: "he", minutes: 15 },
      { kind: "video", url: "https://www.youtube.com/watch?v=Pmlsa5-ruMk", title: "How Diversification Works", channel: "The Plain Bagel", lang: "en", minutes: 11 },
      { kind: "video", url: "https://www.youtube.com/watch?v=_AsIuR-z_nw", title: "Investing: Why You Should Diversify", channel: "Marginal Revolution University", lang: "en", minutes: 5 },
      { kind: "video", url: "https://www.youtube.com/watch?v=1FXuMs6YRCY", title: "International Diversification", channel: "Ben Felix", lang: "en", minutes: 11 },
    ],
  ],
  company: [
    // Revenue and profit
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=hrSUq4wcd0g", title: "The INCOME STATEMENT Explained (Profit & Loss / P&L)", channel: "Accounting Stuff", lang: "en", minutes: 11 },
      { kind: "video", url: "https://www.youtube.com/watch?v=R8voRf5BjdA", title: "What is Profit? (Gross Profit, Operating Profit, Net Income) | From A Business Professor", channel: "Business School 101", lang: "en", minutes: 9 },
    ],
    // The P/E ratio
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=21STUhQ-iP0", title: "Stock Multiples: How to Tell When a Stock is Cheap/Expensive", channel: "The Plain Bagel", lang: "en", minutes: 10 },
      { kind: "video", url: "https://www.youtube.com/watch?v=dJPw1XmKA7Q", title: "PE Ratio Explained Simply | Finance in 5 Minutes!", channel: "Investing & Retirement", lang: "en", minutes: 6 },
    ],
    // Debt
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=WUW1g4wLoRU", title: "How to Tell If a Stock/Company Can Weather a Downturn", channel: "The Plain Bagel", lang: "en", minutes: 13 },
      { kind: "video", url: "https://www.youtube.com/watch?v=enhdH7Tl5bY", title: "Long Term Debt to Equity Ratio, ROE, & Shareholder's Equity", channel: "The Organic Chemistry Tutor", lang: "en", minutes: 11 },
    ],
    // Moats
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=WQiX7a_z--4", title: "The Morningstar Economic Moat Rating", channel: "Morningstar", lang: "en", minutes: 2 },
      { kind: "video", url: "https://www.youtube.com/watch?v=OHCpUcerz1Q", title: "Economic Moat (Competitive Advantage): Warren Buffett’s Principles of Stock Market Investing", channel: "Bull Investor", lang: "en", minutes: 15 },
      { kind: "video", url: "https://www.youtube.com/watch?v=asF5zscxvQ4", title: "Understanding Economic Moats with Pat Dorsey", channel: "Investing Principle", lang: "en", minutes: 31 },
    ],
  ],
  portfolio: [
    // Asset allocation
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=p25PPBgMiEk", title: "Choosing an Asset Allocation (How Much in Stocks vs. Bonds?)", channel: "Ben Felix", lang: "en", minutes: 13 },
      { kind: "video", url: "https://www.youtube.com/watch?v=rSn2CT6lDlA", title: "One-Decision Asset Allocation ETFs (VCIP/VCNS/VBAL/VGRO/VEQT | XBAL/XGRO)", channel: "Ben Felix", lang: "en", minutes: 10 },
    ],
    // Rebalancing
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=B3d60iqPQK4", title: "How To Rebalance Your Portfolio", channel: "Tae Kim - Financial Tortoise", lang: "en", minutes: 11 },
      { kind: "video", url: "https://www.youtube.com/watch?v=SyRuisbzthI", title: "Rebalancing is an important discipline for investors right now: Charles Schwab's Liz Ann Sonders", channel: "CNBC Television / Charles Schwab", lang: "en", minutes: 3 },
    ],
    // Concentration
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=jg_MflByI3Y", title: "Diversification: Many Investors Miss an Important Point", channel: "The Swedish Investor", lang: "en", minutes: 7 },
      { kind: "video", url: "https://www.youtube.com/watch?v=xnS1nWiug7I", title: "Risk–Return & Efficient Market Hypothesis | Investment Process Explained", channel: "Farhat Lectures", lang: "en", minutes: 14 },
    ],
    // Costs and discipline
    [
      { kind: "video", url: "https://www.youtube.com/watch?v=FlpwTJJEasA", title: "4 Reasons Your Advisor Isn't Recommending Index Funds | Common Sense Investing with Ben Felix", channel: "Ben Felix", lang: "en", minutes: 6 },
      { kind: "video", url: "https://www.youtube.com/watch?v=1DL1E5ACT8k", title: "Dealing With Investment FOMO", channel: "The Plain Bagel", lang: "en", minutes: 13 },
    ],
  ],
  moatmine: [
    // Risk profile
    [],
    // PAPI and MAMI targets
    [],
    // Safety scores and checks
    [],
    // Stress tests and sample data
    [],
  ],
};
