const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { authMiddleware } = require('../middleware/authMiddleware');

/**
 * @route   POST /api/progress
 * @desc    Mark a word as learned
 * @access  Private
 */
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { wordId } = req.body;

    if (!wordId) {
      return res.status(400).json({
        success: false,
        message: 'wordId is required',
      });
    }

    // Find the word
    const word = await Word.findOne({ id: parseInt(wordId) });

    if (!word) {
      return res.status(404).json({
        success: false,
        message: 'Word not found',
      });
    }

    // Check if already learned
    if (req.user.hasLearnedWord(word.id)) {
      return res.status(400).json({
        success: false,
        message: 'Word already marked as learned',
        data: {
          wordId: word.id,
          alreadyLearned: true,
        },
      });
    }

    // Add word to learned list
    await req.user.addLearnedWord(word.id, word.frequency);

    res.json({
      success: true,
      message: 'Word marked as learned',
      data: {
        wordId: word.id,
        word: word.arabic,
        translation: word.translation,
        frequency: word.frequency,
        totalWordsLearned: req.user.learnedWords.length,
        totalFrequencyKnown: req.user.totalFrequencyKnown,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/progress/:wordId
 * @desc    Remove a word from learned list (unlearn)
 * @access  Private
 */
router.delete('/:wordId', authMiddleware, async (req, res, next) => {
  try {
    const wordId = parseInt(req.params.wordId);

    // Find the word
    const word = await Word.findOne({ id: wordId });

    if (!word) {
      return res.status(404).json({
        success: false,
        message: 'Word not found',
      });
    }

    // Check if word is in learned list
    if (!req.user.hasLearnedWord(wordId)) {
      return res.status(400).json({
        success: false,
        message: 'Word is not in learned list',
      });
    }

    // Remove word from learned list
    req.user.learnedWords = req.user.learnedWords.filter((id) => id !== wordId);
    req.user.totalFrequencyKnown -= word.frequency;
    req.user.lastActive = new Date();
    await req.user.save();

    res.json({
      success: true,
      message: 'Word removed from learned list',
      data: {
        wordId: word.id,
        totalWordsLearned: req.user.learnedWords.length,
        totalFrequencyKnown: req.user.totalFrequencyKnown,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/progress/stats
 * @desc    Get user's learning statistics
 * @access  Private
 */
router.get('/stats', authMiddleware, async (req, res, next) => {
  try {
    const stats = req.user.getStats();

    // Calculate additional statistics
    const totalWords = await Word.countDocuments();
    const totalQuranFrequency = await Word.aggregate([
      { $group: { _id: null, total: { $sum: '$frequency' } } },
    ]);

    const totalFrequency = totalQuranFrequency[0]?.total || 0;
    const coveragePercentage = totalFrequency > 0 
      ? ((req.user.totalFrequencyKnown / totalFrequency) * 100).toFixed(2)
      : 0;

    // Get most recent learned words
    const recentLearnedIds = req.user.learnedWords.slice(-5).reverse();
    const recentWords = await Word.find({ id: { $in: recentLearnedIds } })
      .select('id arabic translation transliteration frequency')
      .lean();

    // Sort recent words by the order they were learned
    const sortedRecentWords = recentLearnedIds.map(id =>
      recentWords.find(word => word.id === id)
    ).filter(Boolean);

    res.json({
      success: true,
      data: {
        ...stats,
        totalAvailableWords: totalWords,
        quranCoveragePercentage: parseFloat(coveragePercentage),
        progressPercentage: ((req.user.learnedWords.length / totalWords) * 100).toFixed(2),
        recentlyLearned: sortedRecentWords,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/progress/learned
 * @desc    Get all learned words for the user
 * @access  Private
 */
router.get('/learned', authMiddleware, async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const learnedWordIds = req.user.learnedWords;

    // Get paginated learned words
    const paginatedIds = learnedWordIds.slice(skip, skip + parseInt(limit));

    const words = await Word.find({ id: { $in: paginatedIds } })
      .sort({ frequency: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        words,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(learnedWordIds.length / parseInt(limit)),
          totalLearned: learnedWordIds.length,
          wordsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/progress/batch
 * @desc    Mark multiple words as learned at once
 * @access  Private
 */
router.post('/batch', authMiddleware, async (req, res, next) => {
  try {
    const { wordIds } = req.body;

    if (!Array.isArray(wordIds) || wordIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'wordIds must be a non-empty array',
      });
    }

    // Find all words
    const words = await Word.find({ id: { $in: wordIds } });

    if (words.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid words found',
      });
    }

    // Add each word to learned list
    let addedCount = 0;
    for (const word of words) {
      if (!req.user.hasLearnedWord(word.id)) {
        await req.user.addLearnedWord(word.id, word.frequency);
        addedCount++;
      }
    }

    res.json({
      success: true,
      message: `${addedCount} words marked as learned`,
      data: {
        addedCount,
        totalWordsLearned: req.user.learnedWords.length,
        totalFrequencyKnown: req.user.totalFrequencyKnown,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
