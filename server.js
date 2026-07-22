const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const yts = require('yt-search');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Servir archivos estáticos desde cualquier carpeta donde puedan estar
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Función para buscar un archivo en la raíz, public o Público
function findFile(filename) {
  const rootPath = path.join(__dirname, filename);
  const publicPath = path.join(__dirname, 'public', filename);
  const publicoPath = path.join(__dirname, 'Público', filename);
  const publicoPath2 = path.join(__dirname, 'publico', filename);

  if (fs.existsSync(publicoPath)) return publicoPath;
  if (fs.existsSync(publicoPath2)) return publicoPath2;
  if (fs.existsSync(publicPath)) return publicPath;
  if (fs.existsSync(rootPath)) return rootPath;
  return null;
}

// Ruta Principal (Clientes)
app.get('/', (req, res) => {
  const filePath = findFile('index.html');
  if (filePath) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Error: No se encontró index.html en el repositorio.');
  }
});

// Ruta del Reproductor (Tablet)
app.get(['/player', '/player.html'], (req, res) => {
  const filePath = findFile('player.html');
  if (filePath) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Error: No se encontró player.html en el repositorio.');
  }
});

let queue = [];
let currentSong = null;

const AUTO_PLAY_GENRES = [
  'rock en espanol clasicos',
  'pop en espanol exitos',
  'musica ambiental restaurante',
  'soda stereo exitos',
  'latin pop hits'
];

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
