/**
 * Copyright (c) 2022-2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export type CSSDECLARATION = Record<string, string>;
export type CSSRULE = {
    cssSelector: string;
    belowThresholdCssDeclaration: CSSDECLARATION;
    aboveThresholdCssDeclaration: CSSDECLARATION;
    threshold: number;
    thresholdStatus: THRESHOLD_STATUS;
};
export enum THRESHOLD_STATUS {
    BELOW,
    ABOVE,
}

export const DEFAULT_DYNAMIC_CSS_RULES: CSSRULE[] = [
    {
        cssSelector: '.nad-edge-infos', // data on edges (arrows and values)
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 2200,
        thresholdStatus: THRESHOLD_STATUS.ABOVE,
    },
    {
        cssSelector: '.nad-label-box', // tooltips linked to nodes
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 3000,
        thresholdStatus: THRESHOLD_STATUS.ABOVE,
    },
    {
        cssSelector: '.nad-text-edges', // visual link between nodes and their tooltip
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 3000,
        thresholdStatus: THRESHOLD_STATUS.ABOVE,
    },
    {
        cssSelector: '[class^="nad-vl0to30"], [class*=" nad-vl0to30"]',
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 4000,
        thresholdStatus: THRESHOLD_STATUS.BELOW,
    },
    {
        cssSelector: '[class^="nad-vl30to50"], [class*=" nad-vl30to50"]',
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 4000,
        thresholdStatus: THRESHOLD_STATUS.BELOW,
    },
    {
        cssSelector: '[class^="nad-vl50to70"], [class*=" nad-vl50to70"]',
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 9000,
        thresholdStatus: THRESHOLD_STATUS.BELOW,
    },
    {
        cssSelector: '[class^="nad-vl70to120"], [class*=" nad-vl70to120"]',
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 9000,
        thresholdStatus: THRESHOLD_STATUS.BELOW,
    },
    {
        cssSelector: '[class^="nad-vl120to180"], [class*=" nad-vl120to180"]',
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 12000,
        thresholdStatus: THRESHOLD_STATUS.BELOW,
    },
    {
        cssSelector: '[class^="nad-vl180to300"], [class*=" nad-vl180to300"]',
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 20000,
        thresholdStatus: THRESHOLD_STATUS.BELOW,
    },
];
