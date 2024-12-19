/**
 * Copyright (c) 2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 */

import { LayoutParametersMetadata } from './diagram-metadata';

export class LayoutParameters {
    static readonly TEXT_NODE_EDGE_CONNECTION_Y_SHIFT_DEFAULT = 25.0;

    layoutParametersMetadata: LayoutParametersMetadata | undefined;

    constructor(layoutParametersMetadata: LayoutParametersMetadata | undefined) {
        this.layoutParametersMetadata = layoutParametersMetadata;
    }

    public getTextNodeEdgeConnectionYShift(): number {
        return (
            this.layoutParametersMetadata?.textNodeEdgeConnectionYShift ??
            LayoutParameters.TEXT_NODE_EDGE_CONNECTION_Y_SHIFT_DEFAULT
        );
    }
}
