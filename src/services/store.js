const mongoose = require('mongoose');
const Record = require('../models/Record');
const CashSetting = require('../models/CashSetting');
const Category = require('../models/Category');
const { REMOVED_SLUGS, REMOVED_NAMES } = require('../utils/seedCategories');

const ensureMongoConnected = () => {
  if (mongoose.connection.readyState !== 1) {
    const error = new Error('Database connection unavailable. MongoDB Atlas must be connected before using the application.');
    error.status = 503;
    throw error;
  }
};

// Helper to check if category is income / received
const isReceivedCategory = (categoryName) => {
  if (!categoryName) return false;
  const lower = categoryName.toLowerCase().trim();
  return lower === 'received amount' || lower === 'received-amount' || lower === 'cash received';
};

// ==================== CASH METHODS ====================
exports.getCashSetting = async () => {
  ensureMongoConnected();
  let doc = await CashSetting.findOne();
  if (!doc) {
    doc = await CashSetting.create({ initialCash: 0 });
  }
  return { initialCash: doc.initialCash || 0, updatedAt: doc.updatedAt };
};

exports.updateCashSetting = async (initialCash) => {
  ensureMongoConnected();
  const num = Number(initialCash) || 0;
  let doc = await CashSetting.findOne();
  if (!doc) {
    doc = new CashSetting({ initialCash: num });
  } else {
    doc.initialCash = num;
    doc.updatedAt = new Date();
  }
  await doc.save();
  return { initialCash: doc.initialCash, updatedAt: doc.updatedAt };
};

// ==================== CATEGORY METHODS ====================
exports.getAllCategories = async () => {
  ensureMongoConnected();
  return await Category.find({
    slug: { $nin: REMOVED_SLUGS },
    name: { $nin: REMOVED_NAMES }
  }).sort({ order: 1, name: 1 });
};

exports.addCategory = async ({ name, color, icon, description, isIncome = false }) => {
  ensureMongoConnected();
  const trimmedName = name.trim();
  const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const existing = await Category.findOne({
    $or: [{ name: new RegExp(`^${trimmedName}$`, 'i') }, { slug }]
  });
  if (existing) {
    throw new Error('A category with this name already exists');
  }
  const count = await Category.countDocuments();
  return await Category.create({
    name: trimmedName,
    slug,
    order: count + 1,
    color: color || '#3b82f6',
    icon: icon || 'folder',
    description: description || '',
    isIncome: Boolean(isIncome)
  });
};

exports.removeCategory = async (id) => {
  ensureMongoConnected();
  const cat = await Category.findById(id);
  if (!cat) throw new Error('Category not found');
  await Category.findByIdAndDelete(id);
  await Record.deleteMany({
    $or: [{ category: cat.name }, { category: cat.slug }]
  });
};

// ==================== RECORD METHODS ====================
exports.getRecords = async (categoryName, { search, startDate, endDate } = {}) => {
  ensureMongoConnected();
  const query = {
    $or: [
      { category: categoryName },
      { category: new RegExp(`^${categoryName}$`, 'i') }
    ]
  };

  if (search && search.trim() !== '') {
    const regex = new RegExp(search.trim(), 'i');
    query.$and = query.$and || [];
    query.$and.push({
      $or: [{ personName: regex }, { purpose: regex }, { notes: regex }]
    });
  }

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  return await Record.find(query).sort({ date: -1, createdAt: -1 });
};

exports.addRecord = async ({ category, personName, amount, date, purpose, notes }) => {
  ensureMongoConnected();
  return await Record.create({
    category: category.trim(),
    personName: personName.trim(),
    amount: Number(amount),
    date: date ? new Date(date) : new Date(),
    purpose: purpose.trim(),
    notes: notes ? notes.trim() : ''
  });
};

exports.editRecord = async (id, updates) => {
  ensureMongoConnected();
  const existing = await Record.findById(id);
  if (!existing) throw new Error('Record not found');

  if (updates.category) existing.category = updates.category.trim();
  if (updates.personName) existing.personName = updates.personName.trim();
  if (updates.amount !== undefined) existing.amount = Number(updates.amount);
  if (updates.date) existing.date = new Date(updates.date);
  if (updates.purpose) existing.purpose = updates.purpose.trim();
  if (updates.notes !== undefined) existing.notes = updates.notes.trim();
  existing.updatedAt = new Date();

  return await existing.save();
};

exports.deleteRecordById = async (id) => {
  ensureMongoConnected();
  const rec = await Record.findById(id);
  if (!rec) throw new Error('Record not found');
  const categoryName = rec.category;
  await Record.findByIdAndDelete(id);
  return { id, categoryName };
};

// ==================== AGGREGATION & CASH BALANCE CALCULATIONS ====================
exports.getCategoryStats = async (categoryName) => {
  ensureMongoConnected();
  const stats = await Record.aggregate([
    { $match: { category: categoryName } },
    {
      $group: {
        _id: '$category',
        totalAmount: { $sum: '$amount' },
        recordCount: { $sum: 1 }
      }
    }
  ]);
  return {
    totalAmount: stats.length > 0 ? stats[0].totalAmount : 0,
    recordCount: stats.length > 0 ? stats[0].recordCount : 0
  };
};

exports.getAllCategoryTotals = async () => {
  ensureMongoConnected();
  const totals = await Record.aggregate([
    {
      $group: {
        _id: '$category',
        totalAmount: { $sum: '$amount' },
        recordCount: { $sum: 1 }
      }
    }
  ]);
  const map = {};
  totals.forEach(t => {
    map[t._id] = { totalAmount: t.totalAmount, recordCount: t.recordCount };
  });
  return map;
};

/**
 * Grand Totals:
 * totalReceived: Sum of records in 'Received Amount'
 * totalUsed: Sum of records in all other expense categories
 * totalAvailableCash: initialCash + totalReceived
 * remainingCash: totalAvailableCash - totalUsed
 */
exports.getGrandTotals = async () => {
  ensureMongoConnected();
  const records = await Record.find();
  let totalReceived = 0;
  let totalReceivedRecords = 0;
  let totalUsed = 0;
  let totalExpenseRecords = 0;

  records.forEach((r) => {
    if (isReceivedCategory(r.category)) {
      totalReceived += Number(r.amount) || 0;
      totalReceivedRecords += 1;
    } else {
      totalUsed += Number(r.amount) || 0;
      totalExpenseRecords += 1;
    }
  });

  return {
    totalReceived,
    totalReceivedRecords,
    totalUsed,
    totalExpenseRecords,
    totalRecords: records.length
  };
};
