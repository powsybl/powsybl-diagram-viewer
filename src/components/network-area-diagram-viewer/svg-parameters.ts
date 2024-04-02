/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export class SvgParameters {
    // the SVG parameters values are now hardcoded in this class
    // the idea is to read them from the metadata included in the SVG
    busAnnulusOuterRadius = 27.5;
    transfomerCircleRadius = 20;
    edgeForkAperture = 60;
    edgeForkLength = 80.0;
    arrowShift = 30.0;
    arrowLabelShift = 19.0;

    public getBusAnnulusOuterRadius(): number {
        return this.busAnnulusOuterRadius;
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
}
