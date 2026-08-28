const Category = require('../models/Category');
const CashSetting = require('../models/CashSetting');

const DEFAULT_CATEGORIES = [
  { name: 'Received Amount', slug: 'received-amount', order: 0, color: '#10b981', icon: 'wallet', isIncome: true },
  { name: 'Raw Material', slug: 'raw-material', order: 1, color: '#3b82f6', icon: 'cube' },
  { name: 'Labor & Wages', slug: 'labor-wages', order: 2, color: '#06b6d4', icon: 'users' },
  { name: 'Shop / Factory Rent', slug: 'shop-factory-rent', order: 3, color: '#8b5cf6', icon: 'building' },
  { name: 'Utility Bills (Bijli/Gas)', slug: 'utility-bills', order: 4, color: '#f59e0b', icon: 'zap' },
  { name: 'Transport & Fuel', slug: 'transport-fuel', order: 5, color: '#f97316', icon: 'truck' },
  { name: 'Machinery & Maintenance', slug: 'machinery-maintenance', order: 6, color: '#ec4899', icon: 'tool' }
];

const REMOVED_SLUGS = ['packaging-materials', 'tea-entertainment', 'miscellaneous-other'];
const REMOVED_NAMES = ['Packaging Materials', 'Tea & Entertainment (Kharcha)', 'Miscellaneous / Other'];

const seedDefaults = async () => {
  try {
    // Remove unwanted categories
    await Category.deleteMany({
      $or: [
        { slug: { $in: REMOVED_SLUGS } },
        { name: { $in: REMOVED_NAMES } }
      ]
    });

    for (const cat of DEFAULT_CATEGORIES) {
      const exists = await Category.findOne({
        $or: [{ slug: cat.slug }, { name: cat.name }]
      });
      if (!exists) {
        await Category.create(cat);
      } else {
        // Ensure isIncome property is updated
        if (cat.isIncome) {
          exists.isIncome = true;
          exists.order = 0;
          await exists.save();
        }
      }
    }

    const cashSetting = await CashSetting.findOne();
    if (!cashSetting) {
      await CashSetting.create({ initialCash: 0 });
    }
  } catch (error) {
    console.error('[Seed Warning]:', error.message);
  }
};

module.exports = { seedDefaults, DEFAULT_CATEGORIES, REMOVED_SLUGS, REMOVED_NAMES };
