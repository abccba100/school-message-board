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

const SHARED_KEY = process.env.SHARED_KEY;
if (!SHARED_KEY) {
  console.error('ERROR: SHARED_KEY environment variable is required');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;

// Initialize SQLite database
const db = new Database('messages.db');

// Create messages table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roomKey TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create index on roomKey
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_roomKey ON messages(roomKey)
`);

// Prepare statements
const getMessagesStmt = db.prepare('SELECT * FROM messages WHERE roomKey = ? ORDER BY createdAt ASC');
const insertMessageStmt = db.prepare('INSERT INTO messages (roomKey, name, content) VALUES (?, ?, ?)');

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
function validateRoomKey(roomKey) {
  if (!roomKey || typeof roomKey !== 'string') return false;
  const trimmed = roomKey.trim();
  return trimmed.length >= 1 && trimmed.length <= 100;
}

function validateName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 20;
}

function validateMessage(content) {
  if (!content || typeof content !== 'string') return false;
  const trimmed = content.trim();
  return trimmed.length > 0 && trimmed.length <= 500;
}

function verifyAccess(providedKey, roomKey) {
  // SHARED_KEY + roomKey 검증
  return providedKey === SHARED_KEY && validateRoomKey(roomKey);
}

// REST API
app.get('/api/messages', (req, res) => {
  try {
    const { roomKey, key } = req.query;
    
    if (!verifyAccess(key, roomKey)) {
      return res.status(403).json({ error: 'Invalid key or room key' });
    }

    const messages = getMessagesStmt.all(roomKey);
    
    res.json(messages.map(msg => ({
      id: msg.id,
      roomKey: msg.roomKey,
      name: msg.name,
      content: msg.content,
      createdAt: new Date(msg.createdAt).toISOString()
    })));
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.IO middleware
io.use((socket, next) => {
  const { roomKey, key } = socket.handshake.auth;
  
  if (!verifyAccess(key, roomKey)) {
    return next(new Error('Invalid key or room key'));
  }
  
  socket.roomKey = roomKey;
  next();
});

io.on('connection', (socket) => {
  const roomKey = socket.roomKey;
  socket.join(roomKey);
  console.log(`Client connected to room: ${roomKey}`);

  socket.on('sendMessage', (data, callback) => {
    try {
      const { name, message } = data;

      if (!validateName(name) || !validateMessage(message)) {
        if (callback) callback({ error: 'Invalid input' });
        return;
      }

      if (socket.roomKey !== roomKey) {
        if (callback) callback({ error: 'Room key mismatch' });
        return;
      }

      const result = insertMessageStmt.run(roomKey, name.trim(), message.trim());
      
      const messageData = {
        id: result.lastInsertRowid,
        roomKey: roomKey,
        name: name.trim(),
        content: message.trim(),
        createdAt: new Date().toISOString()
      };

      io.to(roomKey).emit('newMessage', messageData);
      
      if (callback) callback({ success: true });
    } catch (error) {
      console.error('Error sending message:', error);
      if (callback) callback({ error: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected from room: ${roomKey}`);
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
