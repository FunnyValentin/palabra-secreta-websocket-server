import bcrypt from 'bcrypt';
import fs from 'fs';

export const rooms = new Map();

const words = JSON.parse(fs.readFileSync('./src/assets/words.json', 'utf-8'));

const MAX_PLAYERS_LIMIT = 20;

const generateRoomCode = () => {
    let code;
    do {
        code = Math.random().toString(36).substring(2, 8).toUpperCase()
    } while (rooms.has(code));
    return code;
};

const getRandomWord = (bannedCategories, region) => {
    const availableCategories = Object.keys(words[region]).filter(
        category => !bannedCategories.includes(category)
    );

    if (availableCategories.length === 0) {
        throw new Error("No categories available after applying bans.");
    }

    const randomCategory = availableCategories[
        Math.floor(Math.random() * availableCategories.length)
    ];

    const wordsInCategory = words[region][randomCategory];
    const randomWord = wordsInCategory[
        Math.floor(Math.random() * wordsInCategory.length)
    ];

    return {
        category: randomCategory,
        word: randomWord};
};


export function createRoom(roomName, isPasswordProtected, password, maxPlayers, hostName, hostAvatar, socket) {
    if (maxPlayers > MAX_PLAYERS_LIMIT) {
        socket.emit('error', 'Supera el limite de jugadores');
        console.error("Supera el limite de jugadores")
        return
    }
    if (!roomName || !hostName || maxPlayers <= 0) {
        socket.emit('error', 'Parámetros inválidos para crear una sala');
        console.error("No están todos lo parámetros necesarios")
        return;
    }

    const code = generateRoomCode();
    const hashedPassword = isPasswordProtected ? bcrypt.hashSync(password, 10) : null;
    rooms.set(code, {
        roomName,
        isPasswordProtected,
        password: hashedPassword,
        maxPlayers,
        players: [{
            id: socket.id,
            name: hostName,
            avatar: hostAvatar,
            isHost: true,
            score: 0
        }],
        gameState: {
            round: 1,
            word: null,
            category: null,
            region: "Argentina",
            bannedCategories: [],
            impostorID: null,
            votes: {},
            state: "WAITING"
        }
    })

    return code;
}

export function joinRoom(roomCode, password, playerName, playerAvatar, socket) {
    const room = rooms.get(roomCode);
    if(!room) {
        socket.emit('error', 'No se encontro la sala');
        console.error(`La sala ${roomCode} no se encontró.`);
        return;
    }
    if (room.players.length >= room.maxPlayers) {
        socket.emit('error', 'La sala esta llena');
        console.error(`La sala ${roomCode} esta llena.`)
        return;
    }
    if (room.isPasswordProtected && !bcrypt.compareSync(password, room.password)) {
        socket.emit('error', 'Contraseña invalida');
        console.error("Contraseña inválida.")
        return;
    }
    if (room.players.findIndex(player => player.id === socket.id) !== -1) {
        socket.emit('error', 'El jugador ya esta conectado a la sala')
        console.error("Jugador ya está en la sala.")
        return
    }

    room.players.push({
        id: socket.id,
        name: playerName,
        avatar: playerAvatar,
        isHost: false,
        score: 0,
    });

    return {
        roomName: room.roomName,
        players: room.players,
        maxPlayers: room.maxPlayers,
        gameState: room.gameState
    }
}

export function showRooms() {
    return Array.from(rooms.entries()).map(([code, room]) => ({
        code,
        roomName: room.roomName,
        isPasswordProtected: room.isPasswordProtected,
        maxPlayers: room.maxPlayers,
        currentPlayers: room.players.length,
    }));
}

export function disconnectFromRoom(socket) {
    for (const [code, room] of rooms.entries()) {
        const disconnectedPlayerIndex = room.players.findIndex(player => player.id === socket.id);
        if (disconnectedPlayerIndex !== -1) {
            const wasHost = room.players[disconnectedPlayerIndex].isHost;
            room.players.splice(disconnectedPlayerIndex, 1);

            if (room.players.length == 0) {
                rooms.delete(code)
                console.log(`Se eliminó la sala ${code} por falta de jugadores`)
            } else if (wasHost) {
                room.players[0].isHost = true;
                console.log(`El jugador ${room.players[0].id} ahora es el anfitrión de la sala ${code}.`);
                return room.players
            }
        }
    }
}

export function getRoomInfo(roomCode, socket) {
    const room = rooms.get(roomCode);
    if(!room) {
        console.error(`Room ${roomCode} not found`);
        socket.emit('error', 'No se encontro la sala');
        return;
    }
    
    const playerIndex = room.players.findIndex(player => player.id === socket.id);
    console.log(`Player index in room: ${playerIndex}`);
    
    if (playerIndex === -1) {
        console.error(`Player ${socket.id} not found in room ${roomCode}`);
        socket.emit('error', 'El jugador no está conectado a la sala');
        return;
    }
    
    const roomInfo = {
        roomName: room.roomName,
        players: room.players,
        maxPlayers: room.maxPlayers,
        gameState: room.gameState   
    };
    
    socket.emit("roomInfo", roomInfo);
}

export function setChoosingCategory(roomCode, socket) {
    const room = rooms.get(roomCode);
    if (!room) {
        socket.emit('error', 'No se encontró la sala.');
        console.error(`La sala ${roomCode} no se encontró.`);
        return;
    }

    const player = room.players.find(player => player.id === socket.id);
    if (!player || !player.isHost) {
        socket.emit('error', 'Solo el anfitrión puede cambiar el estado.');
        console.error(`El jugador ${socket.id} no es el anfitrión.`);
        return;
    }

    room.gameState.state = "CHOOSING_CATEGORY";
    const categories = {
        argentina: Object.keys(words["Argentina"]),
        internacional: Object.keys(words["Internacional"])
    }
    
    socket.emit("wordCategories", categories)
    console.log(`El estado de la sala ${roomCode} cambió a CHOOSING_CATEGORY.`);
    
    return {
        roomName: room.roomName,
        players: room.players,
        maxPlayers: room.maxPlayers,
        gameState: room.gameState
    }
}

export function startGame(roomCode, region, bannedCategories, socket) {
    const room = rooms.get(roomCode);
    if (!room) {
        socket.emit('error', 'No se encontró la sala.');
        console.error(`La sala ${roomCode} no se encontró.`);
        return;
    }

    const player = room.players.find(player => player.id === socket.id);
    if (!player || !player.isHost) {
        socket.emit('error', 'Solo el anfitrión puede cambiar el estado.');
        console.error(`El jugador ${socket.id} no es el anfitrión.`);
        return;
    }

    if (room.gameState.state != "CHOOSING_CATEGORY") {
        socket.emit('error', 'La sala no está lista para empezar');
        console.error(`La sala no esta esta lista para empezar`);
        return;
    }

    if (!["Argentina", "Internacional"].includes(region)) {
        socket.emit('error', 'Región inválida')
        console.error(`La región ${region} es inválida`)
        return;
    }

    try {
        const randomWord = getRandomWord(bannedCategories, region);
        const randomPlayerIndex = Math.floor(Math.random() * room.players.length);
        const impostorID = room.players[randomPlayerIndex].id;

        room.gameState.impostorID = impostorID;
        room.gameState.bannedCategories = bannedCategories;
        room.gameState.region = region;
        room.gameState.state = "PLAYING";
        room.gameState.category = randomWord.category

        room.gameState.word = randomWord.word;

        room.players.forEach(player => {
            const playerGameState = { ...room.gameState, word: player.id === impostorID ? "???" : room.gameState.word };
        
            if (player.id === socket.id) {
                socket.emit('roomInfo', {
                    roomName: room.roomName,
                    players: room.players,
                    maxPlayers: room.maxPlayers,
                    gameState: playerGameState
                });
                console.log(`Emitido al jugador (host) ${player.id}`);
            } else {
                socket.to(player.id).emit('roomInfo', {
                    roomName: room.roomName,
                    players: room.players,
                    maxPlayers: room.maxPlayers,
                    gameState: playerGameState
                });
                console.log(`Emitido a ${player.id}`);
            }
        });

        console.log("Partida iniciada en sala", roomCode)

        room.gameState.word = "???"

    } catch (error) {
        socket.emit('error', error.message);
    }
}


