const store = require('../services/store');
const { REMOVED_SLUGS, REMOVED_NAMES } = require('../utils/seedCategories');

// @desc    Get dashboard metrics & category summaries
// @route   GET /api/dashboard
exports.getDashboard = async (req, res) => {
  try {
    // 1. Get initial cash setting
    const cashDoc = await store.getCashSetting();
    const initialCash = cashDoc.initialCash || 0;

    // 2. Fetch all registered categories
    const categories = await store.getAllCategories();

    // 3. Get totals map and grand totals
    const totalsMap = await store.getAllCategoryTotals();
    const grandTotals = await store.getGrandTotals();

    // 4. Map categories with live computed totals
    const categoryCards = categories
      .filter(c => !REMOVED_SLUGS.includes(c.slug) && !REMOVED_NAMES.includes(c.name))
      .map((cat) => {
        const stats = totalsMap[cat.name] || totalsMap[cat.slug] || { totalAmount: 0, recordCount: 0 };
        return {
          _id: cat._id,
          name: cat.name,
          slug: cat.slug,
          order: cat.order !== undefined ? cat.order : 99,
          color: cat.color || '#3b82f6',
          icon: cat.icon || 'folder',
          isIncome: Boolean(cat.isIncome || cat.name === 'Received Amount' || cat.slug === 'received-amount'),
          totalAmount: stats.totalAmount || 0,
          recordCount: stats.recordCount || 0
        };
      });

    // Sort so Received Amount is first or distinguished
    categoryCards.sort((a, b) => {
      if (a.isIncome) return -1;
      if (b.isIncome) return 1;
      return a.order - b.order;
    });

    const totalAvailableCash = initialCash + grandTotals.totalReceived;
    const remainingCash = totalAvailableCash - grandTotals.totalUsed;

    res.status(200).json({
      success: true,
      data: {
        cash: {
          initialCash,
          totalReceived: grandTotals.totalReceived,
          totalReceivedRecords: grandTotals.totalReceivedRecords,
          totalAvailableCash,
          totalUsed: grandTotals.totalUsed,
          totalExpenseRecords: grandTotals.totalExpenseRecords,
          remainingCash
        },
        categories: categoryCards,
        overall: {
          totalRecords: grandTotals.totalRecords,
          totalReceived: grandTotals.totalReceived,
          totalUsed: grandTotals.totalUsed
        }
      }
    });
  } catch (error) {
    console.error('Error in getDashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard metrics',
      error: error.message
    });
  }
};

// @desc    Get cash configuration and balances
// @route   GET /api/cash
exports.getCashStatus = async (req, res) => {
  try {
    const cashDoc = await store.getCashSetting();
    const grandTotals = await store.getGrandTotals();

    const initialCash = cashDoc.initialCash || 0;
    const totalAvailableCash = initialCash + grandTotals.totalReceived;
    const remainingCash = totalAvailableCash - grandTotals.totalUsed;

    res.status(200).json({
      success: true,
      data: {
        initialCash,
        totalReceived: grandTotals.totalReceived,
        totalAvailableCash,
        totalUsed: grandTotals.totalUsed,
        remainingCash,
        updatedAt: cashDoc.updatedAt
      }
    });
  } catch (error) {
    console.error('Error in getCashStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve cash status',
      error: error.message
    });
  }
};

// @desc    Update initial cash amount
// @route   PUT /api/cash
exports.updateInitialCash = async (req, res) => {
  try {
    const { initialCash } = req.body;

    if (initialCash === undefined || initialCash === null || isNaN(Number(initialCash))) {
      return res.status(400).json({
        success: false,
        message: 'A valid numeric Initial Cash amount is required'
      });
    }

    const numericCash = Number(initialCash);
    if (numericCash < 0) {
      return res.status(400).json({
        success: false,
        message: 'Initial Cash amount cannot be negative'
      });
    }

    const updatedCashDoc = await store.updateCashSetting(numericCash);
    const grandTotals = await store.getGrandTotals();
    const totalAvailableCash = numericCash + grandTotals.totalReceived;
    const remainingCash = totalAvailableCash - grandTotals.totalUsed;

    res.status(200).json({
      success: true,
      message: 'Initial Cash updated successfully',
      data: {
        initialCash: numericCash,
        totalReceived: grandTotals.totalReceived,
        totalAvailableCash,
        totalUsed: grandTotals.totalUsed,
        remainingCash,
        updatedAt: updatedCashDoc.updatedAt
      }
    });
  } catch (error) {
    console.error('Error in updateInitialCash:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update initial cash',
      error: error.message
    });
  }
};
