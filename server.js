require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Initialize SQLite database
const db = new Database('messages.db');

// Drop old table if exists and create new simplified table
db.exec(`
  DROP TABLE IF EXISTS messages;
  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Prepare statements
const getMessagesStmt = db.prepare('SELECT * FROM messages ORDER BY createdAt ASC');
const insertMessageStmt = db.prepare('INSERT INTO messages (content) VALUES (?)');

// Rate limiting (IP based)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path.startsWith('/send.html') || req.path.startsWith('/view.html') || 
           req.path.endsWith('.css') || req.path.endsWith('.js') || req.path === '/';
  }
});

app.use(express.json());
app.use(express.static('public'));
app.use('/api', limiter);

// Validation helpers
function validateMessage(content) {
  if (!content || typeof content !== 'string') return false;
  const trimmed = content.trim();
  return trimmed.length > 0 && trimmed.length <= 500;
}

// REST API
app.get('/api/messages', (req, res) => {
  try {
    const messages = getMessagesStmt.all();
    
    res.json(messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      createdAt: new Date(msg.createdAt).toISOString()
    })));
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('sendMessage', (data, callback) => {
    try {
      const { content } = data;

      if (!validateMessage(content)) {
        if (callback) callback({ error: 'Invalid input' });
        return;
      }

      const result = insertMessageStmt.run(content.trim());
      
      const messageData = {
        id: result.lastInsertRowid,
        content: content.trim(),
        createdAt: new Date().toISOString()
      };

      // Broadcast to all connected clients
      io.emit('newMessage', messageData);
      
      if (callback) callback({ success: true });
    } catch (error) {
      console.error('Error sending message:', error);
      if (callback) callback({ error: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Routes
app.get('/send', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'send.html'));
});

app.get('/view', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Send page: http://localhost:${PORT}/send`);
  console.log(`View page: http://localhost:${PORT}/view`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  db.close();
  server.close();
});

process.on('SIGINT', () => {
  db.close();
  server.close();
});
