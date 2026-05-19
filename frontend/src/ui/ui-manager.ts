import type {AppUI} from "../interfaces/app-ui";
import {PeerConnection} from "../audio/peer-connection";
import {RoomJoin} from "../signaling/handlers";
import {io} from "socket.io-client";
import {ServerConfig} from "../configs/server-config";
import {Signaling} from "../signaling/signaling";
import {ClientPositions, Position} from "../position/client-positions";
import {BindStreamAnimation} from "./visualization";
import * as jdenticon from "jdenticon";


export class UIManager {
    static appUI: AppUI;
    static inRoom: boolean = false;
    static buttonsBound = false;
    static pfpUrl: string = "";

    static Initialize() {
        UIManager.appUI = {
            localVisualization: document.getElementById('localVisualization') as HTMLCanvasElement,
            localAudio: document.getElementById('localAudio') as HTMLAudioElement,
            audioMenu: document.getElementById('audio-menu') as HTMLDivElement,
            nameInput: document.getElementById('name') as HTMLInputElement,
            passwordInput: document.getElementById("password") as HTMLInputElement,
            roomIDInput: document.getElementById("roomID") as HTMLInputElement,
            roomList: document.getElementById("roomList") as HTMLDivElement,
            errorMsgLabel: document.getElementById("errorMsg") as HTMLDivElement,
            peerContainer: document.getElementById("peerContainer") as HTMLDivElement,
            audioCtx: undefined,
            localAudioStream: undefined,
        }
        this.setPfp();
    }

    static setPfp(){
        const urlParams = new URLSearchParams(window.location.search);

        UIManager.pfpUrl = urlParams.get("pfp_url") ?? "";
        if (UIManager.pfpUrl.length > 6) {
            const pfp = document.createElement("img");
            pfp.classList.add("pfp");
            pfp.height = 64;
            pfp.width = 64;
            pfp.src = UIManager.pfpUrl;
            UIManager.appUI.audioMenu.append(pfp);
        } else {
            const pfp: SVGSVGElement = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "svg"
            );

            pfp.classList.add("pfp");
            pfp.setAttribute("width", "70");
            pfp.setAttribute("height", "70");

            pfp.style.borderRadius = "50%";
            pfp.style.overflow = "hidden";

            UIManager.appUI.audioMenu.append(pfp);

            jdenticon.update(pfp, UIManager.appUI.nameInput.value);

            UIManager.appUI.nameInput.onchange = (e) => {
                jdenticon.update(pfp, UIManager.appUI.nameInput.value);
            }
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
            try {
                await this.initAudio();
                this.EnableJoinButton(peerConnections, peerPositions, positionsSocket, signaling);
                initButton.style.display = "none";
            } catch (err) {
                this.appUI.errorMsgLabel.innerText = `init failed: ${(err as Error)?.message ?? err}`;
            }
        })


        initButton.style.display = "block";
    }

    static async initAudio(){
        this.appUI.audioCtx = new AudioContext();
        const stream = await navigator.mediaDevices
            .getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: 2,
                    sampleRate: 48000,
                    sampleSize: 16,
                }
            })
        BindStreamAnimation(stream, this.appUI.audioCtx!);
        this.appUI.localAudioStream = stream;
    }

    static updateRoomsList(roomsList: any){
        document.getElementById("rooms-list")?.replaceChildren(...roomsList.map(
            (room: {roomID : string, numberOfUsers: number}) => {
                let div = document.createElement("div");
                div.innerText = `${room.roomID} : ${room.numberOfUsers} users connected`;
                let button = document.createElement("button");
                button.innerText = "Join room";
                button.classList.add("menu-button");
                button.addEventListener("click", async () => {
                    window.open(window.location.origin + `/?username=${UIManager.appUI.nameInput.value}&room_id=${room.roomID}&autojoin="true"`, "_blank");
                })
                div.appendChild(button);
                return div;
            }))
    }

    static EnableJoinButton(peerConnections: { [p: string]: PeerConnection }, peerPositions: {[p: string]: Position}, positionsSocket: ClientPositions,
                            signaling: Signaling) {
        let joinButton = document.getElementById("joinRoomButton") as HTMLButtonElement;

        if (!this.buttonsBound) {
            console.log("join button bound");
            joinButton.addEventListener('click', e => {
                joinButton.style.display = "none";
                document.getElementById("3DInitButton")!.style.display = "none";
                RoomJoin(signaling, peerConnections, peerPositions, positionsSocket);
            });
        }
        joinButton.style.display = "block";
    }

    static EnableDisconnectButton(signaling: Signaling) {
        let disconnectButton = document.getElementById("leaveRoomButton") as HTMLButtonElement;

        disconnectButton.addEventListener('click', async e => {
            signaling.Send({type: "roomLeave"});
            window.location.reload();
        })

        disconnectButton.style.display = "block";
    }
}

/**
 * Downloads all the stats collected in signaling
 * @param signaling
 * @constructor
 */
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