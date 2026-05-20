import {ClientPositions, Position} from "../position/client-positions";

/**
 * Binding positions data stream to actual position objects to read from
 * @param dc
 * @param id
 * @param clientPositions
 * @param peerPositions
 * @constructor
 */
export function BindPositionsChannel(dc: RTCDataChannel, id: string, clientPositions: ClientPositions, peerPositions: {
    [p: string]: Position
}) {
    if (clientPositions.communicator) {
        clientPositions.communicator!.addEventListener("message", (event: any) => {
            if (!event.data) {
                return;
            }
            let data: string[] = event.data.split(";");
            if (data[0] == "GAME_EVENT" && dc.readyState == "open") {
                dc.send(event.data);
                return;
            }
        });
    }

    function startPositionsLoop() {
        peerPositions[id] = new Position();
        let lastPosition = "";

        function sendPos() {
            setTimeout(() => {
                if (lastPosition != clientPositions.RawPositions) {
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
            clientPositions.Send(event.data);
            return;
        }
        peerPositions[id].PositionFormat = format;
        peerPositions[id].RawPositions = data.slice(1).join(";");
        try {
            // Minecraft is the only format that doesn't need to transform the coordinates in the game
            // In the future, all games will need to transform the positions themselves, as keeping format
            // converters here just is not sustainable
            if (format == "mc") {
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