const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const AppState = require('../models/AppState');
const { authMiddleware } = require('../middleware/authMiddleware');
const { matchToken } = require('../services/wordIndex');

// Cross-device sync for opaque client progress blobs (Journey / Hifz).
const STATE_KEYS = ['journey', 'hifz'];

/**
 * @route   GET /api/progress/state/:key
 * @desc    Fetch the user's synced state blob for a key
 * @access  Private
 */
router.get('/state/:key', authMiddleware, async (req, res, next) => {
  try {
    const key = String(req.params.key);
    if (!STATE_KEYS.includes(key)) {
      return res.status(400).json({ success: false, message: 'Invalid state key' });
    }
    const doc = await AppState.findOne({ uid: req.user.uid, key }).lean();
    res.json({
      success: true,
      data: doc ? doc.data : null,
      clientUpdatedAt: doc ? doc.clientUpdatedAt : 0,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/progress/state/:key
 * @desc    Upsert the user's synced state blob for a key
 * @access  Private
 */
router.put('/state/:key', authMiddleware, async (req, res, next) => {
  try {
    const key = String(req.params.key);
    if (!STATE_KEYS.includes(key)) {
      return res.status(400).json({ success: false, message: 'Invalid state key' });
    }
    const { data, clientUpdatedAt } = req.body;
    if (data == null || typeof data !== 'object') {
      return res.status(400).json({ success: false, message: 'data must be an object' });
    }
    await AppState.findOneAndUpdate(
      { uid: req.user.uid, key },
      { data, clientUpdatedAt: Number(clientUpdatedAt) || 0 },
      { upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

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

    // Remove word from learned list (atomic / race-safe)
    await req.user.removeLearnedWord(wordId, word.frequency);

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
        progressPercentage: totalWords > 0
          ? parseFloat(((req.user.learnedWords.length / totalWords) * 100).toFixed(2))
          : 0,
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
    const parsedPage = parseInt(req.query.page);
    const parsedLimit = parseInt(req.query.limit);
    const page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 50 : Math.min(parsedLimit, 100);

    const skip = (page - 1) * limit;
    const learnedWordIds = req.user.learnedWords;

    // Get paginated learned words
    const paginatedIds = learnedWordIds.slice(skip, skip + limit);

    const words = await Word.find({ id: { $in: paginatedIds } })
      .sort({ frequency: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        words,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(learnedWordIds.length / limit),
          totalLearned: learnedWordIds.length,
          wordsPerPage: limit,
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

    // Cap + sanitize: only numeric ids, deduped, at most 100 per request
    // (prevents an authenticated user from loading the DB with a huge array).
    const ids = [...new Set(wordIds.filter((n) => Number.isInteger(n)))].slice(0, 100);
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid word ids provided' });
    }

    // Find all words
    const words = await Word.find({ id: { $in: ids } });

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

/**
 * @route   POST /api/progress/match-learn
 * @desc    Match a raw Quran verse token to an app vocabulary word and mark it
 *          learned. Used by the Reader's tap-to-add-to-deck action.
 * @access  Private
 */
router.post('/match-learn', authMiddleware, async (req, res, next) => {
  try {
    const { arabic } = req.body;
    if (!arabic || typeof arabic !== 'string') {
      return res.status(400).json({ success: false, message: 'arabic token is required' });
    }

    const match = await matchToken(arabic);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'This word is not in the vocabulary list yet',
      });
    }

    const alreadyLearned = req.user.hasLearnedWord(match.id);
    if (!alreadyLearned) {
      await req.user.addLearnedWord(match.id, match.frequency);
    }

    const word = await Word.findOne({ id: match.id })
      .select('id arabic translation transliteration bangla english frequency type')
      .lean();

    res.json({
      success: true,
      message: alreadyLearned ? 'Already in your deck' : 'Added to your deck',
      data: {
        word,
        alreadyLearned,
        totalWordsLearned: req.user.learnedWords.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/progress/vocabulary
 * @desc    Get the user's entire learned vocabulary (id + arabic only) for
 *          client-side comprehension matching. Small payload, no pagination.
 * @access  Private
 */
router.get('/vocabulary', authMiddleware, async (req, res, next) => {
  try {
    const words = await Word.find({ id: { $in: req.user.learnedWords } })
      .select('id arabic')
      .lean();

    res.json({
      success: true,
      data: { words, count: words.length },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/progress/reviews/due
 * @desc    Get words due for spaced-repetition review
 * @access  Private
 */
router.get('/reviews/due', authMiddleware, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
    const now = new Date();

    const dueIds = req.user.getDueWordIds(now);
    const totalDue = dueIds.length;
    const batchIds = dueIds.slice(0, limit);

    const words = await Word.find({ id: { $in: batchIds } })
      .select('id arabic translation transliteration bangla english frequency type')
      .lean();

    // Preserve the due order (most overdue first is fine; keep id order here)
    const byId = new Map(words.map((w) => [w.id, w]));
    const orderedWords = batchIds.map((id) => byId.get(id)).filter(Boolean);

    res.json({
      success: true,
      data: {
        words: orderedWords,
        totalDue,
        count: orderedWords.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/progress/reviews/:wordId
 * @desc    Submit a spaced-repetition grade for a word
 * @access  Private
 */
router.post('/reviews/:wordId', authMiddleware, async (req, res, next) => {
  try {
    const wordId = parseInt(req.params.wordId);
    const { quality } = req.body;

    if (isNaN(wordId)) {
      return res.status(400).json({ success: false, message: 'Invalid word id' });
    }
    if (typeof quality !== 'number' || quality < 0 || quality > 5) {
      return res.status(400).json({
        success: false,
        message: 'quality must be a number between 0 and 5',
      });
    }
    if (!req.user.hasLearnedWord(wordId)) {
      return res.status(400).json({
        success: false,
        message: 'Word must be learned before it can be reviewed',
      });
    }

    const review = await req.user.gradeReview(wordId, quality);

    res.json({
      success: true,
      message: 'Review recorded',
      data: {
        wordId,
        interval: review.interval,
        dueDate: review.dueDate,
        ease: review.ease,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
