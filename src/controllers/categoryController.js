const store = require('../services/store');

// @desc    Get all categories
// @route   GET /api/categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await store.getAllCategories();
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error in getCategories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
};

// @desc    Create a new category
// @route   POST /api/categories
exports.createCategory = async (req, res) => {
  try {
    const { name, color, icon, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    const newCategory = await store.addCategory({
      name,
      color,
      icon,
      description
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: newCategory
    });
  } catch (error) {
    console.error('Error in createCategory:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create category'
    });
  }
};

// @desc    Delete category and its records
// @route   DELETE /api/categories/:id
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await store.removeCategory(id);

    res.status(200).json({
      success: true,
      message: 'Category and its records deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteCategory:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete category'
    });
  }
};
