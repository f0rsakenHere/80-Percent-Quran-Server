const mongoose = require('mongoose');

/**
 * User Schema
 * Represents a user's progress in learning Quranic vocabulary
 */
const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: [true, 'Firebase UID is required'],
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    learnedWords: {
      type: [Number],
      default: [],
      index: true,
    },
    totalFrequencyKnown: {
      type: Number,
      default: 0,
      min: [0, 'Total frequency must be non-negative'],
    },
    displayName: {
      type: String,
      trim: true,
    },
    photoURL: {
      type: String,
      trim: true,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// Compound index for efficient queries
userSchema.index({ firebaseUid: 1, learnedWords: 1 });

/**
 * Instance method to add a learned word
 * @param {number} wordId - ID of the word learned
 * @param {number} frequency - Frequency of the word
 * @returns {Promise<User>} Updated user document
 */
userSchema.methods.addLearnedWord = async function (wordId, frequency) {
  if (!this.learnedWords.includes(wordId)) {
    this.learnedWords.push(wordId);
    this.totalFrequencyKnown += frequency;
    this.lastActive = new Date();
    return await this.save();
  }
  return this;
};

/**
 * Instance method to check if a word is learned
 * @param {number} wordId - ID of the word to check
 * @returns {boolean} True if word is learned
 */
userSchema.methods.hasLearnedWord = function (wordId) {
  return this.learnedWords.includes(wordId);
};

/**
 * Instance method to get learning progress statistics
 * @returns {Object} Progress statistics
 */
userSchema.methods.getStats = function () {
  return {
    totalWordsLearned: this.learnedWords.length,
    totalFrequencyKnown: this.totalFrequencyKnown,
    memberSince: this.createdAt,
    lastActive: this.lastActive,
  };
};

/**
 * Static method to find or create a user
 * @param {Object} userData - User data from Firebase
 * @returns {Promise<User>} User document
 */
userSchema.statics.findOrCreate = async function (userData) {
  const { uid, email, displayName, photoURL } = userData;

  let user = await this.findOne({ firebaseUid: uid });

  if (!user) {
    user = await this.create({
      firebaseUid: uid,
      email: email,
      displayName: displayName || null,
      photoURL: photoURL || null,
      learnedWords: [],
      totalFrequencyKnown: 0,
    });
    console.log(`✅ New user created: ${email}`);
  } else {
    // Update last active timestamp
    user.lastActive = new Date();
    await user.save();
  }

  return user;
};

/**
 * Pre-save hook to ensure data integrity
 */
userSchema.pre('save', function (next) {
  // Remove duplicates from learnedWords array
  this.learnedWords = [...new Set(this.learnedWords)];
  next();
});

module.exports = mongoose.model('User', userSchema);
