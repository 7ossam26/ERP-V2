# قرارات الثيم

## الثيم الافتراضي

- الثيم الافتراضي المعتمد في رامكس هو `ramex-store`.
- السبب: أكثر ثيم مناسب للهوية الحالية، وتباينه جيد على صفحات التشغيل اليومية مثل نقطة البيع، المشتريات، والتقارير.
- هذا الاختيار هو fallback إذا لم توجد قيمة محفوظة في `SystemConfiguration.themeKey`.

## الثيمات المتاحة

- `ramex-store`: نحاسي دافئ مناسب لواجهة عربية عملية.
- `nile-ledger`: أخضر هادئ مناسب للتقارير والشاشات الإدارية.
- `graphite-bazaar`: أزرق معدني بتباين أعلى للشاشات المكتظة.

## قرار التنفيذ

- مصدر الثيمات الوحيد: [themes.js](/C:/Users/7OSS/Desktop/projects/ghoneimy/ERP-V2/frontend/src/theme/themes.js).
- `GET /api/settings/themes` يقرأ نفس الملف لتجنب اختلافات بين الواجهة والخلفية.
- Tailwind يقرأ ألوانه من CSS variables.
- MUI theme يُبنى من نفس `themeKey` داخل `SystemSettingsContext`.
- المعاينة الحية في صفحة الإعدادات لا تحفظ أي تغيير حتى الضغط على "حفظ الإعدادات".

## ملاحظات

- تغيير الثيم يجب أن يبقى cosmetic فقط، بلا أي تأثير على permission logic أو business rules.
- أي ثيم جديد لاحقًا يجب أن يضيف:
  - `cssVars`
  - `preview`
  - `mui`
  - label عربي وإنجليزي
