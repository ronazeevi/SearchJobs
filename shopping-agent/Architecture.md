# Architecture: "סוכן הקניות"

> תרגיל שיעור 6, שאלה 4: מה מפעיל את הסוכן, מה עושים עם הפלט, ותרשים זרימת המידע של כל המערכת.
>
> קבצים נלווים: [SPEC.md](SPEC.md) (תכנון הסוכן) · [CONFIG.md](CONFIG.md) (קונפיגורציה).

---

## 1. המערכת בפסקה אחת

אני ממלאת **טופס Tally** לכל דבר שאני רוצה לקנות (מספיק שם מוצר). **Make** קולט את הטופס, כותב שורה ל-**Google Sheets** ומפעיל את **הסוכן** ב-**Anthropic Platform (Managed Agents)**. **שלב 1:** אם לא ידעתי איזה סוג, הסוכן מביא רשימת סוגים של המוצר, ואני בוחרת סוג בדשבורד. **שלב 2:** הסוכן מחפש הצעות לסוג שבחרתי, בחנויות ובמודעות יד שנייה אם ביקשתי, ודרך **שער ב-Make** כותב הצעות ומחירים לגיליון. **כל בוקר** הוא חוזר לבקשות הפתוחות, ו**בשישי** שולח לי מייל עם ההמלצות. **הדשבורד** (Apps Script, כמו בתרגיל 4) מציג הכול ומאפשר לי לסמן "נקנה".

**החלוקה:**
- **Make** = הצעדים הקבועים: קליטה, כתיבה לגיליון, מייל, אכיפת כללים.
- **הסוכן** = שיקול הדעת: איפה לחפש, מה לבדוק, מה לדרג.
- **Google Sheets** = מסד הנתונים שכולם חולקים.
- **אני** = ההחלטה והקנייה.

---

## 2. תרשים המערכת

```mermaid
flowchart LR
    %% ===== מקורות =====
    subgraph SRC["מקורות מידע"]
        ME(["אני"])
        TALLY["טופס Tally<br/>בקשת קנייה"]
        WEB[("חנויות ברשת<br/>השוואת מחירים<br/>ביקורות ומדריכים<br/>מודעות יד שנייה")]
    end

    %% ===== Make =====
    subgraph MAKE["Make.com"]
        MA["תרחיש A<br/>קליטת בקשה"]
        MB["תרחיש B<br/>שער הסוכן"]
        MC["תרחיש C<br/>סגירת בקשות שפג תוקפן"]
        MD["תרחיש D<br/>התראות תקלה"]
        ME2["תרחיש E<br/>סוג נבחר"]
    end

    %% ===== מסד נתונים =====
    subgraph DB["Google Sheets: סוכן קניות"]
        REQ[("בקשות")]
        TYP[("סוגים")]
        OFF[("הצעות")]
        HIS[("היסטוריית מחירים")]
    end

    %% ===== Anthropic =====
    subgraph ANT["Anthropic Platform: Managed Agents"]
        DEP1["Deployment יומי<br/>א-ה 08:00"]
        DEP2["Deployment שישי<br/>09:00"]
        AGENT{{"סוכן shop-scout<br/>claude-opus-5-5"}}
        MEM[("Memory stores<br/>shop-profile, shop-notes")]
        VAULT[["Vault<br/>מפתח השער"]]
    end

    %% ===== פלט =====
    subgraph OUT["פלט"]
        MAILT["מייל: הסוגים מוכנים"]
        MAIL["מייל שישי<br/>3 המלצות לכל בקשה"]
        DASH["דשבורד<br/>Apps Script"]
    end

    ME -->|ממלאת| TALLY
    TALLY -->|webhook| MA
    MA -->|שורה חדשה, סטטוס חדש| REQ
    MA -->|"HTTP: יצירת session<br/>חיפוש ראשון מיד"| AGENT
    DEP1 -->|מתחיל session| AGENT
    DEP2 -->|מתחיל session| AGENT

    AGENT <-->|web_search, web_fetch| WEB
    AGENT <-->|קורא וכותב הערות| MEM
    VAULT -.->|מזריק מפתח ביציאה| MB
    AGENT <-->|"curl + action"| MB

    MB -->|list_open_requests| REQ
    MB -->|"upsert_type (שלב 1)"| TYP
    MB -->|send_types_email| MAILT
    MB -->|upsert_offer| OFF
    MB -->|log_price| HIS
    MB -->|set_request_status| REQ
    MB -->|send_weekly_email| MAIL

    MC -->|"כל לילה: עבר התאריך"| REQ
    ANT -.->|"webhook: session נכשל / נעצר"| MD
    MD -.->|מייל תקלה| ME

    REQ --> DASH
    TYP --> DASH
    OFF --> DASH
    HIS --> DASH
    DASH -->|"מסמנת נקנה / בוטל"| REQ
    DASH -->|"בחרתי סוג"| ME2
    ME2 -->|"סוג נבחר, סטטוס בחיפוש"| REQ
    ME2 -->|"HTTP: session לשלב 2"| AGENT
    MAILT --> ME
    MAIL --> ME
    ME -->|קונה בעצמי| WEB
```

**מקרא:** חץ מלא = זרימת מידע רגילה · חץ מקווקו = סודות או התראות · `<-->` = קריאה ותשובה.

---

## 3. מה מפעיל את הסוכן (טריגרים)

לסוכן יש **ארבעה טריגרים**: שניים מ-Make (טופס, בחירת סוג) ושניים מהפלטפורמה של Anthropic (תזמון).

| # | טריגר | איפה מוגדר | מתי | ההודעה הראשונה ל-session | למה |
|---|---|---|---|---|---|
| 1 | **בקשה חדשה** | Make, תרחיש A (HTTP module ל-Anthropic API) | מיד כשהטופס נשלח | לא ידעתי סוג: "בקשה חדשה REQ-...: שלב 1, תביא רשימת סוגים". ידעתי סוג: "בקשה חדשה REQ-...: שלב 2, תחפש הצעות" | לא לחכות למחר. תוך כמה דקות יש סוגים או הצעות בדשבורד |
| 4 | **בחרתי סוג** | Make, תרחיש E (webhook מכפתור "בחרתי בזה" בדשבורד) | מיד כשאני בוחרת | "REQ-...: נבחר הסוג X. שלב 2, תחפש הצעות לסוג הזה בלבד." | ההחלטה שלי היא נקודת בקרה: הסוכן מחפש מחירים רק אחרי שאישרתי מה לחפש |
| 2 | **ריצה יומית** | Anthropic, Deployment `shop-daily` | ראשון עד חמישי, 08:00 שעון ישראל (עד ~9 דקות אחרי) | "ריצה יומית: תבדוק את כל הבקשות הפתוחות" | מחירים ומלאי משתנים. מוצא מבצעים חדשים |
| 3 | **סיכום שבועי** | Anthropic, Deployment `shop-weekly` | שישי, 09:00 שעון ישראל | "ריצת שישי: תעדכן ותשלח את המייל השבועי" | מה שביקשתי: לקבל עדכון בסוף השבוע |

**למה טריגר 1 ב-Make ולא בפלטפורמה?** הטופס של Tally יודע לשלוח webhook רק לכתובת אחת, ו-Make כבר מחובר אליו (מבונוס 2). Make גם כותב את השורה לגיליון **לפני** שהסוכן מתחיל, כך שהבקשה קיימת גם אם הסוכן נכשל.

**למה טריגר 4 דרך Make ולא ישר מהדשבורד?** כדי שמפתח ה-API של Anthropic יישב רק במקום אחד (Make), ולא גם ב-Apps Script. Make גם כותב את הבחירה לגיליון לפני שהסוכן מתחיל.

**למה טריגרים 2-3 בפלטפורמה ולא ב-Make?** Deployment שומר רשומה של כל הפעלה, כולל הפעלות שנכשלו, ואפשר להשהות אותו בלי למחוק. זה "שעון מעורר" שמחובר ישירות לסוכן.

### ומה **לא** מפעיל את הסוכן

- **מייל שיווקי מחנות** לא מפעיל אותו. זה היה פותח פתח ל-prompt injection (כל אחד יכול לשלוח לי מייל).
- **שינוי בגיליון** לא מפעיל אותו. סימון "נקנה" פשוט נקרא בריצה הבאה.

---

## 4. מה עושים עם הפלט

| פלט | נוצר ע"י | הולך ל | מי משתמש | מה עושים איתו |
|---|---|---|---|---|
| **רשימת סוגים** (שלב 1) | הסוכן → שער B | לשונית `סוגים` | דשבורד | **אני בוחרת סוג**, וזה מפעיל את שלב 2 |
| **מייל "הסוגים מוכנים"** | הסוכן → שער B → Gmail | תיבת המייל שלי | אני | קישור לדשבורד כדי לבחור |
| **הצעות** (שורות בגיליון) | הסוכן → שער B | לשונית `הצעות` | דשבורד, מייל שישי | השוואה, החלטה |
| **היסטוריית מחירים** | הסוכן → שער B | לשונית `היסטוריית מחירים` | דשבורד (גרף) | לראות אם המחיר יורד לפני שקונים |
| **סטטוס בקשה** | הסוכן → שער B / אני בדשבורד / תרחיש C | לשונית `בקשות` | כולם | הסוכן יודע מה עוד פתוח |
| **מייל שישי** | הסוכן מנסח → שער B שולח מ-Gmail | תיבת המייל שלי | אני | **אני קונה** בקישור מהמייל, ומסמנת "נקנה" |
| **הערות במחברת** | הסוכן | memory store `shop-notes` | הסוכן בריצה הבאה | לא לחזור על חיפוש שכבר נעשה, להתרחק מחנויות חשודות |
| **דוח ריצה** (ההודעה האחרונה של ה-session) | הסוכן | תמליל ה-session בקונסולה | אני, כשבודקת | מעקב, דיבאג |
| **התראת תקלה** | Anthropic webhook → Make D | המייל שלי | אני | לתקן (למשל לחבר מחדש את Google ב-Make) |

---

## 5. הזרימות צעד אחר צעד

### 5.1 בקשה חדשה מהטופס, שלב 1: רשימת סוגים

```mermaid
sequenceDiagram
    autonumber
    actor Me as אני
    participant T as Tally
    participant A as Make A: קליטה
    participant S as Google Sheets
    participant AG as הסוכן
    participant B as Make B: שער
    participant W as מדריכים וביקורות
    participant DB as דשבורד
    participant E as Make E: סוג נבחר

    Me->>T: "מכונת תפירה", עד 900 ש"ח, לא יודעת סוג, גם יד שנייה, תוך 3 ימי עסקים
    T->>A: webhook
    A->>S: שורה ב"בקשות", סטטוס "חדש"
    A->>AG: session חדש: "שלב 1, תביא רשימת סוגים"
    AG->>B: set_request_status "בירור סוגים"
    loop עד 6 דפים
        AG->>W: web_search / web_fetch
        W-->>AG: סוגים, יתרונות, חסרונות, מחירים
    end
    AG->>B: upsert_type (3 עד 6 סוגים, אחד מסומן מומלץ)
    B->>S: לשונית "סוגים"
    AG->>B: send_types_email
    B->>Me: "מצאתי 4 סוגים, בחרי בדשבורד"
    AG->>B: set_request_status "ממתין לבחירת סוג"
    AG-->>AG: עוצר. לא מחפש הצעות לפני הבחירה
    Me->>DB: "בחרתי בזה": מכנית בסיסית (+ אולי מאפייני חובה)
    DB->>E: webhook עם request_id, הסוג והמאפיינים
    E->>S: סוג נבחר, סטטוס "בחיפוש"
    E->>AG: session חדש: "שלב 2, תחפש הצעות לסוג הזה"
```

### 5.2 שלב 2: חיפוש הצעות (אחרי בחירת סוג, או ישר מהטופס כשידעתי סוג)

```mermaid
sequenceDiagram
    autonumber
    actor Me as אני
    participant T as Tally
    participant A as Make A: קליטה
    participant S as Google Sheets
    participant API as Anthropic API
    participant AG as הסוכן
    participant B as Make B: שער
    participant W as חנויות ומודעות יד שנייה

    Me->>T: ממלאת בקשה עם "כן, אני יודעת איזה סוג"
    T->>A: webhook עם התשובות
    A->>A: יוצר request_id
    A->>S: שורה חדשה ב"בקשות", סטטוס "בחיפוש"
    A->>API: POST /v1/sessions (סוכן, סביבה, vault, זיכרון, תקציב)
    A->>API: POST /v1/sessions/{id}/events: "שלב 2, REQ-..."
    Note over A,API: אחרי בחירת סוג, תרחיש E שולח את אותן שתי קריאות
    API->>AG: הלולאה מתחילה
    loop עד 8 דפים
        AG->>W: web_search / web_fetch
        W-->>AG: מחיר, מפרט, ימי עסקים לאספקה, מצב (יד שנייה)
    end
    AG->>AG: פוסל: מעל המחיר, חסר מאפיין חובה, מגיע אחרי X ימי עסקים, יד שנייה כשביקשתי רק חדש
    AG->>B: upsert_offer + log_price (לכל הצעה תקינה)
    B->>S: הצעות + מחירים
    AG->>B: set_request_status "נמצאו הצעות"
    AG-->>API: דוח קצר, סיום
    Note over Me,S: תוך דקות ההצעות הראשונות מופיעות בדשבורד
```

### 5.3 ריצה יומית וריצת שישי

```mermaid
sequenceDiagram
    autonumber
    participant D as Deployment (יומי / שישי)
    participant AG as הסוכן
    participant M as Memory stores
    participant B as Make B: שער
    participant S as Google Sheets
    participant W as חנויות ברשת
    participant G as Gmail
    actor Me as אני

    D->>AG: session חדש לפי cron
    AG->>M: קורא העדפות, חנויות, לקחים, ריצה אחרונה
    AG->>B: list_open_requests
    B->>S: קריאה
    S-->>AG: בקשות פתוחות (כולל מה שסימנתי "נקנה" = לא מופיע)
    loop לכל בקשה (עד 5)
        AG->>M: קורא requests/REQ-....md
        AG->>W: בודק מחיר של הצעות קיימות + מחפש חדשות
        AG->>B: upsert_offer + log_price
        AG->>M: מעדכן requests/REQ-....md
    end
    AG->>M: מעדכן stores.md, lessons.md, last-run.md
    opt רק בריצת שישי
        AG->>AG: בוחר עד 3 המלצות לכל בקשה, מנסח
        AG->>B: send_weekly_email
        B->>G: שולח (נמען קבוע)
        G->>Me: "סיכום שבועי מסוכן הקניות"
    end
    AG-->>D: דוח, סיום
```

### 5.4 מחזור החיים של בקשה

```mermaid
stateDiagram-v2
    state "חדש" as NEW
    state "בירור סוגים" as TYPES
    state "ממתין לבחירת סוג" as WAIT
    state "בחיפוש" as SEARCH
    state "נמצאו הצעות" as FOUND
    state "נקנה" as BOUGHT
    state "בוטל" as CANCELED
    state "פג תוקף" as EXPIRED
    [*] --> NEW: Make A מהטופס
    NEW --> TYPES: הסוכן, שלב 1
    TYPES --> WAIT: הסוכן, הסוגים מוכנים
    WAIT --> SEARCH: Make E, בחרתי סוג
    WAIT --> CANCELED: אני בדשבורד
    NEW --> SEARCH: Make A, ידעתי סוג
    SEARCH --> FOUND: הסוכן, יש הצעה תקינה
    FOUND --> BOUGHT: אני בדשבורד
    FOUND --> CANCELED: אני בדשבורד
    SEARCH --> CANCELED: אני בדשבורד
    SEARCH --> EXPIRED: Make C, עבר התאריך
    FOUND --> EXPIRED: Make C, עבר התאריך
    BOUGHT --> [*]
    CANCELED --> [*]
    EXPIRED --> [*]
```

**השער של Make אוכף:** הסוכן יכול לבצע רק את המעברים שכתוב לידם "הסוכן". כל מעבר אחר נדחה. בריצה היומית, בקשה ב"ממתין לבחירת סוג" לא נחפשת, רק מופיעה במייל של שישי כתזכורת.

---

## 6. הרכיבים

| רכיב | טכנולוגיה | תפקיד | הרשאות |
|---|---|---|---|
| טופס | Tally (חינמי) | קליטת בקשה | — |
| תרחיש A: קליטת בקשה | Make: Webhooks → Tools (set variable: request_id) → Google Sheets Add a Row → HTTP (create session) → HTTP (send event) | בקשה → גיליון → סוכן | Sheets: גיליון אחד · Anthropic API key בחיבור של Make |
| תרחיש B: שער הסוכן | Make: Webhooks (עם API key) → Router לפי `action` → Sheets Search/Add/Update · Gmail Send · Webhook response | הידיים של הסוכן בגיליון ובמייל | Sheets: גיליון אחד · Gmail: שליחה לכתובת קבועה |
| תרחיש C: סגירה לילית | Make: Schedule 02:00 → Sheets Search (עבר תאריך) → Update סטטוס "פג תוקף" | ניקיון | Sheets |
| תרחיש E: סוג נבחר | Make: Webhooks ← כפתור "בחרתי בזה" בדשבורד → Sheets Update (סוג נבחר, מאפיינים, סטטוס "בחיפוש") → HTTP (create session) → HTTP (send event "שלב 2") | הבחירה שלי → שלב 2 | Sheets · Anthropic API key בחיבור של Make |
| תרחיש D: התראות | Make: Webhooks ← Anthropic webhook (`session.status_idled` עם שגיאה / תקציב) → Gmail | לדעת כשמשהו נשבר | Gmail לעצמי |
| מסד נתונים | Google Sheets "סוכן קניות" (4 לשוניות: בקשות, סוגים, הצעות, היסטוריית מחירים) | העולם המשותף | — |
| הסוכן | Anthropic Managed Agents: Agent `shop-scout` | שיקול הדעת | ראו [CONFIG.md](CONFIG.md) |
| סביבה | Environment `shop-cloud` (ענן Anthropic) | החדר שהכלים רצים בו | רשת פתוחה (חייב לחפש בכל החנויות) |
| מפתחות | Vault `shop-vault` | מפתח השער | מוזרק רק ל-`hook.eu1.make.com` |
| זיכרון | Memory stores `shop-profile` (קריאה), `shop-notes` (קריאה+כתיבה) | המחברת | — |
| תזמון | Deployments `shop-daily`, `shop-weekly` | השעון המעורר | — |
| דשבורד | Google Apps Script web app (כמו בתרגיל 4) | תצוגה + סימון "נקנה" | קורא וכותב לאותו גיליון |

### הדשבורד

אותו רעיון כמו דשבורד חיפוש העבודה שכבר בניתי (ראו [DASHBOARD.md](../DASHBOARD.md)):

- **כרטיסים למעלה:** בקשות פתוחות · הצעות שנמצאו השבוע · כמה חסכתי (מחיר מקסימלי פחות מחיר ההמלצה).
- **בקשה שממתינה לבחירת סוג:** כרטיס לכל סוג (יתרונות, חסרונות, טווח מחיר, "מתאים לך אם", תגית "מומלץ") עם כפתור **"בחרתי בזה"** ושדה להוספת מאפייני חובה.
- **רשימת בקשות** עם סטטוס שאפשר לשנות (`נקנה` / `בוטל`), שנכתב חזרה לגיליון.
- **לכל בקשה:** טבלת ההצעות לפי ציון (עם תגית "חדש" / "יד שנייה" וימי עסקים לאספקה), וגרף קטן של המחיר לאורך השבוע מ"היסטוריית מחירים".
- **כפתור "בקשה חדשה"** שפותח את טופס Tally.

---

## 7. גבולות אמון (מי סומך על מי)

```mermaid
flowchart TB
    subgraph TRUST["מהימן: אני שולטת בזה"]
        T["טופס Tally (רק אני ממלאת)"]
        MK["Make + Google Sheets"]
        DSH["דשבורד"]
    end
    subgraph AGENTZONE["חצי מהימן: המודל מחליט"]
        AG["הסוכן"]
    end
    subgraph UNTRUSTED["לא מהימן: כל אחד כותב שם"]
        WEB["דפי חנויות, ביקורות, מודעות"]
    end
    WEB -->|"מידע בלבד, לא הוראות"| AG
    AG -->|"בקשות דרך שער עם כללים"| MK
    T --> MK
    MK --> DSH
```

- **מה שנכנס מהרשת** הוא מידע לא מהימן. לכן לסוכן אין ידיים מסוכנות, והכללים נאכפים ב-Make.
- **הקישור לטופס** לא מפורסם, כדי שרק אני אמלא אותו. (אפשר להוסיף שדה סיסמה פשוט ב-Tally, ו-Make בודק אותו.)

---

## 8. עלויות (הערכה)

| רכיב | עלות |
|---|---|
| Tally, Google Sheets, Apps Script | חינם |
| Make (בתוכנית החינמית יש מכסה חודשית של כ-1,000 פעולות) | ~5 ריצות × 25 קריאות לשער + קליטה + סגירה ≈ 700 פעולות בחודש. **צמוד לגבול החינמי**. אם עובר: לצמצם את `log_price` רק לשינוי מחיר |
| Anthropic | עד 1.50$ ליום × 5 + 2$ בשישי + בקשות חדשות ≈ **עד 40$ לחודש** בתקרה. בפועל פחות, כי בימים בלי בקשות פתוחות הריצה קצרה |

> כדי לחסוך: כשאין בקשות פתוחות, אפשר להשהות את ה-deployments (Pause) ולהפעיל מחדש עם בקשה חדשה.
