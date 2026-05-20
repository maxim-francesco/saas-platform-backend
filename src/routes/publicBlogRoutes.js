const express = require('express')
const router = express.Router()
const {
  getPublicPosts,
  getPublicPostBySlug,
} = require('../controllers/blogController')
const { publicBrowseLimiter } = require('../middlewares/rateLimiter')

router.get('/', publicBrowseLimiter, getPublicPosts)
router.get('/:slug', publicBrowseLimiter, getPublicPostBySlug)

module.exports = router
