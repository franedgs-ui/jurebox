const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const yts = require('yt-search');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let queue = [];
let currentSong = null;

// 📻 LISTA DE BÚSQUEDAS PARA EL MODO AUTOMÁTICO
// Puedes agregar o cambiar los géneros/artistas que quieras para tu local
const AUTO_PLAY_GENRES = [
  'rock en espanol clasicos',
  'pop en espanol exitos',
  'musica ambiental restaurante',
  'indie rock playlist',
  'baladas en espanol exitos',
  'lounge chillout music',
  'soda stereo exitos',
  'latin pop hits'
];

io.on('connection', (socket) => {
  socket.emit('updateQueue', { queue, currentSong });

  // Escuchar cuando el usuario busca una canción
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

  // Agregar canción elegida por un cliente
  socket.on('addSong', (song) => {
    queue.push(song);
    if (!currentSong) {
      playNext();
    } else {
      io.emit('updateQueue', { queue, currentSong });
    }
  });

  socket.on('songEnded', () => {
    playNext();
  });

  socket.on('skipSong', () => {
    playNext();
  });

  socket.on('songError', (songTitle) => {
    io.emit('songSkippedError', songTitle);
    playNext();
  });

  async function playNext() {
    if (queue.length > 0) {
      // 1. Si hay canciones pedidas por los clientes, reproduce la siguiente
      currentSong = queue.shift();
      io.emit('updateQueue', { queue, currentSong });
    } else {
      // 2. Si la cola está vacía, busca una canción aleatoria
      console.log('Cola vacia. Generando cancion automatica...');
      try {
        // Selecciona un género al azar de la lista AUTO_PLAY_GENRES
        const randomGenre = AUTO_PLAY_GENRES[Math.floor(Math.random() * AUTO_PLAY_GENRES.length)];
        const searchResults = await yts(randomGenre + ' lyric audio');
        
        if (searchResults.videos.length > 0) {
          // Elige uno de los primeros 10 resultados al azar
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

// Cambiar esto:
// server.listen(3000, ...);

// Por esto otro (para que lea el puerto dinámico de Render):
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});