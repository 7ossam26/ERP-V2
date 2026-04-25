import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../../components/ui/Icon";

// ─── Table of Contents Definition ────────────────────────────────────────────
const SECTIONS = [
  { id: "login",       icon: "login",                   title: "تسجيل الدخول",        route: null },
  { id: "dashboard",   icon: "dashboard",               title: "الصفحة الرئيسية",     route: "/dashboard" },
  { id: "pos",         icon: "point_of_sale",           title: "نقطة البيع (POS)",    route: "/pos" },
  { id: "shifts",      icon: "schedule",                title: "الورديات",             route: "/shifts" },
  { id: "inventory",   icon: "inventory_2",             title: "المخزون",              route: "/inventory" },
  { id: "transfers",   icon: "swap_horiz",              title: "تحويل المخزون",        route: "/transfer-management" },
  { id: "purchases",   icon: "shopping_cart",           title: "المشتريات",            route: "/purchases" },
  { id: "suppliers",   icon: "handshake",               title: "حسابات الموردين",      route: "/supplier-accounts" },
  { id: "treasury",    icon: "account_balance",         title: "الخزائن",              route: "/treasury" },
  { id: "expenses",    icon: "receipt_long",            title: "المصروفات",            route: "/expenses" },
  { id: "hr",          icon: "groups",                  title: "الموارد البشرية",      route: "/hr" },
  { id: "delivery",    icon: "local_shipping",          title: "التوصيل",              route: "/delivery-men" },
  { id: "reports",     icon: "bar_chart",               title: "التقارير",             route: "/reports" },
  { id: "settings",    icon: "settings",                title: "الإعدادات",            route: "/settings" },
  { id: "superadmin",  icon: "admin_panel_settings",    title: "لوحة الإدارة العليا", route: "/superadmin" },
];

// ─── Reusable Section Wrapper ─────────────────────────────────────────────────
function Section({ id, icon, title, route, onNavigate, children }) {
  return (
    <section id={id} className="scroll-mt-24 mb-12">
      <div className="flex items-center gap-3 mb-5 pb-3 border-b-2 border-primary/20">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon name={icon} size={20} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex-1">{title}</h2>
        {route && (
          <button
            onClick={() => onNavigate(route)}
            title={`افتح صفحة ${title}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/30 rounded-lg px-2.5 py-1.5 hover:bg-primary hover:text-white transition-all flex-shrink-0">
            <Icon name="open_in_new" className="text-sm" />
            <span>فتح الصفحة</span>
          </button>
        )}
      </div>
      <div className="text-slate-700 dark:text-slate-300 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

function Step({ num, text }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center mt-0.5">
        {num}
      </span>
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function Note({ children }) {
  return (
    <div className="flex gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
      <Icon name="info" className="text-base flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function Tip({ children }) {
  return (
    <div className="flex gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-4 py-3 text-sm text-green-800 dark:text-green-300">
      <Icon name="lightbulb" className="text-base flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const UserManualPage = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("login");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const contentRef = useRef(null);

  // Highlight active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    setSidebarOpen(false);
  };

  // Returns props for a Section from the SECTIONS definition
  const sec = (id) => {
    const s = SECTIONS.find((x) => x.id === id);
    return { id, icon: s.icon, title: s.title, route: s.route, onNavigate: navigate };
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* ── Sticky Top Bar ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors">
              <Icon name="arrow_back" className="text-base" />
              رجوع
            </button>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-2">
              <Icon name="help" className="text-primary text-xl" />
              <h1 className="text-base font-bold text-slate-800 dark:text-white">دليل المستخدم</h1>
            </div>
          </div>
          {/* Mobile TOC toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
            <Icon name="menu_book" className="text-base" />
            المحتوى
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* ── Sidebar TOC ──────────────────────────────────────────────── */}
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside className={`
          fixed top-0 right-0 h-full w-64 z-40 bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto transition-transform duration-300
          lg:static lg:w-56 lg:shadow-none lg:bg-transparent lg:z-auto lg:translate-x-0 lg:flex-shrink-0
          lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto
          ${sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
        `}>
          <div className="p-4 lg:p-0">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-1">
              محتويات الدليل
            </p>
            <nav className="space-y-0.5">
              {SECTIONS.map(({ id, icon, title, route }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-right transition-all ${
                    activeSection === id
                      ? "bg-primary text-white font-semibold shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary"
                  }`}>
                  <Icon name={icon} size={16} className="flex-shrink-0" />
                  <span className="flex-1">{title}</span>
                  {route && (
                    <span
                      onClick={(e) => { e.stopPropagation(); navigate(route); }}
                      title="فتح الصفحة"
                      className={`flex-shrink-0 opacity-60 hover:opacity-100 ${activeSection === id ? "text-white" : "text-primary"}`}>
                      <Icon name="open_in_new" size={14} />
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── Main Content ──────────────────────────────────────────────── */}
        <main ref={contentRef} className="flex-1 min-w-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 px-6 py-8 lg:px-10">

          {/* Welcome */}
          <div className="mb-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <Icon name="help_outline" className="text-primary text-4xl" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
              دليل المستخدم — نظام رامكس
            </h1>
            <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto text-sm">
              هذا الدليل يشرح طريقة استخدام جميع وحدات النظام خطوة بخطوة. اختر أي قسم من القائمة الجانبية للانتقال إليه مباشرة.
            </p>
          </div>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 1. تسجيل الدخول */}
          <Section {...sec("login")}>
            <p>عند فتح النظام تظهر لك صفحة تسجيل الدخول. أدخل بياناتك للوصول إلى حسابك.</p>
            <div className="space-y-2 mt-3">
              <Step num="1" text="أدخل اسم المستخدم الخاص بك في خانة «اسم المستخدم»." />
              <Step num="2" text="أدخل كلمة المرور في خانة «كلمة المرور»." />
              <Step num="3" text="اضغط على زر «تسجيل الدخول»." />
            </div>
            <Note>في حال نسيت كلمة المرور تواصل مع مدير النظام لإعادة تعيينها.</Note>
            <Tip>سيتم تسجيل خروجك تلقائياً إذا انتهت صلاحية جلستك؛ أعد تسجيل الدخول عند الطلب.</Tip>
          </Section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 2. الصفحة الرئيسية */}
          <Section {...sec("dashboard")}>
            <p>بعد تسجيل الدخول ستنتقل تلقائياً إلى الصفحة الرئيسية التي تعرض بيانات اليوم الفعلية (مثل المبيعات) ومختصرات للوحدات.</p>
            <div className="space-y-2 mt-3">
              <Step num="1" text="تجد في الأعلى رسالة الترحيب مع شعار رامكس وتاريخ اليوم." />
              <Step num="2" text="تظهر بطاقات بيانات مباشرة عن نشاط اليوم بحسب الصلاحيات." />
              <Step num="3" text="يمكن تعديل أقسام «إجراءات سريعة» و«التقارير السريعة» من صفحة الإعدادات." />
            </div>
            <Tip>الوحدات المعروضة تعتمد على الصلاحيات الممنوحة لحسابك؛ تواصل مع المدير إذا لم تجد وحدة تحتاجها.</Tip>
          </Section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 3. نقطة البيع */}
          <Section {...sec("pos")}>
            <p>وحدة نقطة البيع هي قلب النظام؛ من خلالها تُسجَّل جميع المبيعات اليومية.</p>

            <h3 className="font-bold text-slate-800 dark:text-white mt-4 mb-2">فتح الوردية</h3>
            <div className="space-y-2">
              <Step num="1" text="افتح وحدة نقطة البيع من الصفحة الرئيسية." />
              <Step num="2" text="إذا لم تكن هناك وردية مفتوحة ستظهر لك رسالة تطلب فتح وردية جديدة؛ اضغط «فتح وردية»." />
              <Step num="3" text="أدخل رصيد بداية الخزنة إن طُلب منك ذلك ثم أكّد." />
            </div>

            <h3 className="font-bold text-slate-800 dark:text-white mt-4 mb-2">إتمام عملية بيع</h3>
            <div className="space-y-2">
              <Step num="1" text="ابحث عن المنتج بالاسم أو الرمز في خانة البحث." />
              <Step num="2" text="اضغط على المنتج لإضافته إلى سلة المبيعات." />
              <Step num="3" text="عدّل الكمية إذا لزم بالضغط على حقل الكمية بجانب الصنف." />
              <Step num="4" text="اختر طريقة الدفع: نقداً أو بطاقة." />
              <Step num="5" text="اضغط «إتمام البيع» لتأكيد العملية وطباعة الفاتورة." />
            </div>

            <h3 className="font-bold text-slate-800 dark:text-white mt-4 mb-2">إغلاق الوردية</h3>
            <div className="space-y-2">
              <Step num="1" text="اضغط على زر «إغلاق الوردية» في أسفل الشاشة." />
              <Step num="2" text="سيُعرض عليك ملخص الوردية (مبيعات نقدي، بطاقة، إجمالي)." />
              <Step num="3" text="أكّد الإغلاق؛ ستنتقل الوردية إلى حالة «قيد المراجعة» حتى يوافق عليها المدير." />
            </div>

            <Note>لا يمكن تسجيل مبيعات بدون وردية مفتوحة. إذا ظهرت رسالة خطأ تحقق من أن الوردية نشطة.</Note>
            <Tip>يمكن إضافة عميل للفاتورة قبل إتمام البيع بالضغط على «اختر عميل» لتتبع مديونيات العملاء.</Tip>
          </Section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 4. الورديات */}
          <Section {...sec("shifts")}>
            <p>تُستخدم وحدة الورديات لإدارة ومراجعة واعتماد ورديات الكاشيرين.</p>
            <div className="space-y-2 mt-3">
              <Step num="1" text="انتقل إلى «الورديات» من القائمة الرئيسية." />
              <Step num="2" text="ستجد قائمة بجميع الورديات مع حالة كل منها: مفتوحة / قيد المراجعة / مقبولة." />
              <Step num="3" text="اضغط على أي وردية لعرض تفاصيلها (المبيعات، الإجماليات، الكاشير)." />
              <Step num="4" text="إذا كنت مديراً أو مديراً عاماً يمكنك الموافقة على الوردية بزر «اعتماد»." />
            </div>
            <Note>لا يمكن لكاشير إغلاق وردية كاشير آخر. كل مستخدم مسؤول عن وردياته الخاصة فقط.</Note>
          </Section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 5. المخزون */}
          <Section {...sec("inventory")}>
            <p>تعرض وحدة المخزون الكميات الحالية لجميع الأصناف في المستودعات.</p>
            <div className="space-y-2 mt-3">
              <Step num="1" text="افتح وحدة «المخزون» من القائمة." />
              <Step num="2" text="يمكنك تصفية النتائج حسب المستودع أو الفئة أو اسم الصنف." />
              <Step num="3" text="تُظهر القائمة اسم الصنف، الوحدة، الكمية المتاحة، والمستودع." />
            </div>
            <Tip>استخدم خانة البحث للعثور على صنف معين بسرعة بدلاً من التمرير في القائمة.</Tip>
          </Section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 6. تحويل المخزون */}
          <Section {...sec("transfers")}>
            <p>تُستخدم هذه الوحدة لنقل كميات من مستودع إلى آخر.</p>
            <div className="space-y-2 mt-3">
              <Step num="1" text="افتح «تحويل المخزون» من القائمة." />
              <Step num="2" text="اختر المستودع المصدر (من) والمستودع الوجهة (إلى)." />
              <Step num="3" text="أضف الأصناف المراد تحويلها والكميات." />
              <Step num="4" text="اضغط «تأكيد التحويل»؛ ستُخصم الكمية من المصدر وتُضاف للوجهة فوراً." />
            </div>
            <Note>لا يمكن تحويل كمية أكبر من الكمية المتاحة في المستودع المصدر. حذف التحويل يعيد الكميات إلى ما كانت عليه.</Note>
          </Section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 7. المشتريات */}
          <Section {...sec("purchases")}>
            <p>سجّل فواتير الشراء من الموردين وتابع حالة الدفع لكل فاتورة.</p>
            <div className="space-y-2 mt-3">
              <Step num="1" text="افتح «المشتريات» واضغط «فاتورة شراء جديدة»." />
              <Step num="2" text="اختر المورد من القائمة المنسدلة." />
              <Step num="3" text="أضف الأصناف والكميات والأسعار." />
              <Step num="4" text="حدد طريقة الدفع: نقداً (مباشر) أو آجل (مديونية للمورد)." />
              <Step num="5" text="اضغط «حفظ الفاتورة» لإضافتها إلى النظام وتحديث المخزون." />
            </div>
            <Tip>الفواتير الآجلة تظهر في حسابات الموردين وتؤثر على رصيده المستحق.</Tip>
          </Section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 8. حسابات الموردين */}
          <Section {...sec("suppliers")}>
            <p>تتبّع مديونيات الموردين وسجّل المدفوعات لهم.</p>
            <div className="space-y-2 mt-3">
              <Step num="1" text="افتح «حسابات الموردين» لرؤية قائمة الموردين مع الرصيد المستحق لكل منهم." />
              <Step num="2" text="اضغط على اسم المورد لعرض تفاصيل حسابه وسجل المدفوعات." />
              <Step num="3" text="لتسجيل دفعة اضغط «سدّد» وأدخل المبلغ والخزنة التي ستُسحب منها." />
              <Step num="4" text="اضغط «تأكيد» لإتمام الدفع وتحديث رصيد المورد." />
            </div>
            <Note>لا يمكن دفع مبلغ أكبر من الرصيد المستحق للمورد.</Note>
          </Section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 9. الخزائن */}
          <Section {...sec("treasury")}>
            <p>تُدار من هذه الوحدة جميع العمليات المالية: إيداع، سحب، تحويل بين الخزائن.</p>

            <h3 className="font-bold text-slate-800 dark:text-white mt-4 mb-2">إيداع في الخزنة</h3>
            <div className="space-y-2">
              <Step num="1" text="اضغط «إيداع جديد»، اختر الخزنة، أدخل المبلغ والسبب ثم أكّد." />
            </div>

            <h3 className="font-bold text-slate-800 dark:text-white mt-4 mb-2">سحب من الخزنة</h3>
            <div className="space-y-2">
              <Step num="1" text="اضغط «سحب جديد»، اختر الخزنة، أدخل المبلغ والسبب ثم أكّد." />
            </div>

            <h3 className="font-bold text-slate-800 dark:text-white mt-4 mb-2">تحويل بين الخزائن</h3>
            <div className="space-y-2">
              <Step num="1" text="اضغط «تحويل»، حدد الخزنة المصدر والخزنة الوجهة والمبلغ." />
              <Step num="2" text="اضغط «تأكيد التحويل»." />
            </div>

            <Note>لا يمكن سحب أو تحويل مبلغ يتجاوز الرصيد الحالي للخزنة.</Note>
          </Section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 10. المصروفات */}
          <Section {...sec("expenses")}>
            <p>سجّل مصروفات الفرع اليومية مثل الإيجار، الكهرباء، المواصلات وغيرها.</p>
            <div className="space-y-2 mt-3">
              <Step num="1" text="افتح «المصروفات» واضغط «إضافة مصروف»." />
              <Step num="2" text="أدخل اسم المصروف، المبلغ، وحدد الخزنة التي ستُسحب منها." />
              <Step num="3" text="اضغط «حفظ»؛ سيُخصم المبلغ من الخزنة المحددة وتُضاف العملية لسجل المصروفات." />
            </div>
          </Section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 11. الموارد البشرية */}
          <Section {...sec("hr")}>
            <p>إدارة رواتب الموظفين والسلف والخصومات من خلال هذه الوحدة.</p>

            <h3 className="font-bold text-slate-800 dark:text-white mt-4 mb-2">صرف الراتب</h3>
            <div className="space-y-2">
              <Step num="1" text="افتح «الموارد البشرية» واختر الموظف." />
              <Step num="2" text="اضغط «صرف الراتب»؛ سيُحسب صافي الراتب تلقائياً بعد خصم السلف والخصومات." />
              <Step num="3" text="أكّد الصرف؛ سيُخصم المبلغ من خزنة الفرع وتُسجَّل العملية في سجل الرواتب." />
            </div>

            <h3 className="font-bold text-slate-800 dark:text-white mt-4 mb-2">تسجيل سلفة</h3>
            <div className="space-y-2">
              <Step num="1" text="اختر الموظف واضغط «إضافة سلفة»." />
              <Step num="2" text="أدخل مبلغ السلفة وتاريخها واضغط «حفظ»." />
            </div>

            <Note>لا يمكن صرف الراتب إذا كانت خزنة الفرع لا تملك رصيداً كافياً لتغطية صافي الراتب.</Note>
          </Section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 12. التوصيل */}
          <Section {...sec("delivery")}>
            <p>إدارة مناطق التوصيل، عمال التوصيل، والتسوية المالية معهم.</p>

            <h3 className="font-bold text-slate-800 dark:text-white mt-4 mb-2">إضافة عامل توصيل</h3>
            <div className="space-y-2">
              <Step num="1" text="انتقل إلى «التوصيل» ثم «عمال التوصيل»." />
              <Step num="2" text="اضغط «إضافة» وأدخل بيانات العامل وحدد المنطقة." />
            </div>

            <h3 className="font-bold text-slate-800 dark:text-white mt-4 mb-2">تسوية التوصيل</h3>
            <div className="space-y-2">
              <Step num="1" text="اختر عامل التوصيل من القائمة." />
              <Step num="2" text="اضغط «تسوية» وأدخل المبلغ المستلم منه." />
              <Step num="3" text="أكّد التسوية لتحديث رصيد المحفظة." />
            </div>

            <Note>التسوية تتطلب صلاحية «إدارة التوصيل» أو صلاحية مدير.</Note>
          </Section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 14. التقارير */}
          <Section {...sec("reports")}>
            <p>توفر وحدة التقارير رؤية شاملة لأداء الفرع والمبيعات والمالية.</p>
            <div className="space-y-2 mt-3">
              <Step num="1" text="انتقل إلى «التقارير» من القائمة." />
              <Step num="2" text="اختر نوع التقرير: ملخص يومي، مبيعات تفصيلية، مصروفات، ورديات، إلخ." />
              <Step num="3" text="حدد نطاق التاريخ والفرع المطلوب (إن كان لديك صلاحية أكثر من فرع)." />
              <Step num="4" text="اضغط «عرض» لتحميل التقرير. يمكن طباعة التقرير مباشرة بالضغط على «طباعة»." />
            </div>
            <Tip>التقارير التفصيلية تشمل: مبيعات الأصناف، حركة الخزنة، مدفوعات الموردين، ورواتب الموظفين.</Tip>
          </Section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 15. الإعدادات */}
          <Section {...sec("settings")}>
            <p>من هذه الوحدة يتم ضبط إعدادات النظام التشغيلية (بيانات الشركة، الخزائن، الورديات) وتخصيص عناصر الصفحة الرئيسية.</p>
            <div className="space-y-2 mt-3">
              <Step num="1" text="افتح «الإعدادات» من القائمة." />
              <Step num="2" text="عدّل البيانات المطلوبة مثل اسم الشركة والرقم الضريبي وإعدادات الورديات." />
              <Step num="3" text="اضغط «حفظ» لتطبيق التغييرات." />
            </div>
            <Note>تعديل الإعدادات يتطلب صلاحيات خاصة. تواصل مع المدير إذا لم تتمكن من الوصول.</Note>
          </Section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* 16. لوحة الإدارة العليا */}
          <Section {...sec("superadmin")}>
            <p>هذه اللوحة متاحة فقط للمدير الأعلى (Superadmin) وتشمل إدارة المستخدمين والصلاحيات وسجل التدقيق.</p>

            <h3 className="font-bold text-slate-800 dark:text-white mt-4 mb-2">إدارة المستخدمين</h3>
            <div className="space-y-2">
              <Step num="1" text="انتقل إلى لوحة الإدارة العليا ← إدارة المستخدمين." />
              <Step num="2" text="اضغط «إضافة مستخدم» وأدخل الاسم، اسم المستخدم، كلمة المرور، الدور، والفرع." />
              <Step num="3" text="اضغط «حفظ» لإنشاء الحساب." />
            </div>

            <h3 className="font-bold text-slate-800 dark:text-white mt-4 mb-2">إدارة الأدوار والصلاحيات</h3>
            <div className="space-y-2">
              <Step num="1" text="انتقل إلى «إدارة الأدوار» لرؤية الأدوار المتاحة." />
              <Step num="2" text="اضغط على دور لعرض صلاحياته أو تعديلها." />
              <Step num="3" text="فعّل أو أوقف الصلاحيات حسب الحاجة واضغط «حفظ»." />
            </div>

            <h3 className="font-bold text-slate-800 dark:text-white mt-4 mb-2">سجل التدقيق (Audit Trail)</h3>
            <div className="space-y-2">
              <Step num="1" text="انتقل إلى «سجل التدقيق» لمشاهدة جميع العمليات التي نفّذها المستخدمون." />
              <Step num="2" text="يمكن تصفية السجل حسب الإجراء، النوع، المستخدم، أو التاريخ." />
              <Step num="3" text="اضغط «التحقق من السلامة» للتأكد من أن السجل لم يُعبَث به." />
            </div>

            <Note>سجل التدقيق للقراءة فقط ولا يمكن حذفه أو تعديله من أي حساب.</Note>
          </Section>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700 text-center text-sm text-slate-400 dark:text-slate-500">
            <p>نظام ERP — جميع الحقوق محفوظة</p>
            <p className="mt-1">للدعم الفني تواصل مع مسؤول النظام</p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserManualPage;
