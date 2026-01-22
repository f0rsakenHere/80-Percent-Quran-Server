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
 * @route   GET /api/quran/health
 * @desc    Check if Quran API service is accessible
 * @access  Public
 */
router.get('/health', async (req, res, next) => {
  try {
    // Try to get a token to verify API connectivity
    const token = await quranService.ensureValidToken();

    res.json({
      success: true,
      message: 'Quran API service is accessible',
      data: {
        environment: quranService.environment,
        authUrl: quranService.authUrl,
        apiBaseUrl: quranService.apiBaseUrl,
        tokenValid: quranService.isTokenValid(),
      },
    });
  } catch (error) {
    console.error('❌ Quran API health check failed:', error.message);
    res.status(503).json({
      success: false,
      message: 'Quran API service is not accessible',
      error: error.message,
    });
  }
});

module.exports = router;
