const express = require('express');
const router = express.Router();

const { login } = require('../controllers/authController');

const {
  getDashboard,
  getCashStatus,
  updateInitialCash
} = require('../controllers/dashboardController');

const {
  getRecordsByCategory,
  createRecord,
  updateRecord,
  deleteRecord
} = require('../controllers/recordController');

const {
  getCategories,
  createCategory,
  deleteCategory
} = require('../controllers/categoryController');

// Auth routes
router.post('/auth/login', login);

// Dashboard & Cash routes
router.get('/dashboard', getDashboard);
router.get('/cash', getCashStatus);
router.put('/cash', updateInitialCash);

// Category management routes
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.delete('/categories/:id', deleteCategory);

// Record routes
router.get('/records/:category', getRecordsByCategory);
router.post('/records', createRecord);
router.put('/records/:id', updateRecord);
router.delete('/records/:id', deleteRecord);

module.exports = router;
