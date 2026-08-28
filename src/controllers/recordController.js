const store = require('../services/store');

// Helper to get category and cash totals
const getCategoryAndCashSummary = async (categoryName, dateFilters = {}) => {
  const categoryStats = await store.getCategoryStats(categoryName, dateFilters);
  const grandTotals = await store.getGrandTotals(dateFilters);
  const cashDoc = await store.getCashSetting();

  const initialCash = cashDoc.initialCash || 0;
  const totalAvailableCash = initialCash + grandTotals.totalReceived;
  const remainingCash = totalAvailableCash - grandTotals.totalUsed;

  return {
    categoryTotal: categoryStats.totalAmount || 0,
    categoryCount: categoryStats.recordCount || 0,
    cash: {
      initialCash,
      totalReceived: grandTotals.totalReceived,
      totalAvailableCash,
      totalUsed: grandTotals.totalUsed,
      remainingCash
    }
  };
};

// @desc    Get all records for a category with search/date filters
// @route   GET /api/records/:category
exports.getRecordsByCategory = async (req, res) => {
  try {
    const rawCategory = req.params.category;
    const { search, startDate, endDate } = req.query;
    const dateFilters = { startDate, endDate };

    if (!rawCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category identifier is required'
      });
    }

    // Try finding matching category in registered list
    const categories = await store.getAllCategories();
    const categoryDoc = categories.find(
      c => c.slug === rawCategory.toLowerCase() || c.name.toLowerCase() === rawCategory.toLowerCase()
    );

    const categoryName = categoryDoc ? categoryDoc.name : decodeURIComponent(rawCategory);
    const isIncome = Boolean(categoryDoc?.isIncome || categoryName === 'Received Amount' || rawCategory.toLowerCase() === 'received-amount');

    // Fetch records (newest first)
    const records = await store.getRecords(categoryName, { search, startDate, endDate });

    // Calculate live category totals
    const summary = await getCategoryAndCashSummary(categoryName, dateFilters);

    res.status(200).json({
      success: true,
      data: {
        category: {
          name: categoryName,
          slug: categoryDoc ? categoryDoc.slug : rawCategory,
          color: categoryDoc ? categoryDoc.color : (isIncome ? '#10b981' : '#3b82f6'),
          icon: categoryDoc ? categoryDoc.icon : (isIncome ? 'wallet' : 'folder'),
          isIncome,
          totalAmount: summary.categoryTotal,
          recordCount: summary.categoryCount
        },
        filteredCount: records.length,
        records,
        cash: summary.cash
      }
    });
  } catch (error) {
    console.error('Error in getRecordsByCategory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch records',
      error: error.message
    });
  }
};

// @desc    Create a new record
// @route   POST /api/records
exports.createRecord = async (req, res) => {
  try {
    const { category, personName, amount, date, purpose, notes } = req.body;

    // Validation
    const errors = [];
    if (!category || category.trim() === '') errors.push('Category is required');
    if (!personName || personName.trim() === '') errors.push('Person name is required');
    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
      errors.push('Amount must be a number greater than 0');
    }
    if (!purpose || purpose.trim() === '') errors.push('Purpose / Work description is required');

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(', '),
        errors
      });
    }

    const newRecord = await store.addRecord({
      category: category.trim(),
      personName: personName.trim(),
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      purpose: purpose.trim(),
      notes: notes ? notes.trim() : ''
    });

    // Get updated calculations
    const summary = await getCategoryAndCashSummary(category.trim());

    res.status(201).json({
      success: true,
      message: 'Record created successfully',
      data: {
        record: newRecord,
        categoryTotal: summary.categoryTotal,
        categoryCount: summary.categoryCount,
        cash: summary.cash
      }
    });
  } catch (error) {
    console.error('Error in createRecord:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create record',
      error: error.message
    });
  }
};

// @desc    Update an existing record
// @route   PUT /api/records/:id
exports.updateRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, personName, amount, date, purpose, notes } = req.body;

    // Validation
    const errors = [];
    if (personName !== undefined && personName.trim() === '') errors.push('Person name cannot be empty');
    if (amount !== undefined && (isNaN(Number(amount)) || Number(amount) <= 0)) {
      errors.push('Amount must be a number greater than 0');
    }
    if (purpose !== undefined && purpose.trim() === '') errors.push('Purpose cannot be empty');

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(', '),
        errors
      });
    }

    const updatedRecord = await store.editRecord(id, {
      category,
      personName,
      amount,
      date,
      purpose,
      notes
    });

    // Get live updated calculations
    const summary = await getCategoryAndCashSummary(updatedRecord.category);

    res.status(200).json({
      success: true,
      message: 'Record updated successfully',
      data: {
        record: updatedRecord,
        categoryTotal: summary.categoryTotal,
        categoryCount: summary.categoryCount,
        cash: summary.cash
      }
    });
  } catch (error) {
    console.error('Error in updateRecord:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update record',
      error: error.message
    });
  }
};

// @desc    Delete a record
// @route   DELETE /api/records/:id
exports.deleteRecord = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await store.deleteRecordById(id);
    const summary = await getCategoryAndCashSummary(result.categoryName);

    res.status(200).json({
      success: true,
      message: 'Record deleted successfully',
      data: {
        deletedId: id,
        categoryTotal: summary.categoryTotal,
        categoryCount: summary.categoryCount,
        cash: summary.cash
      }
    });
  } catch (error) {
    console.error('Error in deleteRecord:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete record',
      error: error.message
    });
  }
};
