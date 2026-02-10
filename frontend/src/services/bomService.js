import api from "./apiClient";

const BOM_URL = "/bom";

const toFrontend = (data) => ({
  id: data.id,
  name: data.name,
  outputItemId: data.outputItemId,
  outputItemName: data.outputItem?.name || "",
  outputQuantity: data.outputQuantity,
  isActive: data.isActive,
  notes: data.notes,
  items:
    data.items?.map((bi) => ({
      id: bi.id,
      itemId: bi.itemId,
      itemName: bi.item?.name || "",
      quantity: bi.quantity,
      notes: bi.notes,
    })) || [],
  createdAt: data.createdAt,
  updatedAt: data.updatedAt,
});

export const bomService = {
  async getAll() {
    const data = await api.get(BOM_URL);
    return data.map(toFrontend);
  },

  async getById(id) {
    const data = await api.get(`${BOM_URL}/${id}`);
    return toFrontend(data);
  },

  async create(bomData) {
    const payload = {
      name: bomData.name,
      outputItemId: parseInt(bomData.outputItemId),
      outputQuantity: parseFloat(bomData.outputQuantity) || 1,
      isActive: bomData.isActive !== false,
      notes: bomData.notes || null,
      items: (bomData.items || []).map((item) => ({
        itemId: parseInt(item.itemId),
        quantity: parseFloat(item.quantity),
        notes: item.notes || null,
      })),
    };
    const data = await api.post(BOM_URL, payload);
    return toFrontend(data);
  },

  async update(id, bomData) {
    const payload = {
      name: bomData.name,
      outputItemId: parseInt(bomData.outputItemId),
      outputQuantity: parseFloat(bomData.outputQuantity) || 1,
      isActive: bomData.isActive !== false,
      notes: bomData.notes || null,
      items: (bomData.items || []).map((item) => ({
        itemId: parseInt(item.itemId),
        quantity: parseFloat(item.quantity),
        notes: item.notes || null,
      })),
    };
    const data = await api.put(`${BOM_URL}/${id}`, payload);
    return toFrontend(data);
  },

  async delete(id) {
    await api.delete(`${BOM_URL}/${id}`);
    return true;
  },
};
