// controllers/bulk/bulkCustomer.controller.js
const prisma = require("../../config/database");

function trimOrNull(value) {
  if (typeof value !== "string") return value ?? null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

function parseCreditLimit(raw) {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error("creditLimit must be a non-negative number or null");
    err.status = 400;
    throw err;
  }
  return n;
}

// GET /api/bulk/customers?search=foo&active=true
exports.list = async (req, res, next) => {
  try {
    const { search, active } = req.query;
    const where = {};
    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;
    if (search && search.trim()) {
      const s = search.trim();
      where.OR = [
        { companyName: { contains: s } },
        { tradeName: { contains: s } },
        { taxNumber: { contains: s } },
        { primaryContactPhone: { contains: s } },
        { primaryContactName: { contains: s } },
      ];
    }
    const customers = await prisma.bulkCustomer.findMany({
      where,
      orderBy: { companyName: "asc" },
      select: {
        id: true,
        companyName: true,
        tradeName: true,
        taxNumber: true,
        primaryContactName: true,
        primaryContactPhone: true,
        primaryContactEmail: true,
        creditLimit: true,
        isActive: true,
        createdAt: true,
      },
    });
    res.json(customers);
  } catch (err) {
    next(err);
  }
};

// GET /api/bulk/customers/:id
exports.detail = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const customer = await prisma.bulkCustomer.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { id: "asc" } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (err) {
    next(err);
  }
};

// POST /api/bulk/customers
exports.create = async (req, res, next) => {
  try {
    const body = req.body || {};
    const companyName = trimOrNull(body.companyName);
    const primaryContactName = trimOrNull(body.primaryContactName);
    const primaryContactPhone = trimOrNull(body.primaryContactPhone);
    const shippingAddress = trimOrNull(body.shippingAddress);

    if (!companyName) return res.status(400).json({ error: "companyName is required" });
    if (!primaryContactName) return res.status(400).json({ error: "primaryContactName is required" });
    if (!primaryContactPhone) return res.status(400).json({ error: "primaryContactPhone is required" });
    if (!shippingAddress) return res.status(400).json({ error: "shippingAddress is required" });

    const taxNumber = trimOrNull(body.taxNumber);
    if (taxNumber) {
      const dup = await prisma.bulkCustomer.findUnique({ where: { taxNumber } });
      if (dup) return res.status(409).json({ error: "Tax number already exists" });
    }

    const creditLimit = parseCreditLimit(body.creditLimit);

    const created = await prisma.bulkCustomer.create({
      data: {
        companyName,
        tradeName: trimOrNull(body.tradeName),
        taxNumber,
        primaryContactName,
        primaryContactPhone,
        primaryContactEmail: trimOrNull(body.primaryContactEmail),
        shippingAddress,
        creditLimit: creditLimit === undefined ? null : creditLimit,
        notes: trimOrNull(body.notes),
        createdByUserId: req.user?.id ?? null,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/bulk/customers/:id
exports.update = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const existing = await prisma.bulkCustomer.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Customer not found" });

    const body = req.body || {};
    const data = {};
    if (body.companyName !== undefined) {
      const v = trimOrNull(body.companyName);
      if (!v) return res.status(400).json({ error: "companyName cannot be empty" });
      data.companyName = v;
    }
    if (body.tradeName !== undefined) data.tradeName = trimOrNull(body.tradeName);
    if (body.taxNumber !== undefined) {
      const v = trimOrNull(body.taxNumber);
      if (v && v !== existing.taxNumber) {
        const dup = await prisma.bulkCustomer.findUnique({ where: { taxNumber: v } });
        if (dup) return res.status(409).json({ error: "Tax number already exists" });
      }
      data.taxNumber = v;
    }
    if (body.primaryContactName !== undefined) {
      const v = trimOrNull(body.primaryContactName);
      if (!v) return res.status(400).json({ error: "primaryContactName cannot be empty" });
      data.primaryContactName = v;
    }
    if (body.primaryContactPhone !== undefined) {
      const v = trimOrNull(body.primaryContactPhone);
      if (!v) return res.status(400).json({ error: "primaryContactPhone cannot be empty" });
      data.primaryContactPhone = v;
    }
    if (body.primaryContactEmail !== undefined) data.primaryContactEmail = trimOrNull(body.primaryContactEmail);
    if (body.shippingAddress !== undefined) {
      const v = trimOrNull(body.shippingAddress);
      if (!v) return res.status(400).json({ error: "shippingAddress cannot be empty" });
      data.shippingAddress = v;
    }
    if (body.creditLimit !== undefined) {
      const v = parseCreditLimit(body.creditLimit);
      data.creditLimit = v === undefined ? null : v;
    }
    if (body.notes !== undefined) data.notes = trimOrNull(body.notes);
    if (body.isActive !== undefined) data.isActive = !!body.isActive;

    const updated = await prisma.bulkCustomer.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// POST /api/bulk/customers/:id/contacts
exports.addContact = async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (!Number.isFinite(customerId)) return res.status(400).json({ error: "Invalid id" });
    const customer = await prisma.bulkCustomer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const body = req.body || {};
    const name = trimOrNull(body.name);
    const phone = trimOrNull(body.phone);
    if (!name || !phone) return res.status(400).json({ error: "name and phone are required" });

    const contact = await prisma.bulkCustomerContact.create({
      data: {
        customerId,
        name,
        phone,
        email: trimOrNull(body.email),
        role: trimOrNull(body.role),
      },
    });
    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/bulk/customers/:id/contacts/:contactId
exports.removeContact = async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    const contactId = parseInt(req.params.contactId, 10);
    if (!Number.isFinite(customerId) || !Number.isFinite(contactId)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const contact = await prisma.bulkCustomerContact.findUnique({ where: { id: contactId } });
    if (!contact || contact.customerId !== customerId) {
      return res.status(404).json({ error: "Contact not found" });
    }
    await prisma.bulkCustomerContact.delete({ where: { id: contactId } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
