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
      details: [
        text(
          "Shareholders come last in line. If a company fails, lenders and other creditors are paid first, and shareholders get what is left, which is often nothing.",
          "בעלי מניות נמצאים אחרונים בתור. אם חברה קורסת, מלווים ונושים אחרים מקבלים תשלום קודם, ובעלי המניות מקבלים את מה שנשאר, שלעיתים קרובות הוא כלום.",
        ),
        text(
          "Some companies reinvest their profits to grow and pay no dividend. Others pay out a steady share of profit. Neither is better in itself; they suit different goals. A share price is what the market pays today, which is not always what the business is worth.",
          "חברות מסוימות משקיעות מחדש את הרווחים כדי לצמוח ואינן משלמות דיבידנד. אחרות משלמות נתח קבוע מהרווח. אף אחת מהן אינה טובה יותר כשלעצמה; הן מתאימות למטרות שונות. מחיר מניה הוא מה ששוק משלם היום, ולא תמיד מה ששווה העסק.",
        ),
      ],
      examples: [
        text(
          "You buy 10 shares at 50, so 500 in total. If the price rises to 60 you hold 600. If it falls to 40 you hold 400. You only realise the gain or loss when you sell.",
          "אתם קונים 10 מניות ב-50, כלומר 500 בסך הכול. אם המחיר עולה ל-60 אתם מחזיקים 600. אם הוא יורד ל-40 אתם מחזיקים 400. הרווח או ההפסד מתממשים רק כשמוכרים.",
        ),
        text(
          "Dividend: with 10 shares and a dividend of 1 per share you receive 10. On the day the dividend is paid the share price usually drops by about that amount, so the dividend is not free money on top.",
          "דיבידנד: עם 10 מניות ודיבידנד של 1 למניה אתם מקבלים 10. ביום תשלום הדיבידנד מחיר המניה בדרך כלל יורד בערך בסכום הזה, ולכן הדיבידנד אינו כסף חינם נוסף.",
        ),
        text(
          "A company with 1,000 of debt and 200 of assets left fails. Lenders are paid first from the 200, and shareholders receive nothing.",
          "חברה עם חוב של 1,000 ונכסים שנותרו בשווי 200 קורסת. המלווים מקבלים קודם מתוך ה-200, ובעלי המניות לא מקבלים דבר.",
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
      details: [
        text(
          "Key terms: the face value is what you get back at maturity, the coupon is the yearly interest, and the yield is the return you actually earn at today's price.",
          "מונחים עיקריים: הערך הנקוב הוא מה שמקבלים בפדיון, הקופון הוא הריבית השנתית, והתשואה לפדיון היא התשואה שמרוויחים בפועל במחיר של היום.",
        ),
        text(
          "Prices and rates move in opposite directions. When new bonds pay more interest, older bonds with lower coupons become less attractive, so their price falls. If you hold to maturity you still get the face value back, unless the issuer defaults. Credit ratings estimate how likely that is.",
          "מחירים וריבית נעים בכיוונים הפוכים. כשאג\"ח חדשות משלמות יותר ריבית, אג\"ח ישנות עם קופון נמוך פחות אטרקטיביות ולכן מחירן יורד. אם מחזיקים עד הפדיון מקבלים בחזרה את הערך הנקוב, אלא אם המנפיק לא משלם. דירוגי אשראי מעריכים עד כמה זה סביר.",
        ),
      ],
      examples: [
        text(
          "A bond with a face value of 1,000 and a 4% coupon pays 40 a year for five years, then returns the 1,000.",
          "אג\"ח עם ערך נקוב של 1,000 וקופון של 4% משלמת 40 בשנה במשך חמש שנים, ואז מחזירה את ה-1,000.",
        ),
        text(
          "Rates rise from 4% to 6%. New bonds now pay 6%, so nobody will pay the full 1,000 for your 4% bond. If you sell before maturity you receive less than 1,000.",
          "הריבית עולה מ-4% ל-6%. אג\"ח חדשות משלמות עכשיו 6%, ולכן איש לא ישלם 1,000 מלאים עבור האג\"ח שלכם ב-4%. אם תמכרו לפני הפדיון תקבלו פחות מ-1,000.",
        ),
        text(
          "A stable government and a weaker company both issue bonds. The company must offer a higher coupon, because lenders want extra pay for the higher chance of not being repaid.",
          "ממשלה יציבה וחברה חלשה יותר מנפיקות אג\"ח. החברה חייבת להציע קופון גבוה יותר, כי המלווים רוצים תוספת תשלום על הסיכוי הגבוה יותר שלא יוחזר להם הכסף.",
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
      details: [
        text(
          "An index fund follows a list of companies automatically. An actively managed fund has managers choosing holdings, which usually costs more and does not always beat the index.",
          "קרן מחקה עוקבת אוטומטית אחרי רשימת חברות. בקרן מנוהלת מנהלים בוחרים אחזקות, וזה בדרך כלל עולה יותר ולא תמיד מנצח את המדד.",
        ),
        text(
          "Funds exist for stocks, bonds, a single sector, a country or a mix. What the fund holds decides its risk, so read what is inside rather than relying on the name.",
          "יש קרנות למניות, לאג\"ח, לענף בודד, למדינה או לתמהיל. מה שהקרן מחזיקה קובע את הסיכון שלה, ולכן קראו מה בפנים ואל תסתמכו על השם.",
        ),
      ],
      examples: [
        text(
          "An ETF tracking an index of 500 large companies: one purchase gives you a tiny slice of all 500, so one company failing barely moves the total.",
          "ETF שעוקב אחרי מדד של 500 חברות גדולות: קנייה אחת נותנת לכם פרוסה זעירה מכל ה-500, כך שכישלון של חברה אחת כמעט לא משנה את הסך הכול.",
        ),
        text(
          "Fees: on 10,000, an expense ratio of 0.1% costs 10 a year and 1.0% costs 100 a year. Over decades that gap grows large.",
          "עמלות: על 10,000, יחס הוצאות של 0.1% עולה 10 בשנה ו-1.0% עולה 100 בשנה. לאורך עשורים הפער הזה גדל מאוד.",
        ),
        text(
          "A sector ETF holding only 25 energy companies is far less spread out than a broad ETF. It is a fund, but it is not very diversified.",
          "ETF ענפי שמחזיק רק 25 חברות אנרגיה פחות מפוזר בהרבה מ-ETF רחב. זו קרן, אבל היא אינה מפוזרת במיוחד.",
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
      details: [
        text(
          "Liquidity means how fast you can turn something into cash without losing value. Cash is the most liquid asset; a flat is among the least.",
          "נזילות פירושה כמה מהר אפשר להפוך משהו למזומן בלי לאבד מערכו. מזומן הוא הנכס הנזיל ביותר; דירה היא מהפחות נזילים.",
        ),
        text(
          "Holding some cash inside a portfolio lowers its swings and gives you something to spend or invest when prices are low, at the price of a lower long-run growth.",
          "החזקת מעט מזומן בתוך תיק מקטינה את התנודות שלו ונותנת לכם משהו להוציא או להשקיע כשהמחירים נמוכים, במחיר של צמיחה נמוכה יותר בטווח הארוך.",
        ),
      ],
      examples: [
        text(
          "Emergency fund: a few months of expenses in an account you can reach the same day.",
          "קרן חירום: הוצאות של כמה חודשים בחשבון שאפשר להגיע אליו באותו יום.",
        ),
        text(
          "Waiting: you receive a bonus and are unsure where to invest it. Holding it as cash for a few weeks while you decide costs little.",
          "המתנה: קיבלתם בונוס ואינכם בטוחים איפה להשקיע אותו. החזקתו במזומן כמה שבועות בזמן שאתם מחליטים עולה מעט.",
        ),
        text(
          "Cushion: in a portfolio of 80% stocks and 20% cash, a 30% fall in stocks lowers the total by about 24%, not 30%.",
          "כרית ביטחון: בתיק של 80% מניות ו-20% מזומן, ירידה של 30% במניות מורידה את הסך הכול בכ-24%, לא ב-30%.",
        ),
      ],
      tryIt: "/portfolio",
    },
  ],
};
