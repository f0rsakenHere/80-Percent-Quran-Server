const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');

// Maximum number of records that can be requested in a single page
const MAX_LIMIT = 100;

// Clamp a user-supplied limit into the range [1, MAX_LIMIT]
const clampLimit = (value, fallback) => {
  const parsed = parseInt(value);
  if (isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, MAX_LIMIT);
};

// Parse a user-supplied page number, defaulting to 1 and never below 1
const parsePage = (value) => {
  const parsed = parseInt(value);
  return isNaN(parsed) || parsed < 1 ? 1 : parsed;
};

// Escape regex metacharacters so user input is matched literally (prevents ReDoS / injection)
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @route   GET /api/words
 * @desc    Get all words with optional pagination and filtering
 * @access  Public (optional auth for personalized experience)
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const {
      type,
      minFreq,
      maxFreq,
      sortBy = 'frequency',
      order = 'desc',
    } = req.query;

    const page = parsePage(req.query.page);
    const limit = clampLimit(req.query.limit, 50);

    // Build query
    const query = {};

    if (type) {
      query.type = String(type); // coerce so ?type[$ne]=x can't inject operators
    }

    if (minFreq || maxFreq) {
      query.frequency = {};
      if (minFreq) query.frequency.$gte = parseInt(minFreq);
      if (maxFreq) query.frequency.$lte = parseInt(maxFreq);
    }

    // Build sort object — whitelist the sort field to avoid arbitrary/unindexed sorts.
    const ALLOWED_SORT = ['frequency', 'id', 'type'];
    const sortField = ALLOWED_SORT.includes(String(sortBy)) ? String(sortBy) : 'frequency';
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortOrder };

    // Execute query with pagination
    const skip = (page - 1) * limit;

    const [words, total] = await Promise.all([
      Word.find(query)
        .sort(sort)
        .limit(limit)
        .skip(skip)
        .lean(),
      Word.countDocuments(query),
    ]);

    // If user is authenticated, mark learned words
    if (req.user) {
      words.forEach((word) => {
        word.isLearned = req.user.hasLearnedWord(word.id);
      });
    }

    res.json({
      success: true,
      data: {
        words,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalWords: total,
          wordsPerPage: limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/words/learn
 * @desc    Get next words to learn (not in user's learned list)
 * @access  Private
 */
router.get('/learn', authMiddleware, async (req, res, next) => {
  try {
    const limit = clampLimit(req.query.limit, 10);

    // Find words that are NOT in the user's learned words list
    // Sorted by frequency (most frequent first)
    const unlearnedWords = await Word.find({
      id: { $nin: req.user.learnedWords },
    })
      .sort({ frequency: -1, id: 1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: {
        words: unlearnedWords,
        count: unlearnedWords.length,
        totalLearned: req.user.learnedWords.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/words/:id
 * @desc    Get a specific word by ID
 * @access  Public (optional auth)
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const word = await Word.findOne({ id: parseInt(req.params.id) }).lean();

    if (!word) {
      return res.status(404).json({
        success: false,
        message: 'Word not found',
      });
    }

    // Check if user has learned this word
    if (req.user) {
      word.isLearned = req.user.hasLearnedWord(word.id);
    }

    res.json({
      success: true,
      data: word,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/words/search/:query
 * @desc    Search words by Arabic, translation, or transliteration
 * @access  Public
 */
router.get('/search/:query', optionalAuth, async (req, res, next) => {
  try {
    const { query } = req.params;
    const limit = clampLimit(req.query.limit, 20);

    const searchRegex = new RegExp(escapeRegex(query), 'i');

    const words = await Word.find({
      $or: [
        { arabic: searchRegex },
        { translation: searchRegex },
        { english: searchRegex },
        { bangla: searchRegex },
        { transliteration: searchRegex },
      ],
    })
      .sort({ frequency: -1 })
      .limit(limit)
      .lean();

    // Mark learned words if authenticated
    if (req.user) {
      words.forEach((word) => {
        word.isLearned = req.user.hasLearnedWord(word.id);
      });
    }

    res.json({
      success: true,
      data: {
        words,
        count: words.length,
        query: query,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
