import { text, type LearnModule } from "../types";

export const markets: LearnModule = {
  id: "markets",
  title: text("How markets work", "איך שווקים עובדים"),
  summary: text(
    "Exchanges, tickers, prices, orders and what market cap means.",
    "בורסות, סימולים, מחירים, הוראות קנייה ומה זה שווי שוק.",
  ),
  lessons: [
    {
      title: text("Exchanges and tickers", "בורסות וסימולים"),
      body: [
        text(
          "An exchange is a marketplace where buyers and sellers of shares meet. Each company is identified by a short ticker symbol, such as AAPL for Apple.",
          "בורסה היא שוק שבו קונים ומוכרים של מניות נפגשים. כל חברה מזוהה בסימול קצר, למשל AAPL עבור Apple.",
        ),
        text(
          "You do not buy from the company; you buy from another investor who is selling. The company only receives money when it first issues shares.",
          "אתם לא קונים מהחברה אלא ממשקיע אחר שמוכר. החברה מקבלת כסף רק כשהיא מנפיקה מניות לראשונה.",
        ),
      ],
      tryIt: "/watchlist",
    },
    {
      title: text("Why prices move", "למה מחירים זזים"),
      body: [
        text(
          "A price is simply where buyers and sellers agree right now. News, earnings, interest rates and mood all shift how much people are willing to pay.",
          "מחיר הוא פשוט הנקודה שבה קונים ומוכרים מסכימים כרגע. חדשות, דוחות רווח, ריבית ורוח השוק משנים כמה אנשים מוכנים לשלם.",
        ),
        text(
          "Over short periods prices are noisy and hard to predict. Over long periods they follow the business more closely.",
          "בטווח קצר המחירים רועשים וקשים לחיזוי. בטווח ארוך הם עוקבים אחרי העסק מקרוב יותר.",
        ),
      ],
    },
    {
      title: text("Orders: market and limit", "הוראות: שוק ולימיט"),
      body: [
        text(
          "A market order buys or sells right away at the best available price. A limit order sets your price: it buys only at or below it, or sells only at or above it, and may never fill.",
          "הוראת שוק קונה או מוכרת מיד במחיר הטוב ביותר הזמין. הוראת לימיט קובעת את המחיר שלכם: היא קונה רק במחיר הזה או נמוך ממנו, או מוכרת רק בו או מעליו, וייתכן שלא תתבצע כלל.",
        ),
        text(
          "Prices quoted are a bid, what buyers offer, and an ask, what sellers want. The gap between them is a hidden cost of trading.",
          "המחירים מוצגים כ-bid, מה שקונים מציעים, ו-ask, מה שמוכרים רוצים. הפער ביניהם הוא עלות סמויה של מסחר.",
        ),
      ],
    },
    {
      title: text("Market cap and indices", "שווי שוק ומדדים"),
      body: [
        text(
          "Market capitalisation is the share price times the number of shares: the market's price for the whole company. A price of 50 with 1 million shares means a market cap of 50 million.",
          "שווי שוק הוא מחיר המניה כפול מספר המניות: המחיר שהשוק נותן לחברה כולה. מחיר 50 עם מיליון מניות פירושו שווי שוק של 50 מיליון.",
        ),
        text(
          "An index, such as the S&P 500, tracks a basket of companies to show how a market is doing as a whole.",
          "מדד, כמו S&P 500, עוקב אחרי סל חברות כדי להראות איך שוק שלם מתפקד.",
        ),
      ],
    },
  ],
  quiz: [
    {
      prompt: text("When you buy a share on an exchange, who usually sells it to you?", "כשאתם קונים מניה בבורסה, מי בדרך כלל מוכר לכם אותה?"),
      options: [
        text("The company itself", "החברה עצמה"),
        text("Another investor", "משקיע אחר"),
        text("The government", "הממשלה"),
      ],
      answer: 1,
      explanation: text(
        "Trading on an exchange is between investors. The company is paid only when it issues new shares.",
        "המסחר בבורסה הוא בין משקיעים. החברה מקבלת תשלום רק כשהיא מנפיקה מניות חדשות.",
      ),
    },
    {
      prompt: text("You want to buy only if the price is 40 or lower. Which order fits?", "אתם רוצים לקנות רק אם המחיר 40 או נמוך יותר. איזו הוראה מתאימה?"),
      options: [
        text("Market order", "הוראת שוק"),
        text("Limit order at 40", "הוראת לימיט ב-40"),
        text("Either one gives the same result", "שתיהן נותנות אותה תוצאה"),
      ],
      answer: 1,
      explanation: text(
        "A limit order never pays more than your limit. A market order takes whatever the price is.",
        "הוראת לימיט לא משלמת יותר מהגבול שלכם. הוראת שוק לוקחת כל מחיר שיש.",
      ),
    },
    {
      prompt: text("A company has 2 million shares priced at 30. What is its market cap?", "לחברה 2 מיליון מניות במחיר 30. מהו שווי השוק שלה?"),
      options: [
        text("32 million", "32 מיליון"),
        text("60 million", "60 מיליון"),
        text("15 million", "15 מיליון"),
      ],
      answer: 1,
      explanation: text("2 million × 30 = 60 million.", "2 מיליון × 30 = 60 מיליון."),
    },
  ],
};
