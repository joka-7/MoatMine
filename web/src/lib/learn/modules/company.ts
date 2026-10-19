import { text, type LearnModule } from "../types";

export const company: LearnModule = {
  id: "company",
  title: text("Reading a company", "קריאת חברה"),
  summary: text(
    "Revenue, earnings, P/E, debt, and what a moat is.",
    "הכנסות, רווח, מכפיל רווח, חוב, ומהו חפיר.",
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
      details: [
        text(
          "Profit comes in layers: gross profit is revenue minus the direct cost of the goods sold, operating profit also subtracts running costs, and net profit is what remains after interest and tax. The margin is the profit divided by revenue.",
          "הרווח בא בשכבות: רווח גולמי הוא ההכנסות פחות העלות הישירה של הסחורה שנמכרה, רווח תפעולי מפחית גם עלויות שוטפות, ורווח נקי הוא מה שנשאר אחרי ריבית ומס. השולי הוא הרווח חלקי ההכנסות.",
        ),
        text(
          "Profit is an accounting number; cash flow is the money actually arriving. A company can show a profit and still run short of cash if customers pay slowly, so look at both.",
          "רווח הוא מספר חשבונאי; תזרים מזומנים הוא הכסף שמגיע בפועל. חברה יכולה להציג רווח ועדיין להיות חסרת מזומנים אם לקוחות משלמים לאט, ולכן הסתכלו על שניהם.",
        ),
      ],
      examples: [
        text(
          "Revenue is 1,000 and costs are 900. Profit is 100, a margin of 10%. If costs rise to 950, profit halves to 50 even though revenue did not change.",
          "ההכנסות הן 1,000 והעלויות 900. הרווח 100, שולי של 10%. אם העלויות עולות ל-950, הרווח יורד בחצי ל-50 אף שההכנסות לא השתנו.",
        ),
        text(
          "A young company grows revenue 30% a year but spends even more on growth, so it still loses money. Fast growth is not the same as profit.",
          "חברה צעירה מגדילה הכנסות 30% בשנה אבל מוציאה אפילו יותר על צמיחה, ולכן עדיין מפסידה. צמיחה מהירה אינה זהה לרווח.",
        ),
        text(
          "Net profit is 50 million and there are 10 million shares, so EPS is 5. If the share price is 100, you are paying 20 for each 1 of yearly profit.",
          "הרווח הנקי הוא 50 מיליון ויש 10 מיליון מניות, ולכן ה-EPS הוא 5. אם מחיר המניה 100, אתם משלמים 20 על כל 1 של רווח שנתי.",
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
      details: [
        text(
          "Trailing P/E uses the last year's profit; forward P/E uses expected profit, which is only an estimate. Compare P/E between similar companies in the same industry, since norms differ widely between industries.",
          "P/E נגרר משתמש ברווח של השנה האחרונה; P/E עתידי משתמש ברווח צפוי, שהוא רק אומדן. השוו P/E בין חברות דומות באותה תעשייה, כי הנורמות שונות מאוד בין תעשיות.",
        ),
        text(
          "Turn it upside down for the earnings yield: 1 divided by the P/E. A P/E of 20 is an earnings yield of 5%. P/E has no meaning when a company has no profit.",
          "הפכו את היחס ותקבלו את תשואת הרווח: 1 חלקי ה-P/E. P/E של 20 הוא תשואת רווח של 5%. ל-P/E אין משמעות כשלחברה אין רווח.",
        ),
      ],
      examples: [
        text(
          "A share costs 60 and the company earns 3 per share: P/E is 20. Another costs 60 and earns 6 per share: P/E is 10, so you pay half as much for each unit of profit.",
          "מניה עולה 60 והחברה מרוויחה 3 למניה: P/E הוא 20. אחרת עולה 60 ומרוויחה 6 למניה: P/E הוא 10, כלומר אתם משלמים חצי על כל יחידת רווח.",
        ),
        text(
          "Company X has a P/E of 10 and grows 2% a year. Company Y has a P/E of 40 and grows 25% a year. Y's higher price may be fair if the growth lasts, and X's low price may be a trap if its business is shrinking.",
          "לחברה X יש P/E של 10 והיא צומחת 2% בשנה. לחברה Y יש P/E של 40 והיא צומחת 25% בשנה. המחיר הגבוה של Y עשוי להיות הוגן אם הצמיחה נמשכת, והמחיר הנמוך של X עלול להיות מלכודת אם העסק מצטמצם.",
        ),
        text(
          "A company lost money this year, so its EPS is negative and the P/E means nothing. You need other measures, such as revenue and cash flow.",
          "חברה הפסידה השנה, ולכן ה-EPS שלה שלילי וה-P/E חסר משמעות. צריך מדדים אחרים, כמו הכנסות ותזרים מזומנים.",
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
      details: [
        text(
          "Two common yardsticks: debt compared with earnings (how many years of profit it would take to repay), and interest coverage, which is operating profit divided by interest paid. A low coverage means little cushion.",
          "שני מדדים נפוצים: חוב ביחס לרווח (כמה שנות רווח ייקח להחזיר אותו), וכיסוי ריבית, שהוא רווח תפעולי חלקי ריבית ששולמה. כיסוי נמוך פירושו כרית ביטחון קטנה.",
        ),
        text(
          "Debt is not always bad. Used well it funds growth, and some industries, such as utilities, carry more of it by nature. The danger is debt that is too large for earnings that can fall.",
          "חוב אינו תמיד רע. כשמשתמשים בו היטב הוא מממן צמיחה, ותעשיות מסוימות, כמו שירותים ציבוריים, נושאות יותר ממנו מטבען. הסכנה היא חוב גדול מדי ביחס לרווחים שיכולים לרדת.",
        ),
      ],
      examples: [
        text(
          "Operating profit is 100 and interest is 20: coverage is 5 times. If a bad year cuts profit to 30, coverage falls to 1.5 times and there is almost no room left.",
          "הרווח התפעולי הוא 100 והריבית 20: הכיסוי פי 5. אם שנה רעה מורידה את הרווח ל-30, הכיסוי יורד לפי 1.5 ואין כמעט מרווח.",
        ),
        text(
          "Two companies each earn 100 a year. One has no debt, the other owes 800 at 5%, so it pays 40 interest every year. When sales fall, the indebted one is in trouble first.",
          "שתי חברות מרוויחות כל אחת 100 בשנה. לאחת אין חוב, לשנייה חוב של 800 ב-5%, כך שהיא משלמת 40 ריבית כל שנה. כשהמכירות יורדות, החברה עם החוב נקלעת לקשיים ראשונה.",
        ),
        text(
          "Compare like with like: a utility with steady customers can handle more debt than a company whose sales swing from year to year.",
          "השוו דומה לדומה: חברת שירותים עם לקוחות יציבים יכולה להתמודד עם יותר חוב מחברה שהמכירות שלה מתנדנדות משנה לשנה.",
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
      details: [
        text(
          "Common sources of a moat: a brand people pay extra for, a cost advantage rivals cannot match, switching costs that make customers stay, network effects where the service gets better as more people use it, and licences or patents.",
          "מקורות נפוצים לחפיר: מותג שאנשים משלמים עליו תוספת, יתרון עלות שמתחרים לא יכולים להשוות, עלויות מעבר שגורמות ללקוחות להישאר, אפקט רשת שבו השירות משתפר ככל שיותר אנשים משתמשים בו, ורישיונות או פטנטים.",
        ),
        text(
          "Moats can erode as technology and tastes change. Signs of a lasting moat in the numbers are steady high returns on capital, stable margins and growth through many years, which MoatMine's moat grade looks at.",
          "חפירים יכולים להישחק כשהטכנולוגיה והטעמים משתנים. סימנים בנתונים לחפיר מתמשך הם תשואה גבוהה ויציבה על ההון, שולי רווח יציבים וצמיחה לאורך שנים רבות, וזה מה שדירוג החפיר של MoatMine בוחן.",
        ),
      ],
      examples: [
        text(
          "Brand: customers pay more for the same product because they trust the name, so the company keeps a healthier margin than rivals.",
          "מותג: לקוחות משלמים יותר על אותו מוצר כי הם סומכים על השם, ולכן לחברה שולי רווח בריא יותר מלמתחרים.",
        ),
        text(
          "Switching costs: a business uses one software system for all its records. Moving everything to a rival is slow and risky, so it stays even when a cheaper option appears.",
          "עלויות מעבר: עסק משתמש במערכת תוכנה אחת לכל הרשומות שלו. העברת הכול למתחרה איטית ומסוכנת, ולכן הוא נשאר גם כשמופיעה אפשרות זולה יותר.",
        ),
        text(
          "Network effect: a marketplace with many sellers attracts many buyers, which attracts more sellers. A new rival starts with neither and struggles to catch up.",
          "אפקט רשת: שוק מקוון עם הרבה מוכרים מושך הרבה קונים, מה שמושך עוד מוכרים. מתחרה חדש מתחיל בלי אף אחד מהם וקשה לו להשיג.",
        ),
      ],
      tryIt: "/watchlist",
    },
  ],
};
