import {GetMinecraftHeadingVector} from "./converters";

/**
 * Base class representing the position object
 *
 */
export class Position {
    x: number = 0;
    y: number = 0;
    z: number = 0;
    heading: { x: number, y: number, z: number } = {x: 0, y: 0, z: 0};
    pitch: number = 90;
    yaw: number = 0;
    PositionFormat: string | null = null;
    RawPositions: string = "";
}

function getHeadingVector(pitch: number, yaw: number) {
    const pitchRad = pitch * Math.PI / 180;
    const yawRad = yaw * Math.PI / 180;

    const x = Math.cos(pitchRad) * Math.sin(yawRad);
    const y = Math.sin(pitchRad);
    const z = Math.cos(pitchRad) * Math.cos(yawRad);

    return {x, y, z};
}

/**
 * Connects to specified websocket (or window), binds onopen, onmessage, onclose, onerror
 * @param communicator websocket | window to connect
 * The data sent to the communicator has to be in the string format "format;x;y;z;pitch;yaw"
 * If the communicator receives message "GAME_EVENT;*" it will forward this whole message to the connected peers
 * When a peer receives such message, it will forward it to the communicator
 * this can be used to create simple arbitrary data exchange between two connected peers
 */
export class ClientPositions extends Position {
    communicator: WebSocket | Window | null = null;
    parentWindow: Window | null = null;
    sendPeerPositionsBack: boolean = false;
    address: string | null = null;

    constructor(communicator: string | Window) {
        super();
        if (typeof communicator === "string") {
            // will be needed if connection fails
            this.address = communicator;
            this.communicator = new WebSocket(communicator);
        } else {
            this.communicator = window;
            this.parentWindow = communicator;
        }
        this.BindWebSocketMessages();
    }

    /**
     * Sends the data string to the communicator
     * @param data
     * @constructor
     */
    public Send(data: string) {
        if (!this.communicator) {
            return;
        }

        if (this.communicator instanceof WebSocket && this.communicator.readyState == WebSocket.OPEN) {
            this.communicator.send(data)
        } else if (this.communicator instanceof Window) {
            this.parentWindow!.postMessage(data, "*");
        }
    }

    /**
     * Sends the data string to the communicator with the 'SERVER_EVENT' format
     * @param data
     * @constructor
     */
    SendServerEvent(data: string) {
        this.Send("SERVER_EVENT;" + data);
    }


    /**
     * Binds basic open, message, close end error events of the communicator - on message will fill its position
     * Special SERVER and GAME events are also transmitted and handled -> can be used as a networking layer for some arbitrary data exchange
     * @constructor
     */
    BindWebSocketMessages() {
        if (!this.communicator) {
            return;
        }
        this.communicator.addEventListener("open", () => {
            console.log("Positions Connection opened");
        });

        this.communicator.addEventListener("message", (event: any) => {
            if (!event.data) {
                return;
            }
            let data: string[] = event.data.split(";");

            // this will be handled and bound upon data channel creation with every peer
            if (data[0] == "GAME_EVENT") return;

            if (data[0] == "SERVER_EVENT") {
                switch (data[1]) {
                    case "SEND_PEER_POSITIONS":
                        this.sendPeerPositionsBack = data[2] == "true";
                        break;
                }
                return;
            }

            this.RawPositions = data.slice(1, data.length).join(";");
            try {
                this.PositionFormat = data[0];
                // This is a simplification done only for positions for Minecraft
                // this is not a sustainable way to handle positions, the game integrations
                // should be the ones handling conversion into WebAudio format
                if (this.PositionFormat == "mc") {
                    this.x = parseFloat(data[1]);
                    this.y = parseFloat(data[2]);
                    this.z = -parseFloat(data[3]);

                    this.pitch = Math.max(Math.min(90, parseFloat(data[4])), -90);
                    this.yaw = Math.max(Math.min(360, parseFloat(data[5])), -180);

                    this.heading = GetMinecraftHeadingVector(this.pitch, this.yaw);
                } else {
                    this.x = parseFloat(data[1]);
                    this.y = parseFloat(data[2]);
                    this.z = parseFloat(data[3]);
                    if (Number.isNaN(this.x)) this.x = 0;
                    if (Number.isNaN(this.y)) this.y = 0;
                    if (Number.isNaN(this.z)) this.z = 0;

                    // clamp the pitch and yaw
                    this.pitch = Math.max(Math.min(90, parseFloat(data[4])), -90);
                    this.yaw = Math.max(Math.min(360, parseFloat(data[5])), -180);
                    if (Number.isNaN(this.pitch)) this.pitch = 0;
                    if (Number.isNaN(this.yaw)) this.yaw = 0;
                    this.heading = getHeadingVector(this.pitch, this.yaw);
                }
            } catch (e) {
                console.error(e);
            }
        });

        this.communicator.addEventListener("close", () => {
            this.PositionFormat = null;
            this.communicator = null;
        });

        this.communicator.addEventListener("error", (error: any) => {
            if (this.parentWindow) {
                return;
            }
            console.error("WebSocket error:", error);
            setTimeout(() => {
                this.communicator = new WebSocket(this.address!);
                this.BindWebSocketMessages();
            }, 5000)
            this.communicator = null;
        });
    }
}