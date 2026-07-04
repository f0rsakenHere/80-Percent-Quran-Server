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
    // Authentic Bengali translation (Sahih Bukhari, ben-bukhari edition)
    bangla: { type: String, default: '' },
    // Bukhari book number + name this hadith belongs to
    book: { type: Number, default: 0 },
    bookName: { type: String, default: '' },
    // Topical category id (see data/hadith-categories.json)
    category: { type: String, default: 'general', index: true },
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
