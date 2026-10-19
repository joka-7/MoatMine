import { text, type LearnModule } from "../types";

export const moatmine: LearnModule = {
  id: "moatmine",
  title: text("Using MoatMine", "שימוש ב-MoatMine"),
  summary: text(
    "Your risk rules, PAPI targets, safety checks and stress tests.",
    "כללי הסיכון שלכם, יעדי PAPI, בדיקות בטיחות ומבחני לחץ.",
  ),
  lessons: [
    {
      title: text("Your risk profile", "פרופיל הסיכון שלכם"),
      body: [
        text(
          "MoatMine starts from your own rules. A short questionnaire sets a risk profile, and every safety check, buy plan and AI answer is measured against it.",
          "MoatMine מתחילה מהכללים שלכם. שאלון קצר קובע פרופיל סיכון, וכל בדיקת בטיחות, תוכנית קנייה ותשובת AI נמדדות מולו.",
        ),
        text(
          "The app gives information to help you control risk. It is not financial advice.",
          "האפליקציה נותנת מידע שעוזר לשלוט בסיכון. היא אינה ייעוץ פיננסי.",
        ),
      ],
      tryIt: "/risk-profile",
    },
    {
      title: text("PAPI and MAMI targets", "יעדי PAPI ו-MAMI"),
      body: [
        text(
          "PAPI is Profit, Amount, Period, Intent: what you hope to earn, how much you put in, over how long, and how much risk you accept. You can set one for a symbol or for the whole portfolio.",
          "PAPI הוא Profit, Amount, Period, Intent: כמה אתם מקווים להרוויח, כמה אתם מכניסים, לכמה זמן, וכמה סיכון אתם מקבלים. אפשר להגדיר אחד לסימול או לתיק כולו.",
        ),
        text(
          "MAMI sets a maximum and minimum for each of those. For Intent, the bounds apply to risk, measured as annualised volatility in percent.",
          "MAMI קובע מקסימום ומינימום לכל אחד מהם. עבור Intent, הגבולות חלים על סיכון, הנמדד כתנודתיות שנתית באחוזים.",
        ),
      ],
      tryIt: "/targets",
    },
    {
      title: text("Safety scores and checks", "ציוני בטיחות ובדיקות"),
      body: [
        text(
          "A stock's safety score is a graded view of its risk, and the safety check compares it, and your whole portfolio, with your rules.",
          "ציון הבטיחות של מניה הוא תמונה מדורגת של הסיכון שלה, ובדיקת הבטיחות משווה אותה, ואת התיק כולו, לכללים שלכם.",
        ),
        text(
          "A good grade means the stock fits your rules, not that it cannot lose money.",
          "ציון טוב אומר שהמניה מתאימה לכללים שלכם, לא שאי אפשר להפסיד בה כסף.",
        ),
      ],
      tryIt: "/watchlist",
    },
    {
      title: text("Stress tests and sample data", "מבחני לחץ ונתוני דוגמה"),
      body: [
        text(
          "The Risk page and each stock's Bad times tab show how a holding or your portfolio would have fared in past crises, and a value-at-risk estimate of a bad month.",
          "עמוד הסיכון ולשונית זמנים רעים בכל מניה מראים איך אחזקה או התיק שלכם היו מתמודדים עם משברי עבר, ואומדן ערך בסיכון של חודש רע.",
        ),
        text(
          "Without market-data keys the app runs on sample data and labels it as such. Treat those numbers as a demo, not as real prices.",
          "בלי מפתחות נתוני שוק האפליקציה פועלת על נתוני דוגמה ומסמנת זאת. התייחסו למספרים האלה כהדגמה, לא כמחירים אמיתיים.",
        ),
      ],
      tryIt: "/risk",
    },
  ],
  quiz: [
    {
      prompt: text("What does the Intent in PAPI describe?", "מה מתאר ה-Intent ב-PAPI?"),
      options: [
        text("How much risk you accept", "כמה סיכון אתם מקבלים"),
        text("Which broker you use", "באיזה ברוקר אתם משתמשים"),
        text("The stock's ticker", "הסימול של המניה"),
      ],
      answer: 0,
      explanation: text(
        "Its MAMI bounds apply to risk, measured as annualised volatility.",
        "גבולות ה-MAMI שלו חלים על סיכון, הנמדד כתנודתיות שנתית.",
      ),
    },
    {
      prompt: text("A stock gets a good safety grade. What does that mean?", "מניה מקבלת ציון בטיחות טוב. מה זה אומר?"),
      options: [
        text("It cannot lose money", "אי אפשר להפסיד בה כסף"),
        text("It fits your risk rules better", "היא מתאימה טוב יותר לכללי הסיכון שלכם"),
        text("It will rise", "היא תעלה"),
      ],
      answer: 1,
      explanation: text(
        "The grade measures fit to your rules, with no promise about the price.",
        "הציון מודד התאמה לכללים שלכם, בלי הבטחה לגבי המחיר.",
      ),
    },
    {
      prompt: text("The app shows a sample-data label. How should you read the numbers?", "האפליקציה מציגה תווית נתוני דוגמה. איך לקרוא את המספרים?"),
      options: [
        text("As today's real prices", "כמחירים אמיתיים של היום"),
        text("As a demo of how the app works", "כהדגמה של אופן פעולת האפליקציה"),
        text("As a forecast", "כתחזית"),
      ],
      answer: 1,
      explanation: text(
        "Sample data lets every feature run without keys; it is not real market data.",
        "נתוני דוגמה מאפשרים לכל התכונות לפעול בלי מפתחות; אלה אינם נתוני שוק אמיתיים.",
      ),
    },
  ],
};
