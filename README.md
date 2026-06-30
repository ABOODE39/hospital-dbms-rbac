# نظام إدارة مستشفى العالمية IVF — قاعدة بيانات آمنة مع RBAC

[![CI](https://github.com/ABOODE39/hospital-dbms-rbac/actions/workflows/ci.yml/badge.svg)](https://github.com/ABOODE39/hospital-dbms-rbac/actions)

مشروع مادة قواعد البيانات: نظام لإدارة مستشفى يركّز على الأمان. الفكرة الأساسية أنّ الصلاحيات لا تُفرض في التطبيق وحده، بل في قاعدة البيانات نفسها عبر **Row-Level Security** — فحتى لو تسرّب اتصال مباشر بقاعدة البيانات، تبقى البيانات محميّة على مستوى الصفّ.

المكدّس: **PostgreSQL 15 + Node.js/Express + واجهة JavaScript عربية (RTL)**.

## الموقع الحيّ

👉 **[aboode39.github.io/hospital-dbms-rbac](https://aboode39.github.io/hospital-dbms-rbac/)**

هذه نسخة عرض تعمل داخل المتصفّح ببيانات تجريبية (GitHub Pages يستضيف ملفّات ثابتة فقط، بلا خادم). النظام الكامل مع PostgreSQL وRLS يُشغّل محلياً (انظر «التشغيل») ويُختبَر آلياً في كل دفعة عبر GitHub Actions.

## ماذا يفعل

إدارة المرضى، المواعيد، السجلّات الطبية، طلبات المختبر، الصيدلية، الفوترة، والموظفين والأقسام — كلٌّ بحسب صلاحيات دور المستخدم.

## الأمان

- **RBAC**: 7 أدوار و68 صلاحية بصيغة `resource:action` (مثل `medical_records:read`).
- **RLS في PostgreSQL**: 36 سياسة على 12 جدولاً حسّاساً — المريض يرى سجلّه فقط، والطبيب يرى مرضاه، وموظّف الاستقبال لا يصل للسجلّات الطبية.
- **كلمات المرور**: bcrypt بـ12 جولة، ولا تُخزَّن خاماً أبداً.
- **JWT**: توكنات قصيرة العمر (15 دقيقة) تحمل أدوار المستخدم وصلاحياته.
- **سجلّ تدقيق** append-only: يسجّل كل تعديل (من، ماذا، متى، من أي IP) ولا يُعدَّل أو يُحذف.
- **تقنيع البيانات**: إخفاء الأرقام الحسّاسة (هوية، هاتف) حسب الدور.
- دفاع إضافي: Helmet، CORS مقيّد، Rate Limiting، وقفل الحساب بعد 5 محاولات دخول فاشلة.

## المكدّس التقني

| الطبقة | التقنيات |
|--------|----------|
| قاعدة البيانات | PostgreSQL 15 (RLS · pgcrypto · Triggers) — 22 جدولاً |
| Backend | Node.js 18 + Express + bcryptjs + JWT |
| Frontend | HTML/CSS/JavaScript عربي (RTL)، بلا أُطر |
| الاختبارات | Jest + Supertest — 61 اختباراً |

## التشغيل

**المتطلّبات:** PostgreSQL 15، Node.js 18، ومتصفّح حديث.

```bash
# 1) قاعدة البيانات — نفّذ الملفّات بالترتيب
createdb hospital_db
psql -d hospital_db -f database/01_schema.sql
psql -d hospital_db -f database/02_rbac_rls.sql
psql -d hospital_db -f database/03_audit.sql
psql -d hospital_db -f database/04_views_masking.sql
psql -d hospital_db -f database/05_seed.sql

# 2) الخادم
cd backend
npm install
cp .env.example .env      # عدّل DATABASE_URL و JWT_SECRET
npm run dev               # يعمل على http://localhost:3000

# 3) الواجهة
cd frontend
python -m http.server 8000   # ثم افتح http://localhost:8000
```

## حسابات الدخول التجريبية

كلمة المرور موحّدة للجميع: **`Passw0rd!`**

| المستخدم | الدور | المستخدم | الدور |
|----------|-------|----------|-------|
| `admin.karrar` | مدير النظام | `lab.omar` | فنّي مختبر |
| `dr.ahmed` · `dr.sara` · `dr.ali` | طبيب | `pharma.noor` | صيدلي |
| `nurse.zainab` · `nurse.hassan` | ممرّض | `patient.mohammed` · `patient.fatima` | مريض |
| `reception.mariam` | استقبال | | |

> جرّب الفرق: ادخل كـ`dr.ahmed` (يرى كل المرضى)، ثم كـ`patient.mohammed` (يرى سجلّه فقط) — هذا أثر RLS.

## الاختبارات

```bash
cd backend
npm test
```

اختبارات وحدة للمصادقة وRBAC، واختبارات تكامل حيّة تشغّل PostgreSQL وتتحقّق من سياسات RLS فعلياً (طبيب ينشئ سجلّاً، مريض يُحجب عن سجلّات غيره، استقبال يُرفض من السجلّات الطبية). تعمل كلّها تلقائياً في GitHub Actions.

## بنية المشروع

```
database/   ملفّات SQL بالترتيب (مخطّط · RBAC+RLS · تدقيق · views · بيانات)
backend/    Express API: config, middleware (auth/rbac), controllers, routes, tests
frontend/   واجهة عربية: تسجيل دخول + لوحة تتغيّر حسب الدور
(الوثائق والتقرير الأكاديمي والملزمة محليّة — غير مُضمّنة في المستودع)
```

## الفريق

| العضو | الشعبة / القاعة |
|-------|-----------------|
| قمر أسعد شنشل | شعبة B |
| سيف مهنّد نجم | شعبة H |
| حسين محمود جراغ | قاعة C |

**المشرف:** د. علي — جامعة آشور، قسم هندسة الأمن السيبراني، المرحلة الثانية.

## ملاحظة

مشروع تعليمي. قبل أي استخدام حقيقي يجب تغيير `JWT_SECRET` وكلمات المرور الافتراضية، وتفعيل HTTPS، وإجراء فحص أمني مستقل. مرخّص تحت MIT.
