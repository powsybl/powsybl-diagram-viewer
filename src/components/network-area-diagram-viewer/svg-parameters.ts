/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 */

import { SvgParametersMetadata } from './diagram-metadata';
import { degToRad } from './diagram-utils';

export class SvgParameters {
    static readonly VOLTAGE_LEVEL_CIRCLE_RADIUS_DEFAULT = 30.0;
    static readonly INTER_ANNULUS_SPACE_DEFAULT = 5.0;
    static readonly TRANSFORMER_CIRCLE_RADIUS_DEFAULT = 20.0;
    static readonly EDGES_FORK_APERTURE_DEFAULT = 60;
    static readonly EDGES_FORK_LENGTH_DEFAULT = 80.0;
    static readonly ARROW_SHIFT_DEFAULT = 30.0;
    static readonly ARROW_LABEL_SHIFT_DEFAULT = 19.0;
    static readonly CONVERTER_STATION_WIDTH_DEFAULT = 70.0;
    static readonly NODE_HOLLOW_WIDTH_DEFAULT = 15.0;
    static readonly UNKNOWN_BUS_NODE_EXTRA_RADIUS_DEFAULT = 10.0;
    static readonly EDGE_NAME_DISPLAYED_DEFAULT = true;

    svgParametersMetadata: SvgParametersMetadata | undefined;

    constructor(svgParametersMetadata: SvgParametersMetadata | undefined) {
        this.svgParametersMetadata = svgParametersMetadata;
    }

    public getVoltageLevelCircleRadius(): number {
        return (
            this.svgParametersMetadata?.voltageLevelCircleRadius ?? SvgParameters.VOLTAGE_LEVEL_CIRCLE_RADIUS_DEFAULT
        );
    }

    public getInterAnnulusSpace(): number {
        return this.svgParametersMetadata?.interAnnulusSpace ?? SvgParameters.INTER_ANNULUS_SPACE_DEFAULT;
    }

    public getTransformerCircleRadius(): number {
        return this.svgParametersMetadata?.transformerCircleRadius ?? SvgParameters.TRANSFORMER_CIRCLE_RADIUS_DEFAULT;
    }

    public getEdgesForkAperture(): number {
        return degToRad(this.svgParametersMetadata?.edgesForkAperture ?? SvgParameters.EDGES_FORK_APERTURE_DEFAULT);
    }

    public getEdgesForkLength(): number {
        return this.svgParametersMetadata?.edgesForkLength ?? SvgParameters.EDGES_FORK_LENGTH_DEFAULT;
    }

    public getArrowShift(): number {
        return this.svgParametersMetadata?.arrowShift ?? SvgParameters.ARROW_SHIFT_DEFAULT;
    }

    public getArrowLabelShift(): number {
        return this.svgParametersMetadata?.arrowLabelShift ?? SvgParameters.ARROW_LABEL_SHIFT_DEFAULT;
    }

    public getConverterStationWidth(): number {
        return this.svgParametersMetadata?.converterStationWidth ?? SvgParameters.CONVERTER_STATION_WIDTH_DEFAULT;
    }

    public getNodeHollowWidth(): number {
        return this.svgParametersMetadata?.nodeHollowWidth ?? SvgParameters.NODE_HOLLOW_WIDTH_DEFAULT;
    }

    public getUnknownBusNodeExtraRadius(): number {
        return (
            this.svgParametersMetadata?.unknownBusNodeExtraRadius ?? SvgParameters.UNKNOWN_BUS_NODE_EXTRA_RADIUS_DEFAULT
        );
    }

    public getEdgeNameDisplayed(): boolean {
        return this.svgParametersMetadata?.edgeNameDisplayed ?? SvgParameters.EDGE_NAME_DISPLAYED_DEFAULT;
    }
}
