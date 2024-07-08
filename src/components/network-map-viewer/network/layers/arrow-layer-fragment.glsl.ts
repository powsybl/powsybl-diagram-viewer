/**
 * Copyright (c) 2022, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const fs = `\
#version 300 es
#define SHADER_NAME arrow-layer-fragment-shader
precision highp float;
in vec4 vFillColor;
in float shouldDiscard;
out vec4 fragmentColor;
void main(void) {
    if (shouldDiscard > 0.0) {
        discard;
    }
    fragmentColor = vFillColor;
}
`;
export default fs;
