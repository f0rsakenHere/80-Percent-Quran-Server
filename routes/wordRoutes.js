const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/words
 * @desc    Get all words with optional pagination and filtering
 * @access  Public (optional auth for personalized experience)
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      type,
      minFreq,
      maxFreq,
      sortBy = 'frequency',
      order = 'desc',
    } = req.query;

    // Build query
    const query = {};

    if (type) {
      query.type = type;
    }

    if (minFreq || maxFreq) {
      query.frequency = {};
      if (minFreq) query.frequency.$gte = parseInt(minFreq);
      if (maxFreq) query.frequency.$lte = parseInt(maxFreq);
    }

    // Build sort object
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [words, total] = await Promise.all([
      Word.find(query)
        .sort(sort)
        .limit(parseInt(limit))
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
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalWords: total,
          wordsPerPage: parseInt(limit),
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
    const { limit = 10 } = req.query;

    // Find words that are NOT in the user's learned words list
    // Sorted by frequency (most frequent first)
    const unlearnedWords = await Word.find({
      id: { $nin: req.user.learnedWords },
    })
      .sort({ frequency: -1, id: 1 })
      .limit(parseInt(limit))
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
    const { limit = 20 } = req.query;

    const searchRegex = new RegExp(query, 'i');

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
      .limit(parseInt(limit))
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
