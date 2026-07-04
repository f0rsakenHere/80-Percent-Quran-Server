const mongoose = require('mongoose');

/**
 * Spaced-repetition schedule entry for a single word (SM-2 algorithm).
 */
const reviewSchema = new mongoose.Schema(
  {
    wordId: { type: Number, required: true },
    ease: { type: Number, default: 2.5 }, // SM-2 ease factor (min 1.3)
    interval: { type: Number, default: 0 }, // days until next review
    repetitions: { type: Number, default: 0 }, // consecutive successful recalls
    dueDate: { type: Date, default: Date.now },
    lastReviewedAt: { type: Date },
  },
  { _id: false }
);

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
    reviews: {
      type: [reviewSchema],
      default: [],
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
  // Atomic, race-safe update: $addToSet prevents duplicates and the
  // `learnedWords: { $ne: wordId }` filter guarantees the frequency is only
  // incremented when the word was genuinely added (never double-counted).
  const result = await this.constructor.updateOne(
    { _id: this._id, learnedWords: { $ne: wordId } },
    {
      $addToSet: { learnedWords: wordId },
      $inc: { totalFrequencyKnown: frequency },
      $set: { lastActive: new Date() },
    }
  );

  // Reflect the persisted change in the in-memory document
  if (result.modifiedCount > 0) {
    this.learnedWords.push(wordId);
    this.totalFrequencyKnown += frequency;
    this.lastActive = new Date();
  }
  return this;
};

/**
 * Instance method to remove a learned word (atomic / race-safe)
 * @param {number} wordId - ID of the word to remove
 * @param {number} frequency - Frequency of the word
 * @returns {Promise<User>} Updated user document
 */
userSchema.methods.removeLearnedWord = async function (wordId, frequency) {
  // Only decrement when the word is actually present, keeping the running
  // total consistent even under concurrent requests.
  const result = await this.constructor.updateOne(
    { _id: this._id, learnedWords: wordId },
    {
      $pull: { learnedWords: wordId },
      $inc: { totalFrequencyKnown: -frequency },
      $set: { lastActive: new Date() },
    }
  );

  if (result.modifiedCount > 0) {
    this.learnedWords = this.learnedWords.filter((id) => id !== wordId);
    this.totalFrequencyKnown -= frequency;
    this.lastActive = new Date();
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
 * Get the word ids that are due for spaced-repetition review.
 * A learned word with no review entry yet is treated as immediately due (new),
 * so no migration / init-on-learn is required.
 * @param {Date} now - Reference time
 * @returns {number[]} Due word ids
 */
userSchema.methods.getDueWordIds = function (now = new Date()) {
  const reviewMap = new Map(this.reviews.map((r) => [r.wordId, r]));
  const due = [];
  for (const id of this.learnedWords) {
    const r = reviewMap.get(id);
    if (!r || new Date(r.dueDate) <= now) due.push(id);
  }
  return due;
};

/**
 * Apply an SM-2 grade to a word's review schedule.
 * @param {number} wordId - Word being reviewed
 * @param {number} quality - Recall quality 0-5 (Again=1, Hard=3, Good=4, Easy=5)
 * @param {Date} now - Reference time
 * @returns {Promise<Object>} The updated review entry
 */
userSchema.methods.gradeReview = async function (wordId, quality, now = new Date()) {
  let review = this.reviews.find((r) => r.wordId === wordId);
  if (!review) {
    review = { wordId, ease: 2.5, interval: 0, repetitions: 0, dueDate: now };
    this.reviews.push(review);
    review = this.reviews[this.reviews.length - 1];
  }

  const q = Math.max(0, Math.min(5, quality));

  if (q < 3) {
    // Failed recall: reset repetitions, see it again tomorrow
    review.repetitions = 0;
    review.interval = 1;
  } else {
    if (review.repetitions === 0) review.interval = 1;
    else if (review.repetitions === 1) review.interval = 6;
    else review.interval = Math.round(review.interval * review.ease);
    review.repetitions += 1;
  }

  // Update ease factor (SM-2), clamped to a 1.3 floor
  review.ease = Math.max(1.3, review.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  const next = new Date(now);
  next.setDate(next.getDate() + review.interval);
  review.dueDate = next;
  review.lastReviewedAt = now;

  await this.save();
  return review;
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
