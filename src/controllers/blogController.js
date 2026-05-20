const prisma = require('../config/prismaClient')

const triggerRevalidation = async () => {
  try {
    await fetch(
      'https://alfacars.ro/api/revalidate?secret=alfacars-revalidate-2026',
      { method: 'GET' }
    )
    console.log('[Blog] Revalidation triggered successfully')
  } catch (err) {
    console.log('[Blog] Revalidation trigger failed (non-critical):', err.message)
  }
}

// Helper: generate slug from title
const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
}

// ── PUBLIC: Get all published posts for a business ──
const getPublicPosts = async (req, res) => {
  const { businessId } = req.query
  if (!businessId) {
    return res.status(400).json({ message: 'businessId este obligatoriu.' })
  }
  try {
    const posts = await prisma.blogPost.findMany({
      where: { businessId, isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        category: true,
        categoryKey: true,
        readTime: true,
        coverImage: true,
        publishedAt: true,
      },
    })
    res.status(200).json(posts)
  } catch (error) {
    console.error('[Blog] Eroare getPublicPosts:', error)
    res.status(500).json({ message: 'Eroare la preluarea articolelor.' })
  }
}

// ── PUBLIC: Get single post by slug ──
const getPublicPostBySlug = async (req, res) => {
  const { slug } = req.params
  const { businessId } = req.query
  if (!businessId) {
    return res.status(400).json({ message: 'businessId este obligatoriu.' })
  }
  try {
    const post = await prisma.blogPost.findFirst({
      where: { slug, businessId, isPublished: true },
    })
    if (!post) {
      return res.status(404).json({ message: 'Articolul nu a fost găsit.' })
    }
    res.status(200).json(post)
  } catch (error) {
    console.error('[Blog] Eroare getPublicPostBySlug:', error)
    res.status(500).json({ message: 'Eroare la preluarea articolului.' })
  }
}

// ── ADMIN: Get all posts (including drafts) ──
const getAdminPosts = async (req, res) => {
  const { businessId } = req.user
  try {
    const posts = await prisma.blogPost.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    })
    res.status(200).json(posts)
  } catch (error) {
    res.status(500).json({ message: 'Eroare la preluarea articolelor.' })
  }
}

// ── ADMIN: Create post ──
const createPost = async (req, res) => {
  const { businessId } = req.user
  const {
    title, excerpt, content, category,
    categoryKey, readTime, coverImage, isPublished
  } = req.body

  if (!title || !content || !excerpt) {
    return res.status(400).json({ message: 'Titlul, rezumatul și conținutul sunt obligatorii.' })
  }

  try {
    let slug = generateSlug(title)
    
    // Check slug uniqueness, append number if needed
    const existing = await prisma.blogPost.findFirst({
      where: { slug, businessId }
    })
    if (existing) {
      slug = `${slug}-${Date.now()}`
    }

    const post = await prisma.blogPost.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        category: category || 'General',
        categoryKey: categoryKey || 'general',
        readTime: readTime || '3 min',
        coverImage: coverImage || null,
        isPublished: isPublished || false,
        publishedAt: isPublished ? new Date() : new Date(),
        businessId,
      },
    })
    
    await triggerRevalidation()
    res.status(201).json(post)
  } catch (error) {
    console.error('[Blog] Eroare createPost:', error)
    res.status(500).json({ message: 'Eroare la crearea articolului.' })
  }
}

// ── ADMIN: Update post ──
const updatePost = async (req, res) => {
  const { postId } = req.params
  const { businessId } = req.user
  const {
    title, excerpt, content, category,
    categoryKey, readTime, coverImage, isPublished
  } = req.body

  try {
    const existing = await prisma.blogPost.findFirst({
      where: { id: postId, businessId }
    })
    if (!existing) {
      return res.status(404).json({ message: 'Articolul nu a fost găsit.' })
    }

    // Update slug if title changed
    let slug = existing.slug
    if (title && title !== existing.title) {
      slug = generateSlug(title)
      const slugExists = await prisma.blogPost.findFirst({
        where: { slug, businessId, id: { not: postId } }
      })
      if (slugExists) slug = `${slug}-${Date.now()}`
    }

    const updated = await prisma.blogPost.update({
      where: { id: postId },
      data: {
        title: title ?? existing.title,
        slug,
        excerpt: excerpt ?? existing.excerpt,
        content: content ?? existing.content,
        category: category ?? existing.category,
        categoryKey: categoryKey ?? existing.categoryKey,
        readTime: readTime ?? existing.readTime,
        coverImage: coverImage !== undefined ? coverImage : existing.coverImage,
        isPublished: isPublished !== undefined ? isPublished : existing.isPublished,
        publishedAt: (isPublished && !existing.isPublished) ? new Date() : existing.publishedAt,
      },
    })
    
    await triggerRevalidation()
    res.status(200).json(updated)
  } catch (error) {
    console.error('[Blog] Eroare updatePost:', error)
    res.status(500).json({ message: 'Eroare la actualizarea articolului.' })
  }
}

// ── ADMIN: Delete post ──
const deletePost = async (req, res) => {
  const { postId } = req.params
  const { businessId } = req.user

  try {
    const existing = await prisma.blogPost.findFirst({
      where: { id: postId, businessId }
    })
    if (!existing) {
      return res.status(404).json({ message: 'Articolul nu a fost găsit.' })
    }

    await prisma.blogPost.delete({ where: { id: postId } })
    res.status(200).json({ message: 'Articolul a fost șters.' })
  } catch (error) {
    res.status(500).json({ message: 'Eroare la ștergerea articolului.' })
  }
}

module.exports = {
  getPublicPosts,
  getPublicPostBySlug,
  getAdminPosts,
  createPost,
  updatePost,
  deletePost,
}
