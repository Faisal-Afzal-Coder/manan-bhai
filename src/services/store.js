const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Record = require('../models/Record');
const CashSetting = require('../models/CashSetting');
const Category = require('../models/Category');
const { DEFAULT_CATEGORIES, REMOVED_SLUGS, REMOVED_NAMES } = require('../utils/seedCategories');

// Fallback file storage directory
const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const CASH_FILE = path.join(DATA_DIR, 'cash.json');

// File Helper functions
const readJSON = (filePath, defaultVal) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2));
      return defaultVal;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content || 'null') || defaultVal;
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return defaultVal;
  }
};

const writeJSON = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
  }
};

const isMongoConnected = () => mongoose.connection.readyState === 1;

// Helper to check if category is income / received
const isReceivedCategory = (categoryName) => {
  if (!categoryName) return false;
  const lower = categoryName.toLowerCase().trim();
  return lower === 'received amount' || lower === 'received-amount' || lower === 'cash received';
};

// ==================== CASH METHODS ====================
exports.getCashSetting = async () => {
  if (isMongoConnected()) {
    let doc = await CashSetting.findOne();
    if (!doc) {
      doc = await CashSetting.create({ initialCash: 0 });
    }
    return { initialCash: doc.initialCash || 0, updatedAt: doc.updatedAt };
  } else {
    let data = readJSON(CASH_FILE, { initialCash: 0, updatedAt: new Date() });
    return data;
  }
};

exports.updateCashSetting = async (initialCash) => {
  const num = Number(initialCash) || 0;
  if (isMongoConnected()) {
    let doc = await CashSetting.findOne();
    if (!doc) {
      doc = new CashSetting({ initialCash: num });
    } else {
      doc.initialCash = num;
      doc.updatedAt = new Date();
    }
    await doc.save();
    return { initialCash: doc.initialCash, updatedAt: doc.updatedAt };
  } else {
    const data = { initialCash: num, updatedAt: new Date() };
    writeJSON(CASH_FILE, data);
    return data;
  }
};

// ==================== CATEGORY METHODS ====================
exports.getAllCategories = async () => {
  if (isMongoConnected()) {
    return await Category.find({
      slug: { $nin: REMOVED_SLUGS },
      name: { $nin: REMOVED_NAMES }
    }).sort({ order: 1, name: 1 });
  } else {
    let list = readJSON(CATEGORIES_FILE, DEFAULT_CATEGORIES);
    list = list.filter(c => !REMOVED_SLUGS.includes(c.slug) && !REMOVED_NAMES.includes(c.name));
    
    // Ensure Received Amount exists
    const hasReceived = list.some(c => isReceivedCategory(c.name) || isReceivedCategory(c.slug));
    if (!hasReceived) {
      list.unshift(DEFAULT_CATEGORIES[0]);
    }
    writeJSON(CATEGORIES_FILE, list);
    return list;
  }
};

exports.addCategory = async ({ name, color, icon, description, isIncome = false }) => {
  const trimmedName = name.trim();
  const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  if (isMongoConnected()) {
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
  } else {
    let list = await exports.getAllCategories();
    const exists = list.some(c => c.name.toLowerCase() === trimmedName.toLowerCase() || c.slug === slug);
    if (exists) {
      throw new Error('A category with this name already exists');
    }
    const newCat = {
      _id: 'cat_' + Date.now(),
      name: trimmedName,
      slug,
      order: list.length + 1,
      color: color || '#3b82f6',
      icon: icon || 'folder',
      description: description || '',
      isIncome: Boolean(isIncome),
      createdAt: new Date()
    };
    list.push(newCat);
    writeJSON(CATEGORIES_FILE, list);
    return newCat;
  }
};

exports.removeCategory = async (id) => {
  if (isMongoConnected()) {
    const cat = await Category.findById(id);
    if (!cat) throw new Error('Category not found');
    await Category.findByIdAndDelete(id);
    await Record.deleteMany({
      $or: [{ category: cat.name }, { category: cat.slug }]
    });
  } else {
    let list = await exports.getAllCategories();
    const cat = list.find(c => c._id === id || c.slug === id);
    if (!cat) throw new Error('Category not found');
    list = list.filter(c => c._id !== id && c.slug !== id);
    writeJSON(CATEGORIES_FILE, list);

    let records = readJSON(RECORDS_FILE, []);
    records = records.filter(r => r.category !== cat.name && r.category !== cat.slug);
    writeJSON(RECORDS_FILE, records);
  }
};

// ==================== RECORD METHODS ====================
exports.getRecords = async (categoryName, { search, startDate, endDate } = {}) => {
  if (isMongoConnected()) {
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
  } else {
    let records = readJSON(RECORDS_FILE, []);
    return records
      .filter((r) => {
        const matchesCategory = r.category.toLowerCase() === categoryName.toLowerCase();
        if (!matchesCategory) return false;

        if (search && search.trim()) {
          const s = search.toLowerCase();
          const matchText = (r.personName && r.personName.toLowerCase().includes(s)) ||
                            (r.purpose && r.purpose.toLowerCase().includes(s)) ||
                            (r.notes && r.notes.toLowerCase().includes(s));
          if (!matchText) return false;
        }

        if (startDate && new Date(r.date) < new Date(startDate)) return false;
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (new Date(r.date) > end) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }
};

exports.addRecord = async ({ category, personName, amount, date, purpose, notes }) => {
  if (isMongoConnected()) {
    return await Record.create({
      category: category.trim(),
      personName: personName.trim(),
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      purpose: purpose.trim(),
      notes: notes ? notes.trim() : ''
    });
  } else {
    let records = readJSON(RECORDS_FILE, []);
    const newRecord = {
      _id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      category: category.trim(),
      personName: personName.trim(),
      amount: Number(amount),
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      purpose: purpose.trim(),
      notes: notes ? notes.trim() : '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    writeJSON(RECORDS_FILE, records);
    return newRecord;
  }
};

exports.editRecord = async (id, updates) => {
  if (isMongoConnected()) {
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
  } else {
    let records = readJSON(RECORDS_FILE, []);
    const idx = records.findIndex(r => r._id === id);
    if (idx === -1) throw new Error('Record not found');

    const rec = records[idx];
    if (updates.category) rec.category = updates.category.trim();
    if (updates.personName) rec.personName = updates.personName.trim();
    if (updates.amount !== undefined) rec.amount = Number(updates.amount);
    if (updates.date) rec.date = new Date(updates.date).toISOString();
    if (updates.purpose) rec.purpose = updates.purpose.trim();
    if (updates.notes !== undefined) rec.notes = updates.notes.trim();
    rec.updatedAt = new Date().toISOString();

    records[idx] = rec;
    writeJSON(RECORDS_FILE, records);
    return rec;
  }
};

exports.deleteRecordById = async (id) => {
  if (isMongoConnected()) {
    const rec = await Record.findById(id);
    if (!rec) throw new Error('Record not found');
    const categoryName = rec.category;
    await Record.findByIdAndDelete(id);
    return { id, categoryName };
  } else {
    let records = readJSON(RECORDS_FILE, []);
    const rec = records.find(r => r._id === id);
    if (!rec) throw new Error('Record not found');
    const categoryName = rec.category;
    records = records.filter(r => r._id !== id);
    writeJSON(RECORDS_FILE, records);
    return { id, categoryName };
  }
};

// ==================== AGGREGATION & CASH BALANCE CALCULATIONS ====================
exports.getCategoryStats = async (categoryName) => {
  if (isMongoConnected()) {
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
  } else {
    const records = readJSON(RECORDS_FILE, []);
    const matching = records.filter(r => r.category.toLowerCase() === categoryName.toLowerCase());
    const totalAmount = matching.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    return {
      totalAmount,
      recordCount: matching.length
    };
  }
};

exports.getAllCategoryTotals = async () => {
  if (isMongoConnected()) {
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
  } else {
    const records = readJSON(RECORDS_FILE, []);
    const map = {};
    records.forEach(r => {
      if (!map[r.category]) {
        map[r.category] = { totalAmount: 0, recordCount: 0 };
      }
      map[r.category].totalAmount += Number(r.amount) || 0;
      map[r.category].recordCount += 1;
    });
    return map;
  }
};

/**
 * Grand Totals:
 * totalReceived: Sum of records in 'Received Amount'
 * totalUsed: Sum of records in all other expense categories
 * totalAvailableCash: initialCash + totalReceived
 * remainingCash: totalAvailableCash - totalUsed
 */
exports.getGrandTotals = async () => {
  if (isMongoConnected()) {
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
  } else {
    const records = readJSON(RECORDS_FILE, []);
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
  }
};
