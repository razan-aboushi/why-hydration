/**
 * Arabic overlay strings. Only the overlay imports this, so it is tree-shaken
 * out of production builds with the rest of the dev implementation.
 */

import {
  classDetail,
  code,
  param,
  type MessageCatalog,
} from '../../core/classify/messages';
import type { OverlayStrings } from '../i18n';

// Written as Modern Standard Arabic for developers: technical terms that Arab
// developers use in English day to day (Hydration, DOM, React, Intl) stay in
// English, and every identifier stays in a code span so the renderer can keep
// it left-to-right inside the right-to-left sentence.
const AR_MESSAGES: MessageCatalog = {
  'non-deterministic-value': {
    explanation:
      'عرض الخادم والعميل قيمتين تبدوان عشوائيتين ومختلفتين (معرّف أو رمز ' +
      'أو ناتج `Math.random()`). أي شيء غير حتمي أثناء العرض ينتج قيمة ' +
      'مختلفة على كل جانب.',
    suggestion:
      'استخدم `useId()` من React للمعرّفات. أما القيم العشوائية فولّدها بعد ' +
      'التركيب (داخل `useEffect`) أو مرّرها من الخادم ليتفق الطرفان. لا ' +
      'تستدعِ `Math.random()` أو `crypto` أثناء العرض أبدًا.',
  },
  'date-time': {
    explanation:
      'القيمتان تاريخان أو وقتان يختلفان بين عرض الخادم وعرض العميل — تغيّرت ' +
      'الساعة (أو اختلفت المنطقة الزمنية) بين البيئتين.',
    suggestion:
      'اعرض الوقت الحالي بعد التركيب، أو مرّر طابعًا زمنيًا واحدًا من الخادم ' +
      'ونسّقه بالطريقة نفسها على الجانبين. وحدّد منطقة زمنية صريحة عند التنسيق.',
  },
  'locale-format.bidi': {
    explanation:
      'القيمتان لا تختلفان إلا بعلامات تحكم ثنائية الاتجاه غير مرئية ' +
      '(`LRM` و`RLM` وعلامات العزل). تضيف `Intl` هذه العلامات حول الأرقام ' +
      'والتواريخ في اللغات التي تُكتب من اليمين إلى اليسار، وتُصدر إصدارات ' +
      'ICU المختلفة — Node مقابل المتصفح — علامات مختلفة للمدخل نفسه.',
    suggestion:
      'نسّق القيمة في مكان واحد ومرّر النص الناتج، أو ثبّت اللغة والمنطقة ' +
      'الزمنية نفسيهما على الجانبين. وإن كانت العلامات غير مؤذية فأضف ' +
      '`suppressHydrationWarning` إلى العنصر.',
  },
  'locale-format.script': {
    explanation:
      'نُسّقت القيمة نفسها بنظامَي أرقام مختلفين (أرقام عربية مشرقية `٠١٢` ' +
      'مقابل أرقام لاتينية `012`). اختار الخادم والعميل إعدادين محليين مختلفين.',
    suggestion:
      'مرّر `locale` صريحًا (ومنطقة زمنية) إلى `Intl.NumberFormat` أو ' +
      '`toLocaleString` على الخادم والعميل معًا، أو نسّق القيمة بعد التركيب ' +
      'ليُستخدم إعداد العميل وحده.',
  },
  'locale-format.separators': {
    explanation:
      'نُسّق الرقم نفسه بفواصل آلاف أو فواصل عشرية مختلفة بين الخادم والعميل ' +
      '(مثل `1,234.56` مقابل `1.234,56`).',
    suggestion:
      'مرّر إعدادًا محليًا صريحًا إلى `Intl.NumberFormat` أو `toLocaleString` ' +
      'على الجانبين لتتطابق الفواصل.',
  },
  'locale-format.date-order': {
    explanation:
      'عُرض التاريخ نفسه بترتيب حقول مختلف (`MM/DD` مقابل `DD/MM`) بين ' +
      'الخادم والعميل.',
    suggestion:
      'نسّق التواريخ بإعداد محلي ومنطقة زمنية صريحين عبر `Intl` على الجانبين.',
  },
  'browser-only-api': {
    explanation:
      'عرض العميل محتوى تركه الخادم فارغًا — وهذه علامة على قراءة واجهة لا ' +
      'تتوفر إلا في المتصفح (`window` أو `document` أو `localStorage` أو ' +
      '`navigator` أو `matchMedia`) أثناء العرض.',
    suggestion:
      'اجعل قراءات المتصفح مشروطة بعلامة تركيب أو ضعها داخل `useEffect`، أو ' +
      'استخدم `useSyncExternalStore` مع لقطة للخادم ليطابق أول عرض على العميل ' +
      'ما عرضه الخادم.',
  },
  'viewport-branching': {
    explanation:
      'أُضيفت شجرة فرعية كاملة أو حُذفت أو استُبدلت بين الخادم والعميل — ' +
      'غالبًا بسبب فحص في JavaScript لعرض الشاشة يفرّع الشجرة في أول عرض.',
    suggestion:
      'اعرض الفرعين وبدّل بينهما باستعلامات الوسائط في CSS عند أول رسم بدل ' +
      'التفريع في JavaScript، أو أجّل الفرع المعتمد على JavaScript إلى ما بعد ' +
      'التركيب.',
  },
  'invalid-html-nesting': {
    explanation:
      'نُقلت عقدة أو أُخرجت من مكانها لأن ترميز HTML غير صالح (مثل `<div>` ' +
      'داخل `<p>`، أو `<a>` داخل `<a>`). يُصلح المتصفح DOM القادم من الخادم، ' +
      'فلا يعود مطابقًا لما يتوقعه React.',
    suggestion:
      'صحّح صلاحية الترميز: لا يمكن وضع العناصر الكتلية داخل `<p>`، ولا يمكن ' +
      'تداخل الروابط. استبدل العنصر الأب غير الصالح بـ `<div>` أو أعد هيكلة ' +
      'الشجرة.',
  },
  'whitespace-minification': {
    explanation:
      'الاختلاف في المسافات البيضاء فقط — النص متطابق باستثناء المسافات ' +
      'والأسطر الجديدة. على الأرجح ضغط مُصغّر HTML المسافات حول جذر الـ ' +
      'Hydration بطريقة مختلفة عن React.',
    suggestion:
      'راجع إعدادات مُصغّر HTML (مثل `conservativeCollapse`) حول جذر التطبيق، ' +
      'أو تجنّب تصغير المسافات داخل الترميز الذي يمر بالـ Hydration.',
  },
  'third-party-dom-mutation.extension-attribute': {
    explanation:
      'حقن امتداد متصفح أو سكربت خارجي (مثل Grammarly أو ColorZilla) السمة ' +
      '`{attribute}` قبل الـ Hydration، فلم يعد DOM على العميل مطابقًا للخادم.',
    suggestion:
      'غالبًا ما يكون هذا غير مؤذٍ. أضف `suppressHydrationWarning` إلى العنصر ' +
      'المتأثر، أو أجّل تهيئة السكربت الخارجي إلى ما بعد الـ Hydration.',
  },
  'third-party-dom-mutation.root-attribute': {
    explanation:
      'ظهرت سمة (`{attribute}`) على عنصر جذري لم يرسلها الخادم أبدًا — وهي ' +
      'علامة مميزة لامتداد أو سكربت خارجي مبكر يعدّل DOM.',
    suggestion:
      'أضف `suppressHydrationWarning` إلى العنصر الجذري، أو أجّل السكربت ' +
      'الخارجي إلى ما بعد الـ Hydration.',
  },
  'third-party-dom-mutation.injected-node': {
    explanation: (p) => [
      'حقن سكربت خارجي أو امتداد متصفح العنصر ',
      code(param(p, 'tag')),
      ' (إعلانات أو نافذة موافقة أو تحليلات أو محادثة) بعد عرض الخادم. ليس ' +
        'هذا جزءًا من الـ Hydration في تطبيقك، لذا فهو غالبًا ضجيج غير مؤذٍ.',
    ],
    suggestion:
      'إن حذّر React منه فأضف `suppressHydrationWarning` إلى أقرب غلاف عُرض ' +
      'على الخادم، أو حمّل السكربت الخارجي بعد الـ Hydration (مثل ' +
      '`<Script strategy="afterInteractive">` في Next.js).',
  },
  'attribute-mismatch.class': {
    explanation: (p) => [
      'تختلف ',
      code('class'),
      ' بين الخادم والعميل',
      ...classDetail(p, {
        added: 'أُضيف على العميل: ',
        removed: 'أُزيل على العميل: ',
        listSeparator: '، ',
        partSeparator: '؛ ',
        open: ' (',
        close: ')',
      }),
      '. طُبّقت فئة CSS بشكل مشروط على العميل — غالبًا بسبب فحص لحجم الشاشة ' +
        'أو استعلام وسائط أو سمة (theme) أو علامة ميزة يُنفَّذ أثناء أول عرض.',
    ],
    suggestion:
      'اعرض قيمة `className` نفسها على الخادم وفي أول رسم على العميل. انقل ' +
      'الشروط الخاصة بالعميل إلى `useEffect` أو علامة تركيب، أو نفّذ التغيير ' +
      'البصري باستعلامات الوسائط في CSS بدل تبديل الفئة عبر JavaScript.',
  },
  'attribute-mismatch.style': {
    explanation:
      'يختلف `style` المضمّن بين الخادم والعميل — حُسب نمط مضمّن من حالة ' +
      'خاصة بالعميل (حجم الشاشة أو السمة أو موضع التمرير) أثناء العرض.',
    suggestion:
      'احسب النمط بعد التركيب (`useEffect`) ليطابق أول عرض على العميل ما عرضه ' +
      'الخادم، أو انقله إلى فئة CSS أو استعلام وسائط.',
  },
  'attribute-mismatch.generic': {
    explanation:
      'تختلف السمة `{attribute}` بين الخادم (`{server}`) والعميل ' +
      '(`{client}`) — اشتُقّت قيمتها من شيء يختلف بين الخادم وأول عرض على ' +
      'العميل.',
    suggestion:
      'اجعل قيمة السمة حتمية على الخادم والعميل، أو عيّنها بعد التركيب ليطابق ' +
      'أول عرض على العميل HTML القادم من الخادم.',
  },
  unknown: {
    explanation:
      'اكتُشف عدم تطابق في الـ Hydration لكن تعذّرت مطابقته مع سبب معروف. ' +
      'افحص قيمتَي الخادم والعميل أعلاه.',
    suggestion:
      'قارن بين قيمتَي الخادم والعميل. من الأسباب الشائعة: القيم غير الحتمية، ' +
      'والتواريخ والإعدادات المحلية، والواجهات الخاصة بالمتصفح المستخدمة أثناء ' +
      'العرض.',
  },
  'unknown.no-location': {
    explanation:
      'أبلغ React بفشل الـ Hydration دون أن يحدد العقدة المختلفة، ولم يجد فحص ' +
      'DOM أي اختلاف يمكن الإشارة إليه.',
    suggestion:
      'تأكد من وجود `<HydrationSnapshotScript>` (أو سكربت اللقطة اليدوي) داخل ' +
      '`<head>` ليتمكن فحص DOM من تحديد العقدة، واقرأ تحذير React الكامل في ' +
      'وحدة تحكم المتصفح.',
  },
};

// Arabic has six plural forms; English's "issue(s)" pattern reads as broken
// grammar for most counts, so pick the form the count actually takes.
//
// Created lazily, on first use. A module-level `new Intl.PluralRules()` is a
// constructor call no bundler can prove pure, so it survived tree-shaking and
// ran on every production page load — the one thing this package must never do.
let arPlural: Intl.PluralRules | null | undefined;
function arabicPlural(count: number): string {
  if (arPlural === undefined) {
    arPlural =
      typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function'
        ? new Intl.PluralRules('ar')
        : null;
  }
  return arPlural?.select(count) ?? 'other';
}

function arabicIssues(count: number): string {
  switch (arabicPlural(count)) {
    case 'zero':
      return 'لا مشكلات';
    case 'one':
      return 'مشكلة واحدة';
    case 'two':
      return 'مشكلتان';
    case 'few':
      return `${count} مشكلات`;
    default:
      return `${count} مشكلة`;
  }
}

export const AR: OverlayStrings = {
  dir: 'rtl',
  title: 'عدم تطابق في الـ Hydration',
  dialogLabel: 'تشخيص عدم تطابق الـ Hydration',
  dismiss: 'إغلاق',
  dismissLabel: 'إغلاق لوحة التشخيص',
  hintDismissLabel: 'إخفاء التلميح',
  server: 'الخادم',
  client: 'العميل',
  fix: 'الحل:',
  // The docs are only written in English, so say so rather than surprise.
  learnMore: 'اعرف المزيد (بالإنجليزية) ←',
  none: '(لا شيء)',
  empty: '(فارغ)',
  fallbackCategory: 'عدم تطابق',
  categories: {
    'non-deterministic-value': 'قيمة غير حتمية',
    'date-time': 'التاريخ / الوقت',
    'locale-format': 'تنسيق اللغة والمنطقة',
    'browser-only-api': 'واجهة خاصة بالمتصفح',
    'viewport-branching': 'تفرّع حسب حجم الشاشة',
    'invalid-html-nesting': 'تداخل HTML غير صالح',
    'whitespace-minification': 'المسافات / التصغير',
    'third-party-dom-mutation': 'تعديل DOM من طرف خارجي',
    'attribute-mismatch': 'اختلاف في السمة',
    unknown: 'غير معروف',
  },
  messages: AR_MESSAGES,
  hint: (count) => `↓ ${arabicIssues(count)} — مرّر لرؤية الكل`,
};
