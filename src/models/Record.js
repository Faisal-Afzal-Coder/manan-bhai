const mongoose = require('mongoose');

const RecordSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true
    },
    personName: {
      type: String,
      required: [true, 'Person name is required'],
      trim: true
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0']
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
      index: true
    },
    purpose: {
      type: String,
      required: [true, 'Purpose / Work description is required'],
      trim: true
    },
    notes: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for category and date sorting
RecordSchema.index({ category: 1, date: -1 });

module.exports = mongoose.model('Record', RecordSchema);
