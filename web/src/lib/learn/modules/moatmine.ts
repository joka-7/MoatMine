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
      details: [
        text(
          "The profile has two parts: five questions that place you on a risk level, and the rules that come with that level, which you can review and adjust. A buy check compares a proposed purchase with those rules and with the portfolio you already hold.",
          "לפרופיל שני חלקים: חמש שאלות שממקמות אתכם ברמת סיכון, והכללים שמגיעים עם הרמה הזו, שאפשר לעיין בהם ולהתאים אותם. בדיקת קנייה משווה קנייה מוצעת לכללים האלה ולתיק שכבר יש לכם.",
        ),
        text(
          "Answer for the person you are when markets fall, not when they rise. Revisit the profile when your goals, income or time horizon change.",
          "ענו בשביל האדם שאתם כשהשווקים יורדים, לא כשהם עולים. חזרו לפרופיל כשהיעדים, ההכנסה או אופק הזמן משתנים.",
        ),
      ],
      examples: [
        text(
          "Honest answers: if you say you would sell after a 20% fall, the profile should reflect a lower risk level, even if you wish you were bolder.",
          "תשובות כנות: אם אתם אומרים שהייתם מוכרים אחרי ירידה של 20%, הפרופיל צריך לשקף רמת סיכון נמוכה יותר, גם אם הייתם רוצים להיות נועזים יותר.",
        ),
        text(
          "Before buying: you consider a new stock. The buy check measures it against your rules and portfolio instead of leaving you to judge it by gut feeling.",
          "לפני קנייה: אתם שוקלים מניה חדשה. בדיקת הקנייה מודדת אותה מול הכללים והתיק שלכם במקום להשאיר אתכם לשפוט לפי תחושת בטן.",
        ),
        text(
          "Life changes: after a new job or a child, you retake the questionnaire, because your answers, and so your rules, may have moved.",
          "שינוי בחיים: אחרי עבודה חדשה או ילד, אתם עונים שוב על השאלון, כי התשובות שלכם, ולכן הכללים, אולי זזו.",
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
      details: [
        text(
          "Each target also records a purpose, such as growth, income, speculation, hedge or retirement. Against your bounds, the app reports where you stand for each dimension: reached, within bounds, below the minimum, above the maximum, or no data.",
          "כל יעד מתעד גם מטרה, כמו צמיחה, הכנסה, ספקולציה, גידור או פרישה. מול הגבולות שלכם, האפליקציה מדווחת איפה אתם עומדים בכל ממד: הושג, בתוך הגבולות, מתחת למינימום, מעל המקסימום, או אין נתונים.",
        ),
        text(
          "The risk dimension needs real price history. If real prices cannot be fetched and the app would have to fall back to sample prices, it does not report a volatility made from them, so a risk target shows no data.",
          "ממד הסיכון צריך היסטוריית מחירים אמיתית. אם אי אפשר להביא מחירים אמיתיים והאפליקציה הייתה נאלצת לעבור למחירי דוגמה, היא לא מדווחת תנודתיות שנבנתה מהם, ולכן יעד סיכון מציג אין נתונים.",
        ),
      ],
      examples: [
        text(
          "Portfolio target: you want growth over about three years, with annualised volatility between 10% and 20%. If the portfolio's measured volatility is 24%, it is above the maximum, a signal to look at what is driving it.",
          "יעד לתיק: אתם רוצים צמיחה לאורך כשלוש שנים, עם תנודתיות שנתית בין 10% ל-20%. אם התנודתיות שנמדדה בתיק היא 24%, היא מעל המקסימום, סימן לבדוק מה מניע אותה.",
        ),
        text(
          "Stock target: for one symbol you set a maximum amount you are willing to hold. When the position grows past it, the target reports above the maximum.",
          "יעד למניה: לסימול אחד אתם קובעים סכום מרבי שאתם מוכנים להחזיק. כשהפוזיציה גדלה מעבר לו, היעד מדווח מעל המקסימום.",
        ),
        text(
          "Reading a status: below the minimum on Amount means you have put in less than planned; reached on Profit means the goal is met, and it is a good time to ask whether to keep holding.",
          "קריאת סטטוס: מתחת למינימום ב-Amount פירושו שהכנסתם פחות מהמתוכנן; הושג ב-Profit פירושו שהיעד התמלא, וזה זמן טוב לשאול אם להמשיך להחזיק.",
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
      details: [
        text(
          "The score runs from 0 to 100 and maps to a letter: A from 80, B from 65, C from 50, D from 35, and F below that. It blends financial strength, quality, leverage, price risk, behaviour in past crises, size, earnings stability, valuation and moat.",
          "הציון נע בין 0 ל-100 ומתורגם לאות: A מ-80, B מ-65, C מ-50, D מ-35, ו-F מתחת לזה. הוא משלב חוסן פיננסי, איכות, מינוף, סיכון מחיר, התנהגות במשברי עבר, גודל, יציבות רווחים, תמחור וחפיר.",
        ),
        text(
          "When a component has no data it is left out and the score is recalculated over the rest, and a coverage figure shows how much of the picture was available. A high score with low coverage deserves less trust.",
          "כשלרכיב אין נתונים הוא מושמט והציון מחושב מחדש על השאר, ומדד כיסוי מראה כמה מהתמונה היה זמין. ציון גבוה עם כיסוי נמוך ראוי ליותר חשדנות.",
        ),
      ],
      examples: [
        text(
          "A stock scores 82, a grade of A. It is strong on financial health and moat, and its behaviour in past crises was mild. It still can fall, and it is only an A against the factors the score measures.",
          "מניה מקבלת 82, ציון A. היא חזקה בבריאות פיננסית ובחפיר, והתנהגותה במשברי עבר הייתה מתונה. היא עדיין יכולה לרדת, והיא A רק מול הגורמים שהציון מודד.",
        ),
        text(
          "Two stocks score 70 and 55: grades B and C. The lower one may be more leveraged or more volatile, which is worth reading before you decide.",
          "שתי מניות מקבלות 70 ו-55: ציוני B ו-C. הנמוכה יותר אולי ממונפת יותר או תנודתית יותר, וכדאי לקרוא על כך לפני שמחליטים.",
        ),
        text(
          "A stock shows a score of 78 but with coverage of only 40%. Most inputs were missing, so treat the number as a rough hint and look for more information.",
          "מניה מציגה ציון 78 אבל עם כיסוי של 40% בלבד. רוב הקלטים חסרו, ולכן התייחסו למספר כרמז גס וחפשו מידע נוסף.",
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
      details: [
        text(
          "For each known crisis, such as the dot-com crash, the Bad times tab shows how deep the stock fell inside the crisis window, how long it took to get back to its earlier price, and the same numbers for a market benchmark so you can compare.",
          "לכל משבר מוכר, כמו קריסת הדוט-קום, לשונית זמנים רעים מראה עד כמה המניה ירדה בחלון המשבר, כמה זמן לקח לה לחזור למחיר הקודם, ואת אותם מספרים למדד שוק להשוואה.",
        ),
        text(
          "Value at risk is an estimate, such as 'a bad month, 1 in 20, could cost about this'. It is not a worst case. A past crisis is also not a forecast: the next one will differ.",
          "ערך בסיכון הוא אומדן, כמו 'חודש רע, אחד מתוך 20, עלול לעלות בערך כך'. זה אינו המקרה הגרוע ביותר. גם משבר עבר אינו תחזית: הבא יהיה שונה.",
        ),
      ],
      examples: [
        text(
          "A stock fell 55% during a past crisis while the benchmark fell 45%. It took the stock three years to recover and the market two. This tells you it fell harder and recovered more slowly than the market.",
          "מניה ירדה 55% במהלך משבר עבר בעוד מדד השוק ירד 45%. לקח למניה שלוש שנים להתאושש ולשוק שתיים. זה מלמד שהיא ירדה חזק יותר והתאוששה לאט יותר מהשוק.",
        ),
        text(
          "Your portfolio is worth 20,000 and the value-at-risk estimate for a bad month is about 8%. That means roughly 1,600 at risk in a bad month, which you can compare with how much loss you could stand.",
          "התיק שלכם שווה 20,000 ואומדן הערך בסיכון לחודש רע הוא כ-8%. זה אומר בערך 1,600 בסיכון בחודש רע, וזה אפשר להשוות לכמה הפסד אתם יכולים לעמוד בו.",
        ),
        text(
          "You see a sample-data label next to a price. The price is for demonstration, so do not trade or judge risk from it until real market data is connected.",
          "אתם רואים תווית נתוני דוגמה ליד מחיר. המחיר להדגמה, ולכן אל תסחרו ואל תשפטו סיכון לפיו עד שמחוברים נתוני שוק אמיתיים.",
        ),
      ],
      tryIt: "/risk",
    },
  ],
};
