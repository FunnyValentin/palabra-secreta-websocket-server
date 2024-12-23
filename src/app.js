import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { rooms, createRoom, joinRoom, showRooms, disconnectFromRoom } from './services/room.service.js'

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

const EVENTS = {
    CREATE_ROOM: 'createRoom',
    JOIN_ROOM: 'joinRoom',
    GET_ROOMS: 'getRooms',
    ROOM_LIST: 'roomList',
    PLAYER_LIST: 'playerList',
    PLAYER_DISCONNECT: 'playerDisconnect',
    ERROR: 'error',
};

io.on('connection', (socket) => {
    console.log("Nueva conexión: ", socket.id);

    socket.on(EVENTS.CREATE_ROOM, ({roomName, isPasswordProtected, password, maxPlayers, hostName, hostAvatar}) => {
        createRoom(roomName, isPasswordProtected, password, maxPlayers, hostName, hostAvatar, socket);
    })

    socket.on(EVENTS.JOIN_ROOM, ({roomCode, password, playerName, playerAvatar}) => {
        joinRoom(roomCode, password, playerName, playerAvatar, socket)
    })

    socket.on(EVENTS.GET_ROOMS, () => {
        const roomList = showRooms(socket);
        socket.emit(EVENTS.ROOM_LIST, roomList)
    })

    socket.on(EVENTS.PLAYER_DISCONNECT, () => {
        disconnectFromRoom(socket)
    })

});

server.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));