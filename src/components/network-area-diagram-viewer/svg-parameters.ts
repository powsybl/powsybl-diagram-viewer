/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export class SvgParameters {
    // the SVG parameters values are now hardcoded in this class
    // the idea is to read them from the metadata included in the SVG
    voltageLevelCircleRadius = 30.0;
    interAnnulusSpace = 5.0;
    transfomerCircleRadius = 20;
    edgeForkAperture = 60;
    edgeForkLength = 80.0;
    arrowShift = 30.0;
    arrowLabelShift = 19.0;
    converterStationWidth = 70.0;
    nodeHollowWidth = 15.0;

    public getVoltageLevelCircleRadius(): number {
        return this.voltageLevelCircleRadius;
    }

    public getInterAnnulusSpace(): number {
        return this.interAnnulusSpace;
    }

    public getTransfomerCircleRadius(): number {
        return this.transfomerCircleRadius;
    }

    public getEdgeForkAperture(): number {
        return this.edgeForkAperture;
    }

    public getEdgeForkLength(): number {
        return this.edgeForkLength;
    }

    public getArrowShift(): number {
        return this.arrowShift;
    }

    public getArrowLabelShift(): number {
        return this.arrowLabelShift;
    }

    public getConverterStationWidth(): number {
        return this.converterStationWidth;
    }

    public getNodeHollowWidth(): number {
        return this.nodeHollowWidth;
    }
}
