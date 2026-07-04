const express = require('express');
const router = express.Router();
const quranService = require('../services/quranService');
const { optionalAuth } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/quran/examples
 * @desc    Get example verses for a specific Arabic word
 * @access  Public (Proxy to hide client secret)
 */
router.get('/examples', optionalAuth, async (req, res, next) => {
  try {
    // Default to Bengali (161) + English (131)
    const { word, size = 2, translations = '161,131', page = 1 } = req.query;

    if (!word) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "word" is required',
      });
    }

    // Validate size parameter
    const requestedSize = parseInt(size);
    if (isNaN(requestedSize) || requestedSize < 1 || requestedSize > 10) {
      return res.status(400).json({
        success: false,
        message: 'Size must be a number between 1 and 10',
      });
    }

    // Validate translations parameter (can be comma-separated IDs)
    // Accept both single number or comma-separated string
    const translationIds = translations.toString();
    if (!translationIds || translationIds.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Translation IDs are required',
      });
    }

    // Validate page parameter
    const requestedPage = parseInt(page);
    if (isNaN(requestedPage) || requestedPage < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page must be a number greater than 0',
      });
    }

    // Call Quran Service with translation IDs and page
    const result = await quranService.getVerses(word, requestedSize, translationIds, requestedPage);

    res.json({
      success: true,
      data: result.data,
      query: result.query,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('❌ Error in /api/quran/examples:', error.message);
    next(error);
  }
});

/**
 * @route   GET /api/quran/verse/:reference
 * @desc    Get detailed information for a specific verse
 * @access  Public
 */
router.get('/verse/:reference', optionalAuth, async (req, res, next) => {
  try {
    const { reference } = req.params;
    // Default to Bengali (161) + English (131)
    const { translations = '161,131' } = req.query;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Verse reference is required (e.g., "2:255")',
      });
    }

    // Validate verse reference format (basic validation)
    const versePattern = /^\d+:\d+$/;
    if (!versePattern.test(reference)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verse reference format. Use format "chapter:verse" (e.g., "2:255")',
      });
    }

    // Validate translations parameter (can be comma-separated IDs)
    const translationIds = translations.toString();
    if (!translationIds || translationIds.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Translation IDs are required',
      });
    }

    // Call Quran Service with translation IDs
    const result = await quranService.getVerseDetails(reference, translationIds);

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('❌ Error in /api/quran/verse:', error.message);
    next(error);
  }
});

/**
 * @route   GET /api/quran/chapters
 * @desc    List all 114 chapters (surahs) with metadata
 * @access  Public
 */
router.get('/chapters', async (req, res, next) => {
  try {
    const result = await quranService.getChapters();
    res.json({ success: true, data: result.chapters });
  } catch (error) {
    console.error('❌ Error in /api/quran/chapters:', error.message);
    next(error);
  }
});

/**
 * @route   GET /api/quran/chapter/:id
 * @desc    Get verses for a chapter (with word-by-word tokens), paginated
 * @access  Public
 */
router.get('/chapter/:id', async (req, res, next) => {
  try {
    const chapterNumber = parseInt(req.params.id);
    if (isNaN(chapterNumber) || chapterNumber < 1 || chapterNumber > 114) {
      return res.status(400).json({
        success: false,
        message: 'Chapter must be a number between 1 and 114',
      });
    }

    const { translations = '131,161' } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(req.query.perPage) || 20, 1), 50);

    const result = await quranService.getChapterVerses(
      chapterNumber,
      translations.toString(),
      page,
      perPage
    );

    res.json({
      success: true,
      data: { verses: result.verses, pagination: result.pagination },
    });
  } catch (error) {
    console.error('❌ Error in /api/quran/chapter:', error.message);
    next(error);
  }
});

/**
 * @route   GET /api/quran/health
 * @desc    Check if Quran API service is accessible
 * @access  Public
 */
router.get('/health', async (req, res) => {
  // Quran content is served from bundled local data — no external API to check.
  res.json({
    success: true,
    message: 'Quran data is served locally (offline)',
    data: {
      environment: quranService.environment, // "local"
      authUrl: quranService.authUrl,
      apiBaseUrl: quranService.apiBaseUrl,
      tokenValid: quranService.isTokenValid(),
    },
  });
});

module.exports = router;
