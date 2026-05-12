import {Socket} from "socket.io-client";
import {InitPeerConnection, PeerConnection} from "./peer-connection";
import {HandleUserDisconnect, useQueuedCandidates} from "./signaling-handlers";
import {UIManager} from "./ui-manager";
import {ClientPositions, Position} from "./client-positions";
import {StatSample} from "./stat-sample"

/**
 * The class handling the communication with the signaling server (for supported devices
 * through a shared worker to offload work)
 */
export class Signaling {
    IceServers: RTCIceServer[];
    communicator: Socket | MessagePort;
    IceCandidateQueue: {
        [p: string]: {
            popped: boolean
            queue: {
                candidate: RTCIceCandidate
                sdpMid: string
                sdpMLineIndex: number
            }[]
        }
    } | null = null;
    peerConnections: {[key: string] : PeerConnection} | null = null;
    peerPositions: {[p: string]: Position} | null = null;
    clientPositions: ClientPositions | null = null;
    peerStats: {[p: string]: StatSample[]} | null = null;


    constructor(communicator: Socket | MessagePort) {
        this.communicator = communicator;
        this.IceServers = [];
        this.peerStats = {};
    }

    /**
     * Sends the message to the signaling server
     * @param message
     * @constructor
     */
    Send(message: any){
        if ("emit" in this.communicator) {
            this.communicator.emit(message.type, message.payload);
        } else if ("postMessage" in this.communicator) {
            this.communicator.postMessage({message: message.payload, type: message.type});
        } else {
            console.error("signalling object can't emit or postMessage");
        }
    }

    /**
     * Binds the events of the communicator (message, open, ...)
     * @param IceCandidateQueue
     * @param peerConnections
     * @param peerPositions
     * @param clientPositions
     * @constructor
     */
    BindEvents(IceCandidateQueue: {
                   [p: string]: { popped: boolean; queue: { candidate: RTCIceCandidate; sdpMid: string; sdpMLineIndex: number }[] }
               },
               peerConnections: { [p: string]: PeerConnection },
               peerPositions: {[p: string]: Position},
               clientPositions: ClientPositions) {
        this.IceCandidateQueue = IceCandidateQueue;
        this.clientPositions = clientPositions;
        this.peerConnections = peerConnections;
        this.peerPositions = peerPositions;


        if ("onAny" in this.communicator){
            this.communicator.offAny();
            this.communicator.onAny(async (ev, ...args) => {
                await this.HandleSignallingEvent(ev.toString(), args[0]);
            })
        } else if ("addEventListener" in this.communicator){
            this.communicator.removeEventListener("message", this.onMessageHandler);
            this.communicator.addEventListener("message", this.onMessageHandler);
        } else {
            console.error("Invalid signaling communicator")
        }
    }

    /**
     * Closes the communicator
     * @constructor
     */
    Close(){
        this.communicator.close();
        console.log("signalling closed");
    }

    /**
     * Handles all relevant events received from communicator
     * @param eventName
     * @param eventData
     * @constructor
     */
    async HandleSignallingEvent(eventName: string,
                                eventData: any) {
        if (this.peerConnections == null || this.IceCandidateQueue == null) {
            console.error("Skipping signalling event handling: ", this.peerConnections, this.IceCandidateQueue);
            return;
        }
        console.log("EventName: ", eventName);
        switch (eventName) {
            case "connected":
                console.log('Successfully connected to the signaling server!');
                break;
            case "roomConnected":
                UIManager.inRoom = true;
                UIManager.EnableDisconnectButton(this);
                console.log("Successfully connected to room " + eventData.roomID)
                break;
            case "userDisconnected":
                await HandleUserDisconnect(eventData.id, this.peerConnections, this.clientPositions);
                console.log("disconnect:" + eventData);
                break;
            case "error":
                console.log("Error: " + eventData.message);
                UIManager.appUI.errorMsgLabel.innerHTML = eventData.message;
                break;
            case "listRooms":
                UIManager.updateRoomsList(eventData.roomsList);
                break;
            case "sharedWorkerMessage":
                console.log("SharedWorker says: " + eventData.message);
                break;
            case "getCandidate":
                console.log("ICECANDIDATE:", eventData)
                if (this.IceCandidateQueue[eventData.id] && this.IceCandidateQueue[eventData.id]!.popped) {
                    console.log("getCandidate", eventData.candidate.candidate);
                    this.peerConnections[eventData.id]!.addIceCandidate(new RTCIceCandidate(eventData.candidate.candidate)).then(() => {
                        console.log("candidate add success");
                    });
                    return;
                } else if (!this.IceCandidateQueue[eventData.id]) {
                    this.IceCandidateQueue[eventData.id] = {popped: false, queue: []};
                    console.log("Initiated queue");
                }
                this.IceCandidateQueue[eventData.id]!.queue.push(eventData.candidate);
                console.log("getCandidate -- pushed to queue: ", eventData.candidate);
                break;
            case "listUsers":
                console.log("listUsers: ", eventData);

                // Reconnect to users in the room when there isn't a connection between them already (crashed/failed)
                // for (let userID of eventData.userIDs){
                //     if ((userID !in this.peerConnections && userID > eventData.selfID)) {
                //         console.log("reestablishing peer connection");
                //         await InitPeerConnection(this, userID, this.peerConnections, this.peerPositions!, this.clientPositions!, true, userID, null);
                //         await this.peerConnections[userID].CreateOffer(this, userID);
                //     }
                // }
                console.log("listUsers check finished", this.peerConnections);
                break;
            case "getAnswerAck":
                console.log("getAnswerAck");
                if (this.IceCandidateQueue[eventData.id] == undefined) {
                    this.IceCandidateQueue[eventData.id] = {popped: true, queue: []};
                    console.log("undefined queue");
                    return;
                }
                // await useQueuedCandidates(this.peerConnections, this.IceCandidateQueue, eventData.id)
                this.IceCandidateQueue[eventData.id]!.popped = true;
                break;
            case "getOffer":
                console.log("OFFER:", eventData);
                console.log("get offer:" + eventData.sdp, eventData.pfpUrl);
                await InitPeerConnection(this, eventData.id, this.peerConnections, this.peerPositions!, this.clientPositions!, false, eventData.username, eventData.pfpUrl);
                console.log("Initiated connection", this.peerConnections[eventData.id]!);
                await this.peerConnections[eventData.id].CreateAnswer(this, eventData.sdp, eventData.id);
                await useQueuedCandidates(this.peerConnections, this.IceCandidateQueue, eventData.id)
                console.log("Created answer", this.peerConnections[eventData.id]!);
                break;
            case "getAnswer":
                console.log("ANSWER:", eventData);
                console.log("get answer:" + eventData.sdp);
                if (!this.peerConnections[eventData.id]!.remoteDescription || !this.peerConnections[eventData.id]!.remoteDescription!.type) {
                    console.log("setting remote desc after getting an answer");
                    await this.peerConnections[eventData.id]!.setRemoteDescription(eventData.sdp);
                    await useQueuedCandidates(this.peerConnections, this.IceCandidateQueue, eventData.id)
                }
                console.log("answerAck sent")
                this.Send({payload: {dest: eventData.id}, type: "answerAck"});
                if (!this.IceCandidateQueue[eventData.id]) {
                    console.log("NO QUEUE TO POP");
                    this.IceCandidateQueue[eventData.id] = {popped: true, queue: []};
                    return;
                }
                console.log("getAnswerAck");
                // await useQueuedCandidates(this.peerConnections, this.IceCandidateQueue, eventData.id)
                break;
            case "PeerJoined":
                console.log("Peer joined: " + eventData.id);
                if (this.peerConnections[eventData.id]) {
                    console.log("peer already connected");
                    return;
                }
                await InitPeerConnection(this, eventData.id, this.peerConnections, this.peerPositions!, this.clientPositions!, true, eventData.username, eventData.pfpUrl);
                await this.peerConnections[eventData.id].CreateOffer(this, eventData.id);
                break;
            case "userCredentials":
                console.log("userCredentials received: ", eventData);
                this.IceServers = eventData.credentials;
                break;
            default:
                console.log("Undefined message received: ", eventName, eventData);
                break;
        }
    }

    /**
     * Helper function for the addEventListener of the communicator
     * @param event
     */
    private onMessageHandler = async (event : any) => {
        if (!event.data || !event.data.type) {
            console.error("signalling received invalid message: ", event);
            return;
        }
        await this.HandleSignallingEvent(event.data.type, event.data);
    }
}