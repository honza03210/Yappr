import type {Signaling} from "./signaling";
import {UIManager} from "../ui/ui-manager";
import {HandleUserDisconnect, useQueuedCandidates} from "./handlers";
import {InitPeerConnection} from "../audio/peer-connection";

type EventHandler = (signaling: Signaling, data: any) => void | Promise<void>;

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
            console.error("getCandidate: no peer connection for", data.id);
            return;
        }
        if (queue[data.id] && queue[data.id]!.popped) {
            peerConnections[data.id]!.addIceCandidate(new RTCIceCandidate(data.candidate.candidate)).then(() => {
                console.log("candidate add success");
            });
            return;
        } else if (!queue[data.id]) {
            queue[data.id] = {popped: false, queue: []};
            console.log("Initiated queue");
        }
        queue[data.id]!.queue.push(data.candidate);
    },

    listUsers: (signaling, data) => {
        console.log("listUsers: ", data);
    },

    getOffer: async (signaling, data) => {
        await signaling.credentialsReady;
        await InitPeerConnection(signaling, data.id, signaling.peerConnections!, signaling.peerPositions!, signaling.clientPositions!, false, data.username, data.pfpUrl);
        await signaling.peerConnections![data.id].CreateAnswer(signaling, data.sdp, data.id);
        await useQueuedCandidates(signaling.peerConnections!, signaling.IceCandidateQueue, data.id);
    },

    getAnswer: async (signaling, data) => {
        const pc = signaling.peerConnections![data.id];
        if (!pc) {
            console.warn("getAnswer: no peer connection for", data.id);
            return;
        }
        if (!pc.remoteDescription || !pc.remoteDescription.type) {
            await pc.setRemoteDescription(data.sdp);
            await useQueuedCandidates(signaling.peerConnections!, signaling.IceCandidateQueue, data.id);
        }
    },

    PeerJoined: async (signaling, data) => {
        await signaling.credentialsReady;
        if (signaling.peerConnections![data.id]) {
            console.error("peer already connected");
            return;
        }
        await InitPeerConnection(signaling, data.id, signaling.peerConnections!, signaling.peerPositions!, signaling.clientPositions!, true, data.username, data.pfpUrl);
        await signaling.peerConnections![data.id].CreateOffer(signaling, data.id);
    },

    userCredentials: (signaling, data) => {
        signaling.IceServers = data.credentials;
        signaling.notifyCredentialsReady();
    },
};

export async function dispatchSignalingEvent(signaling: Signaling, eventName: string, eventData: any) {
    if (signaling.peerConnections == null || signaling.IceCandidateQueue == null) {
        console.error("Skipping signaling event handling: ", signaling.peerConnections, signaling.IceCandidateQueue);
        return;
    }
    const handler = eventHandlers[eventName];
    if (!handler) {
        console.error("Undefined message received: ", eventName, eventData);
        return;
    }
    await handler(signaling, eventData);
}