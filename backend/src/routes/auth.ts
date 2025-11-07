import express from 'express';
import * as db from '../database';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, artstation_username } = req.body;
    
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be between 2 and 20 characters' });
    }

    // Validate username format (alphanumeric and underscores)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }

    try {
      const user = await db.createUser(username.trim(), artstation_username?.trim());
      
      // Return user info (don't expose artstation_username - it's hidden)
      res.json({
        id: user.id,
        username: user.username,
        token: user.token,
        created_at: user.created_at
      });
    } catch (error: any) {
      if (error.message === 'USERNAME_EXISTS') {
        return res.status(409).json({ error: 'Username already exists' });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: error.message || 'Failed to register user' });
  }
});

// Login (just validate username and return token)
router.post('/login', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = await db.getUserByUsername(username.trim());
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user info with token (don't expose artstation_username - it's hidden)
    res.json({
      id: user.id,
      username: user.username,
      token: user.token,
      created_at: user.created_at
    });
  } catch (error: any) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: error.message || 'Failed to login' });
  }
});

// Get current user info
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.query.token as string;
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await db.getUserByToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json({
      id: user.id,
      username: user.username,
      // Don't return artstation_username to frontend (it's hidden)
      created_at: user.created_at
    });
  } catch (error: any) {
    console.error('Error getting user info:', error);
    res.status(500).json({ error: error.message || 'Failed to get user info' });
  }
});

// Update user (e.g., update ArtStation username)
router.patch('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.query.token as string;
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await db.getUserByToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { artstation_username } = req.body;
    const updates: Partial<db.User> = {};
    
    if (artstation_username !== undefined) {
      updates.artstation_username = artstation_username?.trim() || undefined;
    }

    const success = await db.updateUser(user.id, updates);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await db.getUserById(user.id);
    res.json({
      id: updatedUser!.id,
      username: updatedUser!.username,
      created_at: updatedUser!.created_at
    });
  } catch (error: any) {
    if (error.message === 'USERNAME_EXISTS') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
});

export default router;

