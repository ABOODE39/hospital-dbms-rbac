-- =====================================================================
--  نظام قاعدة بيانات مستشفى آمن مع RBAC
--  الملف: 03_audit.sql  — التدقيق الأمني (Audit Logging)
--  المنصّة: PostgreSQL
--
--  الغرض:
--    (1) دالة trigger عامّة واحدة تُسجّل كل عملية INSERT/UPDATE/DELETE
--        على الجداول الحسّاسة في جدول audit_logs (مَن فعل ماذا ومتى).
--    (2) ربط هذه الدالة بالجداول الحسّاسة عبر AFTER triggers.
--    (3) فرض خاصية append-only: منع تعديل/حذف سجلّ التدقيق نهائياً.
--
--  المتطلّب المسبق: تشغيل 01_schema.sql أولاً (جدول audit_logs موجود).
--
--  كيف تعرف قاعدة البيانات مستخدم التطبيق؟
--    قبل كل عملية كتابة، يضبط التطبيق ضمن نفس المعاملة:
--        SET LOCAL app.current_user_id = '<user_id>';
--        SET LOCAL app.client_ip      = '<ip>';
--    وتقرأها الدالة عبر current_setting('app.current_user_id', true).
--    المعامل true يمنع الخطأ إن لم يُضبط المتغيّر (يُرجِع NULL لأحداث النظام).
-- =====================================================================


-- =====================================================================
--  (1) الدالة العامّة لكتابة سجلّ التدقيق
--      AFTER trigger: تُسجّل فقط ما نجح فعلاً ووصل إلى الجدول.
--      تُعيد استخدامها كل الجداول الحسّاسة (دالة واحدة لكل الجداول).
-- =====================================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    -- هوية الفاعل من سياق الجلسة (قد تكون NULL لأحداث النظام)
    v_user_id BIGINT := current_setting('app.current_user_id', true)::BIGINT;
    -- عنوان IP من سياق الجلسة (nullif يتعامل مع السلسلة الفارغة)
    v_ip      INET   := NULLIF(current_setting('app.client_ip', true), '')::INET;
    -- القيم القديمة/الجديدة كـ JSONB (تُعبّأ حسب نوع العملية)
    v_old     JSONB;
    v_new     JSONB;
    v_row_id  BIGINT;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        v_new    := to_jsonb(NEW);
        v_row_id := NEW.id;

    ELSIF (TG_OP = 'UPDATE') THEN
        v_old    := to_jsonb(OLD);
        v_new    := to_jsonb(NEW);
        v_row_id := NEW.id;

    ELSIF (TG_OP = 'DELETE') THEN
        v_old    := to_jsonb(OLD);
        v_row_id := OLD.id;
    END IF;

    -- تصفية أمنية: لا يُسرَّب hash كلمة المرور إلى سجلّ التدقيق عند تدقيق users
    IF (TG_TABLE_NAME = 'users') THEN
        v_old := v_old - 'password_hash';
        v_new := v_new - 'password_hash';
    END IF;

    -- نخزّن العملية بصيغة موحّدة: INSERT/UPDATE/DELETE في عمود action
    INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id,
        old_values, new_values, ip_address, created_at
    )
    VALUES (
        v_user_id, TG_OP, TG_TABLE_NAME, v_row_id,
        v_old, v_new, v_ip, NOW()
    );

    -- في AFTER trigger قيمة الإرجاع تُتجاهل، لكن نلتزم بالعرف الآمن
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION audit_trigger_func() IS
    'دالة trigger عامّة تكتب كل INSERT/UPDATE/DELETE في audit_logs مع القيم القديمة/الجديدة وهوية المستخدم من app.current_user_id';


-- =====================================================================
--  (2) ربط الدالة بالجداول الحسّاسة (AFTER INSERT/UPDATE/DELETE)
--      تسعة جداول حسّاسة: بيانات المرضى السريرية + الهوية + المال.
--      AFTER + FOR EACH ROW: تُسجَّل كل صفّ بعد نجاح العملية فعلاً.
-- =====================================================================

-- المرضى — البيانات الديموغرافية الحسّاسة
CREATE TRIGGER trg_audit_patients
    AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- السجلّ الطبي — جوهر البيانات السريرية
CREATE TRIGGER trg_audit_medical_records
    AFTER INSERT OR UPDATE OR DELETE ON medical_records
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- التشخيصات
CREATE TRIGGER trg_audit_diagnoses
    AFTER INSERT OR UPDATE OR DELETE ON diagnoses
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- الوصفات الطبية
CREATE TRIGGER trg_audit_prescriptions
    AFTER INSERT OR UPDATE OR DELETE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- طلبات الفحص المختبري (تتضمّن النتائج)
CREATE TRIGGER trg_audit_lab_orders
    AFTER INSERT OR UPDATE OR DELETE ON lab_orders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- حسابات المصادقة (إنشاء/تعطيل/تغيير الحساب)
CREATE TRIGGER trg_audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- إسناد الأدوار — حسّاس لمنع تصعيد الامتياز (RBAC)
CREATE TRIGGER trg_audit_user_roles
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- الفواتير — السجلّ المالي
CREATE TRIGGER trg_audit_invoices
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- المدفوعات — السجلّ المالي
CREATE TRIGGER trg_audit_payments
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();


-- =====================================================================
--  (3) فرض خاصية append-only على سجلّ التدقيق
--      طبقتان دفاعيّتان:
--      (أ) trigger يرفض أي UPDATE/DELETE على audit_logs (حتى للأدمن).
--      (ب) سحب صلاحيات UPDATE/DELETE عن دور التطبيق (دفاع بالامتياز).
--      الإدراج (INSERT) يبقى مسموحاً لأنه طريق الكتابة الوحيد المشروع.
-- =====================================================================

-- (أ) دالة رفض تمنع أي محاولة تعديل أو حذف لسجلّ التدقيق
CREATE OR REPLACE FUNCTION block_audit_change()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION block_audit_change() IS
    'تمنع أي UPDATE/DELETE على audit_logs لضمان ثبات سجلّ التدقيق (append-only)';

-- ربط دالة الرفض قبل أي تعديل/حذف على audit_logs
CREATE TRIGGER trg_audit_logs_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION block_audit_change();

-- (ب) سحب صلاحيات التعديل/الحذف عن دور التطبيق (دفاع ثانٍ على مستوى الصلاحيات)
--     ملاحظة: يُنشأ الدور app_role في ملف الأدوار (04). لو لم يكن موجوداً
--     بعدُ، نفّذ هذا السطر بعد إنشائه. نتركه هنا للتوثيق ووضوح النيّة.
-- REVOKE UPDATE, DELETE ON audit_logs FROM app_role;


-- =====================================================================
--  نهاية ملف التدقيق
-- =====================================================================
