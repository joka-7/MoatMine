import { text, type LearnModule } from "../types";

export const portfolio: LearnModule = {
  id: "portfolio",
  title: text("Building a portfolio", "בניית תיק"),
  summary: text(
    "Allocation, rebalancing, time horizon, and the cost of trading.",
    "הקצאה, איזון מחדש, אופק זמן ועלות המסחר.",
  ),
  lessons: [
    {
      title: text("Asset allocation", "הקצאת נכסים"),
      body: [
        text(
          "Allocation is how you split money between stocks, bonds, cash and so on. It usually explains more of a portfolio's ups and downs than which individual stocks you pick.",
          "הקצאה היא החלוקה של הכסף בין מניות, אג\"ח, מזומן וכן הלאה. היא בדרך כלל מסבירה יותר מהעליות והירידות של תיק מאשר איזו מניה ספציפית בחרתם.",
        ),
        text(
          "A 60/40 portfolio holds 60% stocks and 40% bonds. A more cautious investor holds less in stocks, an aggressive one more.",
          "תיק 60/40 מחזיק 60% מניות ו-40% אג\"ח. משקיע זהיר מחזיק פחות מניות, משקיע אגרסיבי יותר.",
        ),
      ],
      tryIt: "/portfolio",
    },
    {
      title: text("Rebalancing", "איזון מחדש"),
      body: [
        text(
          "Prices drift your split away from the plan: if stocks rise, a 60/40 portfolio may become 70/30 and carry more risk than you chose. Rebalancing means selling some of what grew and buying some of what lagged.",
          "המחירים מסיטים את החלוקה מהתוכנית: אם מניות עולות, תיק 60/40 יכול להפוך ל-70/30 ולהחזיק יותר סיכון ממה שבחרתם. איזון מחדש פירושו למכור חלק ממה שגדל ולקנות חלק ממה שפיגר.",
        ),
        text(
          "Check on a schedule, such as once or twice a year, rather than reacting to every headline.",
          "בדקו לפי לוח זמנים, למשל פעם או פעמיים בשנה, ולא בתגובה לכל כותרת.",
        ),
      ],
    },
    {
      title: text("Concentration", "ריכוז"),
      body: [
        text(
          "If one holding is a large share of your portfolio, its bad day becomes your bad day. Setting a maximum weight per holding is a simple rule that limits that.",
          "אם אחזקה אחת היא חלק גדול מהתיק, יום רע שלה הופך ליום רע שלכם. קביעת משקל מרבי לכל אחזקה היא כלל פשוט שמגביל זאת.",
        ),
      ],
      tryIt: "/risk-profile",
    },
    {
      title: text("Costs and discipline", "עלויות ומשמעת"),
      body: [
        text(
          "Fees, trading costs and taxes come straight out of returns, and they repeat every year. Trading often usually adds costs without adding anything else.",
          "עמלות, עלויות מסחר ומסים יורדים ישירות מהתשואה, וחוזרים מדי שנה. מסחר תכוף בדרך כלל מוסיף עלויות בלי להוסיף דבר אחר.",
        ),
        text(
          "Decide your rules while calm, then follow them when markets are not. That is the point of writing them down.",
          "קבעו את הכללים כשאתם רגועים, ואז עקבו אחריהם כשהשווקים לא רגועים. זו הסיבה לרשום אותם.",
        ),
      ],
    },
  ],
  quiz: [
    {
      prompt: text("What is asset allocation?", "מהי הקצאת נכסים?"),
      options: [
        text("How money is split between asset types", "איך הכסף מחולק בין סוגי נכסים"),
        text("Which broker you use", "באיזה ברוקר משתמשים"),
        text("The day you buy", "היום שבו קונים"),
      ],
      answer: 0,
      explanation: text(
        "Allocation is the split between stocks, bonds, cash and others.",
        "הקצאה היא החלוקה בין מניות, אג\"ח, מזומן ואחרים.",
      ),
    },
    {
      prompt: text("Stocks rose, so your 60/40 portfolio is now 70/30. What is rebalancing?", "מניות עלו, ותיק 60/40 שלכם הוא עכשיו 70/30. מהו איזון מחדש?"),
      options: [
        text("Buying more stocks", "קניית עוד מניות"),
        text("Moving back toward 60/40 by selling some stocks and buying bonds", "חזרה לכיוון 60/40 על ידי מכירת מניות וקניית אג\"ח"),
        text("Selling everything", "מכירת הכול"),
      ],
      answer: 1,
      explanation: text(
        "Rebalancing restores the risk level you chose.",
        "איזון מחדש מחזיר את רמת הסיכון שבחרתם.",
      ),
    },
    {
      prompt: text("Why can frequent trading hurt results?", "למה מסחר תכוף יכול לפגוע בתוצאות?"),
      options: [
        text("Costs and taxes add up", "עלויות ומסים מצטברים"),
        text("Markets close more often", "השווקים נסגרים יותר"),
        text("It reduces diversification by law", "הוא מקטין פיזור על פי חוק"),
      ],
      answer: 0,
      explanation: text(
        "Each trade can bring fees, spreads and taxes, which compound against you.",
        "כל עסקה יכולה להביא עמלות, פערי מחיר ומסים, שמצטברים נגדכם.",
      ),
    },
  ],
};
