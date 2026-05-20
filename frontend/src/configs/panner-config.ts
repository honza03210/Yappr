/**
 * Default panner node config.
 * In the future, this could be set dynamically from the url (game would set the params)
 * @param panNode
 * @constructor
 */
export function SetPanNodeParams(panNode: PannerNode) {
    panNode.panningModel = "equalpower";
    panNode.distanceModel = "linear";
    panNode.refDistance = 5;
    panNode.maxDistance = 70;
    panNode.rolloffFactor = 1;
    panNode.coneInnerAngle = 360;
    panNode.coneOuterAngle = 360;
    panNode.coneOuterGain = 1;
}
