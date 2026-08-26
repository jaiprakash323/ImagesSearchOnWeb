import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_image_app_2026';

// Register New User
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      likes: [],
      favourites: []
    });

    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, username: newUser.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful!',
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        likes: newUser.likes,
        favourites: newUser.favourites
      }
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: error.message || 'Server error during registration.' });
  }
});

// Login User
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        likes: user.likes,
        favourites: user.favourites
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Get Logged In User Profile & Data
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        likes: user.likes,
        favourites: user.favourites
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user profile.' });
  }
});

// Sync User Likes & Favourites to MongoDB
router.post('/sync', authMiddleware, async (req, res) => {
  try {
    const { likes, favourites } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        likes: Array.isArray(likes) ? likes : [],
        favourites: Array.isArray(favourites) ? favourites : []
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Synced successfully with MongoDB',
      likes: user.likes,
      favourites: user.favourites
    });
  } catch (error) {
    res.status(500).json({ error: 'Error syncing user data to MongoDB.' });
  }
});

export default router;
