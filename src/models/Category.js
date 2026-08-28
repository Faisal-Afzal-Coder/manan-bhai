const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      unique: true
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true
    },
    order: {
      type: Number,
      default: 0
    },
    color: {
      type: String,
      default: '#3b82f6'
    },
    icon: {
      type: String,
      default: 'tag'
    },
    isIncome: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Category', CategorySchema);
