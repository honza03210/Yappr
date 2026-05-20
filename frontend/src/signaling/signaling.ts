import {Socket} from "socket.io-client";
import {PeerConnection} from "../audio/peer-connection";
import {ClientPositions, Position} from "../position/client-positions";
import {StatSample} from "../audio/stat-sample";
import {SignalingMessage, SignalingTransport} from "./transport";
import {dispatchSignalingEvent} from "./events";

/**
 * Container for the signaling layer
 * Keeps the state of the room, peers, etc...
 */
export class Signaling {
    IceServers: RTCIceServer[];
    transport: SignalingTransport;
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
    peerConnections: { [key: string]: PeerConnection } | null = null;
    peerPositions: { [p: string]: Position } | null = null;
    clientPositions: ClientPositions | null = null;
    peerStats: { [p: string]: StatSample[] } | null = null;
    peerRunningIntervals: { [p: string]: number[] } = {};
    readonly credentialsReady: Promise<void>;
    private resolveCredentials!: () => void;


    constructor(communicator: Socket | MessagePort) {
        this.transport = new SignalingTransport(communicator);
        this.IceServers = [];
        this.peerStats = {};
        this.credentialsReady = new Promise(r => this.resolveCredentials = r);
    }

    /**
     * Sends the message to the signaling server
     */
    Send(message: SignalingMessage) {
        this.transport.send(message);
    }

    /**
     * Binds the events of the communicator (message, open, ...)
     */
    BindEvents(IceCandidateQueue: {
                   [p: string]: { popped: boolean; queue: { candidate: RTCIceCandidate; sdpMid: string; sdpMLineIndex: number }[] }
               },
               peerConnections: { [p: string]: PeerConnection },
               peerPositions: { [p: string]: Position },
               clientPositions: ClientPositions) {
        this.IceCandidateQueue = IceCandidateQueue;
        this.clientPositions = clientPositions;
        this.peerConnections = peerConnections;
        this.peerPositions = peerPositions;

        this.transport.bindEvents((name, data) => dispatchSignalingEvent(this, name, data));
    }

    /**
     * Closes the communicator
     */
    Close() {
        this.transport.close();
    }

    /**
     * Resolves the credentialsReady promise. Called by the userCredentials
     * event handler once ICE servers have arrived from the signaling server
     */
    notifyCredentialsReady() {
        this.resolveCredentials();
    }
}
