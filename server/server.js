const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Core middlewares
app.use(cors());
app.use(express.json());

// 2. Security Middleware: Serve uploads directory for static images only.
// Explicitly blocks direct static streaming of .mp4 and other video files.
app.use('/uploads', (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  const allowedImageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

  if (allowedImageExtensions.includes(ext)) {
    next(); // Pass control to express.static below
  } else {
    console.warn(`Blocked static download request for non-image file type: ${req.path}`);
    res.status(403).json({ error: "Access denied. Private resources must be requested through secure API endpoints." });
  }
}, express.static(path.join(process.cwd(), 'uploads')));

// 3. API Routers Mount
app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/video', require('./routes/video'));
app.use('/api/progress', require('./routes/progress'));

// 4. Default error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled global server exception:", err);
  res.status(500).json({ error: "An unexpected error occurred on the server." });
});

// 5. Connect to Database (Optional standalone launch support)
if (process.env.NODE_ENV !== 'test') {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/elearning';
  mongoose.connect(mongoURI)
    .then(() => {
      console.log('MongoDB successfully connected.');
      app.listen(PORT, () => {
        console.log(`Express server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('MongoDB database connection error:', err);
    });
}

module.exports = app;
