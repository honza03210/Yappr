import {Server} from "socket.io";
import argon2id from "argon2";
import {GenerateTurnCredentials} from "./generate-turn-credentials.js";
import {allowedOrigins} from "./allowed-origins.js";

/**
 * Binds all the needed events for basic signaling
 * @param server
 */
export function signalling(server : any) {
    const io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"],
            credentials: true
        },
    });

    io.engine.on("connection_error", (err) => {
        console.error("socket io engine error", {
            code: err.code,
            message: err.message,
            context: err.context,
        });
    });


    // socketID : username
    let usernames : {[key: string]: string} = {};

    // roomID[socketID : username]
    let rooms : {[key: string]: { [id: string] : string }} = {};

    // argon2 hashed
    let roomsPasswords: {[key: string]: string} = {};

    function ListRooms(socket: any, repeat: boolean) : void {
        try {
            socket.emit("listRooms", {
                roomsList: Object.entries(rooms).map(([roomID, users]) =>
                    ({roomID, numberOfUsers: Object.keys(users).length}))
            });
            if (repeat && socket.connected) {
                setTimeout(() =>{ ListRooms(socket, true) }, 5000)
                            }
        } catch (err){
            console.log("Error: ", err);
        }
    }
    io.on("connection", socket => {
        socket.emit("connected");
        console.log("new socket connected: " + socket.id);
        ListRooms(socket, true);
        console.log("Began list rooms loop");
        socket.on("listRooms", (data) => {
            console.log("LIST_ROOMS received", socket.id);
            console.log("listRooms: ", Object.entries(rooms).map(([roomID, users]) =>
                ({roomID, numberOfUsers: Object.keys(users).length})));
            ListRooms(socket, false);
        });

        socket.on("join", async data => {
            if (!data) return;
            console.log("got join from " + socket.id);
            if (socket.rooms.size > 1) {
                console.log([socket.rooms.values()]);
                socket.emit("error", {message: "You are already connected to a room"} );
                return
            }

            const roomId: string = data.roomId
            // room exists -> try to join with received password
            if (rooms[roomId]) {
                // if for some reason no room password hash is stored
                if (!roomsPasswords[roomId]) {
                    socket.emit("error", {message: "Room not found"} );
                    return;
                }
                if (!await argon2id.verify(roomsPasswords[roomId], data.password)){
                    socket.emit("error", {message: "Invalid password"} );
                    return
                }
            // room doesn't exist -> it will be created and its password hash set by this first users used password
            } else {
                roomsPasswords[roomId] = await argon2id.hash(data.password);
            }
            socket.join(roomId);
            socket.data.roomId = roomId;
            console.log("joined room: " + roomId);

            // add the user to the room
            if (rooms[roomId]) {
                rooms[roomId][socket.id] = data.name;
            } else {
                rooms[roomId] = {};
                rooms[roomId][socket.id] = data.name;
            }

            // const users = Object.values(rooms[roomId]);
            // socket.broadcast.to(socket.data.roomId).emit("room_users", { id: socket.id, users: users.join(", ")});
            console.log("[joined] room:" + roomId + " name: " + data.name);
            usernames[socket.id] = data.name;
            socket.broadcast.to(socket.data.roomId).emit("PeerJoined", {
                id: socket.id,
                username: data.name,
                pfpUrl: data.pfpUrl ?? ""
            });
            console.log("pfp: ", data.pfpUrl);
            socket.emit("roomConnected", { selfID: socket.id, roomID: roomId });
            socket.broadcast.to(socket.data.roomId).emit("PeerJoined", { id: socket.id, username: data.name });
            await sendUserCredentials(socket, data.name);
            setTimeout(() =>{ listUserIDs(socket, socket.data.roomId) }, 5000)
        });
        socket.on("offer", (payload: {dest: string, sdp: any, pfpUrl: any}) => {
            if (!payload || !payload.dest || !payload.sdp) return;
            io.to(payload.dest).emit("getOffer", {
                id: socket.id,
                sdp: payload.sdp,
                username: usernames[socket.id], // Adjusted from object above
                pfpUrl: payload.pfpUrl
            });
            // io.to(payload.dest).emit("getOffer", {id: socket.id, sdp: payload.sdp, username: usernames[socket.id]});
            console.log("offer from " + socket.id + " to " + payload.dest);
        });
        socket.on("answerAck", (payload: {dest: string}) => {
            if (!payload || !payload.dest) return;
            io.to(payload.dest).emit("getAnswerAck", {id: socket.id});
            console.log("answer ack from " + socket.id + " to " + payload.dest);
        });

        socket.on("answer", (payload: {dest: string, sdp: any}) => {
            if (!payload || !payload.dest || !payload.sdp) return;
            io.to(payload.dest).emit("getAnswer", {id: socket.id, sdp: payload.sdp});
            console.log("answer from " + socket.id + " to " + payload.dest);
        });

        socket.on("candidate", (payload:  { dest: string, candidate: RTCIceCandidate }) => {
            if (!payload || !payload.dest || !payload.candidate) return;
            io.to(payload.dest).emit("getCandidate", {id: socket.id, candidate: payload});
            console.log("candidate from " + socket.id + payload.candidate);
        });

        socket.on("roomLeave", () => {
            if (socket.data.roomId) {
                socket.leave(socket.data.roomId);
                handleUserRoomDisconnected(socket);
                socket.data.roomId = undefined; // Clear the data
            }
        });
        socket.on("disconnect", () => {
            handleUserRoomDisconnected(socket);
        });
    });

    /**
     * Cleans up after user disconnects
     * @param socket
     */
    function handleUserRoomDisconnected(socket: any) {
        delete usernames[socket.id];

        if (socket.data.roomId === undefined) {
            console.error("User not present in any room");
            return;
        }
        console.log("user left roomId: " + socket.data.roomId);
        let room = rooms[socket.data.roomId];
        if (room) {
            delete rooms[socket.data.roomId]![socket.id];
            if (Object.keys(rooms[socket.data.roomId]!).length === 0) {
                delete rooms[socket.data.roomId];
                delete roomsPasswords[socket.data.roomId];
                console.log(socket.data.roomId + "deleted");
                return;
            }
        }
        if (typeof room === "undefined") {
            return;
        }
        console.log("userDisconnected broadcast")
        socket.broadcast.to(socket.data.roomId).emit("userDisconnected", {id: socket.id});
        console.log(`[${socket.data.roomId}]: ${socket.id} exit`);
    }

    /**
     * Sends userIDs of others connected to a room
     * @param socket
     * @param roomID
     */
    function listUserIDs(socket: any, roomID: string) {
        try {
            const room = rooms[roomID];
            if (!room || !socket.connected) return;
            socket.emit("listUsers", { selfID: socket.id, userIDs: Object.keys(room) });
            if (usernames[socket.id]) {
                setTimeout(() => {
                    listUserIDs(socket, roomID);
                }, 10000);
            }
        } catch(err) {
            console.error("listUserIDs error:", err);
        }
    }

    /**
     * In the best case generates TURN credentials for the given user - if not possible will use hardcoded server-array backup (metered.ca doesnt support dynamic generation for free tier)
     * @param socket
     * @param user
     */
    async function sendUserCredentials(socket: any, user: string){
        let response = await GenerateTurnCredentials(user);
        if (response != null){
            console.log("user credentials response: ", response);
            socket.emit("userCredentials", { selfID: socket.id, credentials: response });
        } else {
            console.log("GenerateTurnCredentials returned null", response);
            if (!socket.connected) return;
            setTimeout(() => {
                console.log("failed to fetch user credentials");
                sendUserCredentials(socket, user);
            }, 100000);
        }
    }

}
