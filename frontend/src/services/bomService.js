import api from "./apiClient";

const BOM_URL = "/bom";

const toFrontend = (data) => ({
  id: data.id,
  name: data.name,
  outputItemId: data.outputItemId || null,
  outputItemName: data.outputItem?.name || "",
  outputQuantity: data.outputQuantity,
  price: data.price,
  unit: data.unit,
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
  categories:
    data.categories?.map((bc) => ({
      id: bc.category?.id || bc.categoryId,
      name: bc.category?.name || "",
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
      outputItemId: bomData.outputItemId
        ? parseInt(bomData.outputItemId)
        : null,
      outputQuantity: parseFloat(bomData.outputQuantity) || 1,
      price: parseFloat(bomData.price) || 0,
      unit: bomData.unit || "piece",
      isActive: bomData.isActive !== false,
      notes: bomData.notes || null,
      items: (bomData.items || []).map((item) => ({
        itemId: parseInt(item.itemId),
        quantity: parseFloat(item.quantity),
        notes: item.notes || null,
      })),
      categoryIds: bomData.categoryIds || [],
    };
    const data = await api.post(BOM_URL, payload);
    return toFrontend(data);
  },

  async update(id, bomData) {
    const payload = {
      name: bomData.name,
      outputItemId: bomData.outputItemId
        ? parseInt(bomData.outputItemId)
        : null,
      outputQuantity: parseFloat(bomData.outputQuantity) || 1,
      price: parseFloat(bomData.price) || 0,
      unit: bomData.unit || "piece",
      isActive: bomData.isActive !== false,
      notes: bomData.notes || null,
      items: (bomData.items || []).map((item) => ({
        itemId: parseInt(item.itemId),
        quantity: parseFloat(item.quantity),
        notes: item.notes || null,
      })),
      categoryIds: bomData.categoryIds || [],
    };
    const data = await api.put(`${BOM_URL}/${id}`, payload);
    return toFrontend(data);
  },

  async delete(id) {
    await api.delete(`${BOM_URL}/${id}`);
    return true;
  },

  async executeProduction(bomId, payload) {
    return await api.post(`${BOM_URL}/${bomId}/execute`, payload);
  },

  async getProductionOrders() {
    return await api.get(`${BOM_URL}/production-orders`);
  },

  async getProductionOrderById(id) {
    return await api.get(`${BOM_URL}/production-orders/${id}`);
  },
};
