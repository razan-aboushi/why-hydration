/**
 * Hebrew overlay strings. Only the overlay imports this, so it is tree-shaken
 * out of production builds with the rest of the dev implementation.
 *
 * Written for developers: terms Israeli developers use in English day to day
 * (Hydration, DOM, React, API, media query) stay in English, the plural "you"
 * of Hebrew documentation is used for instructions, and every identifier stays
 * in a code span so the renderer keeps it left-to-right inside the sentence.
 */

import {
  classDetail,
  code,
  param,
  type MessageCatalog,
} from '../../core/classify/messages';
import type { OverlayStrings } from '../i18n';

const HE_MESSAGES: MessageCatalog = {
  'non-deterministic-value': {
    explanation:
      'השרת והלקוח רינדרו ערכים שונים שנראים אקראיים (מזהה, טוקן או תוצאה של ' +
      '`Math.random()`). כל דבר לא דטרמיניסטי ברינדור מפיק ערך שונה בכל צד.',
    suggestion:
      'השתמשו ב-`useId()` של React עבור מזהים. ערכים אקראיים צרו אחרי הטעינה ' +
      '(בתוך `useEffect`) או העבירו ערך מהשרת כדי ששני הצדדים יסכימו. אל ' +
      'תקראו ל-`Math.random()` או ל-`crypto` בזמן רינדור.',
  },
  'date-time': {
    explanation:
      'הערכים הם תאריכים או שעות ששונים בין רינדור השרת לרינדור הלקוח — השעון ' +
      'התקדם (או שאזור הזמן שונה) בין שתי הסביבות.',
    suggestion:
      'הציגו את השעה הנוכחית אחרי הטעינה, או העבירו חותמת זמן אחת מהשרת ועצבו ' +
      'אותה באותו אופן בשני הצדדים. קבעו אזור זמן מפורש בעת העיצוב.',
  },
  'locale-format.bidi': {
    explanation:
      'הערכים שונים רק בתווי בקרה דו-כיווניים בלתי נראים (`LRM`, `RLM` ותווי ' +
      'בידוד). `Intl` מוסיף אותם סביב מספרים ותאריכים בשפות מימין לשמאל, ' +
      'וגרסאות ICU שונות — Node לעומת הדפדפן — מוסיפות תווים שונים לאותו קלט.',
    suggestion:
      'עצבו את הערך במקום אחד והעבירו את המחרוזת הלאה, או קבעו את אותה שפה ' +
      'ואותו אזור זמן בשני הצדדים. אם התווים אינם מזיקים, הוסיפו ' +
      '`suppressHydrationWarning` לאלמנט.',
  },
  'locale-format.script': {
    explanation:
      'אותו ערך עוצב במערכות ספרות שונות (ספרות ערביות-הודיות `٠١٢` לעומת ' +
      'ספרות לטיניות `012`). השרת והלקוח בחרו הגדרות אזור שונות.',
    suggestion:
      'העבירו `locale` מפורש (ואזור זמן) ל-`Intl.NumberFormat` או ' +
      'ל-`toLocaleString` גם בשרת וגם בלקוח, או עצבו את הערך אחרי הטעינה כך ' +
      'שרק הגדרת הלקוח תשמש.',
  },
  'locale-format.separators': {
    explanation:
      'אותו מספר עוצב עם מפרידי אלפים או מפרידים עשרוניים שונים בין השרת ' +
      'ללקוח (למשל `1,234.56` לעומת `1.234,56`).',
    suggestion:
      'העבירו הגדרת אזור מפורשת ל-`Intl.NumberFormat` או ל-`toLocaleString` ' +
      'בשני הצדדים כדי שהמפרידים יתאימו.',
  },
  'locale-format.date-order': {
    explanation:
      'אותו תאריך הוצג בסדר שדות שונה (`MM/DD` לעומת `DD/MM`) בין השרת ללקוח.',
    suggestion:
      'עצבו תאריכים עם הגדרת אזור ואזור זמן מפורשים באמצעות `Intl` בשני הצדדים.',
  },
  'browser-only-api': {
    explanation:
      'הלקוח רינדר תוכן שהשרת השאיר ריק — סימן מובהק לקריאה ל-API שקיים רק ' +
      'בדפדפן (`window`, `document`, `localStorage`, `navigator`, ' +
      '`matchMedia`) בזמן רינדור.',
    suggestion:
      'התנו קריאות מהדפדפן בדגל טעינה או ב-`useEffect`, או השתמשו ' +
      'ב-`useSyncExternalStore` עם snapshot לשרת, כך שהרינדור הראשון בלקוח ' +
      'יתאים לשרת.',
  },
  'viewport-branching': {
    explanation:
      'תת-עץ שלם נוסף, הוסר או הוחלף בין השרת ללקוח — בדרך כלל בדיקה של רוחב ' +
      'המסך ב-JavaScript שמפצלת את העץ ברינדור הראשון.',
    suggestion:
      'רנדרו את שני הענפים והחליפו ביניהם עם media queries של CSS בציור ' +
      'הראשון במקום לפצל ב-JavaScript, או דחו את הענף שתלוי ב-JavaScript ' +
      'לאחר הטעינה.',
  },
  'invalid-html-nesting': {
    explanation:
      'צומת הוזז או נפלט כי ה-HTML אינו תקין (למשל `<div>` בתוך `<p>`, או ' +
      '`<a>` בתוך `<a>`). הדפדפן מתקן את ה-DOM שהגיע מהשרת, ולכן הוא כבר לא ' +
      'תואם את מה ש-React מצפה לו.',
    suggestion:
      'תקנו את תקינות ה-HTML: אלמנטי בלוק לא יכולים להיות בתוך `<p>`, קישורים ' +
      'לא יכולים להיות מקוננים וכדומה. החליפו את ההורה הלא תקין ב-`<div>` או ' +
      'ארגנו מחדש את העץ.',
  },
  'whitespace-minification': {
    explanation:
      'ההבדל הוא ברווחים בלבד — הטקסט זהה מלבד רווחים ושורות חדשות. כנראה ' +
      'ש-minifier של HTML כיווץ רווחים סביב שורש ה-Hydration באופן שונה ' +
      'מ-React.',
    suggestion:
      'בדקו את הגדרות ה-minifier של ה-HTML (למשל `conservativeCollapse`) סביב ' +
      'שורש האפליקציה, או הימנעו ממיזעור רווחים בתוך markup שעובר Hydration.',
  },
  'third-party-dom-mutation.extension-attribute': {
    explanation:
      'המאפיין `{attribute}` הוזרק על ידי תוסף דפדפן או סקריפט צד שלישי (למשל ' +
      'Grammarly או ColorZilla) לפני ה-Hydration, ולכן ה-DOM בלקוח כבר לא ' +
      'תואם לשרת.',
    suggestion:
      'בדרך כלל זה לא מזיק. הוסיפו `suppressHydrationWarning` לאלמנט המושפע, ' +
      'או דחו את אתחול הסקריפט החיצוני עד אחרי ה-Hydration.',
  },
  'third-party-dom-mutation.root-attribute': {
    explanation:
      'מאפיין (`{attribute}`) הופיע על אלמנט שורש שהשרת מעולם לא שלח — סימן ' +
      'היכר לתוסף או לסקריפט צד שלישי מוקדם שמשנה את ה-DOM.',
    suggestion:
      'הוסיפו `suppressHydrationWarning` לאלמנט השורש, או דחו את הסקריפט ' +
      'החיצוני עד אחרי ה-Hydration.',
  },
  'third-party-dom-mutation.injected-node': {
    explanation: (p) => [
      'סקריפט צד שלישי או תוסף דפדפן הזריק את האלמנט ',
      code(param(p, 'tag')),
      ' (פרסומות, הסכמה, אנליטיקה או צ׳אט) אחרי רינדור השרת. הוא לא חלק ' +
        'מה-Hydration של האפליקציה שלכם, ולכן זה בדרך כלל רעש לא מזיק.',
    ],
    suggestion:
      'אם React מזהיר לגביו, הוסיפו `suppressHydrationWarning` לעטיפה הקרובה ' +
      'ביותר שרונדרה בשרת, או טענו את הסקריפט החיצוני אחרי ה-Hydration (למשל ' +
      '`<Script strategy="afterInteractive">` ב-Next.js).',
  },
  'attribute-mismatch.class': {
    explanation: (p) => [
      'ה-',
      code('class'),
      ' שונה בין השרת ללקוח',
      ...classDetail(p, {
        added: 'נוסף בלקוח: ',
        removed: 'הוסר בלקוח: ',
        listSeparator: ', ',
        partSeparator: '; ',
        open: ' (',
        close: ')',
      }),
      '. מחלקה הוחלה בתנאי בלקוח — לרוב בדיקה של גודל מסך, media query, ' +
        'ערכת נושא או feature flag שרצה ברינדור הראשון.',
    ],
    suggestion:
      'רנדרו את אותו `className` בשרת ובציור הראשון בלקוח. העבירו תנאים שקיימים ' +
      'רק בלקוח ל-`useEffect` או לדגל טעינה, או בצעו את השינוי החזותי עם ' +
      'media queries של CSS במקום החלפת מחלקה ב-JavaScript.',
  },
  'attribute-mismatch.style': {
    explanation:
      'ה-`style` המוטבע שונה בין השרת ללקוח — סגנון מוטבע חושב ממצב שקיים רק ' +
      'בלקוח (גודל מסך, ערכת נושא, מיקום גלילה) בזמן רינדור.',
    suggestion:
      'חשבו את הסגנון אחרי הטעינה (`useEffect`) כדי שהרינדור הראשון בלקוח ' +
      'יתאים לשרת, או העבירו אותו למחלקת CSS או ל-media query.',
  },
  'attribute-mismatch.generic': {
    explanation:
      'המאפיין `{attribute}` שונה בין השרת (`{server}`) ללקוח (`{client}`) — ' +
      'הערך שלו נגזר ממשהו ששונה בין השרת לרינדור הראשון בלקוח.',
    suggestion:
      'הפכו את המאפיין לדטרמיניסטי בשרת ובלקוח, או קבעו אותו אחרי הטעינה כך ' +
      'שהרינדור הראשון בלקוח יתאים ל-HTML מהשרת.',
  },
  unknown: {
    explanation:
      'זוהתה אי-התאמה ב-Hydration אך לא ניתן היה לשייך אותה לסיבה ידועה. ' +
      'בדקו את ערכי השרת והלקוח למעלה.',
    suggestion:
      'השוו בין ערכי השרת והלקוח. סיבות נפוצות הן ערכים לא דטרמיניסטיים, ' +
      'תאריכים והגדרות אזור, ו-API של דפדפן שמשמשים בזמן רינדור.',
  },
  'unknown.no-location': {
    explanation:
      'React דיווח שה-Hydration נכשל אך לא ציין איזה צומת שונה, ובדיקת ה-DOM ' +
      'לא מצאה הבדל להצביע עליו.',
    suggestion:
      'ודאו ש-`<HydrationSnapshotScript>` (או סקריפט ה-snapshot הידני) נמצא ' +
      'ב-`<head>` כדי שבדיקת ה-DOM תוכל לאתר את הצומת, וקראו את האזהרה המלאה ' +
      'של React בקונסולת הדפדפן.',
  },
};

// Lazily, for the same reason as in the Arabic catalog: a module-level
// `new Intl.PluralRules()` survives tree-shaking into production bundles.
let hePlural: Intl.PluralRules | null | undefined;
function hebrewIssues(count: number): string {
  if (hePlural === undefined) {
    hePlural =
      typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function'
        ? new Intl.PluralRules('he')
        : null;
  }
  switch (hePlural?.select(count) ?? 'other') {
    case 'one':
      return 'בעיה אחת';
    case 'two':
      return 'שתי בעיות';
    default:
      return `${count} בעיות`;
  }
}

export const HE: OverlayStrings = {
  dir: 'rtl',
  title: 'אי-התאמה ב-Hydration',
  dialogLabel: 'אבחון אי-התאמה ב-Hydration',
  dismiss: 'סגירה',
  dismissLabel: 'סגירת חלונית האבחון',
  hintDismissLabel: 'הסתרת הרמז',
  server: 'שרת',
  client: 'לקוח',
  fix: 'תיקון:',
  // The docs are only written in English, so say so rather than surprise.
  learnMore: 'למידע נוסף (באנגלית) ←',
  none: '(אין)',
  empty: '(ריק)',
  fallbackCategory: 'אי-התאמה',
  categories: {
    'non-deterministic-value': 'ערך לא דטרמיניסטי',
    'date-time': 'תאריך / שעה',
    'locale-format': 'עיצוב לפי שפה ואזור',
    'browser-only-api': 'API של דפדפן בלבד',
    'viewport-branching': 'הסתעפות לפי גודל מסך',
    'invalid-html-nesting': 'קינון HTML לא תקין',
    'whitespace-minification': 'רווחים / מיזעור',
    'third-party-dom-mutation': 'שינוי DOM על ידי צד שלישי',
    'attribute-mismatch': 'אי-התאמה במאפיין',
    unknown: 'לא ידוע',
  },
  messages: HE_MESSAGES,
  hint: (count) => `↓ ${hebrewIssues(count)} — גללו כדי לראות הכול`,
};
