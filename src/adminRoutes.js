const express = require('express')
const router = express.Router()
const { 
  getAllUsers, 
  getAllOrders, 
  updateOrderStatus 
} = require('./databse')
const jwt = require('jsonwebtoken')

const authenticateAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const decoded = jwt.verify(token, '72')
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    req.user = decoded
    next()
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// Get all users
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await getAllUsers()
    res.json(users)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get all orders with user details
router.get('/orders', authenticateAdmin, async (req, res) => {
  try {
    const orders = await getAllOrders()
    res.json(orders)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update order status
router.put('/orders/:id', authenticateAdmin, async (req, res) => {
  try {
    const { status } = req.body
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }
    
    const result = await updateOrderStatus(req.params.id, status)
    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Order not found' })
    }
    
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router