/**
 * Persian overlay strings. Only the overlay imports this, so it is tree-shaken
 * out of production builds with the rest of the dev implementation.
 *
 * Written for developers: terms Iranian developers use in English day to day
 * (Hydration, DOM, React, API, mount, snapshot) stay in English, and every
 * identifier stays in a code span so the renderer keeps it left-to-right.
 *
 * Persian spelling depends on the zero-width non-joiner (U+200C) — «می‌کند»,
 * «راه‌حل» — and on the Persian letters ی and ک rather than the Arabic ي and ك.
 * Both are checked by `test/overlay-rtl.test.ts`; the non-joiners are real
 * characters in these strings, not typos.
 */

import {
  classDetail,
  code,
  param,
  type MessageCatalog,
} from '../../core/classify/messages';
import type { OverlayStrings } from '../i18n';

const FA_MESSAGES: MessageCatalog = {
  'non-deterministic-value': {
    explanation:
      'سرور و کلاینت دو مقدار متفاوت و به‌ظاهر تصادفی رندر کردند (یک شناسه، ' +
      'توکن یا خروجی `Math.random()`). هر چیز غیرقطعی در رندر، در هر طرف ' +
      'مقدار متفاوتی تولید می‌کند.',
    suggestion:
      'برای شناسه‌ها از `useId()` در React استفاده کنید. مقدارهای تصادفی را ' +
      'بعد از mount (داخل `useEffect`) بسازید یا مقداری را از سرور پاس بدهید تا ' +
      'هر دو طرف یکسان باشند. هنگام رندر هرگز `Math.random()` یا `crypto` را ' +
      'صدا نزنید.',
  },
  'date-time': {
    explanation:
      'مقدارها تاریخ یا زمان‌هایی هستند که بین رندر سرور و رندر کلاینت فرق ' +
      'دارند — ساعت جلو رفته (یا منطقهٔ زمانی متفاوت است) بین دو محیط.',
    suggestion:
      'زمان فعلی را بعد از mount نمایش دهید، یا یک timestamp از سرور پاس بدهید ' +
      'و در هر دو طرف یکسان قالب‌بندی کنید. هنگام قالب‌بندی یک منطقهٔ زمانی ' +
      'مشخص تعیین کنید.',
  },
  'locale-format.bidi': {
    explanation:
      'مقدارها فقط در نویسه‌های کنترلی دوسویهٔ نامرئی (`LRM`، `RLM` و ' +
      'نویسه‌های جداسازی) فرق دارند. `Intl` این نویسه‌ها را در زبان‌های ' +
      'راست‌به‌چپ دور اعداد و تاریخ‌ها اضافه می‌کند و نسخه‌های مختلف ICU — ' +
      'Node در برابر مرورگر — برای ورودی یکسان نویسه‌های متفاوتی اضافه می‌کنند.',
    suggestion:
      'مقدار را در یک جا قالب‌بندی کنید و رشتهٔ حاصل را پاس بدهید، یا زبان و ' +
      'منطقهٔ زمانی یکسانی در دو طرف تعیین کنید. اگر این نویسه‌ها بی‌ضررند، ' +
      '`suppressHydrationWarning` را به عنصر اضافه کنید.',
  },
  'locale-format.script': {
    explanation:
      'یک مقدار با دو نظام رقم متفاوت قالب‌بندی شده است (رقم‌های عربی-هندی ' +
      '`٠١٢` در برابر رقم‌های لاتین `012`). سرور و کلاینت تنظیمات منطقه‌ای ' +
      'متفاوتی انتخاب کرده‌اند.',
    suggestion:
      'یک `locale` مشخص (و منطقهٔ زمانی) را هم در سرور و هم در کلاینت به ' +
      '`Intl.NumberFormat` یا `toLocaleString` بدهید، یا مقدار را بعد از mount ' +
      'قالب‌بندی کنید تا فقط تنظیمات کلاینت به کار رود.',
  },
  'locale-format.separators': {
    explanation:
      'یک عدد با جداکنندهٔ هزارگان یا جداکنندهٔ اعشار متفاوت بین سرور و کلاینت ' +
      'قالب‌بندی شده است (مثلاً `1,234.56` در برابر `1.234,56`).',
    suggestion:
      'یک تنظیم منطقه‌ای مشخص را در هر دو طرف به `Intl.NumberFormat` یا ' +
      '`toLocaleString` بدهید تا جداکننده‌ها یکسان شوند.',
  },
  'locale-format.date-order': {
    explanation:
      'یک تاریخ با ترتیب بخش‌های متفاوت (`MM/DD` در برابر `DD/MM`) بین سرور و ' +
      'کلاینت نمایش داده شده است.',
    suggestion:
      'تاریخ‌ها را با تنظیم منطقه‌ای و منطقهٔ زمانی مشخص از طریق `Intl` در هر ' +
      'دو طرف قالب‌بندی کنید.',
  },
  'browser-only-api': {
    explanation:
      'کلاینت محتوایی رندر کرد که سرور خالی گذاشته بود — نشانهٔ خواندن یک API ' +
      'مخصوص مرورگر (`window`، `document`، `localStorage`، `navigator`، ' +
      '`matchMedia`) هنگام رندر.',
    suggestion:
      'خواندن از مرورگر را پشت یک پرچم mount یا داخل `useEffect` قرار دهید، یا ' +
      'از `useSyncExternalStore` با snapshot سرور استفاده کنید تا اولین رندر ' +
      'کلاینت با سرور یکسان باشد.',
  },
  'viewport-branching': {
    explanation:
      'یک زیردرخت کامل بین سرور و کلاینت اضافه، حذف یا جایگزین شده است — ' +
      'معمولاً یک بررسی عرض صفحه در JavaScript که درخت را در اولین رندر ' +
      'دوشاخه می‌کند.',
    suggestion:
      'هر دو شاخه را رندر کنید و در اولین نمایش با media queryهای CSS بینشان ' +
      'جابه‌جا شوید، نه با انشعاب در JavaScript؛ یا شاخهٔ وابسته به JavaScript ' +
      'را تا بعد از mount به تعویق بیندازید.',
  },
  'invalid-html-nesting': {
    explanation:
      'یک گره جابه‌جا یا بیرون رانده شد چون HTML نامعتبر است (مثلاً `<div>` ' +
      'داخل `<p>`، یا `<a>` داخل `<a>`). مرورگر DOM رسیده از سرور را اصلاح ' +
      'می‌کند و دیگر با انتظار React مطابقت ندارد.',
    suggestion:
      'اعتبار HTML را درست کنید: عنصرهای بلوکی نمی‌توانند داخل `<p>` باشند، ' +
      'پیوندها نمی‌توانند تودرتو باشند و مانند آن. والد نامعتبر را با `<div>` ' +
      'جایگزین کنید یا ساختار درخت را تغییر دهید.',
  },
  'whitespace-minification': {
    explanation:
      'تفاوت فقط در فاصله‌هاست — متن جز فاصله‌ها و خط‌های جدید یکسان است. ' +
      'احتمالاً یک کوچک‌کنندهٔ HTML فاصله‌های اطراف ریشهٔ Hydration را متفاوت ' +
      'با React فشرده کرده است.',
    suggestion:
      'تنظیمات کوچک‌کنندهٔ HTML (مثلاً `conservativeCollapse`) را اطراف ریشهٔ ' +
      'برنامه بررسی کنید، یا از کوچک‌سازی فاصله‌ها در markupی که Hydration ' +
      'می‌شود پرهیز کنید.',
  },
  'third-party-dom-mutation.extension-attribute': {
    explanation:
      'ویژگی `{attribute}` پیش از Hydration توسط یک افزونهٔ مرورگر یا اسکریپت ' +
      'شخص ثالث (مثلاً Grammarly یا ColorZilla) تزریق شده است، بنابراین DOM ' +
      'کلاینت دیگر با سرور یکسان نیست.',
    suggestion:
      'معمولاً بی‌ضرر است. `suppressHydrationWarning` را به عنصر مربوط اضافه ' +
      'کنید، یا راه‌اندازی اسکریپت خارجی را تا بعد از Hydration به تعویق ' +
      'بیندازید.',
  },
  'third-party-dom-mutation.root-attribute': {
    explanation:
      'ویژگی‌ای (`{attribute}`) روی یک عنصر ریشه ظاهر شد که سرور هرگز نفرستاده ' +
      'بود — نشانهٔ بارز یک افزونه یا اسکریپت شخص ثالث زودهنگام که DOM را تغییر ' +
      'می‌دهد.',
    suggestion:
      '`suppressHydrationWarning` را به عنصر ریشه اضافه کنید، یا اسکریپت خارجی ' +
      'را تا بعد از Hydration به تعویق بیندازید.',
  },
  'third-party-dom-mutation.injected-node': {
    explanation: (p) => [
      'یک اسکریپت شخص ثالث یا افزونهٔ مرورگر عنصر ',
      code(param(p, 'tag')),
      ' را پس از رندر سرور تزریق کرد (تبلیغات، رضایت‌نامه، آنالیتیکس یا چت). ' +
        'این بخشی از Hydration برنامهٔ شما نیست، پس معمولاً نویزی بی‌ضرر است.',
    ],
    suggestion:
      'اگر React دربارهٔ آن هشدار می‌دهد، `suppressHydrationWarning` را به ' +
      'نزدیک‌ترین پوشش رندرشده در سرور اضافه کنید، یا اسکریپت خارجی را بعد از ' +
      'Hydration بارگذاری کنید (مثلاً `<Script strategy="afterInteractive">` ' +
      'در Next.js).',
  },
  'attribute-mismatch.class': {
    explanation: (p) => [
      'ویژگی ',
      code('class'),
      ' بین سرور و کلاینت فرق دارد',
      ...classDetail(p, {
        added: 'در کلاینت اضافه شد: ',
        removed: 'در کلاینت حذف شد: ',
        listSeparator: '، ',
        partSeparator: '؛ ',
        open: ' (',
        close: ')',
      }),
      '. یک کلاس به‌صورت شرطی در کلاینت اعمال شده است — معمولاً بررسی اندازهٔ ' +
        'صفحه، media query، تم یا feature flag که در اولین رندر اجرا می‌شود.',
    ],
    suggestion:
      'همان `className` را در سرور و اولین نمایش کلاینت رندر کنید. شرط‌های ' +
      'مخصوص کلاینت را به `useEffect` یا یک پرچم mount منتقل کنید، یا تغییر ' +
      'ظاهری را با media queryهای CSS انجام دهید نه با تغییر کلاس در JavaScript.',
  },
  'attribute-mismatch.style': {
    explanation:
      '`style` درون‌خطی بین سرور و کلاینت فرق دارد — یک استایل درون‌خطی هنگام ' +
      'رندر از وضعیت مخصوص کلاینت (اندازهٔ صفحه، تم، موقعیت اسکرول) محاسبه ' +
      'شده است.',
    suggestion:
      'استایل را بعد از mount (`useEffect`) محاسبه کنید تا اولین رندر کلاینت با ' +
      'سرور یکسان باشد، یا آن را به یک کلاس CSS یا media query منتقل کنید.',
  },
  'attribute-mismatch.generic': {
    explanation:
      'ویژگی `{attribute}` بین سرور (`{server}`) و کلاینت (`{client}`) فرق ' +
      'دارد — مقدار آن از چیزی گرفته شده که بین سرور و اولین رندر کلاینت ' +
      'متفاوت است.',
    suggestion:
      'ویژگی را در سرور و کلاینت قطعی کنید، یا آن را بعد از mount تنظیم کنید تا ' +
      'اولین رندر کلاینت با HTML سرور یکسان باشد.',
  },
  unknown: {
    explanation:
      'یک ناهمخوانی Hydration پیدا شد اما با هیچ علت شناخته‌شده‌ای تطبیق داده ' +
      'نشد. مقدارهای سرور و کلاینت را در بالا بررسی کنید.',
    suggestion:
      'مقدارهای سرور و کلاینت را مقایسه کنید. علت‌های رایج: مقدارهای غیرقطعی، ' +
      'تاریخ‌ها و تنظیمات منطقه‌ای، و APIهای مخصوص مرورگر که هنگام رندر ' +
      'استفاده می‌شوند.',
  },
  'unknown.no-location': {
    explanation:
      'React گزارش داد که Hydration شکست خورده اما نگفت کدام گره متفاوت بوده ' +
      'است، و بررسی DOM هم تفاوتی برای نشان دادن پیدا نکرد.',
    suggestion:
      'مطمئن شوید `<HydrationSnapshotScript>` (یا اسکریپت snapshot دستی) داخل ' +
      '`<head>` است تا بررسی DOM بتواند گره را پیدا کند، و هشدار کامل React را ' +
      'در کنسول مرورگر بخوانید.',
  },
};

// Persian nouns stay singular after a number («۵ مشکل», never «۵ مشکل‌ها»),
// so only the one-item form differs.
export const FA: OverlayStrings = {
  dir: 'rtl',
  title: 'ناهمخوانی در Hydration',
  dialogLabel: 'عیب‌یابی ناهمخوانی Hydration',
  dismiss: 'بستن',
  dismissLabel: 'بستن پنل عیب‌یابی',
  hintDismissLabel: 'پنهان کردن راهنما',
  server: 'سرور',
  client: 'کلاینت',
  fix: 'راه‌حل:',
  // The docs are only written in English, so say so rather than surprise.
  learnMore: 'اطلاعات بیشتر (به انگلیسی) ←',
  none: '(هیچ)',
  empty: '(خالی)',
  fallbackCategory: 'ناهمخوانی',
  categories: {
    'non-deterministic-value': 'مقدار غیرقطعی',
    'date-time': 'تاریخ / زمان',
    'locale-format': 'قالب‌بندی زبان و منطقه',
    'browser-only-api': 'API مخصوص مرورگر',
    'viewport-branching': 'انشعاب بر اساس اندازهٔ صفحه',
    'invalid-html-nesting': 'تودرتویی نامعتبر HTML',
    'whitespace-minification': 'فاصله‌ها / کوچک‌سازی',
    'third-party-dom-mutation': 'تغییر DOM توسط شخص ثالث',
    'attribute-mismatch': 'ناهمخوانی ویژگی',
    unknown: 'نامشخص',
  },
  messages: FA_MESSAGES,
  hint: (count) =>
    `↓ ${count === 1 ? 'یک مشکل' : `${count} مشکل`} — برای دیدن همه اسکرول کنید`,
};
