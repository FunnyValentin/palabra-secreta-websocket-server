import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { rooms, createRoom, joinRoom, showRooms, disconnectFromRoom, getRoomInfo, setChoosingCategory, startGame, handleVote, nextRound, skipRound } from './services/room.service.js'

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
    PLAYER_DISCONNECT: 'playerDisconnect',
    SET_CHOOSING_CATEGORY: 'setChoosingCategory',
    START_GAME: 'startGame',
    HANDLE_VOTE: 'handleVote',
    ROUND_RESULT: 'roundResult',
    NEXT_ROUND: 'nextRound',
    SKIP_ROUND: 'skipRound',
    UPDATE_GAMESTATE: 'updateGameState',
    ERROR: 'error',
};

io.on('connection', (socket) => {
    console.log("Nueva conexión:", socket.id);

    socket.on('disconnect', () => {
        disconnectFromRoom(socket);
        console.log(`Socket ${socket.id} se ha desconectado.`);
    });

    socket.on(EVENTS.CREATE_ROOM, ({roomName, isPasswordProtected, password, maxPlayers, hostName, hostAvatar}) => {
        const roomCode = createRoom(roomName, isPasswordProtected, password, maxPlayers, hostName, hostAvatar, socket);
        socket.join(roomCode);
        socket.emit(EVENTS.ROOM_CREATED, {roomCode})
        console.log("Sala creada:", roomCode)
    })

    socket.on(EVENTS.JOIN_ROOM, ({roomCode, password, playerName, playerAvatar}) => {
        joinRoom(roomCode, password, playerName, playerAvatar, socket);
        console.log("Unido a la sala:", roomCode, "- Jugador:" ,socket.id);
    })

    socket.on(EVENTS.GET_ROOMS, () => {
        const roomList = showRooms(socket);
        socket.emit(EVENTS.ROOM_LIST, roomList)
        console.log("Lista de salas:", roomList)
    })

    socket.on(EVENTS.PLAYER_DISCONNECT, () => {
        disconnectFromRoom(socket);
    })

    socket.on(EVENTS.GET_ROOM_INFO, (roomCode) => {
        getRoomInfo(roomCode, socket);
    })

    socket.on(EVENTS.SET_CHOOSING_CATEGORY, (roomCode) => {
        setChoosingCategory(roomCode, socket);
    })

    socket.on(EVENTS.START_GAME, (roomCode, region, bannedCategories) => {
        startGame(roomCode, region, bannedCategories, socket);
    })

    socket.on(EVENTS.HANDLE_VOTE, (roomCode, idVoted) => {
        const result = handleVote(idVoted, roomCode, socket);
        if (result !== null) {
            console.log("Emitiendo resultado, impostorCaught:", result)
            io.to(roomCode).emit(EVENTS.ROUND_RESULT, result);
        }
    })

    socket.on(EVENTS.NEXT_ROUND, (roomCode) => {
        nextRound(roomCode, socket);
    })

    socket.on(EVENTS.SKIP_ROUND, (roomCode) => {
        skipRound(roomCode, socket);
    })
});

server.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));