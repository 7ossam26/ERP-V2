# النسخ الاحتياطي والاستعادة

## الهدف

ضمان وجود نسخة يومية قابلة للاستعادة لقاعدة بيانات `ramex_prod` مع احتفاظ لا يقل عن 30 يومًا.

## السياسة المعتمدة

- نوع النسخة: `mysqldump`
- المصدر: قاعدة بيانات Hostinger MySQL الخاصة بالإنتاج
- التكرار: يومي
- الاحتفاظ: 30 يومًا
- التخزين: Hostinger backups أو cron يرفع الملفات إلى مساحة تخزين آمنة

## إعداد النسخ الاحتياطي

1. فعّل نسخًا يومية على مستوى Hostinger إن كانت الخطة تدعم ذلك.
2. إن لم تكن متاحة، أضف cron على الـ VPS:

```bash
0 2 * * * mysqldump --single-transaction --quick --routines --triggers \
  -h <db-host> -u <db-user> -p'<db-password>' ramex_prod \
  | gzip > /var/backups/ramex/ramex_prod_$(date +\%F).sql.gz
```

3. أضف job لحذف النسخ الأقدم من 30 يومًا:

```bash
15 2 * * * find /var/backups/ramex -type f -name 'ramex_prod_*.sql.gz' -mtime +30 -delete
```

## اختبار الاستعادة

1. أنشئ قاعدة مؤقتة مثل `ramex_restore_test`.
2. استعد النسخة:

```bash
gunzip -c /var/backups/ramex/ramex_prod_YYYY-MM-DD.sql.gz | \
mysql -h <db-host> -u <db-user> -p'<db-password>' ramex_restore_test
```

3. شغّل فحوصًا سريعة:
  - عدد المستخدمين
  - وجود الجداول الأساسية
  - سلامة فواتير البيع/الشراء الحديثة
4. احذف قاعدة الاختبار بعد التحقق.

## قائمة تحقق بعد الاستعادة

- يعمل `GET /api/health`
- تسجيل الدخول بحساب Owner ينجح
- تظهر الفروع والمخازن والخزائن
- تظهر آخر فواتير البيع والشراء
- لا توجد أخطاء Prisma migration مطلوبة بشكل إضافي

## ملاحظات تشغيلية

- لا تحفظ أسرار قاعدة البيانات داخل المستودع.
- الاستعادة يجب أن تُنفذ أولًا على قاعدة اختبار قبل لمس قاعدة الإنتاج.
- أي استعادة إنتاجية يجب أن تُسجل في `docs/go-live-notes.md`.
