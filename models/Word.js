const mongoose = require('mongoose');

/**
 * Word Schema
 * Represents a Quranic word with its translation and metadata
 */
const wordSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: [true, 'Word ID is required'],
      unique: true,
      index: true,
    },
    arabic: {
      type: String,
      required: [true, 'Arabic text is required'],
      trim: true,
    },
    translation: {
      type: String,
      required: [true, 'Translation is required'],
      trim: true,
    },
    transliteration: {
      type: String,
      required: [true, 'Transliteration is required'],
      trim: true,
    },
    frequency: {
      type: Number,
      required: [true, 'Frequency is required'],
      min: [0, 'Frequency must be a positive number'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Word type is required'],
      enum: {
        values: ['Noun', 'Verb', 'Particle', 'Adjective', 'Pronoun', 'Preposition', 'Other'],
        message: '{VALUE} is not a valid word type',
      },
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'words',
  }
);

// Compound index for efficient sorting and filtering
wordSchema.index({ frequency: -1, id: 1 });

// Virtual for formatted display
wordSchema.virtual('display').get(function () {
  return `${this.arabic} (${this.transliteration}) - ${this.translation}`;
});

// Ensure virtuals are included in JSON output
wordSchema.set('toJSON', { virtuals: true });
wordSchema.set('toObject', { virtuals: true });

/**
 * Static method to get words by frequency range
 * @param {number} minFreq - Minimum frequency
 * @param {number} maxFreq - Maximum frequency
 * @returns {Promise<Array>} Array of words
 */
wordSchema.statics.getByFrequencyRange = function (minFreq, maxFreq) {
  return this.find({
    frequency: { $gte: minFreq, $lte: maxFreq },
  }).sort({ frequency: -1 });
};

/**
 * Static method to get top N most frequent words
 * @param {number} limit - Number of words to return
 * @returns {Promise<Array>} Array of words
 */
wordSchema.statics.getTopWords = function (limit = 100) {
  return this.find().sort({ frequency: -1 }).limit(limit);
};

module.exports = mongoose.model('Word', wordSchema);
