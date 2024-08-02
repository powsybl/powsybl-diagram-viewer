/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

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
    static readonly DETAILED_TEXT_NODE_Y_SHIFT_PARAMETER_NAME = 'detailedtextnodeyshift';

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
    static readonly DETAILED_TEXT_NODE_Y_SHIFT_DEFAULT = 25.0;

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
    detailedTextNodeYShift: number;

    constructor(svgParametersElement: SVGGraphicsElement | null) {
        this.voltageLevelCircleRadius = this.getNumberParameter(
            svgParametersElement,
            SvgParameters.VOLTAGE_LEVEL_CIRCLE_RADIUS_PARAMETER_NAME,
            SvgParameters.VOLTAGE_LEVEL_CIRCLE_RADIUS_DEFAULT
        );
        this.interAnnulusSpace = this.getNumberParameter(
            svgParametersElement,
            SvgParameters.INTER_ANNULUS_SPACE_PARAMETER_NAME,
            SvgParameters.INTER_ANNULUS_SPACE_DEFAULT
        );
        this.transformerCircleRadius = this.getNumberParameter(
            svgParametersElement,
            SvgParameters.TRANSFORMER_CIRCLE_RADIUS_PARAMETER_NAME,
            SvgParameters.TRANSFORMER_CIRCLE_RADIUS_DEFAULT
        );
        this.edgesForkAperture = this.getNumberParameter(
            svgParametersElement,
            SvgParameters.EDGES_FORK_APERTURE_PARAMETER_NAME,
            SvgParameters.EDGES_FORK_APERTURE_DEFAULT
        );
        this.edgesForkLength = this.getNumberParameter(
            svgParametersElement,
            SvgParameters.EDGES_FORK_LENGTH_PARAMETER_NAME,
            SvgParameters.EDGES_FORK_LENGTH_DEFAULT
        );
        this.arrowShift = this.getNumberParameter(
            svgParametersElement,
            SvgParameters.ARROW_SHIFT_PARAMETER_NAME,
            SvgParameters.ARROW_SHIFT_DEFAULT
        );
        this.arrowLabelShift = this.getNumberParameter(
            svgParametersElement,
            SvgParameters.ARROW_LABEL_SHIFT_PARAMETER_NAME,
            SvgParameters.ARROW_LABEL_SHIFT_DEFAULT
        );
        this.converterStationWidth = this.getNumberParameter(
            svgParametersElement,
            SvgParameters.CONVERTER_STATION_WIDTH_PARAMETER_NAME,
            SvgParameters.CONVERTER_STATION_WIDTH_DEFAULT
        );
        this.nodeHollowWidth = this.getNumberParameter(
            svgParametersElement,
            SvgParameters.NODE_HOLLOW_WIDTH_PARAMETER_NAME,
            SvgParameters.NODE_HOLLOW_WIDTH_DEFAULT
        );
        this.unknownBusNodeExtraRadius = this.getNumberParameter(
            svgParametersElement,
            SvgParameters.UNKNOWN_BUS_NODE_EXTRA_RADIUS_PARAMETER_NAME,
            SvgParameters.UNKNOWN_BUS_NODE_EXTRA_RADIUS_DEFAULT
        );
        this.edgeNameDisplayed = this.getBooleanParameter(
            svgParametersElement,
            SvgParameters.EDGE_NAME_DISPLAYED_PARAMETER_NAME,
            SvgParameters.EDGE_NAME_DISPLAYED_DEFAULT
        );
        // parameter moved from svg parameters to layout parameters
        // value hardcoded, waiting for the layout parameter in metadata
        this.detailedTextNodeYShift =
            SvgParameters.DETAILED_TEXT_NODE_Y_SHIFT_DEFAULT;
    }

    private getNumberParameter(
        svgParametersElement: SVGGraphicsElement | null,
        parameterName: string,
        parameterDefault: number
    ): number {
        const parameter = svgParametersElement?.getAttribute(parameterName);
        return parameter !== undefined && parameter !== null ? +parameter : parameterDefault;
    }

    private getBooleanParameter(
        svgParametersElement: SVGGraphicsElement | null,
        parameterName: string,
        parameterDefault: boolean
    ): boolean {
        const parameter = svgParametersElement?.getAttribute(parameterName);
        return parameter !== undefined && parameter !== null ? parameter === 'true' : parameterDefault;
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

    public getDetailedTextNodeYShift(): number {
        return this.detailedTextNodeYShift;
    }
}
