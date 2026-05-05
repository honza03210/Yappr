import type {AppUI} from "./interaces/app-ui";
import {PeerConnection} from "./peer-connection";
import {RoomJoin} from "./signaling-handlers";
import {io} from "socket.io-client";
import {ServerConfig} from "./configs/server-config";
import {Signaling} from "./signaling";
import {ClientPositions, Position} from "./client-positions";
import {BindStreamAnimation} from "./visualization";


// TODO: This whole class should be rewritten, it doesn't make much sense to do it like this
export class UIManager {
    static appUI: AppUI;
    static inRoom: boolean = false;
    static buttonsBound = false;
    static pfpUrl: string = "";

    static Initialize() {
        UIManager.appUI = {
            localVideo: document.getElementById('localVideo') as HTMLCanvasElement,
            localAudio: document.getElementById('localAudio') as HTMLAudioElement,
            audioMenu: document.getElementById('audio-menu') as HTMLDivElement,
            nameInput: document.getElementById('name') as HTMLInputElement,
            passwordInput: document.getElementById("password") as HTMLInputElement,
            roomIDInput: document.getElementById("roomID") as HTMLInputElement,
            roomList: document.getElementById("roomList") as HTMLDivElement,
            errorMsgLabel: document.getElementById("errorMsg") as HTMLDivElement,
            videoContainer: document.getElementById("videoContainer") as HTMLDivElement,
            audioCtx: undefined,
        }
    }

    static PrefillFieldsFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        UIManager.appUI.nameInput.value = urlParams.get("username") ?? "";
        UIManager.appUI.roomIDInput.value = urlParams.get("room_id") ?? "";
        UIManager.appUI.passwordInput.value = urlParams.get("password-INSECURE") ?? "";
    }

    static async EnableInitButton(peerConnections: { [p: string]: PeerConnection }, peerPositions: {[p: string]: Position}, positionsSocket: ClientPositions) {
        let comm = io(ServerConfig.url, {
            transports: ['websocket', 'polling'],
            withCredentials: true,
        });

        let signaling: Signaling = new Signaling(comm);
        signaling.Send({type: "listRooms", payload: {}});
        signaling.BindEvents({}, peerConnections, {}, positionsSocket);

        let downloadStatsButton = document.getElementById("downloadStatsButton") as HTMLButtonElement;
        downloadStatsButton.addEventListener('click', async e => {
            DownloadStats(signaling);
        });

        let initButton = document.getElementById("initButton") as HTMLButtonElement;
        initButton.addEventListener('click', async e => {
            this.appUI.audioCtx = new AudioContext();
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true,
                })
                .then(stream => {
                    BindStreamAnimation(stream, this.appUI.audioCtx!);
                });
            this.EnableJoinButton(peerConnections, peerPositions, positionsSocket, signaling);
            initButton.style.display = "none";
        })


        initButton.style.display = "block";
    }

    static EnableJoinButton(peerConnections: { [p: string]: PeerConnection }, peerPositions: {[p: string]: Position}, positionsSocket: ClientPositions,
                            signalling: Signaling) {
        let joinButton = document.getElementById("joinRoomButton") as HTMLButtonElement;

        if (!this.buttonsBound) {
            console.log("join button bound");
            joinButton.addEventListener('click', e => {
                joinButton.style.display = "none";
                document.getElementById("3DInitButton")!.style.display = "none";
                RoomJoin(signalling, peerConnections, peerPositions, positionsSocket);
            });
        }
        joinButton.style.display = "block";
    }

    static EnableDisconnectButton(signalling: Signaling) {
        let disconnectButton = document.getElementById("leaveRoomButton") as HTMLButtonElement;

        disconnectButton.addEventListener('click', async e => {
            signalling.Send({type: "roomLeave"});
            window.location.reload();
        })

        disconnectButton.style.display = "block";
    }
}


function DownloadStats(signaling: Signaling) {
    const jsonString = JSON.stringify(signaling.peerStats, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `yappr-session-stats-${Date.now()}.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}