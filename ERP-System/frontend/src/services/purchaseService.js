import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const PURCHASES_URL = `${API_BASE_URL}/purchases`;

// Map backend payment method to frontend format
const mapPaymentMethod = (backendMethod) => {
  const mapping = {
    CASH: "cash",
    CREDIT: "credit",
    MIXED: "mixed",
  };
  return mapping[backendMethod] || "cash";
};

// Map frontend payment method to backend format
const mapPaymentMethodToBackend = (frontendMethod) => {
  const mapping = {
    cash: "CASH",
    credit: "CREDIT",
    mixed: "MIXED",
  };
  return mapping[frontendMethod] || "CASH";
};

// Map backend discount type to frontend format
const mapDiscountType = (backendType) => {
  const mapping = {
    PERCENTAGE: "percent",
    VALUE: "value",
  };
  return mapping[backendType] || "percent";
};

// Map frontend discount type to backend format
const mapDiscountTypeToBackend = (frontendType) => {
  const mapping = {
    percent: "PERCENTAGE",
    value: "VALUE",
  };
  return mapping[frontendType] || "PERCENTAGE";
};

// Map backend response to frontend format
const toFrontend = (backendData) => ({
  id: backendData.id,
  supplierId: backendData.supplierId,
  treasuryId: backendData.treasuryId,
  warehouseId: backendData.warehouseId,
  supplierInvoiceNo: backendData.supplierInvoiceNo,
  paymentMethod: mapPaymentMethod(backendData.paymentMethod),
  subtotal: backendData.subtotal,
  discountType: mapDiscountType(backendData.discountType),
  discountValue: backendData.discountValue,
  discountAmount: backendData.discountAmount,
  netTotal: backendData.netTotal,
  paidAmount: backendData.paidAmount,
  remaining: backendData.remaining,
  // Map items from nested structure to frontend format
  items:
    backendData.items?.map((pi) => ({
      itemId: pi.item.id,
      name: pi.item.name,
      quantity: pi.quantity,
      purchasePrice: pi.purchasePrice,
      sellPrice: pi.sellPrice,
      total: pi.total,
    })) || [],
  supplier: backendData.supplier,
  treasury: backendData.treasury,
  warehouse: backendData.warehouse,
  createdAt: backendData.createdAt,
  updatedAt: backendData.updatedAt,
});

/**
 * Purchase API Service
 * Provides CRUD operations for purchase invoices
 */
export const purchaseService = {
  /**
   * Get all purchases
   * @returns {Promise<Array>} Array of purchases
   */
  async getAll() {
    try {
      const response = await axios.get(PURCHASES_URL);
      return response.data.map(toFrontend);
    } catch (error) {
      console.error("Error fetching purchases:", error);
      throw error;
    }
  },

  /**
   * Get purchase by ID
   * @param {number} id - Purchase ID
   * @returns {Promise<Object>} Purchase object
   */
  async getById(id) {
    try {
      const response = await axios.get(`${PURCHASES_URL}/${id}`);
      return toFrontend(response.data);
    } catch (error) {
      console.error(`Error fetching purchase ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create a new purchase
   * @param {Object} purchaseData - Purchase data
   * @returns {Promise<Object>} Created purchase
   */
  async create(purchaseData) {
    try {
      const backendData = {
        supplierId: purchaseData.supplierId,
        treasuryId: purchaseData.treasuryId,
        warehouseId: purchaseData.warehouseId,
        supplierInvoiceNo: purchaseData.supplierInvoiceNo,
        paymentMethod: mapPaymentMethodToBackend(purchaseData.paymentMethod),
        subtotal: purchaseData.subtotal,
        discountType: mapDiscountTypeToBackend(purchaseData.discountType),
        discountValue: purchaseData.discountValue,
        discountAmount: purchaseData.discountAmount,
        netTotal: purchaseData.netTotal,
        paidAmount: purchaseData.paidAmount,
        remaining: purchaseData.remaining,
        items: purchaseData.items.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          sellPrice: item.sellPrice,
          total: item.total,
        })),
      };

      const response = await axios.post(PURCHASES_URL, backendData);
      return toFrontend(response.data);
    } catch (error) {
      console.error("Error creating purchase:", error);
      throw error;
    }
  },

  /**
   * Update an existing purchase
   * @param {number} id - Purchase ID
   * @param {Object} updates - Updated purchase data
   * @returns {Promise<Object>} Updated purchase
   */
  async update(id, updates) {
    try {
      const backendData = {
        supplierId: updates.supplierId,
        treasuryId: updates.treasuryId,
        warehouseId: updates.warehouseId,
        supplierInvoiceNo: updates.supplierInvoiceNo,
        paymentMethod: mapPaymentMethodToBackend(updates.paymentMethod),
        subtotal: updates.subtotal,
        discountType: mapDiscountTypeToBackend(updates.discountType),
        discountValue: updates.discountValue,
        discountAmount: updates.discountAmount,
        netTotal: updates.netTotal,
        paidAmount: updates.paidAmount,
        remaining: updates.remaining,
        items: updates.items.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          sellPrice: item.sellPrice,
          total: item.total,
        })),
      };

      const response = await axios.put(`${PURCHASES_URL}/${id}`, backendData);
      return toFrontend(response.data);
    } catch (error) {
      console.error(`Error updating purchase ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a purchase
   * @param {number} id - Purchase ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    try {
      await axios.delete(`${PURCHASES_URL}/${id}`);
      return true;
    } catch (error) {
      console.error(`Error deleting purchase ${id}:`, error);
      throw error;
    }
  },
};
