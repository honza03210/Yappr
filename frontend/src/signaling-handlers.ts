import {PeerConnection} from "./peer-connection.js";
import {Signaling} from "./signaling";
import {UIManager} from "./ui-manager";
import {ClientPositions, Position} from "./client-positions";


/**
 * Called upon user requesting a room join
 * @param signalling
 * @param peerConnections
 * @param peerPositions
 * @param positionsSocket
 * @constructor
 */
export function RoomJoin(signalling: Signaling, peerConnections: {
    [id: string]: PeerConnection
}, peerPositions: {[id: string]: Position}, positionsSocket: ClientPositions) {
    console.log("roomJoin");

    let IceCandidateQueue: {
        [key: string]: {
            popped: boolean,
            queue: { candidate: RTCIceCandidate, sdpMid: string, sdpMLineIndex: number }[]
        }
    } = {};

    signalling.BindEvents(IceCandidateQueue, peerConnections, peerPositions, positionsSocket);

    signalling.Send({
        payload: {
            roomId: UIManager.appUI.roomIDInput.value,
            name: UIManager.appUI.nameInput.value != "" ? UIManager.appUI.nameInput.value : `user-${Math.random().toString(36).substring(2, 10)}`,
            password: UIManager.appUI.passwordInput.value,
            pfpUrl: UIManager.pfpUrl
        }, type: "join"
    });

    console.log("join posted");
}


/**
 * Cleans up after a peer disconnects
 * @param userID
 * @param peerConnections
 * @param clientPositions
 * @constructor
 */
export async function HandleUserDisconnect(userID: string, peerConnections: {[key: string] : PeerConnection}, clientPositions: ClientPositions | null) {
    document.getElementById("peerContainer-" + userID)?.remove();
    document.getElementById("remoteVideo-" + userID)?.remove();
    document.getElementById("remoteAudio-" + userID)?.remove();
    peerConnections[userID].close();
    clientPositions?.SendServerEvent(`PLAYER_LEFT;${userID}`);
    delete peerConnections[userID];
}


/**
 * Reads and applies the queued ICE candidates received before being ready to process them
 * @param peerConnections
 * @param iceCandidateQueue
 * @param id
 */
export async function useQueuedCandidates (peerConnections: { [p: string]: RTCPeerConnection }, iceCandidateQueue:any, id: string) {
    for (const cand of iceCandidateQueue[id]!.queue) {
        if (peerConnections[id]!.connectionState == "connected") {
            console.log("getCandidate ignored - connected");
            return;
        }
        console.log("popped from queue");
        if (cand.candidate.candidate == "") return;
        await peerConnections[id]!.addIceCandidate(new RTCIceCandidate(cand.candidate));
    }
    iceCandidateQueue[id]!.popped = true;
}
