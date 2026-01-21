const express = require('express');
const router = express.Router();
const Story = require('../models/Story');

/**
 * @route   GET /api/stories
 * @desc    Get all stories
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    const stories = await Story.find().sort({ id: 1 }).lean();
    res.json({
      success: true,
      data: stories
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/stories/random
 * @desc    Get a random story
 * @access  Public
 */
router.get('/random', async (req, res, next) => {
  try {
    const count = await Story.countDocuments();
    const random = Math.floor(Math.random() * count);
    const story = await Story.findOne().skip(random).lean();
    
    if (!story) {
       return res.status(404).json({
         success: false,
         message: 'No stories found'
       });
    }

    res.json({
      success: true,
      data: story
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/stories/:id
 * @desc    Get a specific story by ID
 * @access  Public
 */
router.get('/:id', async (req, res, next) => {
  try {
    const story = await Story.findOne({ id: parseInt(req.params.id) }).lean();
    if (!story) {
        return res.status(404).json({
            success: false,
            message: 'Story not found'
        });
    }
    res.json({
      success: true,
      data: story
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
