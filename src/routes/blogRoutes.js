const express = require('express')
const router = express.Router()
const {
  getAdminPosts,
  createPost,
  updatePost,
  deletePost,
} = require('../controllers/blogController')
const { isAuthenticated } = require('../middlewares/authMiddleware')

router.use(isAuthenticated)

router.get('/', getAdminPosts)
router.post('/', createPost)
router.put('/:postId', updatePost)
router.delete('/:postId', deletePost)

module.exports = router
