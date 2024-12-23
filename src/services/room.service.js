import bcrypt from 'bcrypt';

export const rooms = new Map();

const MAX_PLAYERS_LIMIT = 20;

const generateRoomCode = () => {
    let code;
    do {
        code = Math.random().toString(36).substring(2, 8).toUpperCase()
    } while (rooms.has(code));
    return code;
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
            hostName,
            hostAvatar,
            isHost: true,
            score: 0
        }]
    })

    socket.join(code);
    socket.emit('roomCreated', {code});
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

    room.players.push({
        id: socket.id,
        name: playerName,
        avatar: playerAvatar,
        isHost: false,
        score: 0,
    });

    socket.join(roomCode);
    socket.emit('joinedRoom', { roomCode });
}

export function showRooms(socket) {
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
            }
        }
    }
}