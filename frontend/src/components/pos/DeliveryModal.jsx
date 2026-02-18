import React, { useState, useEffect } from "react";

import { deliveryZoneService } from "../../services/deliveryZoneService";
import { clientService } from "../../services/domainServices";
import AuthService from "../../services/authService";

import toast from "react-hot-toast";

const DeliveryModal = ({
  isOpen,
  onClose,
  onConfirm,
  selectedClient,
  deliveryMen,
  currentShiftId,
  branchId,
}) => {
  const [activeTab, setActiveTab] = useState("riders");
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [selectedRider, setSelectedRider] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [clientAddress, setClientAddress] = useState("");

  // Quick Zone Creation State
  const [isAddingZone, setIsAddingZone] = useState(false);
  const [isCreatingZone, setIsCreatingZone] = useState(false);
  const [newZoneData, setNewZoneData] = useState({ name: "", fee: "" });

  const handleCreateZone = async () => {
    if (!newZoneData.name.trim()) {
      toast.error("يرجى إدخال اسم المنطقة");
      return;
    }
    if (!newZoneData.fee || parseFloat(newZoneData.fee) < 0) {
      toast.error("يرجى إدخال رسوم توصيل صحيحة");
      return;
    }

    try {
      setIsCreatingZone(true);
      const payload = {
        name: newZoneData.name,
        fee: parseFloat(newZoneData.fee),
        branchId: branchId, // Start with current branch
        isActive: true,
      };

      const newZone = await deliveryZoneService.create(payload);
      toast.success("تم إضافة المنطقة بنجاح");

      // Reset form
      setNewZoneData({ name: "", fee: "" });
      setIsAddingZone(false);

      // Refresh zones and auto-select
      const updatedZones = await deliveryZoneService.getAll({
        isActive: true,
        branchId,
      });
      setDeliveryZones(updatedZones);

      // Attempt to find the newly created zone in the list to select it
      // Note: Backend might return the created object differently, but usually getAll returns list
      const createdInList = updatedZones.find(z => z.name === newZone.name);
      if (createdInList) {
        setSelectedZone(createdInList);
      } else {
        // Fallback if not found by name immediately
        setSelectedZone(newZone);
      }

    } catch (error) {
      console.error("Failed to create zone:", error);
      toast.error("فشل إضافة المنطقة");
    } finally {
      setIsCreatingZone(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDeliveryZones();
      setClientAddress(selectedClient?.address || "");
      setClientAddress(selectedClient?.address || "");
    }
  }, [isOpen, selectedClient, branchId]);

  const fetchDeliveryZones = async () => {
    try {
      const params = { isActive: true };
      if (branchId) params.branchId = branchId;

      const data = await deliveryZoneService.getAll(params);
      setDeliveryZones(data);
    } catch (error) {
      console.error("Failed to fetch delivery zones:", error);
      toast.error("فشل تحميل مناطق التوصيل");
    }
  };

  const handleConfirm = async () => {
    if (!selectedRider) {
      toast.error("يرجى اختيار طيار التوصيل");
      return;
    }

    if (!selectedZone) {
      toast.error("يرجى اختيار منطقة التوصيل");
      return;
    }

    if (!clientAddress.trim()) {
      toast.error("يرجى إضافة عنوان التوصيل");
      return;
    }

    // Auto-save address if changed
    if (selectedClient && clientAddress !== selectedClient.address) {
      try {
        await clientService.update(selectedClient.id, {
          ...selectedClient,
          address: clientAddress,
        });
      } catch (error) {
        console.error("Failed to save address:", error);
        toast.error("فشل حفظ العنوان الجديد");
        return;
      }
    }

    const confirmationPayload = {
      riderId: selectedRider.id,
      riderName: selectedRider.name,
      zoneId: selectedZone.id,
      zoneName: selectedZone.name,
      zoneFee: selectedZone.fee,
      address: clientAddress,
    };

    console.log(
      "🚚 DeliveryModal Confirming with payload:",
      confirmationPayload,
    );

    onConfirm(confirmationPayload);

    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-icons-round text-primary text-3xl">
                  local_shipping
                </span>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    إدارة التوصيل
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    العميل: {selectedClient?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <span className="material-icons-round text-gray-500">
                  close
                </span>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setActiveTab("riders")}
                className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === "riders"
                  ? "bg-primary text-white shadow-md"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}>
                <span className="material-icons-round text-sm align-middle mr-1">
                  delivery_dining
                </span>
                الطيارين
              </button>
              <button
                onClick={() => setActiveTab("zones")}
                className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === "zones"
                  ? "bg-primary text-white shadow-md"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}>
                <span className="material-icons-round text-sm align-middle mr-1">
                  map
                </span>
                المناطق
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Address Section (always visible) */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-start justify-between mb-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                  عنوان التوصيل
                </label>
              </div>
              <div className="space-y-2">
                <textarea
                  className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent resize-y min-h-[60px]"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="أدخل عنوان التوصيل..."
                  rows={2}
                />
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === "riders" && (
              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 dark:text-white mb-3">
                  اختر الطيار
                </h3>
                {deliveryMen.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    لا يوجد طيارين متاحين
                  </p>
                ) : (
                  deliveryMen.map((rider) => (
                    <button
                      key={rider.id}
                      onClick={() => setSelectedRider(rider)}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-right ${selectedRider?.id === rider.id
                        ? "border-primary bg-primary/10 dark:bg-primary/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
                        }`}>
                      <div className="flex items-center gap-3">
                        <span className="material-icons-round text-primary text-2xl">
                          delivery_dining
                        </span>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 dark:text-white">
                            {rider.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {rider.phone} • {rider.vehicleType || "غير محدد"}
                          </p>
                        </div>
                        {selectedRider?.id === rider.id && (
                          <span className="material-icons-round text-primary">
                            check_circle
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {activeTab === "zones" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    اختر المنطقة
                  </h3>
                  {AuthService.hasPermission("CREATES_DELIVERY_ZONES") && (
                    <button
                      onClick={() => setIsAddingZone(!isAddingZone)}
                      className="text-primary text-sm font-bold hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                      <span className="material-icons-round text-lg">add</span>
                      {isAddingZone ? "إلغاء الإضافة" : "منطقة جديدة"}
                    </button>
                  )}
                </div>

                {isAddingZone && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-dashed border-primary/50 mb-3 animate-fadeIn">
                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-3">
                      إضافة منطقة توصيل جديدة وسريعة
                    </h4>
                    <div className="flex gap-3 mb-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="اسم المنطقة"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                          value={newZoneData.name}
                          onChange={(e) =>
                            setNewZoneData({ ...newZoneData, name: e.target.value })
                          }
                        />
                      </div>
                      <div className="w-1/3">
                        <input
                          type="number"
                          placeholder="الرسوم"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                          value={newZoneData.fee}
                          onChange={(e) =>
                            setNewZoneData({ ...newZoneData, fee: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleCreateZone}
                      disabled={isCreatingZone}
                      className="w-full py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary-hover transition-colors disabled:opacity-50">
                      {isCreatingZone ? "جاري الإضافة..." : "حفظ المنطقة"}
                    </button>
                  </div>
                )}

                {deliveryZones.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    لا توجد مناطق توصيل متاحة
                  </p>
                ) : (
                  deliveryZones.map((zone) => (
                    <button
                      key={zone.id}
                      onClick={() => setSelectedZone(zone)}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-right ${selectedZone?.id === zone.id
                        ? "border-primary bg-primary/10 dark:bg-primary/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-primary/50"
                        }`}>
                      <div className="flex items-center gap-3">
                        <span className="material-icons-round text-primary text-2xl">
                          location_on
                        </span>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 dark:text-white">
                            {zone.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            رسوم التوصيل: {parseFloat(zone.fee).toFixed(2)} ج.م
                          </p>
                        </div>
                        {selectedZone?.id === zone.id && (
                          <span className="material-icons-round text-primary">
                            check_circle
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            {/* Summary */}
            <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  الطيار:
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {selectedRider?.name || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600 dark:text-gray-400">
                  المنطقة:
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {selectedZone?.name || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600 dark:text-gray-400">
                  رسوم التوصيل:
                </span>
                <span className="font-bold text-primary text-lg">
                  {selectedZone
                    ? `${parseFloat(selectedZone.fee).toFixed(2)} ج.م`
                    : "-"}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
                إلغاء
              </button>
              <button
                onClick={handleConfirm}
                disabled={
                  !selectedRider || !selectedZone || !clientAddress.trim()
                }
                className="flex-1 px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg">
                <span className="material-icons-round text-sm align-middle mr-1">
                  check
                </span>
                تأكيد التوصيل
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DeliveryModal;
