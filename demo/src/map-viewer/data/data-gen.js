const allVoltageLevels = [
    {
        id: 'VL2_1',
        substationId: 'SUB2',
        nominalV: 110.0,
    },
    {
        id: 'VL2_2',
        substationId: 'SUB2',
        nominalV: 380.0,
    },
    {
        id: 'VL2_3',
        substationId: 'SUB2',
        nominalV: 225.0,
    },
];

function generateSubstationData(idNumber, nbVl) {
    const data = {
        id: 'SUB' + idNumber,
        name: 'Substation' + idNumber,
        voltageLevels: allVoltageLevels.slice(1, nbVl),
    };
    return data;
}

export function generateSubstationsData(nbSubstations, nbVl) {
    const substations = [];
    for (let i = 1; i <= nbSubstations; i++) {
        substations.push(generateSubstationData(i, nbVl));
    }
    return substations;
}

console.log(generateSubstationData(1, 2));

export function generateSubstationPositions(nbSubstations) {
    const positions = [];
    for (let i = 1; i <= nbSubstations; i++) {
        positions.push({
            id: 'SUB' + i,
            coordinate: {
                lat: (Math.random() * (46.0 - 45.0) + 45.0).toFixed(5),
                lon: (Math.random() * (9.0 - 10.0) + 45.0).toFixed(5),
            },
        });
    }
    return positions;
}

console.log(generateSubstationPositions(3));
