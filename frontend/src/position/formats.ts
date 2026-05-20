/**
 * Currently unused, the game integration should send the coordinates in the coordinate system WebAudio expects for a panner node
 */

export class Format {
    label: string;
    up: string;
    right: string;
    front: string;
    pitchMax: number;
    pitchMin: number;
    yawMax: number;
    yawMin: number;
    yawZero: string;
    constructor(label: string, up: string, right: string, front: string, pitchMax: number, pitchMin: number, yawMax:number, yawMin: number, yawZero: string) {
        this.label = label;
        this.up = up;
        this.right = right;
        this.front = front;
        this.pitchMax = pitchMax;
        this.pitchMin = pitchMin;
        this.yawMax = yawMax;
        this.yawMin = yawMin;
        this.yawZero = yawZero;
    }
}

export class PositionFormats {
    static formats: Map<string, Format> = new Map();
    constructor() {
        PositionFormats.formats.set("mc", new Format(
            "mc",
            "+y",
            "+x",
            "-z",
            90,
            -90,
            180,
            -180,
            "-z"));
        PositionFormats.formats.set("3d", new Format(
            "3d",
            "+y",
            "+x",
            "+z",
            90,
            -90,
            0,
            360,
            "+z"));

    }
}

export function ConvertFormatToWebAudio(label: string, x: number, y: number, z: number, pitch: number, yaw: number){
    const format: Format | undefined = PositionFormats.formats.get(label);
    if (format === undefined){
        throw new Error("Unknown format");
    }


}