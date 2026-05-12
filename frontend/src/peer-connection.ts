import {Signaling} from "./signaling";
import {UIManager} from "./ui-manager";
import {ClientPositions, Position} from "./client-positions";
import * as jdenticon from "jdenticon";
import {BindPositionsChannel} from "./data-channels";
import {StatSample} from "./stat-sample";
import {HandleNewReceivedStream} from "./stream-handling";

/**
 * Class taking care of the connection between the peers - used to abstract Offer/Answer exchange
 */
export class PeerConnection extends RTCPeerConnection {
    async CreateOffer(signalling: Signaling, destID: string) {
        console.log("create offer");
        this
            .createOffer({offerToReceiveAudio: true, offerToReceiveVideo: false})
            .then(async sdp => {
                await this.setLocalDescription(sdp);
                signalling.Send({type: "offer", payload: {dest: destID, sdp: sdp, pfpUrl: UIManager.pfpUrl}});
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
    clientPositions.SendServerEvent(`PLAYER_JOIN;${username};${id}`);
    console.log("render videos");
    try {
        // Getting the local audio stream
        // TODO: get it just once and then reuse it
        let stream = UIManager.appUI.localAudioStream!

        const peerContainer = document.createElement("div");
        peerContainer.classList.add("roomBound");
        peerContainer.style.position = "relative";
        peerContainer.id = "peerContainer-" + id;
        const peerVisualizationContainer = document.createElement("div");
        peerVisualizationContainer.style.position = "relative";
        const remoteVideo = document.createElement("canvas");
        remoteVideo.width = 128;
        remoteVideo.height = 128;
        remoteVideo.style.display = "block";

        const remoteAudio: HTMLAudioElement = document.createElement("audio");

        remoteVideo.id = "remoteVideo-" + id;
        remoteVideo.classList.add("roomBound");
        remoteAudio.id = "remoteAudio-" + id;

        remoteAudio.autoplay = true;
        remoteAudio.muted = false;
        remoteAudio.classList.add("roomBound");

        let pfp: HTMLImageElement | SVGSVGElement;
        console.log("pfp url: ", pfpUrl);
        if (pfpUrl != "" && pfpUrl != undefined) {
            pfp = document.createElement("img");
            pfp.classList.add("pfp");
            pfp.height = 64;
            pfp.width = 64;
            pfp.src = pfpUrl;
        } else {
            pfp = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "svg"
            );

            pfp.classList.add("pfp");
            pfp.setAttribute("width", "70");
            pfp.setAttribute("height", "70");

            pfp.style.borderRadius = "50%";
            pfp.style.overflow = "hidden";
        }

        const latency = document.createElement("div");
        latency.id = "latency-" + id;
        latency.innerText = username;
        latency.style.textAlign = "center";
        latency.classList.add("latency");


        if (UIManager.appUI.videoContainer) {
            peerVisualizationContainer.append(remoteAudio, remoteVideo);
            if (pfpUrl == "" || pfpUrl == undefined) jdenticon.update(pfp, username);
            peerVisualizationContainer.append(pfp);
            peerContainer.append(peerVisualizationContainer);
            peerContainer.append(latency);
            UIManager.appUI.videoContainer.appendChild(peerContainer);
        }

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

        let pannerInterval = 0;
        peerConnection.ontrack = async ev => {
            pannerInterval = HandleNewReceivedStream(ev.streams[0], remoteAudio, remoteVideo, id, clientPositions, peerPositions);
        };

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
                    if (report.type === "candidate-pair" && report.state === "succeeded") {
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
                clearInterval(statsInterval);
                clearInterval(pannerInterval);
                console.log("stopped gathering stats for", peerConnection);
            }

        }, 1000);
    } catch (e) {
        console.log(e);
    }
    console.log("set new peerConnection");
    peerConnections[id] = peerConnection;
}
