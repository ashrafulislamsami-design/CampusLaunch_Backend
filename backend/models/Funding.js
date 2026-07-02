const mongoose = require('mongoose');

const fundingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  provider: {
    type: String,
    required: true,
  },
  amount: {
    type: String, // e.g., "10 Lakh BDT"
    required: true,
  },
  deadline: {
    type: Date,
    required: true,
  },
  eligibility: {
    type: String,
  },
  category: {
    type: String,
    enum: ['Grant', 'Competition', 'Accelerator', 'Angel'],
    required: true,
  },
  applyLink: {
    type: String,
  },
  pastWinners: {
    type: String,
  }
}, { timestamps: true });

module.exports = mongoose.model('Funding', fundingSchema);
