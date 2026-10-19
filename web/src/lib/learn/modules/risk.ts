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
          "Higher possible returns come with a wider range of outcomes, including bad ones. An investment that offers more for little risk would be bought up until the extra disappears.",
          "תשואה פוטנציאלית גבוהה יותר באה עם טווח רחב יותר של תוצאות, כולל רעות. השקעה שמציעה יותר תמורת סיכון קטן הייתה נקנית עד שהיתרון נעלם.",
        ),
        text(
          "So be sceptical of anything that promises high returns easily. The useful question is how much risk you can live with.",
          "לכן היו ספקנים כלפי כל מה שמבטיח תשואה גבוהה בקלות. השאלה השימושית היא כמה סיכון אפשר לחיות איתו.",
        ),
      ],
      details: [
        text(
          "Risk comes in kinds: market risk (everything falls together), company risk (one business fails), inflation risk (cash loses buying power), liquidity risk (you cannot sell quickly) and currency risk (exchange rates move against you).",
          "לסיכון יש סוגים: סיכון שוק (הכול יורד יחד), סיכון חברה (עסק אחד קורס), סיכון אינפלציה (המזומן מאבד כוח קנייה), סיכון נזילות (אי אפשר למכור מהר) וסיכון מטבע (שערי חליפין זזים נגדכם).",
        ),
        text(
          "Investors are paid, on average, for taking risks they cannot avoid, but only on average and only over long periods. A single year can pay nothing, or cost a lot.",
          "משקיעים מקבלים תשלום, בממוצע, על סיכונים שאי אפשר להימנע מהם, אבל רק בממוצע ורק בטווח ארוך. שנה אחת יכולה לא לשלם דבר, או לעלות הרבה.",
        ),
      ],
      examples: [
        text(
          "A deposit pays a steady 3%. Broad stock indices have had years that fell 30% or more, and also years that rose by a similar amount. The higher average comes with that wider spread.",
          "פיקדון משלם 3% קבועים. מדדי מניות רחבים חוו שנים שבהן ירדו 30% ויותר, וגם שנים שבהן עלו בהיקף דומה. הממוצע הגבוה יותר בא עם הפיזור הרחב הזה.",
        ),
        text(
          "Fund A's yearly results ranged between -5% and +10%. Fund B's ranged between -30% and +40%. B may earn more over time, but it asks you to live with much bigger swings.",
          "תוצאות שנתיות של קרן א' נעו בין -5% ל-+10%. של קרן ב' בין -30% ל-+40%. ב' אולי תרוויח יותר עם הזמן, אבל היא דורשת לחיות עם תנודות גדולות הרבה יותר.",
        ),
        text(
          "Someone offers a return of 20% a year with no downside. Since real investments cannot offer that, treat it as a warning sign and be ready to walk away.",
          "מישהו מציע תשואה של 20% בשנה בלי צד שלילי. מכיוון שהשקעות אמיתיות לא יכולות להציע זאת, התייחסו לזה כסימן אזהרה והיו מוכנים ללכת.",
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
      details: [
        text(
          "As a rough guide, a yearly volatility of 20% means that in about two years out of three the result lands within 20 points of its long-run average. That assumes returns follow a bell curve.",
          "כאומדן גס, תנודתיות שנתית של 20% פירושה שבערך בשתיים מכל שלוש שנים התוצאה נופלת בטווח של 20 נקודות מהממוצע ארוך הטווח. זה מניח שהתשואות עוקבות אחרי עקומת פעמון.",
        ),
        text(
          "Real markets have fatter tails: extreme days happen more often than a bell curve says. Volatility is a useful yardstick, not a limit on how bad things can get.",
          "בשווקים אמיתיים הזנבות שמנים יותר: ימים קיצוניים קורים יותר ממה שעקומת פעמון אומרת. תנודתיות היא סרגל שימושי, לא גבול לכמה גרוע זה יכול להיות.",
        ),
      ],
      examples: [
        text(
          "Stock A has 15% volatility and stock B has 30%. Over a typical year B's result is expected to scatter about twice as far from its average as A's.",
          "למניה א' תנודתיות של 15% ולמניה ב' 30%. בשנה טיפוסית תוצאת ב' צפויה להתפזר פי שניים רחוק יותר מהממוצע שלה לעומת א'.",
        ),
        text(
          "A holding of 10,000 with 30% volatility: in a typical year its result is expected to land within about 3,000 either side of its average, and sometimes far outside it.",
          "אחזקה של 10,000 עם תנודתיות של 30%: בשנה טיפוסית תוצאתה צפויה לנחות בטווח של כ-3,000 לשני צדי הממוצע שלה, ולפעמים הרבה מחוצה לו.",
        ),
        text(
          "A utility company and a young technology company can both be good businesses, yet the technology one typically shows far higher volatility. The number tells you about the ride, not the quality.",
          "חברת שירותים וחברת טכנולוגיה צעירה יכולות שתיהן להיות עסקים טובים, אך בחברת הטכנולוגיה התנודתיות בדרך כלל גבוהה בהרבה. המספר מספר על הנסיעה, לא על האיכות.",
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
      details: [
        text(
          "The gain needed to recover grows faster than the loss: a 10% fall needs about 11%, 20% needs 25%, 33% needs 50%, 50% needs 100% and 75% needs 300%.",
          "העלייה הנדרשת להתאוששות גדלה מהר יותר מההפסד: ירידה של 10% דורשת כ-11%, 20% דורשת 25%, 33% דורשת 50%, 50% דורשת 100% ו-75% דורשת 300%.",
        ),
        text(
          "Maximum drawdown is the deepest peak-to-low fall in a period. Recovery time matters too: a fall that takes years to regain is much harder to sit through than one that is back in months.",
          "ירידה מרבית מהשיא היא הנפילה העמוקה ביותר משיא לשפל בתקופה. גם זמן ההתאוששות חשוב: נפילה שלוקח שנים להחזיר קשה הרבה יותר מאשר כזו שחוזרת בתוך חודשים.",
        ),
      ],
      examples: [
        text(
          "A portfolio of 10,000 falls 20% to 8,000. To return to 10,000 it needs to gain 25%, because 8,000 × 1.25 = 10,000.",
          "תיק של 10,000 יורד 20% ל-8,000. כדי לחזור ל-10,000 הוא צריך לעלות 25%, כי 8,000 × 1.25 = 10,000.",
        ),
        text(
          "A stock falls 50% from 100 to 50. A gain of 50% takes it only to 75. It needs to double, a 100% gain, to be back at 100.",
          "מניה יורדת 50% מ-100 ל-50. עלייה של 50% מביאה אותה רק ל-75. היא צריכה להכפיל את עצמה, עלייה של 100%, כדי לחזור ל-100.",
        ),
        text(
          "Two funds both average 7% a year, but one once fell 50% and the other at worst fell 20%. Most people can hold the second through the bad year; many sell the first at the bottom.",
          "שתי קרנות מניבות בממוצע 7% בשנה, אבל אחת ירדה פעם 50% והשנייה במקרה הגרוע ירדה 20%. רוב האנשים יכולים להחזיק את השנייה בשנה הרעה; רבים מוכרים את הראשונה בתחתית.",
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
      details: [
        text(
          "What counts is how differently holdings behave, called correlation. Ten stocks in the same industry usually move together, so they spread less risk than ten stocks in ten industries.",
          "מה שקובע הוא כמה שונה האחזקות מתנהגות, מה שנקרא מתאם. עשר מניות באותה תעשייה בדרך כלל נעות יחד, ולכן מפזרות פחות סיכון מעשר מניות בעשר תעשיות.",
        ),
        text(
          "You can spread across companies, sectors, countries and asset types. More holdings help with diminishing returns: after a few dozen well-chosen ones the benefit of adding more is small.",
          "אפשר לפזר בין חברות, ענפים, מדינות וסוגי נכסים. יותר אחזקות עוזרות בתשואה פוחתת: אחרי כמה עשרות אחזקות שנבחרו היטב התועלת בהוספת עוד קטנה.",
        ),
      ],
      examples: [
        text(
          "10,000 in a single stock that fails loses 100%. The same 10,000 spread equally across 20 stocks loses 5% if one of them fails.",
          "10,000 במניה אחת שקורסת מאבדים 100%. אותם 10,000 מפוזרים שווה בשווה על 20 מניות מאבדים 5% אם אחת מהן קורסת.",
        ),
        text(
          "A portfolio of ten technology companies looks spread out but is really one bet on one sector. If the sector falls, all ten usually fall.",
          "תיק של עשר חברות טכנולוגיה נראה מפוזר אבל הוא בעצם הימור אחד על ענף אחד. אם הענף יורד, כל העשר בדרך כלל יורדות.",
        ),
        text(
          "In a deep market crash most stocks fall together, while cash holds its value and good-quality bonds often fall less. That is why spreading across asset types helps where spreading across stocks does not.",
          "בקריסת שוק עמוקה רוב המניות יורדות יחד, בעוד מזומן שומר על ערכו ואג\"ח איכותיות לרוב יורדות פחות. לכן פיזור בין סוגי נכסים עוזר היכן שפיזור בין מניות לא עוזר.",
        ),
      ],
    },
  ],
};
