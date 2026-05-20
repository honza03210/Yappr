/// <reference lib="webworker" />
import {io} from "socket.io-client";
import {ServerConfig} from "../configs/server-config";

/**
 * Currently unused, may be used to offload the networking into a separate thread in the future
 * Shared worker running on another thread used to offload network communication from the main JavaScript thread
 * @param event
 */
(self as unknown as SharedWorkerGlobalScope).onconnect = (event: MessageEvent) => {
    const port = event.ports[0];

    const signalingSocket = io(ServerConfig.url, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
    });

    console.log("[SharedWorker] New tab connected");

    port!.onmessage = (msgEvent) => {
        signalingSocket.emit(msgEvent.data.type, msgEvent.data.message);
    };

    const events: string[] = ["connect", "disconnect", "error", "listRooms", "getCandidate", "listUsers", "getAnswerAck", "getOffer", "getAnswer", "PeerJoined",];

    events.forEach((eventName) => {
        signalingSocket.on(eventName, (data: any) => {
            port!.postMessage(Object.assign(data, {type: eventName})); // ads event type to the payload
        });
    });

    port!.start();
    port!.postMessage({type: "sharedWorkerMessage", message: "Connected: " + signalingSocket.connected});
};
