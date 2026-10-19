import { text, type LearnModule } from "../types";

export const markets: LearnModule = {
  id: "markets",
  title: text("How markets work", "איך שווקים עובדים"),
  summary: text(
    "Exchanges, tickers, prices, orders and what market cap means.",
    "בורסות, סימולים, מחירים, הוראות קנייה ומה זה שווי שוק.",
  ),
  lessons: [
    {
      title: text("Exchanges and tickers", "בורסות וסימולים"),
      body: [
        text(
          "An exchange is a marketplace where buyers and sellers of shares meet. Each company is identified by a short ticker symbol, such as AAPL for Apple.",
          "בורסה היא שוק שבו קונים ומוכרים של מניות נפגשים. כל חברה מזוהה בסימול קצר, למשל AAPL עבור Apple.",
        ),
        text(
          "You do not buy from the company; you buy from another investor who is selling. The company only receives money when it first issues shares.",
          "אתם לא קונים מהחברה אלא ממשקיע אחר שמוכר. החברה מקבלת כסף רק כשהיא מנפיקה מניות לראשונה.",
        ),
      ],
      details: [
        text(
          "Exchanges have opening hours, and prices only update while they are open. Ordinary investors reach an exchange through a broker, an app or firm that sends your order there.",
          "לבורסות יש שעות פעילות, והמחירים מתעדכנים רק כשהן פתוחות. משקיעים רגילים מגיעים לבורסה דרך ברוקר, אפליקציה או חברה ששולחת לשם את ההוראה.",
        ),
        text(
          "The first sale of new shares by a company is called the primary market, or an IPO when it is the first time. Everything afterwards between investors is the secondary market, which is what you see in daily prices.",
          "המכירה הראשונה של מניות חדשות על ידי חברה נקראת השוק הראשוני, או הנפקה לציבור כשזו הפעם הראשונה. כל מה שאחר כך בין משקיעים הוא השוק המשני, וזה מה שרואים במחירים היומיים.",
        ),
      ],
      examples: [
        text(
          "AAPL is the ticker for Apple. The same company may carry a different ticker or suffix on another exchange, so always check which listing you are looking at.",
          "AAPL הוא הסימול של Apple. לאותה חברה עשוי להיות סימול או סיומת אחרים בבורסה אחרת, ולכן תמיד בדקו באיזו רשימה אתם מסתכלים.",
        ),
        text(
          "A company sells 1 million new shares in an IPO and receives that money. A month later you buy 100 of those shares from another investor; the company gets nothing from your purchase.",
          "חברה מוכרת מיליון מניות חדשות בהנפקה ומקבלת את הכסף. חודש אחר כך אתם קונים 100 מהמניות האלה ממשקיע אחר; החברה לא מקבלת דבר מהקנייה שלכם.",
        ),
        text(
          "You tap Buy in a broker app. The broker sends the order to an exchange, where it meets a seller. You never contact the exchange yourself.",
          "אתם לוחצים קנייה באפליקציית ברוקר. הברוקר שולח את ההוראה לבורסה, שם היא פוגשת מוכר. אתם לא פונים לבורסה בעצמכם.",
        ),
      ],
      tryIt: "/watchlist",
    },
    {
      title: text("Why prices move", "למה מחירים זזים"),
      body: [
        text(
          "A price is simply where buyers and sellers agree right now. News, earnings, interest rates and mood all shift how much people are willing to pay.",
          "מחיר הוא פשוט הנקודה שבה קונים ומוכרים מסכימים כרגע. חדשות, דוחות רווח, ריבית ורוח השוק משנים כמה אנשים מוכנים לשלם.",
        ),
        text(
          "Over short periods prices are noisy and hard to predict. Over long periods they follow the business more closely.",
          "בטווח קצר המחירים רועשים וקשים לחיזוי. בטווח ארוך הם עוקבים אחרי העסק מקרוב יותר.",
        ),
      ],
      details: [
        text(
          "Prices move on surprises, not on news everybody already expected. If analysts expect a profit of 10 and the company reports 10, the price may not move at all. The market had already priced it in.",
          "מחירים זזים בגלל הפתעות, לא בגלל חדשות שכולם כבר ציפו להן. אם אנליסטים מצפים לרווח של 10 והחברה מדווחת על 10, המחיר אולי לא יזוז כלל. השוק כבר תמחר זאת.",
        ),
        text(
          "That is why explaining a move after the fact is easy and predicting one in advance is very hard. Beware of anyone claiming to do it reliably.",
          "לכן קל להסביר תנועה בדיעבד וקשה מאוד לחזות אותה מראש. היזהרו ממי שטוען שהוא עושה זאת באופן עקבי.",
        ),
      ],
      examples: [
        text(
          "A company reports profit well above what analysts expected. Many people want to buy at once, and the price may jump that day.",
          "חברה מדווחת על רווח גבוה בהרבה ממה שאנליסטים ציפו. אנשים רבים רוצים לקנות בבת אחת, והמחיר עשוי לקפוץ באותו יום.",
        ),
        text(
          "A central bank raises interest rates. Safer deposits pay more, and companies that rely on borrowing face higher costs, so many stocks fall.",
          "בנק מרכזי מעלה ריבית. פיקדונות מניבים יותר, וחברות שמסתמכות על הלוואות מתמודדות עם עלויות גבוהות יותר, ולכן מניות רבות יורדות.",
        ),
        text(
          "A rumour spreads online and a stock spikes 15%. Nothing about the business changed, so the price drifts back within days.",
          "שמועה מתפשטת ברשת ומניה קופצת 15%. דבר בעסק לא השתנה, ולכן המחיר חוזר תוך ימים.",
        ),
      ],
    },
    {
      title: text("Orders: market and limit", "הוראות: שוק ולימיט"),
      body: [
        text(
          "A market order buys or sells right away at the best available price. A limit order sets your price: it buys only at or below it, or sells only at or above it, and may never fill.",
          "הוראת שוק קונה או מוכרת מיד במחיר הטוב ביותר הזמין. הוראת לימיט קובעת את המחיר שלכם: היא קונה רק במחיר הזה או נמוך ממנו, או מוכרת רק בו או מעליו, וייתכן שלא תתבצע כלל.",
        ),
        text(
          "Prices quoted are a bid, what buyers offer, and an ask, what sellers want. The gap between them is a hidden cost of trading.",
          "המחירים מוצגים כ-bid, מה שקונים מציעים, ו-ask, מה שמוכרים רוצים. הפער ביניהם הוא עלות סמויה של מסחר.",
        ),
      ],
      details: [
        text(
          "A market order guarantees that you trade but not at what price; a limit order guarantees the price but not that you trade. Pick the one whose uncertainty matters less to you.",
          "הוראת שוק מבטיחה שתבצעו עסקה אבל לא באיזה מחיר; הוראת לימיט מבטיחה את המחיר אבל לא שתבצעו עסקה. בחרו את זו שאי-הוודאות שלה מפריעה לכם פחות.",
        ),
        text(
          "For a thinly traded stock the gap between bid and ask can be wide, and a market order can fill at a poor price. Limit orders protect you there. A large order may also fill in several pieces at slightly different prices.",
          "במניה שנסחרת בדלילות הפער בין ה-bid ל-ask יכול להיות רחב, והוראת שוק עלולה להתבצע במחיר גרוע. הוראות לימיט מגינות עליכם שם. הוראה גדולה עשויה גם להתבצע בכמה חלקים במחירים מעט שונים.",
        ),
      ],
      examples: [
        text(
          "The bid is 50.00 and the ask is 50.10. A market buy fills at about 50.10, and a market sell at about 50.00. Buying and selling straight away loses the 0.10 gap.",
          "ה-bid הוא 50.00 וה-ask הוא 50.10. קנייה בשוק מתבצעת בכ-50.10, ומכירה בשוק בכ-50.00. קנייה ומכירה מיידיות מפסידות את הפער של 0.10.",
        ),
        text(
          "You place a limit buy at 49 while the price is 50. If the price never falls to 49, the order never fills, and you may watch the stock rise without you.",
          "אתם נותנים הוראת קנייה בלימיט ב-49 כשהמחיר 50. אם המחיר לא יורד ל-49, ההוראה לא תתבצע, ואולי תראו את המניה עולה בלעדיכם.",
        ),
        text(
          "A stock priced at 20 has a bid of 19.50 and an ask of 20.50. The gap is 1.00, or 5% of the price, a big cost to pay before the stock has moved at all.",
          "מניה במחיר 20 עם bid של 19.50 ו-ask של 20.50. הפער הוא 1.00, כלומר 5% מהמחיר, עלות גדולה לפני שהמניה זזה בכלל.",
        ),
      ],
    },
    {
      title: text("Market cap and indices", "שווי שוק ומדדים"),
      body: [
        text(
          "Market capitalisation is the share price times the number of shares: the market's price for the whole company. A price of 50 with 1 million shares means a market cap of 50 million.",
          "שווי שוק הוא מחיר המניה כפול מספר המניות: המחיר שהשוק נותן לחברה כולה. מחיר 50 עם מיליון מניות פירושו שווי שוק של 50 מיליון.",
        ),
        text(
          "An index, such as the S&P 500, tracks a basket of companies to show how a market is doing as a whole.",
          "מדד, כמו S&P 500, עוקב אחרי סל חברות כדי להראות איך שוק שלם מתפקד.",
        ),
      ],
      details: [
        text(
          "Companies are often grouped as large, mid and small cap. Larger companies tend to be steadier; smaller ones can grow faster and also swing more.",
          "חברות מקובצות לעיתים לגדולות, בינוניות וקטנות לפי שווי שוק. חברות גדולות נוטות להיות יציבות יותר; קטנות יכולות לצמוח מהר יותר וגם להתנדנד יותר.",
        ),
        text(
          "Many indices weight companies by market cap, so the biggest names move the index the most. A rising index does not mean every stock rose.",
          "מדדים רבים משקללים חברות לפי שווי שוק, ולכן השמות הגדולים ביותר מזיזים את המדד הכי הרבה. מדד שעולה אינו אומר שכל מניה עלתה.",
        ),
      ],
      examples: [
        text(
          "Company A has a price of 200 and 1 million shares: a market cap of 200 million. Company B has a price of 20 and 100 million shares: 2 billion. B is ten times larger even though each share costs less.",
          "לחברה א' מחיר 200 ומיליון מניות: שווי שוק של 200 מיליון. לחברה ב' מחיר 20 ו-100 מיליון מניות: 2 מיליארד. ב' גדולה פי עשרה אף שכל מניה עולה פחות.",
        ),
        text(
          "An index rises 1% in a day because a few giant companies rose 3%, while most of the hundreds of other companies in it were flat or fell.",
          "מדד עולה 1% ביום כי כמה חברות ענק עלו 3%, בעוד רוב מאות החברות האחרות בו נשארו ללא שינוי או ירדו.",
        ),
        text(
          "In a market fall of 20%, large steady companies might fall 15% while small speculative ones fall 35%. The sizes are made up, but small caps do tend to swing more.",
          "בירידת שוק של 20%, חברות גדולות ויציבות עשויות לרדת 15% בעוד קטנות וספקולטיביות יורדות 35%. הגדלים מדומים, אבל חברות קטנות אכן נוטות להתנדנד יותר.",
        ),
      ],
    },
  ],
};
