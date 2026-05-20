import {Format} from "./formats";

/**
 * 
 * @param pitch
 * @param yaw
 * @constructor
 */
export function GetMinecraftHeadingVector(pitch: number, yaw: number) {
    const pitchRad = pitch * Math.PI / 180;
    const yawRad = yaw * Math.PI / 180;

    const x = -Math.sin(yawRad) * Math.cos(pitchRad);
    const y = -Math.sin(pitchRad);
    const z =  Math.cos(yawRad) * Math.cos(pitchRad);

    return { x, y, z };
}

export function ConvertFormatToWebAudio(format: Format, x: number, y: number, z: number, pitch: number, yaw: number){

}