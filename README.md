# نرم‌افزار حسابداری دسکتاپ آرنا (Arena Desk)

**Arena Desk** یک نرم‌افزار حسابداری دوبل پیشرفته، سبک و محلی (Local-first) برای سیستم‌عامل ویندوز و دسکتاپ است که بر پایه **Tauri v2** و **React 19** ساخته شده است. این نرم‌افزار بدون نیاز به اینترنت یا نصب سرور خارجی، با تکیه بر موتور دیتابیس **SQLite** (`arena.db`) و تقویم هجری شمسی دقیق، مدیریت کامل جریان‌های مالی شخصی، چک‌ها، فاکتورها، کاردکس انبار و طرف‌حساب‌ها را فراهم می‌کند.

---

## ۱. ویژگی‌های کلیدی سیستم (Core Features)

### ۱. موتور حسابداری دوبل و دفاتر مالی استاندارد (`Core Accounting Engine`)
- **ساختار سند دوبل متوازن ($\sum \text{Debits} = \sum \text{Credits}$):** هر رویداد مالی (درآمد، هزینه، انتقال، فاکتور و چک) در قالب آرتیکل‌های متوازن بدهکار و بستانکار ثبت می‌شود.
- **مدیریت هوشمند مانده اولیه (`initial_balance`):** اتصال مستقیم مانده اولیه حساب‌ها به سند افتتاحیه سیستمی و به‌روزرسانی خودکار آرتیکل‌های افتتاحیه با تغییر مانده اولیه.
- **دفتر معین و ریزگردش بر اساس توالی زمانی دقیق:** مرتب‌سازی صعودی بر مبنای تاریخ واقعی رویدادها همراه با پین شدن ردیف مانده اولیه در سطر شماره ۰ (`Row 0`).
- **محاسبه مانده پس از هر رویداد (Running Balance):** پایش مانده لحظه‌ای با تابع کمکی `cleanNum` جهت حذف خطاهای ممیز شناور جاوااسکریپت و نمایش ستون استاندارد تشخیص ماهیت (بدهکار / بستانکار / بی‌حساب).

### ۲. چرخه حیات و مدیریت چک‌های بانکی (`Cheque Management Lifecycle`)
- **پشتیبانی کامل از چک‌های دریافتی و پرداختی:**
  - چک‌های دریافتی: موجود نزد صندوق (`in_safe`)، وصول‌شده و واریز به بانک (`cleared`)، واگذارشده و خرج‌شده برای تأمین‌کننده (`assigned`)، برگشت‌خورده (`bounced`) و مسترد/عودت داده‌شده به طرف‌حساب (`returned`).
  - چک‌های پرداختی: صادرشده (`issued`)، پاس‌شده و برداشت از بانک (`cleared`)، برگشت‌خورده (`bounced`) و باطل‌شده (`voided`).
- **قابلیت لغو و بازگشت به وضعیت قبلی (`Undo / Revert Cheque Status`):** امکان لغو ایمن عملیات چک‌های وصولی، واگذاری و برگشتی همراه با حذف خودکار اسناد دوبل متناظر و بازگشت حساب‌ها به وضعیت پیشین.
- **قفل امنیتی اسناد سیستمی چک‌ها (`Security Lock`):** محافظت از اسناد حسابداری ناشی از عملیات چک با نشان سیستمی جهت جلوگیری از ویرایش یا حذف دستی در دفتر روزنامه و گردش بانک.
- **اتصال تاریخ سند به تاریخ دریافت/صدور:** استخراج تاریخ میلادی و شمسی سند حسابداری چک مستقیماً از تاریخ دریافت (`issue_date_shamsi`) جهت همخوانی کامل با تاریخ واقعی توافق مالی و صورت‌حساب شخص.
- **انتخابگر پیشرفته طرف‌حساب و بانک:** کامپوننت هوشمند `SearchablePersonSelect` با جستجوی سریع درجا، فوکوس خودکار و دراپ‌داون بانک‌های معتبر کشور.

### ۳. فاکتورهای خرید و فروش، تسویه چندگانه و کاردکس انبار (`Invoicing & Inventory`)
- **روش‌های تسویه چندگانه و هم‌زمان (Multiple Settlements):** امکان ثبت هم‌زمان چندین پرداخت نقدی (به صندوق‌های مختلف)، چندین واریز بانکی و چندین فقره چک صادرشده یا واگذارشده در یک فاکتور با محاسبه زنده مانده نسیه.
- **اعتبارسنجی موجودی انبار در بعد زمان (`Point-in-Time Inventory Validation`):** الگوریتم شبیه‌سازی کاردکس در طول محور زمان با ترتیب تقویمی شمسی؛ جلوگیری قطعی از منفی شدن موجودی کالا در تاریخ انتخابی فاکتور فروش یا روزهای پس از آن.
- **محاسبه سود ناخالص و گردش کالا:** اتصال مستقیم هر قلم فاکتور به کاردکس انبار و صدور خودکار حواله ورود/خروج و اسناد حسابداری قیمت تمام‌شده و درآمد فروش.

### ۴. ابزارها و تقویم بومی هجری شمسی (`Persian / Shamsi Date Utilities`)
- **تراز استاندارد هفته ایرانی:** چینش دقیق روزهای هفته از شنبه (`Saturday = 0`) تا جمعه (`Friday = 6`).
- **رفع خطای انحراف تقویم ماهانه (`emptyLeading`):** تطابق بدون خطای گرید روزها در کامپوننت‌های `ShamsiDatePicker` و `ShamsiDateInput` برای تمام سال‌ها و ماه‌های کبیسه.
- **تبدیل دوطرفه دقیق:** تبدیل بدون خطای تاریخ‌های جلالی به ایزو میلادی و برعکس با کتابخانه بهینه‌شده `jalaali-js`.

### ۵. همگام‌سازی ابری با کیف پول آنلاین (`Cloud Sync`)
- **شناسایی خودکار حساب‌ها و اشخاص جدید:** دریافت ساختار سرفصل‌ها از اندپوینت `/api/accounts` کیف پول ابری و تعریف خودکار آنها با کدینگ حسابداری استاندارد دسکتاپ.
- **ردیابی ماندگار شناسه ابری (`remote_id`):** ردیابی پایدار شناسه تراکنش‌های ابری در جدول `journal_entries` حتی پس از ویرایش و قطعی‌سازی اسناد جهت جلوگیری قطعی از ورود دوباره تراکنش‌ها در همگام‌سازی‌های بعدی.

---

## ۲. پشته فنی پروژه (Tech Stack)

| بخش | ابزار و فناوری | توضیحات |
| :--- | :--- | :--- |
| **هسته دسکتاپ** | Tauri v2 (Rust) | پکیج بسیار سبک و سریع، دسترسی مستقیم به سیستم‌عامل و SQLite محلی |
| **فرانت‌اند** | React 19 + TypeScript | کامپوننت‌های مدرن و مدیریت رویدادهای ناهمگام |
| **ابزار بیلد** | Vite 8 | بیلد آنی با پشتیبانی از Hot Module Replacement و پراکسی توسعه |
| **استایل‌دهی** | Tailwind CSS v4 | رابط کاربری مدرن، راست‌به‌چپ (RTL)، هماهنگ با فونت وزیرمتن |
| **پایگاه داده** | SQLite (`@tauri-apps/plugin-sql`) | پایگاه داده محلی مستقل `arena.db` بدون وابستگی به شبکه |
| **تقویم و تاریخ** | `jalaali-js` + تقویم اختصاصی | تقویم بومی فارسی هجری شمسی |
| **آیکون‌ها** | Lucide React | مجموعه آیکون‌های استاندارد و هماهنگ |

---

## ۳. ساختار جداول پایگاه‌داده محلی (Database Schema)

```sql
-- سرفصل‌های حسابداری و اشخاص
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,          -- 'asset', 'liability', 'revenue', 'expense', 'person'
  bank_name TEXT,
  account_number TEXT,
  card_number TEXT,
  color TEXT,
  icon TEXT,
  balance REAL DEFAULT 0,
  initial_balance REAL DEFAULT 0,
  parent_id TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

-- سربرگ اسناد حسابداری دوبل
CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,
  entry_number INTEGER NOT NULL,
  entry_date TEXT NOT NULL,
  entry_date_shamsi TEXT NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL,   -- 'expense', 'income', 'transfer', 'manual', 'opening', 'invoice', 'cheque'
  from_account_id TEXT,
  to_account_id TEXT,
  fee REAL DEFAULT 0,
  status TEXT NOT NULL,        -- 'final', 'draft'
  is_system_generated INTEGER DEFAULT 0,
  related_cheque_id TEXT,
  remote_id TEXT,
  created_at TEXT NOT NULL
);

-- آرتیکل‌های سند حسابداری
CREATE TABLE journal_items (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  debit REAL NOT NULL,
  credit REAL NOT NULL,
  note TEXT,
  is_system_generated INTEGER DEFAULT 0,
  source_type TEXT
);

-- ماژول دسته‌چک و چک‌ها
CREATE TABLE checkbooks (...);
CREATE TABLE cheques (...);

-- انبار و کالاها و کاردکس
CREATE TABLE warehouses (...);
CREATE TABLE commodity_groups (...);
CREATE TABLE commodities (...);
CREATE TABLE commodity_transactions (...);

-- فاکتورها و اقلام تسویه
CREATE TABLE invoices (...);
CREATE TABLE invoice_items (...);
CREATE TABLE invoice_services (...);
CREATE TABLE invoice_payments (...);
```

---

## ۴. راه‌اندازی و اجرای پروژه (Development & Build)

### پیش‌نیازها:
- **Node.js:** نسخه ۱۸ به بالا
- **Rust & Cargo:** نسخه پایدار (جهت کامپایل اپلیکیشن دسکتاپ Tauri)

### نصب وابستگی‌ها:
```bash
npm install
```

### اجرای در محیط توسعه (Tauri Desktop):
```bash
npm run tauri dev
```

### اجرای در بستر وب محلی (Web Preview / Fallback):
```bash
npm run dev
```

### ساخت نسخه نهایی نصبی و پرتابل (Production Build):
```bash
npm run tauri build
```
فایل اجرایی و نصبی در مسیر `src-tauri/target/release/bundle/msi` یا `nsis` تولید می‌گردد.
