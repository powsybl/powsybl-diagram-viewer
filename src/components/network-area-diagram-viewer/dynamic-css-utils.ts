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

export enum CSS_RULE_TYPE {
    THRESHOLD_DRIVEN = 'THRESHOLD_DRIVEN',
    FUNCTION_DRIVEN = 'FUNCTION_DRIVEN ',
}

export type CSS_DECLARATION = Record<string, string>;
export type CSS_DECLARATION_CALLBACK = (value: number) => string;
export type DYNAMIC_CSS_DECLARATION = Record<string, CSS_DECLARATION_CALLBACK>;

type CSS_RULE_BASE = {
    cssSelector: string;
    type: CSS_RULE_TYPE;
};

export type CSS_RULE_THRESHOLD_DRIVEN = CSS_RULE_BASE & {
    type: CSS_RULE_TYPE.THRESHOLD_DRIVEN;
    belowThresholdCssDeclaration: CSS_DECLARATION;
    aboveThresholdCssDeclaration: CSS_DECLARATION;
    threshold: number;
    thresholdStatus: THRESHOLD_STATUS;
};

export type CSS_RULE_FUNCTION_DRIVEN = CSS_RULE_BASE & {
    type: CSS_RULE_TYPE.FUNCTION_DRIVEN;
    cssDeclaration: DYNAMIC_CSS_DECLARATION;
    currentValue: CSS_DECLARATION;
};

export type CSS_RULE = CSS_RULE_THRESHOLD_DRIVEN | CSS_RULE_FUNCTION_DRIVEN;

export const DEFAULT_DYNAMIC_CSS_RULES: CSS_RULE[] = [
    {
        cssSelector: '.nad-edge-infos', // data on edges (arrows and values)
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 2200,
        thresholdStatus: THRESHOLD_STATUS.ABOVE,
        type: CSS_RULE_TYPE.THRESHOLD_DRIVEN,
    },
    {
        cssSelector: '.nad-label-box', // tooltips linked to nodes
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 3000,
        thresholdStatus: THRESHOLD_STATUS.ABOVE,
        type: CSS_RULE_TYPE.THRESHOLD_DRIVEN,
    },
    {
        cssSelector: '.nad-text-edges', // visual link between nodes and their tooltip
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 3000,
        thresholdStatus: THRESHOLD_STATUS.ABOVE,
        type: CSS_RULE_TYPE.THRESHOLD_DRIVEN,
    },
    {
        cssSelector: '[class^="nad-vl0to30"], [class*=" nad-vl0to30"]',
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 4000,
        thresholdStatus: THRESHOLD_STATUS.BELOW,
        type: CSS_RULE_TYPE.THRESHOLD_DRIVEN,
    },
    {
        cssSelector: '[class^="nad-vl30to50"], [class*=" nad-vl30to50"]',
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 4000,
        thresholdStatus: THRESHOLD_STATUS.BELOW,
        type: CSS_RULE_TYPE.THRESHOLD_DRIVEN,
    },
    {
        cssSelector: '[class^="nad-vl50to70"], [class*=" nad-vl50to70"]',
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 9000,
        thresholdStatus: THRESHOLD_STATUS.BELOW,
        type: CSS_RULE_TYPE.THRESHOLD_DRIVEN,
    },
    {
        cssSelector: '[class^="nad-vl70to120"], [class*=" nad-vl70to120"]',
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 9000,
        thresholdStatus: THRESHOLD_STATUS.BELOW,
        type: CSS_RULE_TYPE.THRESHOLD_DRIVEN,
    },
    {
        cssSelector: '[class^="nad-vl120to180"], [class*=" nad-vl120to180"]',
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 12000,
        thresholdStatus: THRESHOLD_STATUS.BELOW,
        type: CSS_RULE_TYPE.THRESHOLD_DRIVEN,
    },
    {
        cssSelector: '[class^="nad-vl180to300"], [class*=" nad-vl180to300"]',
        belowThresholdCssDeclaration: { display: 'block' },
        aboveThresholdCssDeclaration: { display: 'none' },
        threshold: 20000,
        thresholdStatus: THRESHOLD_STATUS.BELOW,
        type: CSS_RULE_TYPE.THRESHOLD_DRIVEN,
    },
];
