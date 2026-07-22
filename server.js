const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const yts = require('yt-search');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Servir archivos estáticos tanto desde la raíz como desde la carpeta public
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));

let queue = [];
let currentSong = null;

// Lista de géneros para reproducción automática
const AUTO_PLAY_GENRES = [
  'rock en espanol clasicos',
  'pop en espanol exitos',
  'musica ambiental restaurante',
  'soda stereo exitos',
  'latin pop hits'
];

// Rutas para las páginas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) res.sendFile(path.join(__dirname, 'index.html'));
  });
});

app.get('/player', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'), (err) => {
    if (err) res.sendFile(path.join(__dirname, 'player.html'));
  });
});

app.get('/player.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'), (err) => {
    if (err) res.sendFile(path.join(__dirname, 'player.html'));
  });
});

io.on('connection', (socket) => {
  socket.emit('updateQueue', { queue, currentSong });

  socket.on('searchSong', async (query) => {
    try {
      const searchResults = await yts(query + ' lyric audio');
      const videos = searchResults.videos.slice(0, 5);
      socket.emit('searchResults', videos);
    } catch (error) {
      console.error('Error al buscar en YouTube:', error);
      socket.emit('searchError', 'No se pudieron encontrar resultados.');
    }
  });

  socket.on('addSong', (song) => {
    queue.push(song);
    if (!currentSong) {
      playNext();
    } else {
      io.emit('updateQueue', { queue, currentSong });
    }
  });

  socket.on('songEnded', () => playNext());
  socket.on('skipSong', () => playNext());
  socket.on('songError', (songTitle) => {
    io.emit('songSkippedError', songTitle);
    playNext();
  });

  async function playNext() {
    if (queue.length > 0) {
      currentSong = queue.shift();
      io.emit('updateQueue', { queue, currentSong });
    } else {
      try {
        const randomGenre = AUTO_PLAY_GENRES[Math.floor(Math.random() * AUTO_PLAY_GENRES.length)];
        const searchResults = await yts(randomGenre + ' lyric audio');
        
        if (searchResults.videos.length > 0) {
          const randomIndex = Math.floor(Math.random() * Math.min(10, searchResults.videos.length));
          const randomVideo = searchResults.videos[randomIndex];
          
          currentSong = {
            id: randomVideo.videoId,
            title: `📻 (Auto) ${randomVideo.title}`
          };
        } else {
          currentSong = null;
        }
      } catch (err) {
        console.error('Error generando música automática:', err);
        currentSong = null;
      }
      io.emit('updateQueue', { queue, currentSong });
    }
  }
});

// Usar el puerto de Render o el 3000 local
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
