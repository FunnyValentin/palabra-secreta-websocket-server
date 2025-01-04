import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { rooms, createRoom, joinRoom, showRooms, disconnectFromRoom, getRoomInfo, setChoosingCategory, startGame } from './services/room.service.js'

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
    ROOM_CREATED: 'roomCreated',
    JOIN_ROOM: 'joinRoom',
    JOINED_ROOM: 'joinedRoom',
    GET_ROOMS: 'getRooms',
    ROOM_LIST: 'roomList',
    GET_ROOM_INFO: 'getRoomInfo',
    ROOM_INFO: 'roomInfo',
    PLAYER_LIST: 'playerList',
    PLAYER_DISCONNECT: 'playerDisconnect',
    SET_CHOOSING_CATEGORY: 'setChoosingCategory',
    START_GAME: 'startGame',
    UPDATE_GAMESTATE: 'updateGameState',
    ERROR: 'error',
};

io.on('connection', (socket) => {
    console.log("Nueva conexión:", socket.id);

    socket.on(EVENTS.CREATE_ROOM, ({roomName, isPasswordProtected, password, maxPlayers, hostName, hostAvatar}) => {
        const roomCode = createRoom(roomName, isPasswordProtected, password, maxPlayers, hostName, hostAvatar, socket);
        socket.join(roomCode);
        socket.emit(EVENTS.ROOM_CREATED, {roomCode})
        console.log("Sala creada:", roomCode)
    })

    socket.on(EVENTS.JOIN_ROOM, ({roomCode, password, playerName, playerAvatar}) => {
        const roomInfo = joinRoom(roomCode, password, playerName, playerAvatar, socket);
        socket.join(roomCode);
        socket.emit(EVENTS.JOINED_ROOM, { roomCode });
        io.to(roomCode).emit(EVENTS.ROOM_INFO, roomInfo);
        console.log("Unido a la sala:", roomCode, "- Jugador:" ,socket.id);
    })

    socket.on(EVENTS.GET_ROOMS, () => {
        const roomList = showRooms(socket);
        socket.emit(EVENTS.ROOM_LIST, roomList)
        console.log("Lista de salas:", roomList)
    })

    socket.on(EVENTS.PLAYER_DISCONNECT, () => {
        const {roomCode, playerList} = disconnectFromRoom(socket);
        io.to(roomCode).emit(EVENTS.PLAYER_LIST, playerList);
        console.log("Se desconecto un jugador, lista actualizada:", playerList);
    })

    socket.on(EVENTS.GET_ROOM_INFO, (roomCode) => {
        getRoomInfo(roomCode, socket);
    })

    socket.on(EVENTS.SET_CHOOSING_CATEGORY, (roomCode) => {
        const roomInfo = setChoosingCategory(roomCode, socket);
        if (!roomInfo) {return}
        io.to(roomCode).emit(EVENTS.ROOM_INFO, roomInfo);
    })

    socket.on(EVENTS.START_GAME, (roomCode, region, bannedCategories) => {
        startGame(roomCode, region, bannedCategories, socket);
    })
});

server.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));