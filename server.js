const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const yts = require('yt-search');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Función para buscar un archivo recursivamente en todo el proyecto
function searchFileRecursively(dir, targetFile) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file === 'node_modules' || file === '.git') continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        const found = searchFileRecursively(fullPath, targetFile);
        if (found) return found;
      } else if (file.toLowerCase() === targetFile.toLowerCase()) {
        return fullPath;
      }
    }
  } catch (e) {
    console.error("Error buscando archivo:", e);
  }
  return null;
}

// Servir estáticos desde todas las subcarpetas
app.use(express.static(__dirname));
try {
  const dirs = fs.readdirSync(__dirname);
  dirs.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.statSync(fullPath).isDirectory() && file !== 'node_modules' && file !== '.git') {
      app.use(express.static(fullPath));
    }
  });
} catch(e) {}

// Ruta principal para Clientes
app.get(['/', '/index.html'], (req, res) => {
  const indexPath = searchFileRecursively(__dirname, 'index.html');
  if (indexPath) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('No se encontró index.html en el repositorio.');
  }
});

// Ruta para la Tablet
app.get(['/player', '/player.html'], (req, res) => {
  const playerPath = searchFileRecursively(__dirname, 'player.html');
  if (playerPath) {
    res.sendFile(playerPath);
  } else {
    res.status(404).send('No se encontró player.html en el repositorio.');
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
