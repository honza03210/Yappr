import type {Socket} from "socket.io";
import {IceServers} from "../backup-ice-server-array.js";


/**
 * In the best case generates TURN credentials for the given user - if not possible will use hardcoded
 * server-array backup (metered.ca doesn't support dynamic generation for free tier).
 */
export async function sendUserCredentials(socket: Socket, _user: string): Promise<void> {
    socket.emit("userCredentials", {selfID: socket.id, credentials: IceServers});
    return;
}
