import {PeerConnection} from "../audio/peer-connection.js";
import {Signaling} from "./signaling";
import {UIManager} from "../ui/ui-manager";
import {ClientPositions, Position} from "../position/client-positions";


/**
 * Called when the user requests to join a room.
 * Rebinds the signaling and sends a join message.
 * Disables input fields
 * @param signaling
 * @param peerConnections
 * @param peerPositions
 * @param positionsSocket
 * @constructor
 */
export function RoomJoin(signaling: Signaling, peerConnections: {
    [id: string]: PeerConnection
}, peerPositions: {[id: string]: Position}, positionsSocket: ClientPositions) {
    console.log("roomJoin");

    let IceCandidateQueue: {
        [key: string]: {
            popped: boolean,
            queue: { candidate: RTCIceCandidate, sdpMid: string, sdpMLineIndex: number }[]
        }
    } = {};

    signaling.BindEvents(IceCandidateQueue, peerConnections, peerPositions, positionsSocket);

    let username = UIManager.appUI.nameInput.value != "" ? UIManager.appUI.nameInput.value : `user-${Math.random().toString(36).substring(2, 10)}`;
    UIManager.appUI.nameInput.value = username;
    UIManager.appUI.nameInput.dispatchEvent(new Event("change"));

    signaling.Send({
        payload: {
            roomId: UIManager.appUI.roomIDInput.value,
            name: username,
            password: UIManager.appUI.passwordInput.value,
            pfpUrl: UIManager.pfpUrl
        }, type: "join"
    });

    UIManager.appUI.nameInput.disabled = true;
    UIManager.appUI.roomIDInput.disabled = true;
    UIManager.appUI.passwordInput.disabled = true;

    console.log("join posted");
}


/**
 * Cleans up after a peer disconnects
 * @param userID
 * @param peerConnections
 * @param clientPositions
 * @param signaling
 * @constructor
 */
export async function HandleUserDisconnect(userID: string, peerConnections: {[key: string] : PeerConnection}, clientPositions: ClientPositions | null, signaling: Signaling) {
    document.getElementById("peerContainer-" + userID)?.remove();
    document.getElementById("remoteVideo-" + userID)?.remove();
    document.getElementById("remoteAudio-" + userID)?.remove();
    if (peerConnections[userID]) {
        peerConnections[userID].close();
        delete peerConnections[userID];
    }
    for (const interval of signaling.peerRunningIntervals[userID]) {
        clearInterval(interval);
    }
    delete signaling.peerRunningIntervals[userID];
    clientPositions?.SendServerEvent(`PLAYER_LEFT;${userID}`);
    setTimeout(() => {
      if (!peerConnections[userID]) {
          delete signaling.peerStats![userID];
          delete signaling.peerPositions![userID];
      }
    }, 180);
}


/**
 * Reads and applies the queued ICE candidates received before being ready to process them
 * @param peerConnections
 * @param iceCandidateQueue
 * @param id
 */
export async function useQueuedCandidates (peerConnections: { [p: string]: PeerConnection }, iceCandidateQueue:any, id: string) {
    if (!iceCandidateQueue[id]) {
        iceCandidateQueue[id] = {popped: true, queue: []};
    }
    for (const cand of iceCandidateQueue[id]!.queue) {
        console.log("popped from queue");
        await peerConnections[id]!.addIceCandidate(new RTCIceCandidate(cand.candidate));
    }
    iceCandidateQueue[id] = {popped: true, queue: []};
}
