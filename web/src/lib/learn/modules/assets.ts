import { text, type LearnModule } from "../types";

export const assets: LearnModule = {
  id: "assets",
  title: text("Asset types", "סוגי נכסים"),
  summary: text(
    "Stocks, bonds, funds and cash: what each one is and how they differ.",
    "מניות, אג\"ח, קרנות ומזומן: מה כל אחד מהם ובמה הם נבדלים.",
  ),
  lessons: [
    {
      title: text("Stocks", "מניות"),
      body: [
        text(
          "A stock is a small ownership share in a company. If the company does well, the share can rise and may pay dividends, a cut of profits. If it does badly, the share can fall, and in the worst case become worthless.",
          "מניה היא חלק קטן בבעלות על חברה. אם החברה מצליחה, המניה יכולה לעלות ואולי לשלם דיבידנד, חלק מהרווחים. אם היא מתקשה, המניה יכולה לרדת, ובמקרה הגרוע ללא ערך.",
        ),
        text(
          "Stocks have historically offered higher growth than most other assets, and swing the most.",
          "מבחינה היסטורית מניות הציעו צמיחה גבוהה יותר מרוב הנכסים האחרים, והן גם התנודתיות ביותר.",
        ),
      ],
    },
    {
      title: text("Bonds", "אג\"ח"),
      body: [
        text(
          "A bond is a loan: you lend money to a government or company, and it pays you interest and returns the amount on a set date.",
          "אג\"ח היא הלוואה: אתם מלווים כסף לממשלה או לחברה, והיא משלמת ריבית ומחזירה את הסכום בתאריך קבוע.",
        ),
        text(
          "Bonds usually move less than stocks, but they still carry risk: the issuer may fail to pay, and bond prices fall when interest rates rise.",
          "אג\"ח בדרך כלל נעות פחות ממניות, אבל עדיין נושאות סיכון: המנפיק עלול לא לשלם, ומחירי אג\"ח יורדים כשהריבית עולה.",
        ),
      ],
    },
    {
      title: text("Funds and ETFs", "קרנות ו-ETF"),
      body: [
        text(
          "A fund pools many investors' money to hold many assets at once. An ETF is a fund that trades on an exchange like a stock, and many simply track an index.",
          "קרן מאגדת כספים של משקיעים רבים כדי להחזיק נכסים רבים בבת אחת. ETF היא קרן הנסחרת בבורסה כמו מניה, ורבות מהן פשוט עוקבות אחרי מדד.",
        ),
        text(
          "One purchase spreads your money across many holdings. Check the fee, called the expense ratio, since it is charged every year.",
          "קנייה אחת מפזרת את הכסף על פני אחזקות רבות. בדקו את העמלה, שנקראת יחס הוצאות, כי היא נגבית מדי שנה.",
        ),
      ],
    },
    {
      title: text("Cash and equivalents", "מזומן ושווי מזומן"),
      body: [
        text(
          "Cash and money-market products hold their face value and can be used quickly, which makes them good for short-term needs and for waiting for opportunities.",
          "מזומן ומכשירי שוק הכסף שומרים על ערכם הנקוב וזמינים במהירות, ולכן מתאימים לצרכים קצרי טווח ולהמתנה להזדמנויות.",
        ),
        text(
          "The cost is that over long periods they tend to trail inflation, as the first module showed.",
          "המחיר הוא שבטווח ארוך הם נוטים לפגר אחרי האינפלציה, כפי שהמודול הראשון הראה.",
        ),
      ],
      tryIt: "/portfolio",
    },
  ],
  quiz: [
    {
      prompt: text("What do you own when you buy a stock?", "מה אתם מחזיקים כשאתם קונים מניה?"),
      options: [
        text("A loan to the company", "הלוואה לחברה"),
        text("A small ownership share of the company", "חלק קטן בבעלות על החברה"),
        text("A promise of a fixed payout", "הבטחה לתשלום קבוע"),
      ],
      answer: 1,
      explanation: text(
        "Shareholders own part of the business; there is no promise about its price or dividends.",
        "בעלי מניות הם בעלים של חלק מהעסק; אין הבטחה לגבי מחירה או הדיבידנדים שלה.",
      ),
    },
    {
      prompt: text("Which statement about bonds is correct?", "איזו אמירה על אג\"ח נכונה?"),
      options: [
        text("They are loans that pay interest", "הן הלוואות שמשלמות ריבית"),
        text("They never lose value", "הן אף פעם לא מאבדות מערכן"),
        text("They give you a vote in the company", "הן נותנות לכם זכות הצבעה בחברה"),
      ],
      answer: 0,
      explanation: text(
        "A bond is a loan. Its price can still fall, for example when interest rates rise.",
        "אג\"ח היא הלוואה. מחירה עדיין יכול לרדת, למשל כשהריבית עולה.",
      ),
    },
    {
      prompt: text("What is the main appeal of an index ETF?", "מה המשיכה העיקרית של ETF על מדד?"),
      options: [
        text("It removes all risk", "הוא מסיר כל סיכון"),
        text("One purchase spreads money across many companies", "קנייה אחת מפזרת כסף על פני חברות רבות"),
        text("It never charges fees", "הוא לא גובה עמלות לעולם"),
      ],
      answer: 1,
      explanation: text(
        "It spreads company-specific risk, but the market as a whole can still fall, and fees apply.",
        "הוא מפזר סיכון ספציפי לחברה, אבל השוק כולו עדיין יכול לרדת, וחלות עמלות.",
      ),
    },
  ],
};
