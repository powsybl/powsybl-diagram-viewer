/* eslint-disable @typescript-eslint/no-explicit-any */
type Position = unknown;

export class GeoData {
    substationPositionsById: Map<any, any>;
    linePositionsById: Map<any, any>;

    constructor(
        substationPositionsById: Map<any, any>,
        linePositionsById: Map<any, any>
    );

    setSubstationPositions(positions: Position[]);

    getSubstationPosition(substationId: string): [number, number];

    updateSubstationPositions(
        substationIdsToUpdate: string[],
        fetchedPositions: Position[]
    );

    updateLinePositions(
        lineIdsToUpdate: string[],
        fetchedPositions: Position[]
    );

    setLinePositions(positions: Position[]);
}
