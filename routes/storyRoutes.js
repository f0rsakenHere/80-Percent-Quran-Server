const express = require('express');
const router = express.Router();
const path = require('path');
const Story = require('../models/Story');

// Topical category index (id, en, bn, count) — built by scripts/enrich-hadith.js
const CATEGORIES = require(path.join(__dirname, '..', 'data', 'hadith-categories.json'));

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @route   GET /api/stories/categories
 * @desc    List hadith topical categories with counts
 */
router.get('/categories', (req, res) => {
  res.json({ success: true, data: CATEGORIES });
});

/**
 * @route   GET /api/stories/random
 * @desc    A random hadith (optionally within a category)
 */
router.get('/random', async (req, res, next) => {
  try {
    const category = req.query.category ? String(req.query.category) : '';
    const filter = category && category !== 'all' ? { category } : {};
    const count = await Story.countDocuments(filter);
    if (!count) return res.status(404).json({ success: false, message: 'No hadiths found' });
    const random = Math.floor(Math.random() * count);
    const story = await Story.findOne(filter).skip(random).lean();
    res.json({ success: true, data: story });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/stories
 * @desc    Paginated + filterable hadith list (light projection for cards)
 * @query   category, q (search), page, limit
 */
router.get('/', async (req, res, next) => {
  try {
    // Coerce to strings so query objects (?category[$ne]=x) can't inject Mongo operators.
    const category = req.query.category ? String(req.query.category) : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);

    const filter = {};
    if (category && category !== 'all') filter.category = category;
    if (q) {
      const rx = new RegExp(escapeRx(q), 'i');
      filter.$or = [{ title: rx }, { content: rx }, { bangla: rx }];
    }

    const total = await Story.countDocuments(filter);
    const data = await Story.find(filter)
      .select('id title source category bookName content')
      .sort({ id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/stories/:id
 * @desc    A single hadith with full content + Bengali
 */
router.get('/:id', async (req, res, next) => {
  try {
    const story = await Story.findOne({ id: parseInt(req.params.id) }).lean();
    if (!story) {
      return res.status(404).json({ success: false, message: 'Hadith not found' });
    }
    res.json({ success: true, data: story });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
