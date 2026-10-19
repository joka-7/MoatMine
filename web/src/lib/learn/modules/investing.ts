import { text, type LearnModule } from "../types";

export const investing: LearnModule = {
  id: "investing",
  title: text("What investing is", "מהי השקעה"),
  summary: text(
    "Saving versus investing, what inflation does to cash, and why time matters.",
    "חיסכון מול השקעה, מה האינפלציה עושה למזומן, ולמה זמן משנה.",
  ),
  lessons: [
    {
      title: text("Saving versus investing", "חיסכון מול השקעה"),
      body: [
        text(
          "Saving means setting money aside where it keeps its face value, such as a bank account. Investing means putting money into something whose price moves, such as a company's shares, in the hope it grows.",
          "חיסכון הוא הפרשת כסף למקום שבו ערכו הנקוב נשמר, כמו חשבון בנק. השקעה היא הצבת כסף במשהו שמחירו משתנה, כמו מניות של חברה, בתקווה שיגדל.",
        ),
        text(
          "The trade is simple: investing can grow your money faster, but the value can also fall, sometimes for years. Nobody can remove that risk, only understand and limit it.",
          "העיקרון פשוט: השקעה יכולה להגדיל את הכסף מהר יותר, אבל הערך גם יכול לרדת, לפעמים לשנים. אי אפשר להעלים את הסיכון הזה, רק להבין אותו ולהגביל אותו.",
        ),
      ],
      details: [
        text(
          "A savings account or deposit pays a modest, known interest rate, and in many countries deposits up to a limit are covered by deposit insurance. Rules differ by country, so check yours. An investment carries no such promise: its price is set by the market every day.",
          "חשבון חיסכון או פיקדון משלם ריבית צנועה וידועה מראש, ובמדינות רבות פיקדונות עד תקרה מסוימת מבוטחים. הכללים משתנים ממדינה למדינה, אז בדקו את שלכם. להשקעה אין הבטחה כזו: המחיר שלה נקבע בשוק בכל יום.",
        ),
        text(
          "Risk is not only losing money. It is also being forced to sell at a bad moment because you needed the cash. That is why money you may need soon belongs in savings, and money you can leave alone belongs in investments.",
          "סיכון אינו רק הפסד כסף. זה גם להיאלץ למכור ברגע גרוע כי הייתם זקוקים למזומן. לכן כסף שאולי תצטרכו בקרוב שייך לחיסכון, וכסף שאפשר להשאיר במקומו שייך להשקעות.",
        ),
      ],
      examples: [
        text(
          "Emergency fund: you keep three to six months of expenses in savings. When the car breaks down, you pay from savings and never have to sell shares at a low price.",
          "קרן חירום: אתם שומרים הוצאות של שלושה עד שישה חודשים בחיסכון. כשהרכב מתקלקל, משלמים מהחיסכון ואין צורך למכור מניות במחיר נמוך.",
        ),
        text(
          "Known versus unknown: 5,000 in a deposit at 3% becomes exactly 5,150 after a year. The same 5,000 in a stock fund might be 5,600 a year later, or 4,500. The numbers are made up, but the shape is real: the deposit is predictable, the fund is not.",
          "ידוע מול לא ידוע: 5,000 בפיקדון ב-3% הופכים ל-5,150 בדיוק אחרי שנה. אותם 5,000 בקרן מניות עשויים להיות 5,600 שנה אחר כך, או 4,500. המספרים מדומים, אבל הצורה אמיתית: הפיקדון צפוי, הקרן לא.",
        ),
        text(
          "Two goals: a holiday in six months belongs in savings, because a fall in the meantime would cut the trip. Retirement in thirty years can sit in investments, because there is time to wait out the falls.",
          "שתי מטרות: חופשה בעוד שישה חודשים שייכת לחיסכון, כי ירידה בינתיים תקצץ את הטיול. פרישה בעוד שלושים שנה יכולה לשבת בהשקעות, כי יש זמן להמתין לירידות.",
        ),
      ],
    },
    {
      title: text("Inflation: cash loses quietly", "אינפלציה: המזומן נשחק בשקט"),
      body: [
        text(
          "Inflation is the general rise in prices. At 3% a year, 100 in cash buys only what about 74 buys today after ten years.",
          "אינפלציה היא עליית מחירים כללית. ב-3% בשנה, 100 במזומן קונים אחרי עשר שנים רק מה ש-74 בערך קונים היום.",
        ),
        text(
          "That is why people invest even though it carries risk: leaving everything in cash has a cost too, it is just harder to see.",
          "לכן אנשים משקיעים למרות הסיכון: להשאיר הכול במזומן עולה גם כן, רק שהמחיר קשה יותר לראות.",
        ),
      ],
      details: [
        text(
          "A nominal return is the number on the statement. A real return is what is left after inflation. Roughly, real return is nominal return minus inflation: 5% nominal with 3% inflation is about 2% real.",
          "תשואה נומינלית היא המספר שמופיע בדף החשבון. תשואה ריאלית היא מה שנשאר אחרי האינפלציה. בערך, תשואה ריאלית היא התשואה הנומינלית פחות האינפלציה: 5% נומינליים עם אינפלציה של 3% הם כ-2% ריאליים.",
        ),
        text(
          "Inflation is not the same everywhere or for every person. Rent, food and fuel can rise faster than the official average, so your own inflation can be higher or lower.",
          "האינפלציה אינה זהה בכל מקום ולכל אדם. שכר דירה, מזון ודלק יכולים לעלות מהר יותר מהממוצע הרשמי, ולכן האינפלציה האישית שלכם יכולה להיות גבוהה או נמוכה יותר.",
        ),
      ],
      examples: [
        text(
          "A basket of groceries costs 100 today. At 3% inflation it costs about 103 next year and about 134 in ten years.",
          "סל מצרכים עולה היום 100. באינפלציה של 3% הוא יעלה כ-103 בשנה הבאה וכ-134 בעוד עשר שנים.",
        ),
        text(
          "1,000 kept as cash for ten years at 3% inflation still reads 1,000, but it buys what about 744 buys today.",
          "1,000 שנשמרו במזומן עשר שנים באינפלציה של 3% עדיין מראים 1,000, אבל קונים מה ש-744 בערך קונים היום.",
        ),
        text(
          "A deposit paying 2% while prices rise 3% loses about 1% of buying power a year. A deposit paying 5% in the same conditions gains about 2%.",
          "פיקדון שמשלם 2% בזמן שהמחירים עולים 3% מאבד כ-1% מכוח הקנייה בשנה. פיקדון שמשלם 5% באותם תנאים מרוויח כ-2%.",
        ),
      ],
    },
    {
      title: text("Compounding", "ריבית דריבית"),
      body: [
        text(
          "Compounding means your gains earn gains of their own. As an illustration only, 1,000 growing 7% a year becomes about 1,970 after ten years, not the 1,700 that simple addition suggests.",
          "ריבית דריבית פירושה שהרווחים שלכם מרוויחים בעצמם. להמחשה בלבד, 1,000 שגדלים 7% בשנה הופכים לכ-1,970 אחרי עשר שנים, ולא ל-1,700 כפי שחיבור פשוט מרמז.",
        ),
        text(
          "Real returns are uneven and can be negative in a given year. The 7% above is an example, not a forecast.",
          "תשואות אמיתיות אינן אחידות ויכולות להיות שליליות בשנה מסוימת. 7% לעיל הם דוגמה, לא תחזית.",
        ),
      ],
      details: [
        text(
          "The rule of 72 gives a quick estimate: divide 72 by the yearly growth rate to get the years needed to double. At 6% that is about 12 years, at 9% about 8.",
          "כלל ה-72 נותן הערכה מהירה: מחלקים 72 בקצב הצמיחה השנתי וכך מקבלים את מספר השנים להכפלה. ב-6% זה כ-12 שנים, ב-9% כ-8.",
        ),
        text(
          "Compounding rewards time far more than effort. The later years do most of the growing, which is why starting early, and not interrupting the process, matters.",
          "ריבית דריבית מתגמלת זמן הרבה יותר מאשר מאמץ. השנים המאוחרות עושות את רוב הצמיחה, ולכן חשוב להתחיל מוקדם ולא להפריע לתהליך.",
        ),
      ],
      examples: [
        text(
          "Time: 1,000 at 7% a year becomes about 1,970 after 10 years, about 3,870 after 20 years and about 7,610 after 30 years. The last ten years add more than the first twenty.",
          "זמן: 1,000 ב-7% בשנה הופכים לכ-1,970 אחרי 10 שנים, כ-3,870 אחרי 20 שנה וכ-7,610 אחרי 30 שנה. עשר השנים האחרונות מוסיפות יותר מעשרים הראשונות.",
        ),
        text(
          "Rate: 1,000 for ten years becomes about 1,340 at 3% but about 1,970 at 7%. A few points of difference in the rate become a big difference in the result.",
          "קצב: 1,000 לעשר שנים הופכים לכ-1,340 ב-3% אבל לכ-1,970 ב-7%. הבדל של כמה נקודות בקצב הופך להבדל גדול בתוצאה.",
        ),
        text(
          "Fees: take 7% growth with a 1% yearly fee, so 6% net. After 30 years 1,000 becomes about 5,740 instead of about 7,610. The fee quietly takes about a quarter of the result.",
          "עמלות: קחו צמיחה של 7% עם עמלה שנתית של 1%, כלומר 6% נטו. אחרי 30 שנה 1,000 הופכים לכ-5,740 במקום כ-7,610. העמלה לוקחת בשקט כרבע מהתוצאה.",
        ),
      ],
    },
    {
      title: text("Goals and time horizon", "מטרות ואופק זמן"),
      body: [
        text(
          "Money you need within a year or two, like a deposit on a flat, should not sit in assets that can drop 30% in a bad year. Money for goals decades away can ride out more ups and downs.",
          "כסף שצריך בעוד שנה או שנתיים, כמו מקדמה לדירה, לא צריך לשבת בנכסים שיכולים לרדת 30% בשנה רעה. כסף ליעדים שמרוחקים עשרות שנים יכול לעמוד ביותר עליות וירידות.",
        ),
        text(
          "Start by naming the goal and the date. Everything else, including how much risk is reasonable, follows from them.",
          "התחילו בלקרוא ליעד ולתאריך בשמם. כל השאר, כולל כמה סיכון סביר, נגזר מהם.",
        ),
      ],
      details: [
        text(
          "A common rule of thumb splits goals by distance: under two years, keep the money stable; two to seven years, mix stable assets and growth assets; beyond seven years, growth assets can take a larger share. It is a starting point, not a law.",
          "כלל אצבע נפוץ מחלק מטרות לפי מרחק: פחות משנתיים, לשמור על הכסף יציב; שנתיים עד שבע, לערבב נכסים יציבים ונכסי צמיחה; מעבר לשבע שנים, נכסי צמיחה יכולים לתפוס נתח גדול יותר. זו נקודת התחלה, לא חוק.",
        ),
        text(
          "Your own comfort matters as much as the calendar. If a 20% fall would make you sell in a panic, a lower-risk mix suits you better even with a long horizon.",
          "הנוחות האישית שלכם חשובה כמו הלוח. אם ירידה של 20% תגרום לכם למכור בבהלה, תמהיל בסיכון נמוך יותר מתאים לכם יותר גם עם אופק ארוך.",
        ),
      ],
      examples: [
        text(
          "A flat deposit needed in 18 months: mostly cash or very stable holdings, because there is no time to recover from a fall.",
          "מקדמה לדירה שנחוצה בעוד 18 חודשים: בעיקר מזומן או אחזקות יציבות מאוד, כי אין זמן להתאושש מירידה.",
        ),
        text(
          "A child's education in 12 years: mostly growth assets at first, then gradually moving money toward stable assets as the date approaches.",
          "לימודי ילד בעוד 12 שנה: בהתחלה בעיקר נכסי צמיחה, ואז מעבר הדרגתי של כסף לנכסים יציבים ככל שהתאריך מתקרב.",
        ),
        text(
          "Retirement in 35 years: a larger share of growth assets is reasonable, with the risk reduced gradually as retirement nears.",
          "פרישה בעוד 35 שנה: נתח גדול יותר של נכסי צמיחה סביר, עם הקטנה הדרגתית של הסיכון ככל שהפרישה מתקרבת.",
        ),
      ],
      tryIt: "/risk-profile",
    },
  ],
};
