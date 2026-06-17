import React, { forwardRef } from 'react';

const SettlementReceipt = forwardRef(({ data }, ref) => {
    if (!data) return null;

    const { driverName, settlementId, date, orders, totalAmount, notes, user, treasury } = data;

    return (
        <>
        <style>{`
            @media print {
                .settlement-receipt, .settlement-receipt * {
                    color: #000 !important;
                    background: #fff !important;
                    border-color: #000 !important;
                    opacity: 1 !important;
                }
                .settlement-receipt table, .settlement-receipt th, .settlement-receipt td {
                    border: 1px solid #000 !important;
                }
            }
        `}</style>
        <div ref={ref} className="settlement-receipt p-8 bg-white text-black font-sans max-w-4xl mx-auto" style={{ direction: 'rtl' }}>
            {/* Header with Logo */}
            <div className="text-center mb-8 pb-6 border-b-2 border-gray-800">
                <img
                    src="/assets/logo.png"
                    alt="Logo"
                    className="w-24 h-24 mx-auto mb-4 object-contain"
                />


                <h1 className="text-3xl font-bold mb-2">إيصال توريد نقدية - تسوية طيار</h1>
                <div className="flex justify-center gap-6 text-sm text-gray-600 mt-3">
                    <span>رقم العملية: <strong>#{settlementId}</strong></span>
                    <span>|</span>
                    <span>التاريخ: <strong>{new Date(date).toLocaleString('ar-EG')}</strong></span>
                </div>
            </div>

            {/* Settlement Info */}
            <div className="mb-6 grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div className="flex flex-col">
                    <span className="text-sm text-gray-600 mb-1">اسم الطيار</span>
                    <span className="font-bold text-lg">{driverName}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm text-gray-600 mb-1">المستلم (الكاشير)</span>
                    <span className="font-bold text-lg">{user?.name || 'مدير النظام'}</span>
                </div>
                {treasury && (
                    <>
                        <div className="flex flex-col">
                            <span className="text-sm text-gray-600 mb-1">الخزنة</span>
                            <span className="font-bold text-lg">{treasury.name}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm text-gray-600 mb-1">عدد الطلبات</span>
                            <span className="font-bold text-lg">{orders.length} طلب</span>
                        </div>
                    </>
                )}
            </div>

            {/* Detailed Order Calculation Table */}
            <div className="mb-6">
                <h2 className="text-lg font-bold mb-3">تفاصيل الطلبات:</h2>
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-800 text-white">
                            <th className="py-3 px-4 text-right border border-gray-700">رقم الطلب</th>
                            <th className="py-3 px-4 text-right border border-gray-700">مبلغ الطلب</th>
                            <th className="py-3 px-4 text-right border border-gray-700">رسوم التوصيل</th>
                            <th className="py-3 px-4 text-right border border-gray-700">حصة الطيار</th>
                            <th className="py-3 px-4 text-right border border-gray-700 bg-gray-700">صافي الدين</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order, index) => {
                            const total = parseFloat(order.total) || 0;
                            const fee = parseFloat(order.deliveryFee) || 0;
                            const share = parseFloat(order.deliveryDriverShare) || 0;
                            const netDebt = total - share;

                            return (
                                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="py-2 px-4 border border-gray-300 font-medium">#{order.saleNumber}</td>
                                    <td className="py-2 px-4 border border-gray-300 text-right">{total.toFixed(2)} ج.م</td>
                                    <td className="py-2 px-4 border border-gray-300 text-right text-green-700">
                                        +{fee.toFixed(2)} ج.م
                                    </td>
                                    <td className="py-2 px-4 border border-gray-300 text-right text-red-700">
                                        -{share.toFixed(2)} ج.م
                                    </td>
                                    <td className="py-2 px-4 border border-gray-300 text-right font-bold text-lg bg-gray-100">
                                        {netDebt.toFixed(2)} ج.م
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-800 text-white">
                            <td colSpan="4" className="py-4 px-4 font-bold text-lg border border-gray-700">
                                إجمالي التوريد للخزنة:
                            </td>
                            <td className="py-4 px-4 font-bold text-2xl border border-gray-700 bg-gray-700">
                                {totalAmount.toFixed(2)} ج.م
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Calculation Formula */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-900 mb-2">طريقة الحساب:</h3>
                <p className="text-blue-800">
                    <span className="font-mono bg-white px-2 py-1 rounded">صافي الدين = إجمالي الطلب - حصة الطيار</span>
                </p>
            </div>

            {/* Notes */}
            {notes && (
                <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="font-bold text-yellow-900 mb-2">ملاحظات:</p>
                    <p className="text-yellow-800">{notes}</p>
                </div>
            )}

            {/* Signatures */}
            <div className="flex justify-around mt-12 pt-8 border-t-2 border-gray-300">
                <div className="text-center">
                    <p className="font-bold mb-8 text-lg">توقيع المستلم (الكاشير)</p>
                    <p className="border-b-2 border-gray-400 w-48 mx-auto pb-1"></p>
                    <p className="text-sm text-gray-600 mt-2">{user?.name || ''}</p>
                </div>
                <div className="text-center">
                    <p className="font-bold mb-8 text-lg">توقيع الطيار (المسلم)</p>
                    <p className="border-b-2 border-gray-400 w-48 mx-auto pb-1"></p>
                    <p className="text-sm text-gray-600 mt-2">{driverName}</p>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-xs text-gray-500 border-t pt-4">
                <p>هذا إيصال رسمي صادر من نظام ERP</p>
                <p>تم الطباعة في: {new Date().toLocaleString('ar-EG')}</p>
            </div>
        </div>
        </>
    );
});

SettlementReceipt.displayName = "SettlementReceipt";

export default SettlementReceipt;
