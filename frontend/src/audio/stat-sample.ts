/**
 * Used to store a stat sample when gathering connection statistics
 */
export type StatSample = {
    timestamp: number;

    packetsLost?: number;
    packetsReceived?: number;
    jitter?: number;

    packetsSent?: number;
    bytesSent?: number;

    rtt?: number;
    availableOutgoingBitrate?: number;
};
