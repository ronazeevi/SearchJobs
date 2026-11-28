# סוכן קניות: גרסת Make (Blueprints)

גרסה פשוטה שאפשר להריץ היום ב-Make החינמי, בלי Anthropic Managed Agents. היא מממשת את הזרימה מ-[SPEC.md](../SPEC.md): טופס → גיליון → המלצות במייל ביום שנבחר. **לא נבדקה עדיין בהרצה.**

| קובץ | מה הוא עושה |
|---|---|
| [`shopping-agent-A-intake.blueprint.json`](shopping-agent-A-intake.blueprint.json) | **תרחיש A (מיידי):** Tally Watch New Responses → Google Sheets Add a Row ללשונית `בקשות`. ממלא ברירות מחדל לשדות ריקים (`ifempty`) ומחשב `תאריך שליחה` (YYYYMMDD) מהתשובה "מתי לשלוח". סטטוס `חדש`. |
| [`shopping-agent-B-send-recommendations.blueprint.json`](shopping-agent-B-send-recommendations.blueprint.json) | **תרחיש B (מתוזמן):** Sheets Search Rows (סטטוס `חדש`) → פילטר "הגיע יום השליחה" → Make AI Ask (מודל large) כותב המלצות ב-HTML → Gmail שולח **לכתובת מהשורה** → Sheets Update Row סטטוס `נשלחו המלצות`. |
| [`requests-sheet-headers.csv`](requests-sheet-headers.csv) | שורת הכותרות של הלשונית `בקשות` (עמודות A עד X). |

## הקמה

1. ב-Google Sheets ליצור גיליון חדש, לשונית בשם `בקשות`, ולהדביק בשורה 1 את הכותרות מהקובץ CSV.
2. ב-Make: **Create a new scenario → ⋯ → Import Blueprint** → `shopping-agent-A-intake.blueprint.json`.
3. במודול Tally לבחור את החיבור ואת הטופס "בקשת קנייה לסוכן". במודול Sheets לבחור את הגיליון.
4. **מיפוי שדות:** ה-blueprint ממפה לפי שם השאלה בטופס (`1.fields.שם השאלה`). אם שינית ניסוח של שאלה, צריך לגרור מחדש את השדה הנכון למקום שלו.
5. לשמור ולהדליק (ON). למלא את הטופס פעם אחת ולבדוק שנוספה שורה.
6. לייבא באותו אופן את `shopping-agent-B-send-recommendations.blueprint.json`, לבחור את הגיליון בשני מודולי ה-Sheets ואת חיבור Gmail.
7. תזמון של תרחיש B: **Every 3 hours** (או פעם ביום ב-08:00). בקשה עם "עכשיו, היום" תישלח בהרצה הקרובה.
8. בדיקה: לשנות בשורת בדיקה את `תאריך שליחה` לתאריך של היום → **Run once** בתרחיש B → לבדוק שהגיע מייל והסטטוס התחלף.

## ההבדלים מהעיצוב המלא (SPEC / CONFIG)

- **Make AI לא גולש ברשת.** ההמלצות מבוססות על הידע של המודל, עם טווח מחיר משוער וקישור חיפוש בזאפ. בגרסה המלאה הסוכן (Claude ב-Managed Agents עם `web_search` ו-`web_fetch`) נכנס לחנויות ובודק מחיר, מלאי ומשלוח בפועל.
- אין חיפוש יומי ועדכון מחירים לפני יום השליחה, ואין שלב "בחירת סוג" בדשבורד. אם לא ידעת סוג, המייל מתחיל בסוגים ואחריהם המלצות.
- הנמען נלקח מעמודת `מייל` בשורה, כמו בעיצוב. כדאי להוסיף ב-Make פילטר שמאפשר רק כתובות מוכרות, אם הטופס ציבורי.
