type Coordinate = [number, number];

interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function getBoundingRectangle(coords: Coordinate[]): Rectangle {
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

    for (const coord of coords) {
        minX = Math.min(minX, coord[0]);
        minY = Math.min(minY, coord[1]);
        maxX = Math.max(maxX, coord[0]);
        maxY = Math.max(maxY, coord[1]);
    }

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}
