/**
 * Copyright (c) 2020, RTE (http://www.rte-france.com)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import cheapRuler from 'cheap-ruler';
import {
    computeDestinationPoint,
    getGreatCircleBearing,
    getRhumbLineBearing,
} from 'geolib';
import { Line, LonLat } from '../utils/equipment-types';
import { ArrowDirection } from './layers/arrow-layer';
import { MapEquipments } from './map-equipments';

const substationPositionByIdIndexer = (
    map: Map<string, Coordinate>,
    substation: SubstationPosition
) => {
    map.set(substation.id, substation.coordinate);
    return map;
};

const linePositionByIdIndexer = (
    map: Map<string, Coordinate[]>,
    line: LinePosition
) => {
    map.set(line.id, line.coordinates);
    return map;
};

// https://github.com/powsybl/powsybl-core/blob/main/iidm/iidm-api/src/main/java/com/powsybl/iidm/network/Country.java
export enum Country {
    AF = 'AFGHANISTAN',
    AX = 'ÅLAND ISLANDS',
    AL = 'ALBANIA',
    DZ = 'ALGERIA',
    AS = 'AMERICAN SAMOA',
    AD = 'ANDORRA',
    AO = 'ANGOLA',
    AI = 'ANGUILLA',
    AQ = 'ANTARCTICA',
    AG = 'ANTIGUA AND BARBUDA',
    AR = 'ARGENTINA',
    AM = 'ARMENIA',
    AW = 'ARUBA',
    AU = 'AUSTRALIA',
    AT = 'AUSTRIA',
    AZ = 'AZERBAIJAN',
    BS = 'BAHAMAS',
    BH = 'BAHRAIN',
    BD = 'BANGLADESH',
    BB = 'BARBADOS',
    BY = 'BELARUS',
    BE = 'BELGIUM',
    BZ = 'BELIZE',
    BJ = 'BENIN',
    BM = 'BERMUDA',
    BT = 'BHUTAN',
    BO = 'BOLIVIA, PLURINATIONAL STATE OF',
    BQ = 'BONAIRE, SINT EUSTATIUS AND SABA',
    BA = 'BOSNIA AND HERZEGOVINA',
    BW = 'BOTSWANA',
    BV = 'BOUVET ISLAND',
    BR = 'BRAZIL',
    IO = 'BRITISH INDIAN OCEAN TERRITORY',
    BN = 'BRUNEI DARUSSALAM',
    BG = 'BULGARIA',
    BF = 'BURKINA FASO',
    BI = 'BURUNDI',
    KH = 'CAMBODIA',
    CM = 'CAMEROON',
    CA = 'CANADA',
    CV = 'CAPE VERDE',
    KY = 'CAYMAN ISLANDS',
    CF = 'CENTRAL AFRICAN REPUBLIC',
    TD = 'CHAD',
    CL = 'CHILE',
    CN = 'CHINA',
    CX = 'CHRISTMAS ISLAND',
    CC = 'COCOS (KEELING) ISLANDS',
    CO = 'COLOMBIA',
    KM = 'COMOROS',
    CG = 'CONGO',
    CD = 'CONGO, THE DEMOCRATIC REPUBLIC OF THE',
    CK = 'COOK ISLANDS',
    CR = 'COSTA RICA',
    CI = "CÔTE D'IVOIRE",
    HR = 'CROATIA',
    CU = 'CUBA',
    CW = 'CURAÇAO',
    CY = 'CYPRUS',
    CZ = 'CZECH REPUBLIC',
    DK = 'DENMARK',
    DJ = 'DJIBOUTI',
    DM = 'DOMINICA',
    DO = 'DOMINICAN REPUBLIC',
    EC = 'ECUADOR',
    EG = 'EGYPT',
    SV = 'EL SALVADOR',
    GQ = 'EQUATORIAL GUINEA',
    ER = 'ERITREA',
    EE = 'ESTONIA',
    ET = 'ETHIOPIA',
    FK = 'FALKLAND ISLANDS (MALVINAS)',
    FO = 'FAROE ISLANDS',
    FJ = 'FIJI',
    FI = 'FINLAND',
    FR = 'FRANCE',
    GF = 'FRENCH GUIANA',
    PF = 'FRENCH POLYNESIA',
    TF = 'FRENCH SOUTHERN TERRITORIES',
    GA = 'GABON',
    GM = 'GAMBIA',
    GE = 'GEORGIA',
    DE = 'GERMANY',
    GH = 'GHANA',
    GI = 'GIBRALTAR',
    GR = 'GREECE',
    GL = 'GREENLAND',
    GD = 'GRENADA',
    GP = 'GUADELOUPE',
    GU = 'GUAM',
    GT = 'GUATEMALA',
    GG = 'GUERNSEY',
    GN = 'GUINEA',
    GW = 'GUINEA-BISSAU',
    GY = 'GUYANA',
    HT = 'HAITI',
    HM = 'HEARD ISLAND AND MCDONALD ISLANDS',
    VA = 'HOLY SEE (VATICAN CITY STATE)',
    HN = 'HONDURAS',
    HK = 'HONG KONG',
    HU = 'HUNGARY',
    IS = 'ICELAND',
    IN = 'INDIA',
    ID = 'INDONESIA',
    IR = 'IRAN, ISLAMIC REPUBLIC OF',
    IQ = 'IRAQ',
    IE = 'IRELAND',
    IM = 'ISLE OF MAN',
    IL = 'ISRAEL',
    IT = 'ITALY',
    JM = 'JAMAICA',
    JP = 'JAPAN',
    JE = 'JERSEY',
    JO = 'JORDAN',
    KZ = 'KAZAKHSTAN',
    KE = 'KENYA',
    KI = 'KIRIBATI',
    KP = "KOREA, DEMOCRATIC PEOPLE'S REPUBLIC OF",
    KR = 'KOREA, REPUBLIC OF',
    XK = 'KOSOVO',
    KW = 'KUWAIT',
    KG = 'KYRGYZSTAN',
    LA = "LAO PEOPLE'S DEMOCRATIC REPUBLIC",
    LV = 'LATVIA',
    LB = 'LEBANON',
    LS = 'LESOTHO',
    LR = 'LIBERIA',
    LY = 'LIBYA',
    LI = 'LIECHTENSTEIN',
    LT = 'LITHUANIA',
    LU = 'LUXEMBOURG',
    MO = 'MACAO',
    MK = 'MACEDONIA, THE FORMER YUGOSLAV REPUBLIC OF',
    MG = 'MADAGASCAR',
    MW = 'MALAWI',
    MY = 'MALAYSIA',
    MV = 'MALDIVES',
    ML = 'MALI',
    MT = 'MALTA',
    MH = 'MARSHALL ISLANDS',
    MQ = 'MARTINIQUE',
    MR = 'MAURITANIA',
    MU = 'MAURITIUS',
    YT = 'MAYOTTE',
    MX = 'MEXICO',
    FM = 'MICRONESIA, FEDERATED STATES OF',
    MD = 'MOLDOVA, REPUBLIC OF',
    MC = 'MONACO',
    MN = 'MONGOLIA',
    ME = 'MONTENEGRO',
    MS = 'MONTSERRAT',
    MA = 'MOROCCO',
    MZ = 'MOZAMBIQUE',
    MM = 'MYANMAR',
    NA = 'NAMIBIA',
    NR = 'NAURU',
    NP = 'NEPAL',
    NL = 'NETHERLANDS',
    NC = 'NEW CALEDONIA',
    NZ = 'NEW ZEALAND',
    NI = 'NICARAGUA',
    NE = 'NIGER',
    NG = 'NIGERIA',
    NU = 'NIUE',
    NF = 'NORFOLK ISLAND',
    MP = 'NORTHERN MARIANA ISLANDS',
    NO = 'NORWAY',
    OM = 'OMAN',
    PK = 'PAKISTAN',
    PW = 'PALAU',
    PS = 'PALESTINE, STATE OF',
    PA = 'PANAMA',
    PG = 'PAPUA NEW GUINEA',
    PY = 'PARAGUAY',
    PE = 'PERU',
    PH = 'PHILIPPINES',
    PN = 'PITCAIRN',
    PL = 'POLAND',
    PT = 'PORTUGAL',
    PR = 'PUERTO RICO',
    QA = 'QATAR',
    RE = 'RÉUNION',
    RO = 'ROMANIA',
    RU = 'RUSSIAN FEDERATION',
    RW = 'RWANDA',
    BL = 'SAINT BARTHÉLEMY',
    SH = 'SAINT HELENA, ASCENSION AND TRISTAN DA CUNHA',
    KN = 'SAINT KITTS AND NEVIS',
    LC = 'SAINT LUCIA',
    MF = 'SAINT MARTIN (FRENCH PART)',
    PM = 'SAINT PIERRE AND MIQUELON',
    VC = 'SAINT VINCENT AND THE GRENADINES',
    WS = 'SAMOA',
    SM = 'SAN MARINO',
    ST = 'SAO TOME AND PRINCIPE',
    SA = 'SAUDI ARABIA',
    SN = 'SENEGAL',
    RS = 'SERBIA',
    SC = 'SEYCHELLES',
    SL = 'SIERRA LEONE',
    SG = 'SINGAPORE',
    SX = 'SINT MAARTEN (DUTCH PART)',
    SK = 'SLOVAKIA',
    SI = 'SLOVENIA',
    SB = 'SOLOMON ISLANDS',
    SO = 'SOMALIA',
    ZA = 'SOUTH AFRICA',
    GS = 'SOUTH GEORGIA AND THE SOUTH SANDWICH ISLANDS',
    SS = 'SOUTH SUDAN',
    ES = 'SPAIN',
    LK = 'SRI LANKA',
    SD = 'SUDAN',
    SR = 'SURINAME',
    SJ = 'SVALBARD AND JAN MAYEN',
    SZ = 'SWAZILAND',
    SE = 'SWEDEN',
    CH = 'SWITZERLAND',
    SY = 'SYRIAN ARAB REPUBLIC',
    TW = 'TAIWAN, PROVINCE OF CHINA',
    TJ = 'TAJIKISTAN',
    TZ = 'TANZANIA, UNITED REPUBLIC OF',
    TH = 'THAILAND',
    TL = 'TIMOR-LESTE',
    TG = 'TOGO',
    TK = 'TOKELAU',
    TO = 'TONGA',
    TT = 'TRINIDAD AND TOBAGO',
    TN = 'TUNISIA',
    TR = 'TURKEY',
    TM = 'TURKMENISTAN',
    TC = 'TURKS AND CAICOS ISLANDS',
    TV = 'TUVALU',
    UG = 'UGANDA',
    UA = 'UKRAINE',
    AE = 'UNITED ARAB EMIRATES',
    GB = 'UNITED KINGDOM',
    US = 'UNITED STATES',
    UM = 'UNITED STATES MINOR OUTLYING ISLANDS',
    UY = 'URUGUAY',
    UZ = 'UZBEKISTAN',
    VU = 'VANUATU',
    VE = 'VENEZUELA, BOLIVARIAN REPUBLIC OF',
    VN = 'VIET NAM',
    VG = 'VIRGIN ISLANDS, BRITISH',
    VI = 'VIRGIN ISLANDS, U.S.',
    WF = 'WALLIS AND FUTUNA',
    EH = 'WESTERN SAHARA',
    YE = 'YEMEN',
    ZM = 'ZAMBIA',
    ZW = 'ZIMBABWE',
}

// https://github.com/powsybl/powsybl-core/blob/main/iidm/iidm-extensions/src/main/java/com/powsybl/iidm/network/extensions/Coordinate.java
export type Coordinate = {
    lon: number;
    lat: number;
};

type SubstationPosition = {
    id: string;
    coordinate: Coordinate;
};

type LinePosition = {
    id: string;
    coordinates: Coordinate[];
};

export class GeoData {
    substationPositionsById = new Map<string, Coordinate>();
    linePositionsById = new Map<string, Coordinate[]>();

    constructor(
        substationPositionsById: Map<string, Coordinate>,
        linePositionsById: Map<string, Coordinate[]>
    ) {
        this.substationPositionsById = substationPositionsById;
        this.linePositionsById = linePositionsById;
    }

    setSubstationPositions(positions: SubstationPosition[]) {
        // index positions by substation id
        this.substationPositionsById = positions.reduce(
            substationPositionByIdIndexer,
            new Map()
        );
    }

    updateSubstationPositions(
        substationIdsToUpdate: string[],
        fetchedPositions: SubstationPosition[]
    ) {
        fetchedPositions.forEach((pos) =>
            this.substationPositionsById.set(pos.id, pos.coordinate)
        );
        // If a substation position is requested but not present in the fetched results, we delete its position.
        // It allows to cancel the position of a substation when the server can't situate it anymore after a network modification (for example a line deletion).
        substationIdsToUpdate
            .filter((id) => !fetchedPositions.map((pos) => pos.id).includes(id))
            .forEach((id) => this.substationPositionsById.delete(id));
    }

    getSubstationPosition(substationId: string): LonLat {
        const position = this.substationPositionsById.get(substationId);
        if (!position) {
            console.warn(`Position not found for ${substationId}`);
            return [0, 0];
        }
        return [position.lon, position.lat];
    }

    setLinePositions(positions: LinePosition[]) {
        // index positions by line id
        this.linePositionsById = positions.reduce(
            linePositionByIdIndexer,
            new Map()
        );
    }

    updateLinePositions(
        lineIdsToUpdate: string[],
        fetchedPositions: LinePosition[]
    ) {
        fetchedPositions.forEach((pos) => {
            this.linePositionsById.set(pos.id, pos.coordinates);
        });
        // If a line position is requested but not present in the fetched results, we delete its position.
        // For lines, this code is not really necessary as we draw lines in [(0, 0), (0, 0)] when it is connected to a (0, 0) point (see getLinePositions())
        // But it's cleaner to avoid keeping old ignored data in geo data.
        lineIdsToUpdate
            .filter((id) => !fetchedPositions.map((pos) => pos.id).includes(id))
            .forEach((id) => this.linePositionsById.delete(id));
    }

    /**
     * Get line positions always ordered from side 1 to side 2.
     */
    getLinePositions(
        network: MapEquipments,
        line: Line,
        detailed = true
    ): LonLat[] {
        const voltageLevel1 = network.getVoltageLevel(line.voltageLevelId1);
        if (!voltageLevel1) {
            throw new Error(
                `Voltage level side 1 '${line.voltageLevelId1}' not found`
            );
        }
        const voltageLevel2 = network.getVoltageLevel(line.voltageLevelId2);
        if (!voltageLevel2) {
            throw new Error(
                `Voltage level side 2 '${line.voltageLevelId1}' not found`
            );
        }
        const substationPosition1 = this.getSubstationPosition(
            voltageLevel1.substationId
        );
        const substationPosition2 = this.getSubstationPosition(
            voltageLevel2.substationId
        );

        // We never want to draw lines when its start or end is in (0, 0) (it is ugly, it would cross the whole screen all the time).
        // For example, when a substation position is not yet fetched and it is connected to a positioned substation, it avoids the line crossing the whole screen.
        // This would only happen for a short time because when the position is fetched, the substation and line are drawn at the correct place.
        if (
            (substationPosition1[0] === 0 && substationPosition1[1] === 0) ||
            (substationPosition2[0] === 0 && substationPosition2[1] === 0)
        ) {
            return [
                [0, 0],
                [0, 0],
            ];
        }

        if (detailed) {
            const linePositions = this.linePositionsById.get(line.id);
            // Is there any position for this line ?
            if (linePositions) {
                const positions = new Array<LonLat>(linePositions.length);

                for (const [index, position] of linePositions.entries()) {
                    positions[index] = [position.lon, position.lat];
                }

                return positions;
            }
        }

        return [substationPosition1, substationPosition2];
    }

    getLineDistances(positions: LonLat[]) {
        if (positions !== null && positions.length > 1) {
            const cumulativeDistanceArray = [0];
            let cumulativeDistance = 0;
            let segmentDistance;
            let ruler;
            for (let i = 0; i < positions.length - 1; i++) {
                ruler = new cheapRuler(positions[i][1], 'meters');
                segmentDistance = ruler.lineDistance(positions.slice(i, i + 2));
                cumulativeDistance = cumulativeDistance + segmentDistance;
                cumulativeDistanceArray[i + 1] = cumulativeDistance;
            }
            return cumulativeDistanceArray;
        }
        return null;
    }

    /**
     * Find the segment in which we reach the wanted distance and return the segment
     * along with the remaining distance to travel on this segment to be at the exact wanted distance
     * (implemented using a binary search)
     */
    findSegment(
        positions: LonLat[],
        cumulativeDistances: number[],
        wantedDistance: number
    ) {
        let lowerBound = 0;
        let upperBound = cumulativeDistances.length - 1;
        let middlePoint;
        while (lowerBound + 1 !== upperBound) {
            middlePoint = Math.floor((lowerBound + upperBound) / 2);
            const middlePointDistance = cumulativeDistances[middlePoint];
            if (middlePointDistance <= wantedDistance) {
                lowerBound = middlePoint;
            } else {
                upperBound = middlePoint;
            }
        }
        return {
            idx: lowerBound,
            segment: positions.slice(lowerBound, lowerBound + 2) as [
                LonLat,
                LonLat
            ],
            remainingDistance: wantedDistance - cumulativeDistances[lowerBound],
        };
    }

    labelDisplayPosition(
        positions: LonLat[],
        cumulativeDistances: number[],
        arrowPosition: number,
        arrowDirection: ArrowDirection,
        lineParallelIndex: number,
        lineAngle: number,
        proximityAngle: number,
        distanceBetweenLines: number,
        proximityFactor: number
    ) {
        if (arrowPosition > 1 || arrowPosition < 0) {
            throw new Error(
                'Proportional position value incorrect: ' + arrowPosition
            );
        }
        if (
            cumulativeDistances === null ||
            cumulativeDistances.length < 2 ||
            cumulativeDistances[cumulativeDistances.length - 1] === 0
        ) {
            return null;
        }
        const lineDistance =
            cumulativeDistances[cumulativeDistances.length - 1];
        let wantedDistance = lineDistance * arrowPosition;

        if (cumulativeDistances.length === 2) {
            // For parallel lines, the initial fork line distance does not count
            // when there are no intermediate points between the substations.
            // I'm not sure this is entirely correct but it displays well enough.
            wantedDistance =
                wantedDistance -
                2 * distanceBetweenLines * arrowPosition * proximityFactor;
        }

        const goodSegment = this.findSegment(
            positions,
            cumulativeDistances,
            wantedDistance
        );

        // We don't have the exact same distance calculation as in the arrow shader, so take some margin:
        // we move the label a little bit on the flat side of the arrow so that at least it stays
        // on the right side when zooming
        let multiplier;
        switch (arrowDirection) {
            case ArrowDirection.FROM_SIDE_2_TO_SIDE_1:
                multiplier = 1.005;
                break;
            case ArrowDirection.FROM_SIDE_1_TO_SIDE_2:
                multiplier = 0.995;
                break;
            case ArrowDirection.NONE:
                multiplier = 1;
                break;
            default:
                throw new Error('impossible');
        }
        const remainingDistance = goodSegment.remainingDistance * multiplier;

        const angle = this.getMapAngle(
            goodSegment.segment[0],
            goodSegment.segment[1]
        );
        const neededOffset = this.getLabelOffset(angle, 20, arrowDirection);

        const position = {
            position: computeDestinationPoint(
                goodSegment.segment[0],
                remainingDistance,
                angle
            ),
            angle: angle,
            offset: neededOffset,
        };
        // apply parallel spread between lines
        position.position = computeDestinationPoint(
            position.position,
            distanceBetweenLines * lineParallelIndex,
            lineAngle + 90
        );
        if (cumulativeDistances.length === 2) {
            // For line with only one segment, we can just apply a translation by lineAngle because both segment ends
            // connect to fork lines. This accounts for the fact that the forkline part of the line doesn't count
            position.position = computeDestinationPoint(
                position.position,
                -distanceBetweenLines * proximityFactor,
                lineAngle
            );
        } else if (
            goodSegment.idx === 0 ||
            goodSegment.idx === cumulativeDistances.length - 2
        ) {
            // When the label is on the first or last segment and there is an intermediate point,
            // when must shift by the percentange of position of the label on this segment
            const segmentDistance =
                cumulativeDistances[goodSegment.idx + 1] -
                cumulativeDistances[goodSegment.idx];
            const alreadyDoneDistance = segmentDistance - remainingDistance;
            let labelDistanceInSegment;
            if (goodSegment.idx === 0) {
                labelDistanceInSegment = -alreadyDoneDistance;
            } else {
                labelDistanceInSegment = remainingDistance;
            }
            const labelPercentage = labelDistanceInSegment / segmentDistance;
            position.position = computeDestinationPoint(
                position.position,
                distanceBetweenLines * labelPercentage,
                proximityAngle
            );
        }

        return position;
    }

    getLabelOffset(
        angle: number,
        offsetDistance: number,
        arrowDirection: ArrowDirection
    ): [number, number] {
        const radiantAngle = (-angle + 90) / (180 / Math.PI);
        let direction = 0;
        switch (arrowDirection) {
            case ArrowDirection.FROM_SIDE_2_TO_SIDE_1:
                direction = 1;
                break;
            case ArrowDirection.FROM_SIDE_1_TO_SIDE_2:
                direction = -1;
                break;
            case ArrowDirection.NONE:
                direction = 0;
                break;
            default:
                throw new Error('impossible');
        }
        //Y offset is negative because deckGL pixel uses a top-left coordinate system and our computation use orthogonal coordinates
        return [
            Math.cos(radiantAngle) * offsetDistance * direction,
            -Math.sin(radiantAngle) * offsetDistance * direction,
        ];
    }

    //returns the angle between point1 and point2 in degrees [0-360)
    getMapAngle(point1: LonLat, point2: LonLat) {
        // We don't have the exact same angle calculation as in the arrow shader, and this
        // seems to give more approaching results
        let angle = getRhumbLineBearing(point1, point2);
        const angle2 = getGreatCircleBearing(point1, point2);
        const coeff = 0.1;
        angle = coeff * angle + (1 - coeff) * angle2;
        return angle;
    }
}
