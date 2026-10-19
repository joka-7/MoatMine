import { text, type LearnModule } from "../types";

export const company: LearnModule = {
  id: "company",
  title: text("Reading a company", "קריאת חברה"),
  summary: text(
    "Revenue, earnings, P/E, debt, and what a moat is.",
    "הכנסות, רווח, מכפיל רווח, חוב, ומהי חפיר.",
  ),
  lessons: [
    {
      title: text("Revenue and profit", "הכנסות ורווח"),
      body: [
        text(
          "Revenue is the money a company takes in from customers. Profit, or earnings, is what is left after costs. A company can grow revenue quickly and still lose money.",
          "הכנסות הן הכסף שחברה מקבלת מלקוחות. רווח הוא מה שנשאר אחרי עלויות. חברה יכולה להגדיל הכנסות מהר ועדיין להפסיד כסף.",
        ),
        text(
          "Earnings per share (EPS) divides profit by the number of shares, so you can compare it with the share price.",
          "רווח למניה (EPS) מחלק את הרווח במספר המניות, כדי שאפשר יהיה להשוות אותו למחיר המניה.",
        ),
      ],
      tryIt: "/stock",
    },
    {
      title: text("Valuation: the P/E ratio", "תמחור: מכפיל הרווח"),
      body: [
        text(
          "P/E is the share price divided by earnings per share. A price of 100 and EPS of 5 gives a P/E of 20: you pay 20 for each 1 of yearly profit.",
          "מכפיל רווח (P/E) הוא מחיר המניה חלקי הרווח למניה. מחיר 100 ו-EPS של 5 נותנים P/E של 20: משלמים 20 על כל 1 של רווח שנתי.",
        ),
        text(
          "A high P/E can mean the market expects growth, or that the stock is expensive. A low P/E can mean a bargain, or a business in trouble. It is a starting question, not an answer.",
          "P/E גבוה יכול להעיד שהשוק מצפה לצמיחה, או שהמניה יקרה. P/E נמוך יכול להעיד על הזדמנות, או על עסק בקשיים. זו שאלת פתיחה, לא תשובה.",
        ),
      ],
    },
    {
      title: text("Debt", "חוב"),
      body: [
        text(
          "Debt must be repaid whatever happens to sales. Companies with heavy debt have less room in bad times, because interest still has to be paid.",
          "חוב חייב להיות מוחזר ללא קשר למה שקורה במכירות. לחברות עם חוב כבד יש פחות מרחב בזמנים רעים, כי עדיין צריך לשלם ריבית.",
        ),
        text(
          "Compare debt with earnings and cash, and with other companies in the same sector.",
          "השוו חוב לרווחים ולמזומן, ולחברות אחרות באותו ענף.",
        ),
      ],
    },
    {
      title: text("Moats", "חפיר תחרותי"),
      body: [
        text(
          "A moat is a lasting advantage that protects a company's profits from competitors, such as a strong brand, low costs, or customers who find it hard to switch.",
          "חפיר הוא יתרון מתמשך שמגן על רווחי החברה מפני מתחרים, כמו מותג חזק, עלויות נמוכות, או לקוחות שקשה להם לעבור לאחר.",
        ),
        text(
          "A moat helps profits last. It does not stop the share price from falling, and it does not make a very high price a good one.",
          "חפיר עוזר לרווחים להחזיק מעמד. הוא לא מונע מהמחיר לרדת, והוא לא הופך מחיר גבוה מאוד למחיר טוב.",
        ),
      ],
      tryIt: "/watchlist",
    },
  ],
  quiz: [
    {
      prompt: text("A share costs 60 and the company earns 3 per share. What is the P/E?", "מניה עולה 60 והחברה מרוויחה 3 למניה. מהו ה-P/E?"),
      options: [
        text("5", "5"),
        text("20", "20"),
        text("180", "180"),
      ],
      answer: 1,
      explanation: text("60 ÷ 3 = 20.", "60 ÷ 3 = 20."),
    },
    {
      prompt: text("Why does heavy debt matter in bad times?", "למה חוב כבד חשוב בזמנים רעים?"),
      options: [
        text("Interest and repayments are owed even if sales drop", "ריבית והחזרים חייבים גם אם המכירות יורדות"),
        text("Debt is cancelled when profits fall", "חוב מבוטל כשהרווחים יורדים"),
        text("It does not matter", "זה לא משנה"),
      ],
      answer: 0,
      explanation: text(
        "Fixed obligations do not shrink with sales, which squeezes companies with a lot of debt.",
        "התחייבויות קבועות לא קטנות עם המכירות, וזה לוחץ על חברות עם הרבה חוב.",
      ),
    },
    {
      prompt: text("What does a moat tell you?", "מה חפיר אומר לכם?"),
      options: [
        text("The stock will not fall", "המניה לא תרד"),
        text("The company has a lasting edge over competitors", "לחברה יש יתרון מתמשך על מתחרים"),
        text("The stock is cheap", "המניה זולה"),
      ],
      answer: 1,
      explanation: text(
        "It is about durability of profits, not about price or any promise about the share.",
        "זה עוסק בעמידות הרווחים, לא במחיר ולא בהבטחה כלשהי לגבי המניה.",
      ),
    },
  ],
};
