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
      details: [
        text(
          "Three things shape a sensible split: your time horizon, how much of a fall you can stomach without selling, and how much you may need to withdraw along the way. There is no single right answer, only one that fits you.",
          "שלושה דברים מעצבים חלוקה סבירה: אופק הזמן שלכם, כמה ירידה אתם יכולים לעמוד בה בלי למכור, וכמה אולי תצטרכו למשוך בדרך. אין תשובה נכונה אחת, רק כזו שמתאימה לכם.",
        ),
        text(
          "Many people reduce the share of growth assets gradually as a goal gets closer, so that a late fall has less time to hurt.",
          "אנשים רבים מקטינים בהדרגה את נתח נכסי הצמיחה ככל שהיעד מתקרב, כך שלירידה מאוחרת יש פחות זמן לפגוע.",
        ),
      ],
      examples: [
        text(
          "10,000 in a 60/40 portfolio means 6,000 in stocks and 4,000 in bonds.",
          "10,000 בתיק 60/40 פירושם 6,000 במניות ו-4,000 באג\"ח.",
        ),
        text(
          "Stocks fall 30%. A 90/10 portfolio loses about 27% from its stocks alone, while a 30/70 portfolio loses about 9% from its stocks. The bond part moves too, so real results differ.",
          "מניות יורדות 30%. תיק 90/10 מאבד כ-27% מהמניות לבדן, בעוד תיק 30/70 מאבד כ-9% מהמניות שלו. גם חלק האג\"ח זז, ולכן התוצאות האמיתיות שונות.",
        ),
        text(
          "A 25-year-old saving for retirement and a 64-year-old retiring next year have very different horizons, so reasonable mixes for them differ even if both want the same return.",
          "בן 25 שחוסך לפרישה ובת 64 שפורשת בשנה הבאה הם בעלי אופקים שונים מאוד, ולכן תמהילים סבירים עבורם שונים גם אם שניהם רוצים אותה תשואה.",
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
      details: [
        text(
          "Two common approaches: by the calendar (every six or twelve months) or by a threshold (when any part drifts more than, say, five percentage points from its target). Both work; the point is to have a rule.",
          "שתי גישות נפוצות: לפי לוח שנה (כל שישה או שנים עשר חודשים) או לפי סף (כשחלק כלשהו מתרחק יותר מחמש נקודות אחוז מהיעד שלו, למשל). שתיהן עובדות; העיקר שיהיה כלל.",
        ),
        text(
          "Selling can trigger taxes and trading costs. You can often rebalance more cheaply by directing new deposits to whichever part is below target, instead of selling.",
          "מכירה יכולה להפעיל מסים ועלויות מסחר. לעיתים קרובות אפשר לאזן בזול יותר על ידי הפניית הפקדות חדשות לחלק שמתחת ליעד, במקום למכור.",
        ),
      ],
      examples: [
        text(
          "A 60/40 portfolio of 10,000 sees stocks rise 20%: stocks are 7,200 and bonds 4,000, a total of 11,200. Stocks are now 64% of the portfolio. To get back to 60% you move about 480 from stocks into bonds.",
          "תיק 60/40 של 10,000 רואה את המניות עולות 20%: המניות 7,200 והאג\"ח 4,000, בסך הכול 11,200. המניות הן עכשיו 64% מהתיק. כדי לחזור ל-60% מעבירים כ-480 ממניות לאג\"ח.",
        ),
        text(
          "Threshold rule: you rebalance only when stocks drift more than 5 points from 60%. In a calm year you do nothing; in a big rally or fall you act.",
          "כלל סף: מאזנים רק כשהמניות מתרחקות יותר מ-5 נקודות מ-60%. בשנה שקטה לא עושים כלום; בעלייה או ירידה גדולה פועלים.",
        ),
        text(
          "You add 1,000 each month. Instead of selling anything, you put it all into whichever part is below target until the split is right again.",
          "אתם מוסיפים 1,000 בכל חודש. במקום למכור משהו, אתם מפנים אותם כולם לחלק שמתחת ליעד עד שהחלוקה נכונה שוב.",
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
      details: [
        text(
          "A holding can grow into a large share simply because it did well, with no decision from you. Check weights from time to time, not only at the moment of purchase.",
          "אחזקה יכולה לגדול לנתח גדול פשוט כי הצליחה, בלי שום החלטה מצדכם. בדקו משקלים מדי פעם, לא רק ברגע הקנייה.",
        ),
        text(
          "Shares of your own employer are a special case: your income and your savings then depend on the same company, so a bad outcome hits both at once.",
          "מניות של המעסיק שלכם הן מקרה מיוחד: ההכנסה והחיסכון שלכם תלויים אז באותה חברה, ולכן תוצאה רעה פוגעת בשניהם בבת אחת.",
        ),
      ],
      examples: [
        text(
          "40% of a portfolio sits in one stock that falls 50%. The portfolio loses 20% from that stock alone.",
          "40% מהתיק יושבים במניה אחת שיורדת 50%. התיק מאבד 20% מהמניה הזו בלבד.",
        ),
        text(
          "With a rule of at most 10% per holding, the same 50% fall in one stock costs at most 5% of the portfolio.",
          "עם כלל של 10% לכל היותר לאחזקה, אותה ירידה של 50% במניה אחת עולה לכל היותר 5% מהתיק.",
        ),
        text(
          "You work at a company and also hold a lot of its shares. If the company runs into trouble you could lose your job and a large part of your savings in the same month.",
          "אתם עובדים בחברה ומחזיקים גם הרבה ממניותיה. אם החברה נקלעת לקשיים אתם עלולים לאבד את העבודה ונתח גדול מהחיסכון באותו חודש.",
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
      details: [
        text(
          "Costs include fund fees, broker commissions, the gap between bid and ask, and taxes on gains. Each looks small; together over decades they take a large bite of the result.",
          "עלויות כוללות עמלות קרן, עמלות ברוקר, הפער בין bid ל-ask ומסים על רווחים. כל אחת נראית קטנה; יחד לאורך עשורים הן אוכלות נתח גדול מהתוצאה.",
        ),
        text(
          "Behaviour is the other big cost. Selling after a large fall, or buying after a large rise, tends to lock in poor timing. Written rules protect you from your own worst moments.",
          "התנהגות היא העלות הגדולה האחרת. מכירה אחרי ירידה גדולה, או קנייה אחרי עלייה גדולה, נוטות לנעול תזמון גרוע. כללים כתובים מגנים עליכם מהרגעים הגרועים ביותר שלכם.",
        ),
      ],
      examples: [
        text(
          "1,000 growing 7% a year for 30 years becomes about 7,400 when the yearly fee is 0.1%, but only about 5,700 when the fee is 1%. The fee difference alone costs about 1,700.",
          "1,000 שגדלים 7% בשנה במשך 30 שנה הופכים לכ-7,400 כשהעמלה השנתית 0.1%, אבל רק לכ-5,700 כשהעמלה 1%. הפרש העמלות לבדו עולה כ-1,700.",
        ),
        text(
          "A portfolio falls 30% and you sell in a panic. If you had held on, the fall would have been only a dip on paper; selling made it a real loss.",
          "תיק יורד 30% ואתם מוכרים בבהלה. אם הייתם מחזיקים, הירידה הייתה רק שקיעה על הנייר; המכירה הפכה אותה להפסד אמיתי.",
        ),
        text(
          "A written rule: rebalance every January, never hold more than 10% in one stock, and never trade on a rumour. When markets get loud, you reread the rule instead of deciding on the spot.",
          "כלל כתוב: מאזנים כל ינואר, לא מחזיקים יותר מ-10% במניה אחת, ולא סוחרים על שמועה. כשהשווקים רועשים, אתם קוראים שוב את הכלל במקום להחליט במקום.",
        ),
      ],
    },
  ],
};
