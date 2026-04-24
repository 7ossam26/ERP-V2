# قائمة تدقيق التعريب والصقل

## صفحات تم تحسينها مباشرة في Phase 8

- [SettingsPage.jsx](/C:/Users/7OSS/Desktop/projects/ghoneimy/ERP-V2/frontend/src/pages/settings/SettingsPage.jsx): تبويبات عربية، معاينة ثيم، سياسات الأمان، رفع شعار.
- [AuditLogPage.jsx](/C:/Users/7OSS/Desktop/projects/ghoneimy/ERP-V2/frontend/src/pages/audit/AuditLogPage.jsx): فلاتر عربية، تفاصيل before/after، تصدير Excel.
- [ChangePasswordPage.jsx](/C:/Users/7OSS/Desktop/projects/ghoneimy/ERP-V2/frontend/src/pages/ChangePasswordPage.jsx): نصوص عربية، شعار الشركة، متطلبات كلمة المرور من الإعدادات.
- [ExpensesPage.jsx](/C:/Users/7OSS/Desktop/projects/ghoneimy/ERP-V2/frontend/src/pages/expenses/ExpensesPage.jsx): ترويسة عربية، تنسيق تاريخ، طباعة، إزالة hardcoded copy.
- [ReceiptPrintTemplate.jsx](/C:/Users/7OSS/Desktop/projects/ghoneimy/ERP-V2/frontend/src/pages/pos/ReceiptPrintTemplate.jsx): دعم بيانات الشركة والشعار والهاتف والعنوان.

## قواعد معتمدة

- التواريخ داخل الواجهة: `YYYY-MM-DD HH:mm` أو `YYYY-MM-DD` حسب الحاجة.
- تنسيق الواجهة العربية يعتمد `ar-EG`.
- العملة داخل الواجهة: `ج.م`.
- العملة في التصدير الخارجي: `EGP`.
- الأرقام داخل الحقول والبيانات التشغيلية تبقى ASCII لضمان الإدخال والفرز.

## بنود مكتملة

- إزالة `console.log` الواضح من مسارات الشراء ذات الصلة بالمرحلة.
- إزالة نصوص إنجليزية واضحة من صفحة تغيير كلمة المرور وصفحة المصروفات الجديدة.
- ربط الشعار واسم الشركة من إعدادات النظام بدل الثوابت.
- إضافة focus states مرئية في `index.css`.

## بنود تحتاج مرورًا يدويًا نهائيًا

- فحص كل صفحة legacy لم تُفتح فعليًا على البيئة الحالية.
- مراجعة placeholders القديمة في الصفحات الأقل استخدامًا.
- مراجعة رسائل الخطأ القادمة من backend القديمة التي لم تُعاد كتابتها في هذه المرحلة.

## ملاحظة تنفيذية

- هذه القائمة تغطي ما تم لمسه في Phase 8 وما تمت مراجعته مباشرة.
- المرور الشامل على كل شاشة في الإنتاج ما زال مطلوبًا قبل sign-off النهائي.
