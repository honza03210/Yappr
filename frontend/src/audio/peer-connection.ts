import {Signaling} from "../signaling/signaling";
import {UIManager} from "../ui/ui-manager";
import {ClientPositions, Position} from "../position/client-positions";
import * as jdenticon from "jdenticon";
import {BindPositionsChannel} from "./data-channels";
import {StatSample} from "./stat-sample";
import {HandleNewReceivedStream} from "./stream-handling";
import {CreatePeerUI} from "../ui/ui-manager";

/**
 * Class taking care of the connection between the peers - used to abstract Offer/Answer exchange
 */
export class PeerConnection extends RTCPeerConnection {
    async CreateOffer(signaling: Signaling, destID: string) {
        console.log("create offer");
        this
            .createOffer({offerToReceiveAudio: true, offerToReceiveVideo: false})
            .then(async sdp => {
                await this.setLocalDescription(sdp);
                signaling.Send({type: "offer", payload: {dest: destID, sdp: sdp, pfpUrl: UIManager.pfpUrl}});
            })
            .catch(error => {
                console.log(error);
            });
    }

    async CreateAnswer(signaling: Signaling, sdp: string | RTCSessionDescription, destID: string) {
        console.log("create answer");
        this.setRemoteDescription(<RTCSessionDescriptionInit>sdp).then(() => {
            console.log("answer set remote description success");
            this
                .createAnswer({
                    offerToReceiveVideo: false,
                    offerToReceiveAudio: true,
                })
                .then(async sdp1 => {
                    await this.setLocalDescription(sdp1);
                    signaling.Send({type: "answer", payload: {dest: destID, sdp: sdp1}})
                })
                .catch(error => {
                    console.log(error);
                });
        });
    }
}

/**
 * Handles the init. of the PeerConnection - Getting audio, setting up the visualization, binding ICE exchange events and data streams
 * @param signaling
 * @param id
 * @param peerConnections
 * @param peerPositions
 * @param clientPositions
 * @param offer
 * @param username
 * @param pfpUrl
 * @constructor
 */
export async function InitPeerConnection(signaling: Signaling, id: string, peerConnections: {
    [p: string]: PeerConnection
}, peerPositions: {[p: string]: Position}, clientPositions: ClientPositions, offer: boolean, username: string, pfpUrl: string) {
    if (id in peerConnections) {
        console.log("id already in peer connections")
        return;
    }

    console.log("PeerConn init with ", signaling.IceServers);
    let peerConnection: PeerConnection = new PeerConnection({iceServers: signaling.IceServers, iceTransportPolicy: "all"});
    signaling.peerRunningIntervals[id] = [];
    clientPositions.SendServerEvent(`PLAYER_JOIN;${username};${id}`);
    console.log("render videos");
    try {
        let [remoteAudio, remoteVideo] = CreatePeerUI(id, pfpUrl, username);
        let stream = UIManager.appUI.localAudioStream!

        stream.getTracks().forEach(track => {
            peerConnection.addTrack(track, stream);
        });

        // Positions data stream init.
        if (offer) {
            console.log("creating data channel");
            let dc = peerConnection.createDataChannel("positions", {ordered: false, maxRetransmits: 0});
            BindPositionsChannel(dc, id, clientPositions, peerPositions);
        } else {
            peerConnection.ondatachannel = (e) => {
                console.log("got data channel");
                if (e.channel.label == "positions"){
                    let dc = e.channel;
                    BindPositionsChannel(dc, id, clientPositions, peerPositions);
                }
            };
        }

        peerConnection.onicecandidate = e => {
            console.log("onicecandidate");
            if (e.candidate === null) return;
            console.log("candidate: " + e.candidate);
            signaling.Send({
                payload: {
                    dest: id, candidate: e.candidate
                }, type: "candidate"
            })
        };

        peerConnection.oniceconnectionstatechange = e => {
            console.log(e);
        };

        let pannerInterval;
        peerConnection.ontrack = async ev => {
            pannerInterval = HandleNewReceivedStream(ev.streams[0], remoteAudio, remoteVideo, id, clientPositions, peerPositions, signaling);
        };

        // uncomment the following line to enable statistics gathering
        // Download Stats button has to be enabled as well
        // InitStatsInterval(signaling, peerConnection, id);

    } catch (e) {
        console.log(e);
    }
    console.log("set new peerConnection");
    peerConnections[id] = peerConnection;
}

function InitStatsInterval(signaling: Signaling, peerConnection: PeerConnection, id: string) {
    const statsInterval = setInterval(async () => {
        try {
            const stats = await peerConnection.getStats();

            let sample: StatSample = {
                timestamp: Date.now(),
            };

            stats.forEach(report => {
                if (report.type === "inbound-rtp" && report.kind === "audio") {
                    sample.packetsLost = report.packetsLost;
                    sample.packetsReceived = report.packetsReceived;
                    sample.jitter = report.jitter;
                }
                if (report.type === "outbound-rtp" && report.kind === "audio") {
                    sample.packetsSent = report.packetsSent;
                    sample.bytesSent = report.bytesSent;
                }
                if (report.type === "candidate-pair" && report.nominated === true) {
                    sample.rtt = report.currentRoundTripTime;
                    sample.availableOutgoingBitrate = report.availableOutgoingBitrate;
                }
            });

            if (!signaling.peerStats![id]) {
                signaling.peerStats![id] = [];
            }
            signaling.peerStats![id].push(sample);
        }
        catch(e: any){
            console.error(e);
        }
    }, 1000);
    signaling.peerRunningIntervals[id].push(statsInterval);
}