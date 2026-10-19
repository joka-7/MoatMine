import { text, type LearnModule } from "../types";

export const risk: LearnModule = {
  id: "risk",
  title: text("Risk and return", "סיכון ותשואה"),
  summary: text(
    "Volatility, drawdown and diversification: how risk is measured and reduced.",
    "תנודתיות, ירידה מהשיא ופיזור: איך מודדים סיכון ואיך מקטינים אותו.",
  ),
  lessons: [
    {
      title: text("Risk and reward go together", "סיכון ותשואה הולכים יחד"),
      body: [
        text(
          "Higher possible returns come with a wider range of outcomes, including bad ones. An investment that offers more with little risk would be bought up until the extra disappears.",
          "תשואה פוטנציאלית גבוהה יותר באה עם טווח רחב יותר של תוצאות, כולל רעות. השקעה שמציעה יותר תמורת סיכון קטן הייתה נקנית עד שהיתרון נעלם.",
        ),
        text(
          "So be sceptical of anything that promises high returns easily. The useful question is how much risk you can live with.",
          "לכן היו ספקנים כלפי כל מה שמבטיח תשואה גבוהה בקלות. השאלה השימושית היא כמה סיכון אפשר לחיות איתו.",
        ),
      ],
    },
    {
      title: text("Volatility", "תנודתיות"),
      body: [
        text(
          "Volatility measures how widely a price swings, usually as the annualised standard deviation of returns. A stock with 30% volatility swings roughly twice as widely as one with 15%.",
          "תנודתיות מודדת עד כמה המחיר מתנדנד, בדרך כלל כסטיית התקן השנתית של התשואות. מניה עם תנודתיות של 30% מתנדנדת בערך פי שניים ממניה עם 15%.",
        ),
        text(
          "MoatMine uses annualised volatility as its risk number, so it appears throughout the app.",
          "MoatMine משתמשת בתנודתיות שנתית כמספר הסיכון שלה, ולכן היא מופיעה בכל האפליקציה.",
        ),
      ],
      tryIt: "/risk",
    },
    {
      title: text("Drawdown: falls are lopsided", "ירידה מהשיא: ירידות אינן סימטריות"),
      body: [
        text(
          "A drawdown is the fall from a peak to a later low. Losses are harder to recover than they look: after a 50% fall you need a 100% gain just to get back.",
          "ירידה מהשיא היא הנפילה מפסגה לשפל מאוחר יותר. הפסדים קשים להשבה יותר ממה שנראה: אחרי ירידה של 50% צריך עלייה של 100% כדי לחזור.",
        ),
        text(
          "That is why many people care more about how deep a fall could be than about the average return.",
          "לכן אנשים רבים מתעניינים יותר בעומק האפשרי של נפילה מאשר בתשואה הממוצעת.",
        ),
      ],
    },
    {
      title: text("Diversification", "פיזור"),
      body: [
        text(
          "Holding many different investments means one company's bad news hurts less. It reduces risk specific to a company or sector.",
          "החזקת השקעות רבות ושונות פירושה שחדשות רעות של חברה אחת פוגעות פחות. זה מקטין סיכון ייחודי לחברה או לענף.",
        ),
        text(
          "It does not protect against everything: in a broad crash, most stocks fall together.",
          "זה לא מגן מפני הכול: בקריסה רחבה, רוב המניות יורדות יחד.",
        ),
      ],
    },
  ],
  quiz: [
    {
      prompt: text("What does higher volatility mean?", "מה משמעות תנודתיות גבוהה יותר?"),
      options: [
        text("A price that swings more widely", "מחיר שמתנדנד בטווח רחב יותר"),
        text("A price that only goes up", "מחיר שרק עולה"),
        text("A cheaper stock", "מניה זולה יותר"),
      ],
      answer: 0,
      explanation: text(
        "Volatility is about the size of the swings, in both directions.",
        "תנודתיות עוסקת בגודל התנודות, בשני הכיוונים.",
      ),
    },
    {
      prompt: text("A portfolio falls 50%. What gain is needed to get back to where it started?", "תיק יורד ב-50%. איזו עלייה נדרשת כדי לחזור לנקודת ההתחלה?"),
      options: [
        text("50%", "50%"),
        text("75%", "75%"),
        text("100%", "100%"),
      ],
      answer: 2,
      explanation: text(
        "100 falls to 50, and 50 must double to return to 100.",
        "100 יורד ל-50, ו-50 צריך להכפיל את עצמו כדי לחזור ל-100.",
      ),
    },
    {
      prompt: text("What can diversification NOT do?", "מה פיזור לא יכול לעשות?"),
      options: [
        text("Reduce the damage from one company failing", "להקטין את הנזק מכישלון של חברה אחת"),
        text("Stop the whole market falling at once", "למנוע מהשוק כולו לרדת בבת אחת"),
        text("Spread money across sectors", "לפזר כסף בין ענפים"),
      ],
      answer: 1,
      explanation: text(
        "It reduces company-specific risk; market-wide falls still hit most holdings.",
        "הוא מקטין סיכון ייחודי לחברה; ירידות כלל-שוקיות עדיין פוגעות ברוב האחזקות.",
      ),
    },
  ],
};
