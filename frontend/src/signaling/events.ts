import type {Signaling} from "./signaling";
import {UIManager} from "../ui/ui-manager";
import {HandleUserDisconnect, useQueuedCandidates} from "./handlers";
import {InitPeerConnection} from "../audio/peer-connection";

type EventHandler = (signaling: Signaling, data: any) => void | Promise<void>;

/**
 * The handlers of events signaling may receive
 */
const eventHandlers: {[name: string]: EventHandler} = {
    connected: () => {
        console.log("Successfully connected to the signaling server!");
    },

    roomConnected: (signaling, data) => {
        UIManager.inRoom = true;
        UIManager.EnableDisconnectButton(signaling);
        console.log("Successfully connected to room " + data.roomID);
    },

    userDisconnected: async (signaling, data) => {
        await HandleUserDisconnect(data.id, signaling.peerConnections!, signaling.clientPositions, signaling);
        console.log("disconnect:" + data);
    },

    error: (_, data) => {
        console.log("Error: " + data.message);
        UIManager.appUI.errorMsgLabel.innerHTML = data.message;
    },

    listRooms: (_, data) => {
        UIManager.updateRoomsList(data.roomsList);
    },

    sharedWorkerMessage: (_, data) => {
        console.log("SharedWorker says: " + data.message);
    },

    getCandidate: (signaling, data) => {
        const peerConnections = signaling.peerConnections!;
        const queue = signaling.IceCandidateQueue!;
        if (!peerConnections[data.id]) {
            console.warn("getCandidate: no peer connection for", data.id);
            return;
        }
        console.log("ICECANDIDATE:", data);
        if (queue[data.id] && queue[data.id]!.popped) {
            console.log("getCandidate", data.candidate.candidate);
            peerConnections[data.id]!.addIceCandidate(new RTCIceCandidate(data.candidate.candidate)).then(() => {
                console.log("candidate add success");
            });
            return;
        } else if (!queue[data.id]) {
            queue[data.id] = {popped: false, queue: []};
            console.log("Initiated queue");
        }
        queue[data.id]!.queue.push(data.candidate);
        console.log("getCandidate -- pushed to queue: ", data.candidate);
    },

    listUsers: (signaling, data) => {
        console.log("listUsers: ", data);
        console.log("listUsers check finished", signaling.peerConnections);
    },

    getOffer: async (signaling, data) => {
        console.log("OFFER:", data);
        console.log("get offer:" + data.sdp, data.pfpUrl);
        console.log("awaiting credentials");
        await signaling.credentialsReady;
        console.log("credentials ready");
        await InitPeerConnection(signaling, data.id, signaling.peerConnections!, signaling.peerPositions!, signaling.clientPositions!, false, data.username, data.pfpUrl);
        console.log("Initiated connection", signaling.peerConnections![data.id]!);
        await signaling.peerConnections![data.id].CreateAnswer(signaling, data.sdp, data.id);
        await useQueuedCandidates(signaling.peerConnections!, signaling.IceCandidateQueue, data.id);
        console.log("Created answer", signaling.peerConnections![data.id]!);
    },

    getAnswer: async (signaling, data) => {
        const pc = signaling.peerConnections![data.id];
        if (!pc) {
            console.warn("getAnswer: no peer connection for", data.id);
            return;
        }
        console.log("ANSWER:", data);
        console.log("get answer:" + data.sdp);
        if (!pc.remoteDescription || !pc.remoteDescription.type) {
            console.log("setting remote desc after getting an answer");
            await pc.setRemoteDescription(data.sdp);
            await useQueuedCandidates(signaling.peerConnections!, signaling.IceCandidateQueue, data.id);
        }
    },

    PeerJoined: async (signaling, data) => {
        console.log("Peer joined: " + data.id, "Awaiting credentials");
        await signaling.credentialsReady;
        console.log("credentials ready");
        if (signaling.peerConnections![data.id]) {
            console.log("peer already connected");
            return;
        }
        await InitPeerConnection(signaling, data.id, signaling.peerConnections!, signaling.peerPositions!, signaling.clientPositions!, true, data.username, data.pfpUrl);
        await signaling.peerConnections![data.id].CreateOffer(signaling, data.id);
    },

    userCredentials: (signaling, data) => {
        console.log("userCredentials received: ", data);
        signaling.IceServers = data.credentials;
        signaling.notifyCredentialsReady();
    },
};

/**
 * Dispatches the corresponding signaling event
 * @param signaling
 * @param eventName
 * @param eventData
 */
export async function dispatchSignalingEvent(signaling: Signaling, eventName: string, eventData: any) {
    if (signaling.peerConnections == null || signaling.IceCandidateQueue == null) {
        console.error("Skipping signaling event handling: ", signaling.peerConnections, signaling.IceCandidateQueue);
        return;
    }
    console.log("EventName: ", eventName);
    const handler = eventHandlers[eventName];
    if (!handler) {
        console.log("Undefined message received: ", eventName, eventData);
        return;
    }
    await handler(signaling, eventData);
}