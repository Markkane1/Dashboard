const mongoose = require('mongoose');
import type { Document } from 'mongoose';

const taxonomySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['category', 'sdg', 'section', 'topic'],
      trim: true,
      lowercase: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

taxonomySchema.index({ type: 1, key: 1 }, { unique: true });

taxonomySchema.virtual('id').get(function (this: Document) {
  return String(this._id);
});

module.exports = mongoose.model('Taxonomy', taxonomySchema);

export {};
