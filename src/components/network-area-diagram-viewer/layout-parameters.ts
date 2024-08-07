/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { getNumberParameter } from './diagram-utils';

export class LayoutParameters {
    static readonly TEXT_NODE_EDGE_CONNECTION_Y_SHIFT_PARAMETER_NAME = 'textnodeedgeconnectionyshift';

    static readonly TEXT_NODE_EDGE_CONNECTION_Y_SHIFT_DEFAULT = 25.0;

    textNodeEdgeConnectionYShift: number;

    constructor(layoutParametersElement: SVGGraphicsElement | null) {
        this.textNodeEdgeConnectionYShift = getNumberParameter(
            layoutParametersElement,
            LayoutParameters.TEXT_NODE_EDGE_CONNECTION_Y_SHIFT_PARAMETER_NAME,
            LayoutParameters.TEXT_NODE_EDGE_CONNECTION_Y_SHIFT_DEFAULT
        );
    }

    public getTextNodeEdgeConnectionYShift(): number {
        return this.textNodeEdgeConnectionYShift;
    }
}
