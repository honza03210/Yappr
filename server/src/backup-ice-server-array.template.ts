// Copy this file to backup-ice-server-array.ts and replace the placeholder
// URLs / credentials with your real STUN/TURN servers.
// backup-ice-server-array.ts is gitignored.
export const IceServers = [
    {
        urls: "stun:stun.example.com:80",
    },
    {
        urls: "turn:turn.example.com:80",
        username: "YOUR_TURN_USERNAME",
        credential: "YOUR_TURN_CREDENTIAL",
    },
    {
        urls: "turn:turn.example.com:80?transport=tcp",
        username: "YOUR_TURN_USERNAME",
        credential: "YOUR_TURN_CREDENTIAL",
    },
    {
        urls: "turn:turn.example.com:443",
        username: "YOUR_TURN_USERNAME",
        credential: "YOUR_TURN_CREDENTIAL",
    },
    {
        urls: "turns:turn.example.com:443?transport=tcp",
        username: "YOUR_TURN_USERNAME",
        credential: "YOUR_TURN_CREDENTIAL",
    },
];
