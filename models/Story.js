const mongoose = require('mongoose');

/**
 * Story Schema
 * Represents an inspirational story
 */
const storySchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: [true, 'Story ID is required'],
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
    },
    source: {
      type: String,
      required: [true, 'Source is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'stories',
  }
);

// Ensure virtuals are included in JSON output
storySchema.set('toJSON', { virtuals: true });
storySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Story', storySchema);
