import {ClientPositions, Position} from "../position/client-positions";
import {UIManager} from "../ui/ui-manager";

/**
 * Binding positions data stream to actual position objects to read from
 * @param dc
 * @param id
 * @param clientPositions
 * @param peerPositions
 * @constructor
 */
export function BindPositionsChannel(dc: RTCDataChannel, id: string, clientPositions : ClientPositions, peerPositions: {[p: string]: Position}) {
    if (clientPositions.communicator) {
        clientPositions.communicator!.addEventListener("message", (event: any) => {
            if (!event.data) {
                return;
            }
            console.log("Received:", event.data);
            let data = event.data.split(";");
            if (data[0] == "GAME_EVENT" && dc.readyState == "open") {
                console.log("Sent GAME_EVENT message: ", event.data);
                dc.send(event.data);
                return;
            }
        });
    }

    function startPositionsLoop(){
        console.log("DataChannel open");
        peerPositions[id] = new Position();
        console.log("peerPositions:", id, peerPositions[id]);
        let lastPosition = "";
        function sendPos() {
            setTimeout(() => {
                if (lastPosition != clientPositions.RawPositions){
                    dc.send(clientPositions.PositionFormat + ";" + clientPositions.RawPositions);
                    lastPosition = clientPositions.RawPositions;
                }

                sendPos()
            }, 50)
        }
        setTimeout(sendPos, 50);
    }

    dc.onopen = startPositionsLoop;

    if (dc.readyState === "open") {
        setTimeout(startPositionsLoop, 50);
    }

    dc.onmessage = (event: { data: string }) => {
        let data = event.data.split(";");
        let format = data[0];
        if (format == "GAME_EVENT" && clientPositions.communicator) {
            console.log("Received GAME_EVENT message: ", event.data);
            clientPositions.Send(event.data);
            return;
        }
        peerPositions[id].PositionFormat = format;
        peerPositions[id].RawPositions = data.slice(1).join(";");
        try {
            if (format == "mc"){
                peerPositions[id].x = parseFloat(data[1]);
                peerPositions[id].y = parseFloat(data[2]);
                peerPositions[id].z = -parseFloat(data[3]);
                if (Number.isNaN(peerPositions[id].x)) peerPositions[id].x = 0;
                if (Number.isNaN(peerPositions[id].y)) peerPositions[id].y = 0;
                if (Number.isNaN(peerPositions[id].z)) peerPositions[id].z = 0;


                peerPositions[id].pitch = parseFloat(data[4]);
                peerPositions[id].yaw = parseFloat(data[5]);
                if (Number.isNaN(peerPositions[id].pitch)) peerPositions[id].pitch = 0;
                if (Number.isNaN(peerPositions[id].yaw)) peerPositions[id].yaw = 0;
            } else {
                peerPositions[id].x = parseFloat(data[1]);
                peerPositions[id].y = parseFloat(data[2]);
                peerPositions[id].z = parseFloat(data[3]);
                if (Number.isNaN(peerPositions[id].x)) peerPositions[id].x = 0;
                if (Number.isNaN(peerPositions[id].y)) peerPositions[id].y = 0;
                if (Number.isNaN(peerPositions[id].z)) peerPositions[id].z = 0;


                peerPositions[id].pitch = parseFloat(data[4]);
                peerPositions[id].yaw = parseFloat(data[5]);
                if (Number.isNaN(peerPositions[id].pitch)) peerPositions[id].pitch = 0;
                if (Number.isNaN(peerPositions[id].yaw)) peerPositions[id].yaw = 0;
            }
        } catch (e) {
            console.error(e);
        }
        if (clientPositions.sendPeerPositionsBack) {
            clientPositions.SendServerEvent(`POSITION;${id};${peerPositions[id].RawPositions}`);
        }
    }
}


// /**
//  * Binding positions data stream to actual position objects to read from
//  * @param dc
//  * @param userID
//  * @constructor
//  */
// export function BindLatencyChannel(dc: RTCDataChannel, userID: string) {
//     console.log("BindLatencyChannel");
//
//     function startPingLoop(){
//         console.log("LatencyChannel open");
//         function sendPing() {
//             setTimeout(() => {
//                 const now = Date.now();
//                 dc.send(JSON.stringify({ type: "ping", t: now }));
//                 sendPing()
//             }, 1000)
//         }
//         setTimeout(sendPing, 1000);
//     }
//
//     dc.onopen = startPingLoop;
//
//     if (dc.readyState === "open") {
//         setTimeout(startPingLoop, 50);
//     }
//
//     let latencyView = document.getElementById("latency-" + userID)
//
//     dc.onmessage = (e: { data: string }) => {
//         const msg = JSON.parse(e.data);
//
//         if (msg.type === "ping") {
//             dc.send(JSON.stringify({ type: "pong", t: msg.t }));
//         }
//
//         if (msg.type === "pong") {
//             const rtt = Date.now() - msg.t;
//             // latencyView!.innerText = "" + rtt.toString() + " ms";
//             console.log("Ping:", rtt, "ms");
//         }
//     }
// }