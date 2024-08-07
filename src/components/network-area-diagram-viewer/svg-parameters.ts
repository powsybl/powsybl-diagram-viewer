/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { getNumberParameter, getBooleanParameter } from './diagram-utils';

export class SvgParameters {
    static readonly VOLTAGE_LEVEL_CIRCLE_RADIUS_PARAMETER_NAME = 'voltagelevelcircleradius';
    static readonly INTER_ANNULUS_SPACE_PARAMETER_NAME = 'interannulusspace';
    static readonly TRANSFORMER_CIRCLE_RADIUS_PARAMETER_NAME = 'transformercircleradius';
    static readonly EDGES_FORK_APERTURE_PARAMETER_NAME = 'edgesforkaperture';
    static readonly EDGES_FORK_LENGTH_PARAMETER_NAME = 'edgesforklength';
    static readonly ARROW_SHIFT_PARAMETER_NAME = 'arrowshift';
    static readonly ARROW_LABEL_SHIFT_PARAMETER_NAME = 'arrowlabelshift';
    static readonly CONVERTER_STATION_WIDTH_PARAMETER_NAME = 'converterstationwidth';
    static readonly NODE_HOLLOW_WIDTH_PARAMETER_NAME = 'nodehollowwidth';
    static readonly UNKNOWN_BUS_NODE_EXTRA_RADIUS_PARAMETER_NAME = 'unknownbusnodeextraradius';
    static readonly EDGE_NAME_DISPLAYED_PARAMETER_NAME = 'edgenamedisplayed';

    static readonly VOLTAGE_LEVEL_CIRCLE_RADIUS_DEFAULT = 30.0;
    static readonly INTER_ANNULUS_SPACE_DEFAULT = 5.0;
    static readonly TRANSFORMER_CIRCLE_RADIUS_DEFAULT = 20.0;
    static readonly EDGES_FORK_APERTURE_DEFAULT = 1.05;
    static readonly EDGES_FORK_LENGTH_DEFAULT = 80.0;
    static readonly ARROW_SHIFT_DEFAULT = 30.0;
    static readonly ARROW_LABEL_SHIFT_DEFAULT = 19.0;
    static readonly CONVERTER_STATION_WIDTH_DEFAULT = 70.0;
    static readonly NODE_HOLLOW_WIDTH_DEFAULT = 15.0;
    static readonly UNKNOWN_BUS_NODE_EXTRA_RADIUS_DEFAULT = 10.0;
    static readonly EDGE_NAME_DISPLAYED_DEFAULT = true;

    voltageLevelCircleRadius: number;
    interAnnulusSpace: number;
    transformerCircleRadius: number;
    edgesForkAperture: number;
    edgesForkLength: number;
    arrowShift: number;
    arrowLabelShift: number;
    converterStationWidth: number;
    nodeHollowWidth: number;
    unknownBusNodeExtraRadius: number;
    edgeNameDisplayed: boolean;

    constructor(svgParametersElement: SVGGraphicsElement | null) {
        this.voltageLevelCircleRadius = getNumberParameter(
            svgParametersElement,
            SvgParameters.VOLTAGE_LEVEL_CIRCLE_RADIUS_PARAMETER_NAME,
            SvgParameters.VOLTAGE_LEVEL_CIRCLE_RADIUS_DEFAULT
        );
        this.interAnnulusSpace = getNumberParameter(
            svgParametersElement,
            SvgParameters.INTER_ANNULUS_SPACE_PARAMETER_NAME,
            SvgParameters.INTER_ANNULUS_SPACE_DEFAULT
        );
        this.transformerCircleRadius = getNumberParameter(
            svgParametersElement,
            SvgParameters.TRANSFORMER_CIRCLE_RADIUS_PARAMETER_NAME,
            SvgParameters.TRANSFORMER_CIRCLE_RADIUS_DEFAULT
        );
        this.edgesForkAperture = getNumberParameter(
            svgParametersElement,
            SvgParameters.EDGES_FORK_APERTURE_PARAMETER_NAME,
            SvgParameters.EDGES_FORK_APERTURE_DEFAULT
        );
        this.edgesForkLength = getNumberParameter(
            svgParametersElement,
            SvgParameters.EDGES_FORK_LENGTH_PARAMETER_NAME,
            SvgParameters.EDGES_FORK_LENGTH_DEFAULT
        );
        this.arrowShift = getNumberParameter(
            svgParametersElement,
            SvgParameters.ARROW_SHIFT_PARAMETER_NAME,
            SvgParameters.ARROW_SHIFT_DEFAULT
        );
        this.arrowLabelShift = getNumberParameter(
            svgParametersElement,
            SvgParameters.ARROW_LABEL_SHIFT_PARAMETER_NAME,
            SvgParameters.ARROW_LABEL_SHIFT_DEFAULT
        );
        this.converterStationWidth = getNumberParameter(
            svgParametersElement,
            SvgParameters.CONVERTER_STATION_WIDTH_PARAMETER_NAME,
            SvgParameters.CONVERTER_STATION_WIDTH_DEFAULT
        );
        this.nodeHollowWidth = getNumberParameter(
            svgParametersElement,
            SvgParameters.NODE_HOLLOW_WIDTH_PARAMETER_NAME,
            SvgParameters.NODE_HOLLOW_WIDTH_DEFAULT
        );
        this.unknownBusNodeExtraRadius = getNumberParameter(
            svgParametersElement,
            SvgParameters.UNKNOWN_BUS_NODE_EXTRA_RADIUS_PARAMETER_NAME,
            SvgParameters.UNKNOWN_BUS_NODE_EXTRA_RADIUS_DEFAULT
        );
        this.edgeNameDisplayed = getBooleanParameter(
            svgParametersElement,
            SvgParameters.EDGE_NAME_DISPLAYED_PARAMETER_NAME,
            SvgParameters.EDGE_NAME_DISPLAYED_DEFAULT
        );
    }

    public getVoltageLevelCircleRadius(): number {
        return this.voltageLevelCircleRadius;
    }

    public getInterAnnulusSpace(): number {
        return this.interAnnulusSpace;
    }

    public getTransformerCircleRadius(): number {
        return this.transformerCircleRadius;
    }

    public getEdgesForkAperture(): number {
        return this.edgesForkAperture;
    }

    public getEdgesForkLength(): number {
        return this.edgesForkLength;
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

    public getUnknownBusNodeExtraRadius(): number {
        return this.unknownBusNodeExtraRadius;
    }

    public getEdgeNameDisplayed(): boolean {
        return this.edgeNameDisplayed;
    }
}
