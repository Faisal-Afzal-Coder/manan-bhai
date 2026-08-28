const mongoose = require('mongoose');

const CashSettingSchema = new mongoose.Schema(
  {
    initialCash: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Initial cash cannot be negative']
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('CashSetting', CashSettingSchema);
