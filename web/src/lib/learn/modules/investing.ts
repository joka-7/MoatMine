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
      tryIt: "/risk-profile",
    },
  ],
  quiz: [
    {
      prompt: text("What mainly separates investing from saving?", "מה מבדיל בעיקר בין השקעה לחיסכון?"),
      options: [
        text("Investing is only for experts", "השקעה מיועדת רק למומחים"),
        text("An investment's value can rise or fall", "ערכה של השקעה יכול לעלות או לרדת"),
        text("Savings always beat investments", "חיסכון תמיד עדיף על השקעה"),
      ],
      answer: 1,
      explanation: text(
        "Price movement, up and down, is what defines an investment and what makes risk real.",
        "תנודת מחיר, מעלה ומטה, היא מה שמגדיר השקעה ומה שהופך את הסיכון למוחשי.",
      ),
    },
    {
      prompt: text("Prices rise 3% a year. Your cash earns nothing. What happens to what it can buy?", "המחירים עולים 3% בשנה והמזומן שלכם לא מרוויח. מה קורה למה שאפשר לקנות בו?"),
      options: [
        text("It stays the same", "נשאר אותו דבר"),
        text("It grows", "גדל"),
        text("It shrinks each year", "קטן משנה לשנה"),
      ],
      answer: 2,
      explanation: text(
        "The number on the balance stays put, but each unit buys less. That is inflation.",
        "המספר ביתרה נשאר, אבל כל יחידה קונה פחות. זו אינפלציה.",
      ),
    },
    {
      prompt: text("Why is a longer time horizon useful when investing?", "למה אופק זמן ארוך יותר שימושי בהשקעה?"),
      options: [
        text("There is more time to recover from falls", "יש יותר זמן להתאושש מירידות"),
        text("Losses become impossible", "הפסדים הופכים לבלתי אפשריים"),
        text("Prices stop moving", "המחירים מפסיקים לנוע"),
      ],
      answer: 0,
      explanation: text(
        "Time does not remove risk, but it gives temporary falls room to recover before you need the money.",
        "זמן לא מסיר סיכון, אבל הוא נותן לירידות זמניות מרווח להתאושש לפני שצריך את הכסף.",
      ),
    },
  ],
};
