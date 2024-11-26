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
};
// CSS_RULE keys
const RULE_KEYS = {
    BELOW_THRESHOLD_CSS_DECLARATION: 'belowThresholdCssDeclaration',
    ABOVE_THRESHOLD_CSS_DECLARATION: 'aboveThresholdCssDeclaration',
    THRESHOLD: 'threshold',
    THRESHOLD_STATUS: 'thresholdStatus',
    CSS_DECLARATION: 'cssDeclaration',
    CURRENT_VALUE: 'currentValue',
} as const;

export type CSS_RULE_THRESHOLD_DRIVEN = CSS_RULE_BASE & {
    [RULE_KEYS.BELOW_THRESHOLD_CSS_DECLARATION]: CSS_DECLARATION;
    [RULE_KEYS.ABOVE_THRESHOLD_CSS_DECLARATION]: CSS_DECLARATION;
    [RULE_KEYS.THRESHOLD]: number;
    [RULE_KEYS.THRESHOLD_STATUS]: THRESHOLD_STATUS;
};

export type CSS_RULE_FUNCTION_DRIVEN = CSS_RULE_BASE & {
    [RULE_KEYS.CSS_DECLARATION]: DYNAMIC_CSS_DECLARATION;
    [RULE_KEYS.CURRENT_VALUE]: CSS_DECLARATION;
};

export function isThresholdDrivenRule(
    rule: CSS_RULE_THRESHOLD_DRIVEN | CSS_RULE_FUNCTION_DRIVEN
): rule is CSS_RULE_THRESHOLD_DRIVEN {
    return (
        RULE_KEYS.BELOW_THRESHOLD_CSS_DECLARATION in rule &&
        RULE_KEYS.ABOVE_THRESHOLD_CSS_DECLARATION in rule &&
        RULE_KEYS.THRESHOLD in rule &&
        RULE_KEYS.THRESHOLD_STATUS in rule
    );
}

export function isFunctionDrivenRule(
    rule: CSS_RULE_THRESHOLD_DRIVEN | CSS_RULE_FUNCTION_DRIVEN
): rule is CSS_RULE_FUNCTION_DRIVEN {
    return RULE_KEYS.CSS_DECLARATION in rule && RULE_KEYS.CURRENT_VALUE in rule;
}

export type CSS_RULE = CSS_RULE_THRESHOLD_DRIVEN | CSS_RULE_FUNCTION_DRIVEN;

export const DEFAULT_DYNAMIC_CSS_RULES: CSS_RULE[] = [
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
