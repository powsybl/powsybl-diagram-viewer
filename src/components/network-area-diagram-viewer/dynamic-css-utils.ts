/**
 * Copyright (c) 2022-2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export enum THRESHOLD_STATUS {
    BELOW = 'BELOW',
    ABOVE = 'ABOVE',
}

export type DYNAMIC_CSS_DECLARATION = Record<string, ((value: number) => string) | string>;
export type CSS_DECLARATION = Record<string, string>;
export type CSS_RULE = {
    cssSelector: string;
    cssDeclaration: DYNAMIC_CSS_DECLARATION;
    currentValue: CSS_DECLARATION;
};

export function getValueFromThreshold(
    value: number,
    threshold: number,
    aboveThreshold: string,
    belowThreshold: string
) {
    return value > threshold ? aboveThreshold : belowThreshold;
}

export const DEFAULT_DYNAMIC_CSS_RULES: CSS_RULE[] = [
    {
        cssSelector: '.nad-edge-infos', // data on edges (arrows and values)
        cssDeclaration: { display: (value: number) => getValueFromThreshold(value, 2200, 'none', 'block') },
        currentValue: { display: 'none' },
    },
    {
        cssSelector: '.nad-label-box', // tooltips linked to nodes
        cssDeclaration: { display: (value: number) => getValueFromThreshold(value, 3000, 'none', 'block') },
        currentValue: { display: 'none' },
    },
    {
        cssSelector: '.nad-text-edges', // visual link between nodes and their tooltip
        cssDeclaration: { display: (value: number) => getValueFromThreshold(value, 3000, 'none', 'block') },
        currentValue: { display: 'none' },
    },
    {
        cssSelector: '[class^="nad-vl0to30"], [class*=" nad-vl0to30"]',
        cssDeclaration: { display: (value: number) => getValueFromThreshold(value, 4000, 'none', 'block') },
        currentValue: { display: 'none' },
    },
    {
        cssSelector: '[class^="nad-vl30to50"], [class*=" nad-vl30to50"]',
        cssDeclaration: { display: (value: number) => getValueFromThreshold(value, 4000, 'none', 'block') },
        currentValue: { display: 'none' },
    },
    {
        cssSelector: '[class^="nad-vl50to70"], [class*=" nad-vl50to70"]',
        cssDeclaration: { display: (value: number) => getValueFromThreshold(value, 9000, 'none', 'block') },
        currentValue: { display: 'block' },
    },
    {
        cssSelector: '[class^="nad-vl70to120"], [class*=" nad-vl70to120"]',
        cssDeclaration: { display: (value: number) => getValueFromThreshold(value, 9000, 'none', 'block') },
        currentValue: { display: 'block' },
    },
    {
        cssSelector: '[class^="nad-vl120to180"], [class*=" nad-vl120to180"]',
        cssDeclaration: { display: (value: number) => getValueFromThreshold(value, 12000, 'none', 'block') },
        currentValue: { display: 'block' },
    },
    {
        cssSelector: '[class^="nad-vl180to300"], [class*=" nad-vl180to300"]',
        cssDeclaration: { display: (value: number) => getValueFromThreshold(value, 20000, 'none', 'block') },
        currentValue: { display: 'block' },
    },
];
