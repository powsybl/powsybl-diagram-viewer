/**
 * Copyright (c) 2022-2024, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export enum RANGE_STATUS {
    IN = 'IN',
    OUT = 'OUT',
}
export type CSS_DECLARATION = Record<string, string>;
export type CSS_RULE = {
    cssSelector: string;
    cssInRange: CSS_DECLARATION | CSS_DECLARATION[];
    cssOutOfRange?: CSS_DECLARATION | CSS_DECLARATION[];
    min: number;
    max: number;
    status?: RANGE_STATUS;
};

export const DEFAULT_DYNAMIC_CSS_RULES: CSS_RULE[] = [
    {
        cssSelector: '.nad-edge-infos', // data on edges (arrows and values)
        cssInRange: { display: 'block' },
        cssOutOfRange: { display: 'none' },
        min: 0,
        max: 2200,
    },
    {
        cssSelector: '.nad-label-box', // tooltips linked to nodes
        cssInRange: { display: 'block' },
        cssOutOfRange: { display: 'none' },
        min: 0,
        max: 3000,
    },
    {
        cssSelector: '.nad-text-edges', // visual link between nodes and their tooltip
        cssInRange: { display: 'block' },
        cssOutOfRange: { display: 'none' },
        min: 0,
        max: 3000,
    },
    {
        cssSelector: '[class^="nad-vl0to30"], [class*=" nad-vl0to30"]',
        cssInRange: { display: 'block' },
        cssOutOfRange: { display: 'none' },
        min: 0,
        max: 4000,
    },
    {
        cssSelector: '[class^="nad-vl30to50"], [class*=" nad-vl30to50"]',
        cssInRange: { display: 'block' },
        cssOutOfRange: { display: 'none' },
        min: 0,
        max: 4000,
    },
    {
        cssSelector: '[class^="nad-vl50to70"], [class*=" nad-vl50to70"]',
        cssInRange: { display: 'block' },
        cssOutOfRange: { display: 'none' },
        min: 0,
        max: 9000,
    },
    {
        cssSelector: '[class^="nad-vl70to120"], [class*=" nad-vl70to120"]',
        cssInRange: { display: 'block' },
        cssOutOfRange: { display: 'none' },
        min: 0,
        max: 9000,
    },
    {
        cssSelector: '[class^="nad-vl120to180"], [class*=" nad-vl120to180"]',
        cssInRange: { display: 'block' },
        cssOutOfRange: { display: 'none' },
        min: 0,
        max: 12000,
    },
    {
        cssSelector: '[class^="nad-vl180to300"], [class*=" nad-vl180to300"]',
        cssInRange: { display: 'block' },
        cssOutOfRange: { display: 'none' },
        min: 0,
        max: 20000,
    },
];
