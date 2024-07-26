import { Layer, project32, picking, CompositeLayer } from '@deck.gl/core';
import { GL } from '@luma.gl/constants';
import { Model, Geometry } from '@luma.gl/engine';
import { PathStyleExtension } from '@deck.gl/extensions';
import { LineLayer as LineLayer$1, PathLayer, TextLayer, IconLayer, ScatterplotLayer } from '@deck.gl/layers';

const factors = {
    kilometers: 1,
    miles: 1000 / 1609.344,
    nauticalmiles: 1000 / 1852,
    meters: 1000,
    metres: 1000,
    yards: 1000 / 0.9144,
    feet: 1000 / 0.3048,
    inches: 1000 / 0.0254
};

// Values that define WGS84 ellipsoid model of the Earth
const RE = 6378.137; // equatorial radius
const FE = 1 / 298.257223563; // flattening

const E2 = FE * (2 - FE);
const RAD = Math.PI / 180;

/**
 * A collection of very fast approximations to common geodesic measurements. Useful for performance-sensitive code that measures things on a city scale.
 *
 * @param {number} lat latitude
 * @param {string} [units='kilometers']
 * @returns {CheapRuler}
 * @example
 * const ruler = cheapRuler(35.05, 'miles');
 * //=ruler
 */
class CheapRuler {
    /**
     * Creates a ruler object from tile coordinates (y and z).
     *
     * @param {number} y
     * @param {number} z
     * @param {string} [units='kilometers']
     * @returns {CheapRuler}
     * @example
     * const ruler = cheapRuler.fromTile(1567, 12);
     * //=ruler
     */
    static fromTile(y, z, units) {
        const n = Math.PI * (1 - 2 * (y + 0.5) / Math.pow(2, z));
        const lat = Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))) / RAD;
        return new CheapRuler(lat, units);
    }

    /**
     * Multipliers for converting between units.
     *
     * @example
     * // convert 50 meters to yards
     * 50 * CheapRuler.units.yards / CheapRuler.units.meters;
     */
    static get units() {
        return factors;
    }

    /**
     * Creates a ruler instance for very fast approximations to common geodesic measurements around a certain latitude.
     *
     * @param {number} lat latitude
     * @param {string} [units='kilometers']
     * @returns {CheapRuler}
     * @example
     * const ruler = cheapRuler(35.05, 'miles');
     * //=ruler
     */
    constructor(lat, units) {
        if (lat === undefined) throw new Error('No latitude given.');
        if (units && !factors[units]) throw new Error(`Unknown unit ${  units  }. Use one of: ${  Object.keys(factors).join(', ')}`);

        // Curvature formulas from https://en.wikipedia.org/wiki/Earth_radius#Meridional
        const m = RAD * RE * (units ? factors[units] : 1);
        const coslat = Math.cos(lat * RAD);
        const w2 = 1 / (1 - E2 * (1 - coslat * coslat));
        const w = Math.sqrt(w2);

        // multipliers for converting longitude and latitude degrees into distance
        this.kx = m * w * coslat;        // based on normal radius of curvature
        this.ky = m * w * w2 * (1 - E2); // based on meridonal radius of curvature
    }

    /**
     * Given two points of the form [longitude, latitude], returns the distance.
     *
     * @param {Array<number>} a point [longitude, latitude]
     * @param {Array<number>} b point [longitude, latitude]
     * @returns {number} distance
     * @example
     * const distance = ruler.distance([30.5, 50.5], [30.51, 50.49]);
     * //=distance
     */
    distance(a, b) {
        const dx = wrap(a[0] - b[0]) * this.kx;
        const dy = (a[1] - b[1]) * this.ky;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Returns the bearing between two points in angles.
     *
     * @param {Array<number>} a point [longitude, latitude]
     * @param {Array<number>} b point [longitude, latitude]
     * @returns {number} bearing
     * @example
     * const bearing = ruler.bearing([30.5, 50.5], [30.51, 50.49]);
     * //=bearing
     */
    bearing(a, b) {
        const dx = wrap(b[0] - a[0]) * this.kx;
        const dy = (b[1] - a[1]) * this.ky;
        return Math.atan2(dx, dy) / RAD;
    }

    /**
     * Returns a new point given distance and bearing from the starting point.
     *
     * @param {Array<number>} p point [longitude, latitude]
     * @param {number} dist distance
     * @param {number} bearing
     * @returns {Array<number>} point [longitude, latitude]
     * @example
     * const point = ruler.destination([30.5, 50.5], 0.1, 90);
     * //=point
     */
    destination(p, dist, bearing) {
        const a = bearing * RAD;
        return this.offset(p,
            Math.sin(a) * dist,
            Math.cos(a) * dist);
    }

    /**
     * Returns a new point given easting and northing offsets (in ruler units) from the starting point.
     *
     * @param {Array<number>} p point [longitude, latitude]
     * @param {number} dx easting
     * @param {number} dy northing
     * @returns {Array<number>} point [longitude, latitude]
     * @example
     * const point = ruler.offset([30.5, 50.5], 10, 10);
     * //=point
     */
    offset(p, dx, dy) {
        return [
            p[0] + dx / this.kx,
            p[1] + dy / this.ky
        ];
    }

    /**
     * Given a line (an array of points), returns the total line distance.
     *
     * @param {Array<Array<number>>} points [longitude, latitude]
     * @returns {number} total line distance
     * @example
     * const length = ruler.lineDistance([
     *     [-67.031, 50.458], [-67.031, 50.534],
     *     [-66.929, 50.534], [-66.929, 50.458]
     * ]);
     * //=length
     */
    lineDistance(points) {
        let total = 0;
        for (let i = 0; i < points.length - 1; i++) {
            total += this.distance(points[i], points[i + 1]);
        }
        return total;
    }

    /**
     * Given a polygon (an array of rings, where each ring is an array of points), returns the area.
     *
     * @param {Array<Array<Array<number>>>} polygon
     * @returns {number} area value in the specified units (square kilometers by default)
     * @example
     * const area = ruler.area([[
     *     [-67.031, 50.458], [-67.031, 50.534], [-66.929, 50.534],
     *     [-66.929, 50.458], [-67.031, 50.458]
     * ]]);
     * //=area
     */
    area(polygon) {
        let sum = 0;

        for (let i = 0; i < polygon.length; i++) {
            const ring = polygon[i];

            for (let j = 0, len = ring.length, k = len - 1; j < len; k = j++) {
                sum += wrap(ring[j][0] - ring[k][0]) * (ring[j][1] + ring[k][1]) * (i ? -1 : 1);
            }
        }

        return (Math.abs(sum) / 2) * this.kx * this.ky;
    }

    /**
     * Returns the point at a specified distance along the line.
     *
     * @param {Array<Array<number>>} line
     * @param {number} dist distance
     * @returns {Array<number>} point [longitude, latitude]
     * @example
     * const point = ruler.along(line, 2.5);
     * //=point
     */
    along(line, dist) {
        let sum = 0;

        if (dist <= 0) return line[0];

        for (let i = 0; i < line.length - 1; i++) {
            const p0 = line[i];
            const p1 = line[i + 1];
            const d = this.distance(p0, p1);
            sum += d;
            if (sum > dist) return interpolate(p0, p1, (dist - (sum - d)) / d);
        }

        return line[line.length - 1];
    }

    /**
     * Returns the distance from a point `p` to a line segment `a` to `b`.
     *
     * @pointToSegmentDistance
     * @param {Array<number>} p point [longitude, latitude]
     * @param {Array<number>} p1 segment point 1 [longitude, latitude]
     * @param {Array<number>} p2 segment point 2 [longitude, latitude]
     * @returns {number} distance
     * @example
     * const distance = ruler.pointToSegmentDistance([-67.04, 50.5], [-67.05, 50.57], [-67.03, 50.54]);
     * //=distance
     */
    pointToSegmentDistance(p, a, b) {
        let [x, y] = a;
        let dx = wrap(b[0] - x) * this.kx;
        let dy = (b[1] - y) * this.ky;
        let t = 0;

        if (dx !== 0 || dy !== 0) {
            t = (wrap(p[0] - x) * this.kx * dx + (p[1] - y) * this.ky * dy) / (dx * dx + dy * dy);

            if (t > 1) {
                x = b[0];
                y = b[1];

            } else if (t > 0) {
                x += (dx / this.kx) * t;
                y += (dy / this.ky) * t;
            }
        }

        dx = wrap(p[0] - x) * this.kx;
        dy = (p[1] - y) * this.ky;

        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Returns an object of the form {point, index, t}, where point is closest point on the line
     * from the given point, index is the start index of the segment with the closest point,
     * and t is a parameter from 0 to 1 that indicates where the closest point is on that segment.
     *
     * @param {Array<Array<number>>} line
     * @param {Array<number>} p point [longitude, latitude]
     * @returns {Object} {point, index, t}
     * @example
     * const point = ruler.pointOnLine(line, [-67.04, 50.5]).point;
     * //=point
     */
    pointOnLine(line, p) {
        let minDist = Infinity;
        let minX, minY, minI, minT;

        for (let i = 0; i < line.length - 1; i++) {

            let x = line[i][0];
            let y = line[i][1];
            let dx = wrap(line[i + 1][0] - x) * this.kx;
            let dy = (line[i + 1][1] - y) * this.ky;
            let t = 0;

            if (dx !== 0 || dy !== 0) {
                t = (wrap(p[0] - x) * this.kx * dx + (p[1] - y) * this.ky * dy) / (dx * dx + dy * dy);

                if (t > 1) {
                    x = line[i + 1][0];
                    y = line[i + 1][1];

                } else if (t > 0) {
                    x += (dx / this.kx) * t;
                    y += (dy / this.ky) * t;
                }
            }

            dx = wrap(p[0] - x) * this.kx;
            dy = (p[1] - y) * this.ky;

            const sqDist = dx * dx + dy * dy;
            if (sqDist < minDist) {
                minDist = sqDist;
                minX = x;
                minY = y;
                minI = i;
                minT = t;
            }
        }

        return {
            point: [minX, minY],
            index: minI,
            t: Math.max(0, Math.min(1, minT))
        };
    }

    /**
     * Returns a part of the given line between the start and the stop points (or their closest points on the line).
     *
     * @param {Array<number>} start point [longitude, latitude]
     * @param {Array<number>} stop point [longitude, latitude]
     * @param {Array<Array<number>>} line
     * @returns {Array<Array<number>>} line part of a line
     * @example
     * const line2 = ruler.lineSlice([-67.04, 50.5], [-67.05, 50.56], line1);
     * //=line2
     */
    lineSlice(start, stop, line) {
        let p1 = this.pointOnLine(line, start);
        let p2 = this.pointOnLine(line, stop);

        if (p1.index > p2.index || (p1.index === p2.index && p1.t > p2.t)) {
            const tmp = p1;
            p1 = p2;
            p2 = tmp;
        }

        const slice = [p1.point];

        const l = p1.index + 1;
        const r = p2.index;

        if (!equals(line[l], slice[0]) && l <= r)
            slice.push(line[l]);

        for (let i = l + 1; i <= r; i++) {
            slice.push(line[i]);
        }

        if (!equals(line[r], p2.point))
            slice.push(p2.point);

        return slice;
    }

    /**
     * Returns a part of the given line between the start and the stop points indicated by distance along the line.
     *
     * @param {number} start distance
     * @param {number} stop distance
     * @param {Array<Array<number>>} line
     * @returns {Array<Array<number>>} line part of a line
     * @example
     * const line2 = ruler.lineSliceAlong(10, 20, line1);
     * //=line2
     */
    lineSliceAlong(start, stop, line) {
        let sum = 0;
        const slice = [];

        for (let i = 0; i < line.length - 1; i++) {
            const p0 = line[i];
            const p1 = line[i + 1];
            const d = this.distance(p0, p1);

            sum += d;

            if (sum > start && slice.length === 0) {
                slice.push(interpolate(p0, p1, (start - (sum - d)) / d));
            }

            if (sum >= stop) {
                slice.push(interpolate(p0, p1, (stop - (sum - d)) / d));
                return slice;
            }

            if (sum > start) slice.push(p1);
        }

        return slice;
    }

    /**
     * Given a point, returns a bounding box object ([w, s, e, n]) created from the given point buffered by a given distance.
     *
     * @param {Array<number>} p point [longitude, latitude]
     * @param {number} buffer
     * @returns {Array<number>} box object ([w, s, e, n])
     * @example
     * const bbox = ruler.bufferPoint([30.5, 50.5], 0.01);
     * //=bbox
     */
    bufferPoint(p, buffer) {
        const v = buffer / this.ky;
        const h = buffer / this.kx;
        return [
            p[0] - h,
            p[1] - v,
            p[0] + h,
            p[1] + v
        ];
    }

    /**
     * Given a bounding box, returns the box buffered by a given distance.
     *
     * @param {Array<number>} box object ([w, s, e, n])
     * @param {number} buffer
     * @returns {Array<number>} box object ([w, s, e, n])
     * @example
     * const bbox = ruler.bufferBBox([30.5, 50.5, 31, 51], 0.2);
     * //=bbox
     */
    bufferBBox(bbox, buffer) {
        const v = buffer / this.ky;
        const h = buffer / this.kx;
        return [
            bbox[0] - h,
            bbox[1] - v,
            bbox[2] + h,
            bbox[3] + v
        ];
    }

    /**
     * Returns true if the given point is inside in the given bounding box, otherwise false.
     *
     * @param {Array<number>} p point [longitude, latitude]
     * @param {Array<number>} box object ([w, s, e, n])
     * @returns {boolean}
     * @example
     * const inside = ruler.insideBBox([30.5, 50.5], [30, 50, 31, 51]);
     * //=inside
     */
    insideBBox(p, bbox) {
        return wrap(p[0] - bbox[0]) >= 0 &&
               wrap(p[0] - bbox[2]) <= 0 &&
               p[1] >= bbox[1] &&
               p[1] <= bbox[3];
    }
}

function equals(a, b) {
    return a[0] === b[0] && a[1] === b[1];
}

function interpolate(a, b, t) {
    const dx = wrap(b[0] - a[0]);
    const dy = b[1] - a[1];
    return [
        a[0] + dx * t,
        a[1] + dy * t
    ];
}

// normalize a degree value into [-180..180] range
function wrap(deg) {
    while (deg < -180) deg += 360;
    while (deg > 180) deg -= 360;
    return deg;
}

var es = {};

var computeDestinationPoint$1 = {};

var getLatitude$1 = {};

var constants = {};

Object.defineProperty(constants,"__esModule",{value:true});constants.areaConversion=constants.timeConversion=constants.distanceConversion=constants.altitudeKeys=constants.latitudeKeys=constants.longitudeKeys=constants.MAXLON=constants.MINLON=constants.MAXLAT=constants.MINLAT=constants.earthRadius=constants.sexagesimalPattern=void 0;var sexagesimalPattern=/^([0-9]{1,3})°\s*([0-9]{1,3}(?:\.(?:[0-9]{1,}))?)['′]\s*(([0-9]{1,3}(\.([0-9]{1,}))?)["″]\s*)?([NEOSW]?)$/;constants.sexagesimalPattern=sexagesimalPattern;var earthRadius=6378137;constants.earthRadius=earthRadius;var MINLAT=-90;constants.MINLAT=MINLAT;var MAXLAT=90;constants.MAXLAT=MAXLAT;var MINLON=-180;constants.MINLON=MINLON;var MAXLON=180;constants.MAXLON=MAXLON;var longitudeKeys=["lng","lon","longitude",0];constants.longitudeKeys=longitudeKeys;var latitudeKeys=["lat","latitude",1];constants.latitudeKeys=latitudeKeys;var altitudeKeys=["alt","altitude","elevation","elev",2];constants.altitudeKeys=altitudeKeys;var distanceConversion={m:1,km:0.001,cm:100,mm:1000,mi:1/1609.344,sm:1/1852.216,ft:100/30.48,in:100/2.54,yd:1/0.9144};constants.distanceConversion=distanceConversion;var timeConversion={m:60,h:3600,d:86400};constants.timeConversion=timeConversion;var areaConversion={m2:1,km2:0.000001,ha:0.0001,a:0.01,ft2:10.763911,yd2:1.19599,in2:1550.0031};constants.areaConversion=areaConversion;areaConversion.sqm=areaConversion.m2;areaConversion.sqkm=areaConversion.km2;areaConversion.sqft=areaConversion.ft2;areaConversion.sqyd=areaConversion.yd2;areaConversion.sqin=areaConversion.in2;

var getCoordinateKey$1 = {};

Object.defineProperty(getCoordinateKey$1,"__esModule",{value:true});getCoordinateKey$1.default=void 0;var getCoordinateKey=function getCoordinateKey(point,keysToLookup){return keysToLookup.reduce(function(foundKey,key){if(typeof point==="undefined"||point===null){throw new Error("'".concat(point,"' is no valid coordinate."))}if(Object.prototype.hasOwnProperty.call(point,key)&&typeof key!=="undefined"&&typeof foundKey==="undefined"){foundKey=key;return key}return foundKey},undefined)};var _default$D=getCoordinateKey;getCoordinateKey$1.default=_default$D;

var toDecimal$1 = {};

var isDecimal$1 = {};

Object.defineProperty(isDecimal$1,"__esModule",{value:true});isDecimal$1.default=void 0;var isDecimal=function isDecimal(value){var checkedValue=value.toString().trim();if(isNaN(parseFloat(checkedValue))){return false}return parseFloat(checkedValue)===Number(checkedValue)};var _default$C=isDecimal;isDecimal$1.default=_default$C;

var isSexagesimal$1 = {};

Object.defineProperty(isSexagesimal$1,"__esModule",{value:true});isSexagesimal$1.default=void 0;var _constants$e=constants;var isSexagesimal=function isSexagesimal(value){return _constants$e.sexagesimalPattern.test(value.toString().trim())};var _default$B=isSexagesimal;isSexagesimal$1.default=_default$B;

var sexagesimalToDecimal$1 = {};

Object.defineProperty(sexagesimalToDecimal$1,"__esModule",{value:true});sexagesimalToDecimal$1.default=void 0;var _constants$d=constants;var sexagesimalToDecimal=function sexagesimalToDecimal(sexagesimal){var data=new RegExp(_constants$d.sexagesimalPattern).exec(sexagesimal.toString().trim());if(typeof data==="undefined"||data===null){throw new Error("Given value is not in sexagesimal format")}var min=Number(data[2])/60||0;var sec=Number(data[4])/3600||0;var decimal=parseFloat(data[1])+min+sec;return ["S","W"].includes(data[7])?-decimal:decimal};var _default$A=sexagesimalToDecimal;sexagesimalToDecimal$1.default=_default$A;

var isValidCoordinate$1 = {};

var getCoordinateKeys$1 = {};

Object.defineProperty(getCoordinateKeys$1,"__esModule",{value:true});getCoordinateKeys$1.default=void 0;var _constants$c=constants;var _getCoordinateKey$2=_interopRequireDefault$q(getCoordinateKey$1);function _interopRequireDefault$q(obj){return obj&&obj.__esModule?obj:{default:obj}}function ownKeys$1(object,enumerableOnly){var keys=Object.keys(object);if(Object.getOwnPropertySymbols){var symbols=Object.getOwnPropertySymbols(object);if(enumerableOnly)symbols=symbols.filter(function(sym){return Object.getOwnPropertyDescriptor(object,sym).enumerable});keys.push.apply(keys,symbols);}return keys}function _objectSpread$1(target){for(var i=1;i<arguments.length;i++){var source=arguments[i]!=null?arguments[i]:{};if(i%2){ownKeys$1(Object(source),true).forEach(function(key){_defineProperty$1(target,key,source[key]);});}else if(Object.getOwnPropertyDescriptors){Object.defineProperties(target,Object.getOwnPropertyDescriptors(source));}else {ownKeys$1(Object(source)).forEach(function(key){Object.defineProperty(target,key,Object.getOwnPropertyDescriptor(source,key));});}}return target}function _defineProperty$1(obj,key,value){if(key in obj){Object.defineProperty(obj,key,{value:value,enumerable:true,configurable:true,writable:true});}else {obj[key]=value;}return obj}var getCoordinateKeys=function getCoordinateKeys(point){var keysToLookup=arguments.length>1&&arguments[1]!==undefined?arguments[1]:{longitude:_constants$c.longitudeKeys,latitude:_constants$c.latitudeKeys,altitude:_constants$c.altitudeKeys};var longitude=(0, _getCoordinateKey$2.default)(point,keysToLookup.longitude);var latitude=(0, _getCoordinateKey$2.default)(point,keysToLookup.latitude);var altitude=(0, _getCoordinateKey$2.default)(point,keysToLookup.altitude);return _objectSpread$1({latitude:latitude,longitude:longitude},altitude?{altitude:altitude}:{})};var _default$z=getCoordinateKeys;getCoordinateKeys$1.default=_default$z;

var isValidLatitude$1 = {};

Object.defineProperty(isValidLatitude$1,"__esModule",{value:true});isValidLatitude$1.default=void 0;var _isDecimal$2=_interopRequireDefault$p(isDecimal$1);var _isSexagesimal$2=_interopRequireDefault$p(isSexagesimal$1);var _sexagesimalToDecimal$2=_interopRequireDefault$p(sexagesimalToDecimal$1);var _constants$b=constants;function _interopRequireDefault$p(obj){return obj&&obj.__esModule?obj:{default:obj}}var isValidLatitude=function isValidLatitude(value){if((0, _isDecimal$2.default)(value)){if(parseFloat(value)>_constants$b.MAXLAT||value<_constants$b.MINLAT){return false}return true}if((0, _isSexagesimal$2.default)(value)){return isValidLatitude((0, _sexagesimalToDecimal$2.default)(value))}return false};var _default$y=isValidLatitude;isValidLatitude$1.default=_default$y;

var isValidLongitude$1 = {};

Object.defineProperty(isValidLongitude$1,"__esModule",{value:true});isValidLongitude$1.default=void 0;var _isDecimal$1=_interopRequireDefault$o(isDecimal$1);var _isSexagesimal$1=_interopRequireDefault$o(isSexagesimal$1);var _sexagesimalToDecimal$1=_interopRequireDefault$o(sexagesimalToDecimal$1);var _constants$a=constants;function _interopRequireDefault$o(obj){return obj&&obj.__esModule?obj:{default:obj}}var isValidLongitude=function isValidLongitude(value){if((0, _isDecimal$1.default)(value)){if(parseFloat(value)>_constants$a.MAXLON||value<_constants$a.MINLON){return false}return true}if((0, _isSexagesimal$1.default)(value)){return isValidLongitude((0, _sexagesimalToDecimal$1.default)(value))}return false};var _default$x=isValidLongitude;isValidLongitude$1.default=_default$x;

Object.defineProperty(isValidCoordinate$1,"__esModule",{value:true});isValidCoordinate$1.default=void 0;var _getCoordinateKeys2=_interopRequireDefault$n(getCoordinateKeys$1);var _isValidLatitude=_interopRequireDefault$n(isValidLatitude$1);var _isValidLongitude=_interopRequireDefault$n(isValidLongitude$1);function _interopRequireDefault$n(obj){return obj&&obj.__esModule?obj:{default:obj}}var isValidCoordinate=function isValidCoordinate(point){var _getCoordinateKeys=(0, _getCoordinateKeys2.default)(point),latitude=_getCoordinateKeys.latitude,longitude=_getCoordinateKeys.longitude;if(Array.isArray(point)&&point.length>=2){return (0, _isValidLongitude.default)(point[0])&&(0, _isValidLatitude.default)(point[1])}if(typeof latitude==="undefined"||typeof longitude==="undefined"){return false}var lon=point[longitude];var lat=point[latitude];if(typeof lat==="undefined"||typeof lon==="undefined"){return false}if((0, _isValidLatitude.default)(lat)===false||(0, _isValidLongitude.default)(lon)===false){return false}return true};var _default$w=isValidCoordinate;isValidCoordinate$1.default=_default$w;

Object.defineProperty(toDecimal$1,"__esModule",{value:true});toDecimal$1.default=void 0;var _isDecimal=_interopRequireDefault$m(isDecimal$1);var _isSexagesimal=_interopRequireDefault$m(isSexagesimal$1);var _sexagesimalToDecimal=_interopRequireDefault$m(sexagesimalToDecimal$1);var _isValidCoordinate=_interopRequireDefault$m(isValidCoordinate$1);var _getCoordinateKeys=_interopRequireDefault$m(getCoordinateKeys$1);function _interopRequireDefault$m(obj){return obj&&obj.__esModule?obj:{default:obj}}function ownKeys(object,enumerableOnly){var keys=Object.keys(object);if(Object.getOwnPropertySymbols){var symbols=Object.getOwnPropertySymbols(object);if(enumerableOnly)symbols=symbols.filter(function(sym){return Object.getOwnPropertyDescriptor(object,sym).enumerable});keys.push.apply(keys,symbols);}return keys}function _objectSpread(target){for(var i=1;i<arguments.length;i++){var source=arguments[i]!=null?arguments[i]:{};if(i%2){ownKeys(Object(source),true).forEach(function(key){_defineProperty(target,key,source[key]);});}else if(Object.getOwnPropertyDescriptors){Object.defineProperties(target,Object.getOwnPropertyDescriptors(source));}else {ownKeys(Object(source)).forEach(function(key){Object.defineProperty(target,key,Object.getOwnPropertyDescriptor(source,key));});}}return target}function _defineProperty(obj,key,value){if(key in obj){Object.defineProperty(obj,key,{value:value,enumerable:true,configurable:true,writable:true});}else {obj[key]=value;}return obj}var toDecimal=function toDecimal(value){if((0, _isDecimal.default)(value)){return Number(value)}if((0, _isSexagesimal.default)(value)){return (0, _sexagesimalToDecimal.default)(value)}if((0, _isValidCoordinate.default)(value)){var keys=(0, _getCoordinateKeys.default)(value);if(Array.isArray(value)){return value.map(function(v,index){return [0,1].includes(index)?toDecimal(v):v})}return _objectSpread(_objectSpread(_objectSpread({},value),keys.latitude&&_defineProperty({},keys.latitude,toDecimal(value[keys.latitude]))),keys.longitude&&_defineProperty({},keys.longitude,toDecimal(value[keys.longitude])))}if(Array.isArray(value)){return value.map(function(point){return (0, _isValidCoordinate.default)(point)?toDecimal(point):point})}return value};var _default$v=toDecimal;toDecimal$1.default=_default$v;

Object.defineProperty(getLatitude$1,"__esModule",{value:true});getLatitude$1.default=void 0;var _constants$9=constants;var _getCoordinateKey$1=_interopRequireDefault$l(getCoordinateKey$1);var _toDecimal$1=_interopRequireDefault$l(toDecimal$1);function _interopRequireDefault$l(obj){return obj&&obj.__esModule?obj:{default:obj}}var getLatitude=function getLatitude(point,raw){var latKey=(0, _getCoordinateKey$1.default)(point,_constants$9.latitudeKeys);if(typeof latKey==="undefined"||latKey===null){return}var value=point[latKey];return raw===true?value:(0, _toDecimal$1.default)(value)};var _default$u=getLatitude;getLatitude$1.default=_default$u;

var getLongitude$1 = {};

Object.defineProperty(getLongitude$1,"__esModule",{value:true});getLongitude$1.default=void 0;var _constants$8=constants;var _getCoordinateKey=_interopRequireDefault$k(getCoordinateKey$1);var _toDecimal=_interopRequireDefault$k(toDecimal$1);function _interopRequireDefault$k(obj){return obj&&obj.__esModule?obj:{default:obj}}var getLongitude=function getLongitude(point,raw){var latKey=(0, _getCoordinateKey.default)(point,_constants$8.longitudeKeys);if(typeof latKey==="undefined"||latKey===null){return}var value=point[latKey];return raw===true?value:(0, _toDecimal.default)(value)};var _default$t=getLongitude;getLongitude$1.default=_default$t;

var toRad$1 = {};

Object.defineProperty(toRad$1,"__esModule",{value:true});toRad$1.default=void 0;var toRad=function toRad(value){return value*Math.PI/180};var _default$s=toRad;toRad$1.default=_default$s;

var toDeg$1 = {};

Object.defineProperty(toDeg$1,"__esModule",{value:true});toDeg$1.default=void 0;var toDeg=function toDeg(value){return value*180/Math.PI};var _default$r=toDeg;toDeg$1.default=_default$r;

Object.defineProperty(computeDestinationPoint$1,"__esModule",{value:true});computeDestinationPoint$1.default=void 0;var _getLatitude$9=_interopRequireDefault$j(getLatitude$1);var _getLongitude$9=_interopRequireDefault$j(getLongitude$1);var _toRad$7=_interopRequireDefault$j(toRad$1);var _toDeg$4=_interopRequireDefault$j(toDeg$1);var _constants$7=constants;function _interopRequireDefault$j(obj){return obj&&obj.__esModule?obj:{default:obj}}var computeDestinationPoint=function computeDestinationPoint(start,distance,bearing){var radius=arguments.length>3&&arguments[3]!==undefined?arguments[3]:6371000;var lat=(0, _getLatitude$9.default)(start);var lng=(0, _getLongitude$9.default)(start);var delta=distance/radius;var theta=(0, _toRad$7.default)(bearing);var phi1=(0, _toRad$7.default)(lat);var lambda1=(0, _toRad$7.default)(lng);var phi2=Math.asin(Math.sin(phi1)*Math.cos(delta)+Math.cos(phi1)*Math.sin(delta)*Math.cos(theta));var lambda2=lambda1+Math.atan2(Math.sin(theta)*Math.sin(delta)*Math.cos(phi1),Math.cos(delta)-Math.sin(phi1)*Math.sin(phi2));var longitude=(0, _toDeg$4.default)(lambda2);if(longitude<_constants$7.MINLON||longitude>_constants$7.MAXLON){lambda2=(lambda2+3*Math.PI)%(2*Math.PI)-Math.PI;longitude=(0, _toDeg$4.default)(lambda2);}return {latitude:(0, _toDeg$4.default)(phi2),longitude:longitude}};var _default$q=computeDestinationPoint;computeDestinationPoint$1.default=_default$q;

var convertArea$1 = {};

Object.defineProperty(convertArea$1,"__esModule",{value:true});convertArea$1.default=void 0;var _constants$6=constants;var convertArea=function convertArea(squareMeters){var targetUnit=arguments.length>1&&arguments[1]!==undefined?arguments[1]:"m";var factor=_constants$6.areaConversion[targetUnit];if(factor){return squareMeters*factor}throw new Error("Invalid unit used for area conversion.")};var _default$p=convertArea;convertArea$1.default=_default$p;

var convertDistance$1 = {};

Object.defineProperty(convertDistance$1,"__esModule",{value:true});convertDistance$1.default=void 0;var _constants$5=constants;var convertDistance=function convertDistance(meters){var targetUnit=arguments.length>1&&arguments[1]!==undefined?arguments[1]:"m";var factor=_constants$5.distanceConversion[targetUnit];if(factor){return meters*factor}throw new Error("Invalid unit used for distance conversion.")};var _default$o=convertDistance;convertDistance$1.default=_default$o;

var convertSpeed$1 = {};

Object.defineProperty(convertSpeed$1,"__esModule",{value:true});convertSpeed$1.default=void 0;var _constants$4=constants;var convertSpeed=function convertSpeed(metersPerSecond){var targetUnit=arguments.length>1&&arguments[1]!==undefined?arguments[1]:"kmh";switch(targetUnit){case"kmh":return metersPerSecond*_constants$4.timeConversion.h*_constants$4.distanceConversion.km;case"mph":return metersPerSecond*_constants$4.timeConversion.h*_constants$4.distanceConversion.mi;default:return metersPerSecond;}};var _default$n=convertSpeed;convertSpeed$1.default=_default$n;

var decimalToSexagesimal = {};

Object.defineProperty(decimalToSexagesimal,"__esModule",{value:true});decimalToSexagesimal.default=void 0;function _slicedToArray$1(arr,i){return _arrayWithHoles$1(arr)||_iterableToArrayLimit$1(arr,i)||_unsupportedIterableToArray$1(arr,i)||_nonIterableRest$1()}function _nonIterableRest$1(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function _unsupportedIterableToArray$1(o,minLen){if(!o)return;if(typeof o==="string")return _arrayLikeToArray$1(o,minLen);var n=Object.prototype.toString.call(o).slice(8,-1);if(n==="Object"&&o.constructor)n=o.constructor.name;if(n==="Map"||n==="Set")return Array.from(o);if(n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))return _arrayLikeToArray$1(o,minLen)}function _arrayLikeToArray$1(arr,len){if(len==null||len>arr.length)len=arr.length;for(var i=0,arr2=new Array(len);i<len;i++){arr2[i]=arr[i];}return arr2}function _iterableToArrayLimit$1(arr,i){if(typeof Symbol==="undefined"||!(Symbol.iterator in Object(arr)))return;var _arr=[];var _n=true;var _d=false;var _e=undefined;try{for(var _i=arr[Symbol.iterator](),_s;!(_n=(_s=_i.next()).done);_n=true){_arr.push(_s.value);if(i&&_arr.length===i)break}}catch(err){_d=true;_e=err;}finally{try{if(!_n&&_i["return"]!=null)_i["return"]();}finally{if(_d)throw _e}}return _arr}function _arrayWithHoles$1(arr){if(Array.isArray(arr))return arr}var imprecise=function imprecise(number){var decimals=arguments.length>1&&arguments[1]!==undefined?arguments[1]:4;var factor=Math.pow(10,decimals);return Math.round(number*factor)/factor};var decimal2sexagesimalNext=function decimal2sexagesimalNext(decimal){var _decimal$toString$spl=decimal.toString().split("."),_decimal$toString$spl2=_slicedToArray$1(_decimal$toString$spl,2),pre=_decimal$toString$spl2[0],post=_decimal$toString$spl2[1];var deg=Math.abs(Number(pre));var min0=Number("0."+(post||0))*60;var sec0=min0.toString().split(".");var min=Math.floor(min0);var sec=imprecise(Number("0."+(sec0[1]||0))*60).toString();var _sec$split=sec.split("."),_sec$split2=_slicedToArray$1(_sec$split,2),secPreDec=_sec$split2[0],_sec$split2$=_sec$split2[1],secDec=_sec$split2$===void 0?"0":_sec$split2$;return deg+"\xB0 "+min.toString().padStart(2,"0")+"' "+secPreDec.padStart(2,"0")+"."+secDec.padEnd(1,"0")+"\""};var _default$m=decimal2sexagesimalNext;decimalToSexagesimal.default=_default$m;

var findNearest$1 = {};

var orderByDistance$1 = {};

var getDistance$2 = {};

var robustAcos$1 = {};

Object.defineProperty(robustAcos$1,"__esModule",{value:true});robustAcos$1.default=void 0;var robustAcos=function robustAcos(value){if(value>1){return 1}if(value<-1){return -1}return value};var _default$l=robustAcos;robustAcos$1.default=_default$l;

Object.defineProperty(getDistance$2,"__esModule",{value:true});getDistance$2.default=void 0;var _getLatitude$8=_interopRequireDefault$i(getLatitude$1);var _getLongitude$8=_interopRequireDefault$i(getLongitude$1);var _toRad$6=_interopRequireDefault$i(toRad$1);var _robustAcos$1=_interopRequireDefault$i(robustAcos$1);var _constants$3=constants;function _interopRequireDefault$i(obj){return obj&&obj.__esModule?obj:{default:obj}}var getDistance$1=function getDistance(from,to){var accuracy=arguments.length>2&&arguments[2]!==undefined?arguments[2]:1;accuracy=typeof accuracy!=="undefined"&&!isNaN(accuracy)?accuracy:1;var fromLat=(0, _getLatitude$8.default)(from);var fromLon=(0, _getLongitude$8.default)(from);var toLat=(0, _getLatitude$8.default)(to);var toLon=(0, _getLongitude$8.default)(to);var distance=Math.acos((0, _robustAcos$1.default)(Math.sin((0, _toRad$6.default)(toLat))*Math.sin((0, _toRad$6.default)(fromLat))+Math.cos((0, _toRad$6.default)(toLat))*Math.cos((0, _toRad$6.default)(fromLat))*Math.cos((0, _toRad$6.default)(fromLon)-(0, _toRad$6.default)(toLon))))*_constants$3.earthRadius;return Math.round(distance/accuracy)*accuracy};var _default$k=getDistance$1;getDistance$2.default=_default$k;

Object.defineProperty(orderByDistance$1,"__esModule",{value:true});orderByDistance$1.default=void 0;var _getDistance$5=_interopRequireDefault$h(getDistance$2);function _interopRequireDefault$h(obj){return obj&&obj.__esModule?obj:{default:obj}}var orderByDistance=function orderByDistance(point,coords){var distanceFn=arguments.length>2&&arguments[2]!==undefined?arguments[2]:_getDistance$5.default;distanceFn=typeof distanceFn==="function"?distanceFn:_getDistance$5.default;return coords.slice().sort(function(a,b){return distanceFn(point,a)-distanceFn(point,b)})};var _default$j=orderByDistance;orderByDistance$1.default=_default$j;

Object.defineProperty(findNearest$1,"__esModule",{value:true});findNearest$1.default=void 0;var _orderByDistance=_interopRequireDefault$g(orderByDistance$1);function _interopRequireDefault$g(obj){return obj&&obj.__esModule?obj:{default:obj}}var findNearest=function findNearest(point,coords){return (0, _orderByDistance.default)(point,coords)[0]};var _default$i=findNearest;findNearest$1.default=_default$i;

var getAreaOfPolygon$1 = {};

Object.defineProperty(getAreaOfPolygon$1,"__esModule",{value:true});getAreaOfPolygon$1.default=void 0;var _toRad$5=_interopRequireDefault$f(toRad$1);var _getLatitude$7=_interopRequireDefault$f(getLatitude$1);var _getLongitude$7=_interopRequireDefault$f(getLongitude$1);var _constants$2=constants;function _interopRequireDefault$f(obj){return obj&&obj.__esModule?obj:{default:obj}}var getAreaOfPolygon=function getAreaOfPolygon(points){var area=0;if(points.length>2){var lowerIndex;var middleIndex;var upperIndex;for(var i=0;i<points.length;i++){if(i===points.length-2){lowerIndex=points.length-2;middleIndex=points.length-1;upperIndex=0;}else if(i===points.length-1){lowerIndex=points.length-1;middleIndex=0;upperIndex=1;}else {lowerIndex=i;middleIndex=i+1;upperIndex=i+2;}var p1lon=(0, _getLongitude$7.default)(points[lowerIndex]);var p2lat=(0, _getLatitude$7.default)(points[middleIndex]);var p3lon=(0, _getLongitude$7.default)(points[upperIndex]);area+=((0, _toRad$5.default)(p3lon)-(0, _toRad$5.default)(p1lon))*Math.sin((0, _toRad$5.default)(p2lat));}area=area*_constants$2.earthRadius*_constants$2.earthRadius/2;}return Math.abs(area)};var _default$h=getAreaOfPolygon;getAreaOfPolygon$1.default=_default$h;

var getBounds$1 = {};

Object.defineProperty(getBounds$1,"__esModule",{value:true});getBounds$1.default=void 0;var _getLatitude$6=_interopRequireDefault$e(getLatitude$1);var _getLongitude$6=_interopRequireDefault$e(getLongitude$1);function _interopRequireDefault$e(obj){return obj&&obj.__esModule?obj:{default:obj}}var getBounds=function getBounds(points){if(Array.isArray(points)===false||points.length===0){throw new Error("No points were given.")}return points.reduce(function(stats,point){var latitude=(0, _getLatitude$6.default)(point);var longitude=(0, _getLongitude$6.default)(point);return {maxLat:Math.max(latitude,stats.maxLat),minLat:Math.min(latitude,stats.minLat),maxLng:Math.max(longitude,stats.maxLng),minLng:Math.min(longitude,stats.minLng)}},{maxLat:-Infinity,minLat:Infinity,maxLng:-Infinity,minLng:Infinity})};var _default$g=getBounds;getBounds$1.default=_default$g;

var getBoundsOfDistance$1 = {};

Object.defineProperty(getBoundsOfDistance$1,"__esModule",{value:true});getBoundsOfDistance$1.default=void 0;var _getLatitude$5=_interopRequireDefault$d(getLatitude$1);var _getLongitude$5=_interopRequireDefault$d(getLongitude$1);var _toRad$4=_interopRequireDefault$d(toRad$1);var _toDeg$3=_interopRequireDefault$d(toDeg$1);var _constants$1=constants;function _interopRequireDefault$d(obj){return obj&&obj.__esModule?obj:{default:obj}}var getBoundsOfDistance=function getBoundsOfDistance(point,distance){var latitude=(0, _getLatitude$5.default)(point);var longitude=(0, _getLongitude$5.default)(point);var radLat=(0, _toRad$4.default)(latitude);var radLon=(0, _toRad$4.default)(longitude);var radDist=distance/_constants$1.earthRadius;var minLat=radLat-radDist;var maxLat=radLat+radDist;var MAX_LAT_RAD=(0, _toRad$4.default)(_constants$1.MAXLAT);var MIN_LAT_RAD=(0, _toRad$4.default)(_constants$1.MINLAT);var MAX_LON_RAD=(0, _toRad$4.default)(_constants$1.MAXLON);var MIN_LON_RAD=(0, _toRad$4.default)(_constants$1.MINLON);var minLon;var maxLon;if(minLat>MIN_LAT_RAD&&maxLat<MAX_LAT_RAD){var deltaLon=Math.asin(Math.sin(radDist)/Math.cos(radLat));minLon=radLon-deltaLon;if(minLon<MIN_LON_RAD){minLon+=Math.PI*2;}maxLon=radLon+deltaLon;if(maxLon>MAX_LON_RAD){maxLon-=Math.PI*2;}}else {minLat=Math.max(minLat,MIN_LAT_RAD);maxLat=Math.min(maxLat,MAX_LAT_RAD);minLon=MIN_LON_RAD;maxLon=MAX_LON_RAD;}return [{latitude:(0, _toDeg$3.default)(minLat),longitude:(0, _toDeg$3.default)(minLon)},{latitude:(0, _toDeg$3.default)(maxLat),longitude:(0, _toDeg$3.default)(maxLon)}]};var _default$f=getBoundsOfDistance;getBoundsOfDistance$1.default=_default$f;

var getCenter$1 = {};

Object.defineProperty(getCenter$1,"__esModule",{value:true});getCenter$1.default=void 0;var _getLatitude$4=_interopRequireDefault$c(getLatitude$1);var _getLongitude$4=_interopRequireDefault$c(getLongitude$1);var _toRad$3=_interopRequireDefault$c(toRad$1);var _toDeg$2=_interopRequireDefault$c(toDeg$1);function _interopRequireDefault$c(obj){return obj&&obj.__esModule?obj:{default:obj}}var getCenter=function getCenter(points){if(Array.isArray(points)===false||points.length===0){return false}var numberOfPoints=points.length;var sum=points.reduce(function(acc,point){var pointLat=(0, _toRad$3.default)((0, _getLatitude$4.default)(point));var pointLon=(0, _toRad$3.default)((0, _getLongitude$4.default)(point));return {X:acc.X+Math.cos(pointLat)*Math.cos(pointLon),Y:acc.Y+Math.cos(pointLat)*Math.sin(pointLon),Z:acc.Z+Math.sin(pointLat)}},{X:0,Y:0,Z:0});var X=sum.X/numberOfPoints;var Y=sum.Y/numberOfPoints;var Z=sum.Z/numberOfPoints;return {longitude:(0, _toDeg$2.default)(Math.atan2(Y,X)),latitude:(0, _toDeg$2.default)(Math.atan2(Z,Math.sqrt(X*X+Y*Y)))}};var _default$e=getCenter;getCenter$1.default=_default$e;

var getCenterOfBounds$1 = {};

Object.defineProperty(getCenterOfBounds$1,"__esModule",{value:true});getCenterOfBounds$1.default=void 0;var _getBounds=_interopRequireDefault$b(getBounds$1);function _interopRequireDefault$b(obj){return obj&&obj.__esModule?obj:{default:obj}}var getCenterOfBounds=function getCenterOfBounds(coords){var bounds=(0, _getBounds.default)(coords);var latitude=bounds.minLat+(bounds.maxLat-bounds.minLat)/2;var longitude=bounds.minLng+(bounds.maxLng-bounds.minLng)/2;return {latitude:parseFloat(latitude.toFixed(6)),longitude:parseFloat(longitude.toFixed(6))}};var _default$d=getCenterOfBounds;getCenterOfBounds$1.default=_default$d;

var getCompassDirection$1 = {};

var getRhumbLineBearing$1 = {};

Object.defineProperty(getRhumbLineBearing$1,"__esModule",{value:true});getRhumbLineBearing$1.default=void 0;var _getLatitude$3=_interopRequireDefault$a(getLatitude$1);var _getLongitude$3=_interopRequireDefault$a(getLongitude$1);var _toRad$2=_interopRequireDefault$a(toRad$1);var _toDeg$1=_interopRequireDefault$a(toDeg$1);function _interopRequireDefault$a(obj){return obj&&obj.__esModule?obj:{default:obj}}var getRhumbLineBearing=function getRhumbLineBearing(origin,dest){var diffLon=(0, _toRad$2.default)((0, _getLongitude$3.default)(dest))-(0, _toRad$2.default)((0, _getLongitude$3.default)(origin));var diffPhi=Math.log(Math.tan((0, _toRad$2.default)((0, _getLatitude$3.default)(dest))/2+Math.PI/4)/Math.tan((0, _toRad$2.default)((0, _getLatitude$3.default)(origin))/2+Math.PI/4));if(Math.abs(diffLon)>Math.PI){if(diffLon>0){diffLon=(Math.PI*2-diffLon)*-1;}else {diffLon=Math.PI*2+diffLon;}}return ((0, _toDeg$1.default)(Math.atan2(diffLon,diffPhi))+360)%360};var _default$c=getRhumbLineBearing;getRhumbLineBearing$1.default=_default$c;

Object.defineProperty(getCompassDirection$1,"__esModule",{value:true});getCompassDirection$1.default=void 0;var _getRhumbLineBearing=_interopRequireDefault$9(getRhumbLineBearing$1);function _interopRequireDefault$9(obj){return obj&&obj.__esModule?obj:{default:obj}}var getCompassDirection=function getCompassDirection(origin,dest){var bearingFn=arguments.length>2&&arguments[2]!==undefined?arguments[2]:_getRhumbLineBearing.default;var bearing=typeof bearingFn==="function"?bearingFn(origin,dest):(0, _getRhumbLineBearing.default)(origin,dest);if(isNaN(bearing)){throw new Error("Could not calculate bearing for given points. Check your bearing function")}switch(Math.round(bearing/22.5)){case 1:return "NNE";case 2:return "NE";case 3:return "ENE";case 4:return "E";case 5:return "ESE";case 6:return "SE";case 7:return "SSE";case 8:return "S";case 9:return "SSW";case 10:return "SW";case 11:return "WSW";case 12:return "W";case 13:return "WNW";case 14:return "NW";case 15:return "NNW";default:return "N";}};var _default$b=getCompassDirection;getCompassDirection$1.default=_default$b;

var getDistanceFromLine$1 = {};

Object.defineProperty(getDistanceFromLine$1,"__esModule",{value:true});getDistanceFromLine$1.default=void 0;var _getDistance$4=_interopRequireDefault$8(getDistance$2);var _robustAcos=_interopRequireDefault$8(robustAcos$1);function _interopRequireDefault$8(obj){return obj&&obj.__esModule?obj:{default:obj}}var getDistanceFromLine=function getDistanceFromLine(point,lineStart,lineEnd){var accuracy=arguments.length>3&&arguments[3]!==undefined?arguments[3]:1;var d1=(0, _getDistance$4.default)(lineStart,point,accuracy);var d2=(0, _getDistance$4.default)(point,lineEnd,accuracy);var d3=(0, _getDistance$4.default)(lineStart,lineEnd,accuracy);var alpha=Math.acos((0, _robustAcos.default)((d1*d1+d3*d3-d2*d2)/(2*d1*d3)));var beta=Math.acos((0, _robustAcos.default)((d2*d2+d3*d3-d1*d1)/(2*d2*d3)));if(alpha>Math.PI/2){return d1}if(beta>Math.PI/2){return d2}return Math.sin(alpha)*d1};var _default$a=getDistanceFromLine;getDistanceFromLine$1.default=_default$a;

var getGreatCircleBearing$1 = {};

Object.defineProperty(getGreatCircleBearing$1,"__esModule",{value:true});getGreatCircleBearing$1.default=void 0;var _getLatitude$2=_interopRequireDefault$7(getLatitude$1);var _getLongitude$2=_interopRequireDefault$7(getLongitude$1);var _toRad$1=_interopRequireDefault$7(toRad$1);var _toDeg=_interopRequireDefault$7(toDeg$1);function _interopRequireDefault$7(obj){return obj&&obj.__esModule?obj:{default:obj}}var getGreatCircleBearing=function getGreatCircleBearing(origin,dest){var destLat=(0, _getLatitude$2.default)(dest);var detLon=(0, _getLongitude$2.default)(dest);var originLat=(0, _getLatitude$2.default)(origin);var originLon=(0, _getLongitude$2.default)(origin);var bearing=((0, _toDeg.default)(Math.atan2(Math.sin((0, _toRad$1.default)(detLon)-(0, _toRad$1.default)(originLon))*Math.cos((0, _toRad$1.default)(destLat)),Math.cos((0, _toRad$1.default)(originLat))*Math.sin((0, _toRad$1.default)(destLat))-Math.sin((0, _toRad$1.default)(originLat))*Math.cos((0, _toRad$1.default)(destLat))*Math.cos((0, _toRad$1.default)(detLon)-(0, _toRad$1.default)(originLon))))+360)%360;return bearing};var _default$9=getGreatCircleBearing;getGreatCircleBearing$1.default=_default$9;

var getPathLength$1 = {};

Object.defineProperty(getPathLength$1,"__esModule",{value:true});getPathLength$1.default=void 0;var _getDistance$3=_interopRequireDefault$6(getDistance$2);function _interopRequireDefault$6(obj){return obj&&obj.__esModule?obj:{default:obj}}function _typeof(obj){"@babel/helpers - typeof";if(typeof Symbol==="function"&&typeof Symbol.iterator==="symbol"){_typeof=function _typeof(obj){return typeof obj};}else {_typeof=function _typeof(obj){return obj&&typeof Symbol==="function"&&obj.constructor===Symbol&&obj!==Symbol.prototype?"symbol":typeof obj};}return _typeof(obj)}var getPathLength=function getPathLength(points){var distanceFn=arguments.length>1&&arguments[1]!==undefined?arguments[1]:_getDistance$3.default;return points.reduce(function(acc,point){if(_typeof(acc)==="object"&&acc.last!==null){acc.distance+=distanceFn(point,acc.last);}acc.last=point;return acc},{last:null,distance:0}).distance};var _default$8=getPathLength;getPathLength$1.default=_default$8;

var getPreciseDistance = {};

Object.defineProperty(getPreciseDistance,"__esModule",{value:true});getPreciseDistance.default=void 0;var _getLatitude$1=_interopRequireDefault$5(getLatitude$1);var _getLongitude$1=_interopRequireDefault$5(getLongitude$1);var _toRad=_interopRequireDefault$5(toRad$1);var _constants=constants;function _interopRequireDefault$5(obj){return obj&&obj.__esModule?obj:{default:obj}}var getDistance=function getDistance(start,end){var accuracy=arguments.length>2&&arguments[2]!==undefined?arguments[2]:1;accuracy=typeof accuracy!=="undefined"&&!isNaN(accuracy)?accuracy:1;var startLat=(0, _getLatitude$1.default)(start);var startLon=(0, _getLongitude$1.default)(start);var endLat=(0, _getLatitude$1.default)(end);var endLon=(0, _getLongitude$1.default)(end);var b=6356752.314245;var ellipsoidParams=1/298.257223563;var L=(0, _toRad.default)(endLon-startLon);var cosSigma;var sigma;var sinAlpha;var cosSqAlpha;var cos2SigmaM;var sinSigma;var U1=Math.atan((1-ellipsoidParams)*Math.tan((0, _toRad.default)(parseFloat(startLat))));var U2=Math.atan((1-ellipsoidParams)*Math.tan((0, _toRad.default)(parseFloat(endLat))));var sinU1=Math.sin(U1);var cosU1=Math.cos(U1);var sinU2=Math.sin(U2);var cosU2=Math.cos(U2);var lambda=L;var lambdaP;var iterLimit=100;do{var sinLambda=Math.sin(lambda);var cosLambda=Math.cos(lambda);sinSigma=Math.sqrt(cosU2*sinLambda*(cosU2*sinLambda)+(cosU1*sinU2-sinU1*cosU2*cosLambda)*(cosU1*sinU2-sinU1*cosU2*cosLambda));if(sinSigma===0){return 0}cosSigma=sinU1*sinU2+cosU1*cosU2*cosLambda;sigma=Math.atan2(sinSigma,cosSigma);sinAlpha=cosU1*cosU2*sinLambda/sinSigma;cosSqAlpha=1-sinAlpha*sinAlpha;cos2SigmaM=cosSigma-2*sinU1*sinU2/cosSqAlpha;if(isNaN(cos2SigmaM)){cos2SigmaM=0;}var C=ellipsoidParams/16*cosSqAlpha*(4+ellipsoidParams*(4-3*cosSqAlpha));lambdaP=lambda;lambda=L+(1-C)*ellipsoidParams*sinAlpha*(sigma+C*sinSigma*(cos2SigmaM+C*cosSigma*(-1+2*cos2SigmaM*cos2SigmaM)));}while(Math.abs(lambda-lambdaP)>1e-12&&--iterLimit>0);if(iterLimit===0){return NaN}var uSq=cosSqAlpha*(_constants.earthRadius*_constants.earthRadius-b*b)/(b*b);var A=1+uSq/16384*(4096+uSq*(-768+uSq*(320-175*uSq)));var B=uSq/1024*(256+uSq*(-128+uSq*(74-47*uSq)));var deltaSigma=B*sinSigma*(cos2SigmaM+B/4*(cosSigma*(-1+2*cos2SigmaM*cos2SigmaM)-B/6*cos2SigmaM*(-3+4*sinSigma*sinSigma)*(-3+4*cos2SigmaM*cos2SigmaM)));var distance=b*A*(sigma-deltaSigma);return Math.round(distance/accuracy)*accuracy};var _default$7=getDistance;getPreciseDistance.default=_default$7;

var getRoughCompassDirection$1 = {};

Object.defineProperty(getRoughCompassDirection$1,"__esModule",{value:true});getRoughCompassDirection$1.default=void 0;var getRoughCompassDirection=function getRoughCompassDirection(exact){if(/^(NNE|NE|NNW|N)$/.test(exact)){return "N"}if(/^(ENE|E|ESE|SE)$/.test(exact)){return "E"}if(/^(SSE|S|SSW|SW)$/.test(exact)){return "S"}if(/^(WSW|W|WNW|NW)$/.test(exact)){return "W"}};var _default$6=getRoughCompassDirection;getRoughCompassDirection$1.default=_default$6;

var getSpeed$1 = {};

Object.defineProperty(getSpeed$1,"__esModule",{value:true});getSpeed$1.default=void 0;var _getDistance$2=_interopRequireDefault$4(getDistance$2);function _interopRequireDefault$4(obj){return obj&&obj.__esModule?obj:{default:obj}}var getSpeed=function getSpeed(start,end){var distanceFn=arguments.length>2&&arguments[2]!==undefined?arguments[2]:_getDistance$2.default;var distance=distanceFn(start,end);var time=Number(end.time)-Number(start.time);var metersPerSecond=distance/time*1000;return metersPerSecond};var _default$5=getSpeed;getSpeed$1.default=_default$5;

var isPointInLine$1 = {};

Object.defineProperty(isPointInLine$1,"__esModule",{value:true});isPointInLine$1.default=void 0;var _getDistance$1=_interopRequireDefault$3(getDistance$2);function _interopRequireDefault$3(obj){return obj&&obj.__esModule?obj:{default:obj}}var isPointInLine=function isPointInLine(point,lineStart,lineEnd){return (0, _getDistance$1.default)(lineStart,point)+(0, _getDistance$1.default)(point,lineEnd)===(0, _getDistance$1.default)(lineStart,lineEnd)};var _default$4=isPointInLine;isPointInLine$1.default=_default$4;

var isPointInPolygon$1 = {};

Object.defineProperty(isPointInPolygon$1,"__esModule",{value:true});isPointInPolygon$1.default=void 0;var _getLatitude=_interopRequireDefault$2(getLatitude$1);var _getLongitude=_interopRequireDefault$2(getLongitude$1);function _interopRequireDefault$2(obj){return obj&&obj.__esModule?obj:{default:obj}}var isPointInPolygon=function isPointInPolygon(point,polygon){var isInside=false;var totalPolys=polygon.length;for(var i=-1,j=totalPolys-1;++i<totalPolys;j=i){if(((0, _getLongitude.default)(polygon[i])<=(0, _getLongitude.default)(point)&&(0, _getLongitude.default)(point)<(0, _getLongitude.default)(polygon[j])||(0, _getLongitude.default)(polygon[j])<=(0, _getLongitude.default)(point)&&(0, _getLongitude.default)(point)<(0, _getLongitude.default)(polygon[i]))&&(0, _getLatitude.default)(point)<((0, _getLatitude.default)(polygon[j])-(0, _getLatitude.default)(polygon[i]))*((0, _getLongitude.default)(point)-(0, _getLongitude.default)(polygon[i]))/((0, _getLongitude.default)(polygon[j])-(0, _getLongitude.default)(polygon[i]))+(0, _getLatitude.default)(polygon[i])){isInside=!isInside;}}return isInside};var _default$3=isPointInPolygon;isPointInPolygon$1.default=_default$3;

var isPointNearLine$1 = {};

Object.defineProperty(isPointNearLine$1,"__esModule",{value:true});isPointNearLine$1.default=void 0;var _getDistanceFromLine=_interopRequireDefault$1(getDistanceFromLine$1);function _interopRequireDefault$1(obj){return obj&&obj.__esModule?obj:{default:obj}}var isPointNearLine=function isPointNearLine(point,start,end,distance){return (0, _getDistanceFromLine.default)(point,start,end)<distance};var _default$2=isPointNearLine;isPointNearLine$1.default=_default$2;

var isPointWithinRadius$1 = {};

Object.defineProperty(isPointWithinRadius$1,"__esModule",{value:true});isPointWithinRadius$1.default=void 0;var _getDistance=_interopRequireDefault(getDistance$2);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj}}var isPointWithinRadius=function isPointWithinRadius(point,center,radius){var accuracy=0.01;return (0, _getDistance.default)(point,center,accuracy)<radius};var _default$1=isPointWithinRadius;isPointWithinRadius$1.default=_default$1;

var wktToPolygon$1 = {};

Object.defineProperty(wktToPolygon$1,"__esModule",{value:true});wktToPolygon$1.default=void 0;function _slicedToArray(arr,i){return _arrayWithHoles(arr)||_iterableToArrayLimit(arr,i)||_unsupportedIterableToArray(arr,i)||_nonIterableRest()}function _nonIterableRest(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}function _unsupportedIterableToArray(o,minLen){if(!o)return;if(typeof o==="string")return _arrayLikeToArray(o,minLen);var n=Object.prototype.toString.call(o).slice(8,-1);if(n==="Object"&&o.constructor)n=o.constructor.name;if(n==="Map"||n==="Set")return Array.from(o);if(n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))return _arrayLikeToArray(o,minLen)}function _arrayLikeToArray(arr,len){if(len==null||len>arr.length)len=arr.length;for(var i=0,arr2=new Array(len);i<len;i++){arr2[i]=arr[i];}return arr2}function _iterableToArrayLimit(arr,i){if(typeof Symbol==="undefined"||!(Symbol.iterator in Object(arr)))return;var _arr=[];var _n=true;var _d=false;var _e=undefined;try{for(var _i=arr[Symbol.iterator](),_s;!(_n=(_s=_i.next()).done);_n=true){_arr.push(_s.value);if(i&&_arr.length===i)break}}catch(err){_d=true;_e=err;}finally{try{if(!_n&&_i["return"]!=null)_i["return"]();}finally{if(_d)throw _e}}return _arr}function _arrayWithHoles(arr){if(Array.isArray(arr))return arr}var wktToPolygon=function wktToPolygon(wkt){if(!wkt.startsWith("POLYGON")){throw new Error("Invalid wkt.")}var coordsText=wkt.slice(wkt.indexOf("(")+2,wkt.indexOf(")")).split(", ");var polygon=coordsText.map(function(coordText){var _coordText$split=coordText.split(" "),_coordText$split2=_slicedToArray(_coordText$split,2),longitude=_coordText$split2[0],latitude=_coordText$split2[1];return {longitude:parseFloat(longitude),latitude:parseFloat(latitude)}});return polygon};var _default=wktToPolygon;wktToPolygon$1.default=_default;

(function (exports) {
Object.defineProperty(exports,"__esModule",{value:true});var _exportNames={computeDestinationPoint:true,convertArea:true,convertDistance:true,convertSpeed:true,decimalToSexagesimal:true,findNearest:true,getAreaOfPolygon:true,getBounds:true,getBoundsOfDistance:true,getCenter:true,getCenterOfBounds:true,getCompassDirection:true,getCoordinateKey:true,getCoordinateKeys:true,getDistance:true,getDistanceFromLine:true,getGreatCircleBearing:true,getLatitude:true,getLongitude:true,getPathLength:true,getPreciseDistance:true,getRhumbLineBearing:true,getRoughCompassDirection:true,getSpeed:true,isDecimal:true,isPointInLine:true,isPointInPolygon:true,isPointNearLine:true,isPointWithinRadius:true,isSexagesimal:true,isValidCoordinate:true,isValidLatitude:true,isValidLongitude:true,orderByDistance:true,sexagesimalToDecimal:true,toDecimal:true,toRad:true,toDeg:true,wktToPolygon:true};Object.defineProperty(exports,"computeDestinationPoint",{enumerable:true,get:function get(){return _computeDestinationPoint.default}});Object.defineProperty(exports,"convertArea",{enumerable:true,get:function get(){return _convertArea.default}});Object.defineProperty(exports,"convertDistance",{enumerable:true,get:function get(){return _convertDistance.default}});Object.defineProperty(exports,"convertSpeed",{enumerable:true,get:function get(){return _convertSpeed.default}});Object.defineProperty(exports,"decimalToSexagesimal",{enumerable:true,get:function get(){return _decimalToSexagesimal.default}});Object.defineProperty(exports,"findNearest",{enumerable:true,get:function get(){return _findNearest.default}});Object.defineProperty(exports,"getAreaOfPolygon",{enumerable:true,get:function get(){return _getAreaOfPolygon.default}});Object.defineProperty(exports,"getBounds",{enumerable:true,get:function get(){return _getBounds.default}});Object.defineProperty(exports,"getBoundsOfDistance",{enumerable:true,get:function get(){return _getBoundsOfDistance.default}});Object.defineProperty(exports,"getCenter",{enumerable:true,get:function get(){return _getCenter.default}});Object.defineProperty(exports,"getCenterOfBounds",{enumerable:true,get:function get(){return _getCenterOfBounds.default}});Object.defineProperty(exports,"getCompassDirection",{enumerable:true,get:function get(){return _getCompassDirection.default}});Object.defineProperty(exports,"getCoordinateKey",{enumerable:true,get:function get(){return _getCoordinateKey.default}});Object.defineProperty(exports,"getCoordinateKeys",{enumerable:true,get:function get(){return _getCoordinateKeys.default}});Object.defineProperty(exports,"getDistance",{enumerable:true,get:function get(){return _getDistance.default}});Object.defineProperty(exports,"getDistanceFromLine",{enumerable:true,get:function get(){return _getDistanceFromLine.default}});Object.defineProperty(exports,"getGreatCircleBearing",{enumerable:true,get:function get(){return _getGreatCircleBearing.default}});Object.defineProperty(exports,"getLatitude",{enumerable:true,get:function get(){return _getLatitude.default}});Object.defineProperty(exports,"getLongitude",{enumerable:true,get:function get(){return _getLongitude.default}});Object.defineProperty(exports,"getPathLength",{enumerable:true,get:function get(){return _getPathLength.default}});Object.defineProperty(exports,"getPreciseDistance",{enumerable:true,get:function get(){return _getPreciseDistance.default}});Object.defineProperty(exports,"getRhumbLineBearing",{enumerable:true,get:function get(){return _getRhumbLineBearing.default}});Object.defineProperty(exports,"getRoughCompassDirection",{enumerable:true,get:function get(){return _getRoughCompassDirection.default}});Object.defineProperty(exports,"getSpeed",{enumerable:true,get:function get(){return _getSpeed.default}});Object.defineProperty(exports,"isDecimal",{enumerable:true,get:function get(){return _isDecimal.default}});Object.defineProperty(exports,"isPointInLine",{enumerable:true,get:function get(){return _isPointInLine.default}});Object.defineProperty(exports,"isPointInPolygon",{enumerable:true,get:function get(){return _isPointInPolygon.default}});Object.defineProperty(exports,"isPointNearLine",{enumerable:true,get:function get(){return _isPointNearLine.default}});Object.defineProperty(exports,"isPointWithinRadius",{enumerable:true,get:function get(){return _isPointWithinRadius.default}});Object.defineProperty(exports,"isSexagesimal",{enumerable:true,get:function get(){return _isSexagesimal.default}});Object.defineProperty(exports,"isValidCoordinate",{enumerable:true,get:function get(){return _isValidCoordinate.default}});Object.defineProperty(exports,"isValidLatitude",{enumerable:true,get:function get(){return _isValidLatitude.default}});Object.defineProperty(exports,"isValidLongitude",{enumerable:true,get:function get(){return _isValidLongitude.default}});Object.defineProperty(exports,"orderByDistance",{enumerable:true,get:function get(){return _orderByDistance.default}});Object.defineProperty(exports,"sexagesimalToDecimal",{enumerable:true,get:function get(){return _sexagesimalToDecimal.default}});Object.defineProperty(exports,"toDecimal",{enumerable:true,get:function get(){return _toDecimal.default}});Object.defineProperty(exports,"toRad",{enumerable:true,get:function get(){return _toRad.default}});Object.defineProperty(exports,"toDeg",{enumerable:true,get:function get(){return _toDeg.default}});Object.defineProperty(exports,"wktToPolygon",{enumerable:true,get:function get(){return _wktToPolygon.default}});var _computeDestinationPoint=_interopRequireDefault(computeDestinationPoint$1);var _convertArea=_interopRequireDefault(convertArea$1);var _convertDistance=_interopRequireDefault(convertDistance$1);var _convertSpeed=_interopRequireDefault(convertSpeed$1);var _decimalToSexagesimal=_interopRequireDefault(decimalToSexagesimal);var _findNearest=_interopRequireDefault(findNearest$1);var _getAreaOfPolygon=_interopRequireDefault(getAreaOfPolygon$1);var _getBounds=_interopRequireDefault(getBounds$1);var _getBoundsOfDistance=_interopRequireDefault(getBoundsOfDistance$1);var _getCenter=_interopRequireDefault(getCenter$1);var _getCenterOfBounds=_interopRequireDefault(getCenterOfBounds$1);var _getCompassDirection=_interopRequireDefault(getCompassDirection$1);var _getCoordinateKey=_interopRequireDefault(getCoordinateKey$1);var _getCoordinateKeys=_interopRequireDefault(getCoordinateKeys$1);var _getDistance=_interopRequireDefault(getDistance$2);var _getDistanceFromLine=_interopRequireDefault(getDistanceFromLine$1);var _getGreatCircleBearing=_interopRequireDefault(getGreatCircleBearing$1);var _getLatitude=_interopRequireDefault(getLatitude$1);var _getLongitude=_interopRequireDefault(getLongitude$1);var _getPathLength=_interopRequireDefault(getPathLength$1);var _getPreciseDistance=_interopRequireDefault(getPreciseDistance);var _getRhumbLineBearing=_interopRequireDefault(getRhumbLineBearing$1);var _getRoughCompassDirection=_interopRequireDefault(getRoughCompassDirection$1);var _getSpeed=_interopRequireDefault(getSpeed$1);var _isDecimal=_interopRequireDefault(isDecimal$1);var _isPointInLine=_interopRequireDefault(isPointInLine$1);var _isPointInPolygon=_interopRequireDefault(isPointInPolygon$1);var _isPointNearLine=_interopRequireDefault(isPointNearLine$1);var _isPointWithinRadius=_interopRequireDefault(isPointWithinRadius$1);var _isSexagesimal=_interopRequireDefault(isSexagesimal$1);var _isValidCoordinate=_interopRequireDefault(isValidCoordinate$1);var _isValidLatitude=_interopRequireDefault(isValidLatitude$1);var _isValidLongitude=_interopRequireDefault(isValidLongitude$1);var _orderByDistance=_interopRequireDefault(orderByDistance$1);var _sexagesimalToDecimal=_interopRequireDefault(sexagesimalToDecimal$1);var _toDecimal=_interopRequireDefault(toDecimal$1);var _toRad=_interopRequireDefault(toRad$1);var _toDeg=_interopRequireDefault(toDeg$1);var _wktToPolygon=_interopRequireDefault(wktToPolygon$1);var _constants=constants;Object.keys(_constants).forEach(function(key){if(key==="default"||key==="__esModule")return;if(Object.prototype.hasOwnProperty.call(_exportNames,key))return;Object.defineProperty(exports,key,{enumerable:true,get:function get(){return _constants[key]}});});function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj}} 
} (es));

const fs = "#version 300 es\n#define SHADER_NAME arrow-layer-fragment-shader\nprecision highp float;\nin vec4 vFillColor;\nin float shouldDiscard;\nout vec4 fragmentColor;\nvoid main(void) {\n    if (shouldDiscard > 0.0) {\n        discard;\n    }\n    fragmentColor = vFillColor;\n}\n";

const vs = "#version 300 es\n#define SHADER_NAME arrow-layer-vertex-shader\n\nprecision highp float;\n\nin vec3 positions;\nin float instanceSize;\nin vec4 instanceColor;\nin float instanceSpeedFactor;\nin float instanceArrowDistance;\nin float instanceArrowDirection;\nin float instanceLineDistance;\nin int instanceLinePositionsTextureOffset;\nin int instanceLineDistancesTextureOffset;\nin int instanceLinePointCount;\nin float instanceLineParallelIndex;\nin vec3 instanceLineAngles;\nin vec2 instanceProximityFactors;\nin float instanceDistanceBetweenLines;\n\nuniform float sizeMinPixels;\nuniform float sizeMaxPixels;\nuniform float timestamp;\nuniform sampler2D linePositionsTexture;\nuniform sampler2D lineDistancesTexture;\nuniform float maxParallelOffset;\nuniform float minParallelOffset;\nuniform float opacity;\nuniform ivec2 linePositionsTextureSize;\n\nuniform ivec2 lineDistancesTextureSize;\n\nout vec4 vFillColor;\nout float shouldDiscard;\n\n/**\n * Calculate 2 dimensions texture index from flat index. \n */\nivec2 calculateTextureIndex(int flatIndex, ivec2 textureSize) {\n  return ivec2(flatIndex % textureSize.x, flatIndex / textureSize.x);\n}\n\n/**\n * Fetch WGS84 position from texture for a given point of the line.  \n */\nvec3 fetchLinePosition(int point) {\n  int flatIndex = instanceLinePositionsTextureOffset + point;\n  ivec2 textureIndex = calculateTextureIndex(flatIndex, linePositionsTextureSize); \n  return vec3(texelFetch(linePositionsTexture, textureIndex, 0).xy, 0);\n}\n\n/**\n * Fetch distance (in meters from the start of the line) from texture for a point of the line.  \n */\nfloat fetchLineDistance(int point) {\n  int flatIndex = instanceLineDistancesTextureOffset + point;\n  ivec2 textureIndex = calculateTextureIndex(flatIndex, lineDistancesTextureSize);\n  return texelFetch(lineDistancesTexture, textureIndex, 0).x;\n}\n\n/**            \n * Find the first point of the line that is after a given distance from the start (first line point).\n * (implemented using a binary search)\n * The returned value is always between 1 and instanceLinePointCount - 1, even if the searched distance is out of bounds\n * Here are example returned values for a path having points at distance 0.0, 10.0, 20.0\n * -1 => 1\n *  0 => 1\n *  1 => 1\n *  9 => 1\n *  10 => 2\n *  11 => 2\n *  19 => 2\n *  20 => 2\n *  21 => 2\n */\nint findFirstLinePointAfterDistance(float distance) {\n  int firstPoint = 0;\n  int lastPoint = instanceLinePointCount - 1;\n  \n  // variable length loops are not supported in GLSL, instanceLinePointCount is an upper bound that\n  // will never be reached as binary search complexity is in O(log(instanceLinePointCount))\n  for (int i = 0; i < instanceLinePointCount; i++) {\n      if (firstPoint + 1 == lastPoint) {\n          return lastPoint; \n      }   \n      int middlePoint = (firstPoint + lastPoint) / 2;           \n      float middlePointDistance = fetchLineDistance(middlePoint);      \n      if (middlePointDistance <= distance) {\n         firstPoint = middlePoint;\n      } else {\n         lastPoint = middlePoint;                            \n      }  \n  }   \n}\n\nmat3 calculateRotation(vec3 commonPosition1, vec3 commonPosition2) {\n  float angle = atan(commonPosition1.x - commonPosition2.x, commonPosition1.y - commonPosition2.y);\n  if (instanceArrowDirection < 2.0) {\n      angle += radians(180.0);\n  }\n  return mat3(cos(angle),  sin(angle),  0,\n              -sin(angle), cos(angle),  0,\n              0,           0,           0);\n}\n\n/**\n * Adjustment factor for low zoom levels\n * Code from deck.gl/modules/core/src/shaderlib/project/project.glsl.ts. We don't have access to this method from here. \n * Just to call it from project_size_all_zoom_levels().\n * Function renamed to project_size_at_latitude_low_zoom, to prevent conflicts with the original code.\n */\nfloat project_size_at_latitude_low_zoom(float lat) {\n  float y = clamp(lat, -89.9, 89.9);\n  return 1.0 / cos(radians(y));\n}\n\n/**\n * Forked version of project_size() from deck.gl deck.gl/modules/core/src/shaderlib/project/project.glsl.ts\n * Converts the size from the world space (meters) to the common space.\n * When the zoom level is lower than 12 (zoomed out), we use the arrow latitude to calculate the projection. \n * When the zoom level is higher than 12 (zoomed in), we fallback on the standard deck.gl project_size() which uses geometry.position.y. \n * I'm not sure why there is a change at zoomLevel = 12, but there seem to be some optimizations on the deck.gl side\n * (see: https://github.com/visgl/deck.gl/blob/401d624c0529faaa62125714c376b3ba3b8f379f/dev-docs/RFCs/v6.1/improved-lnglat-projection-rfc.md?plain=1#L29)\n */\nfloat project_size_all_zoom_levels(float meters, float lat) {\n   // We use project_uScale = 4096 (2^12) which corresponds to zoom = 12 \n   if (project_uScale < 4096.0) { \n    return meters * project_uCommonUnitsPerMeter.z * project_size_at_latitude_low_zoom(lat);\n  }\n  return project_size(meters);\n}\n\nvoid main(void) {\n  if (instanceArrowDirection < 1.0) {\n      vFillColor = vec4(0, 0, 0, 0);\n      shouldDiscard = 1.0;\n  } else {\n      // arrow distance from the line start shifted with current timestamp\n      // instanceArrowDistance: a float in interval [0,1] describing the initial position of the arrow along the full path between two substations (0: begin, 1.0 end)\n      float arrowDistance = mod(instanceLineDistance * instanceArrowDistance + (instanceArrowDirection < 2.0 ? 1.0 : -1.0) * timestamp * instanceSpeedFactor, instanceLineDistance);\n    \n      // look for first line point that is after arrow distance\n      int linePoint = findFirstLinePointAfterDistance(arrowDistance);\n    \n      // Interpolate the 2 line points position\n      float lineDistance1 = fetchLineDistance(linePoint - 1);\n      float lineDistance2 = fetchLineDistance(linePoint);\n      float interpolationValue = (arrowDistance - lineDistance1) / (lineDistance2 - lineDistance1);\n      \n      // position for the line point just before the arrow\n      vec3 linePosition1 = fetchLinePosition(linePoint - 1);\n    \n      // position for the line point just after the arrow\n      vec3 linePosition2 = fetchLinePosition(linePoint);\n    \n      // clamp to arrow size limits\n      float sizePixels = clamp(project_size_to_pixel(instanceSize), sizeMinPixels, sizeMaxPixels);\n\n      // project the 2 line points position to common space \n      vec3 position64Low = vec3(0, 0, 0);\n      vec3 commonPosition1 = project_position(linePosition1, position64Low);\n      vec3 commonPosition2 = project_position(linePosition2, position64Low);\n\n      // We call our own project_size_all_zoom_levels() instead of project_size() from deck.gl as the latter causes a bug: the arrows\n      // are not correctly positioned on the lines, they are slightly off. \n      // This hack does not seem necessary for parallel-path or fork-line layers.\n      vec3 arrowPositionWorldSpace = mix(linePosition1, linePosition2, interpolationValue);\n      float offsetCommonSpace = clamp(project_size_all_zoom_levels(instanceDistanceBetweenLines, arrowPositionWorldSpace.y), project_pixel_size(minParallelOffset), project_pixel_size(maxParallelOffset));\n\n      // calculate translation for the parallels lines, use the angle calculated from origin/destination\n      // to maintain the same translation between segments\n      float instanceLineAngle1 = instanceLineAngles[1]; \n      float instanceLineAngle2 = instanceLineAngles[1]; \n      if( linePoint == 1 ){\n        instanceLineAngle1 = instanceLineAngles[0];\n      }\n      if ( linePoint == int(instanceLinePointCount)-1 ){\n        instanceLineAngle2 = instanceLineAngles[2];\n      }      \n      vec3 transOr = vec3(cos(instanceLineAngle1), -sin(instanceLineAngle1),0.) * instanceLineParallelIndex;      \n      if(linePoint == 1) {\n          transOr.x -= sin(instanceLineAngle1) * instanceProximityFactors[0];\n          transOr.y -= cos(instanceLineAngle1) * instanceProximityFactors[0];\n      }\n      commonPosition1 += transOr * offsetCommonSpace;\n      vec3 transEx = vec3(cos(instanceLineAngle2), -sin(instanceLineAngle2),0.) * instanceLineParallelIndex;\n      if (linePoint == int(instanceLinePointCount)-1) {\n          transEx.x += sin(instanceLineAngle2) * instanceProximityFactors[1];\n          transEx.y += cos(instanceLineAngle2) * instanceProximityFactors[1];\n      }\n      commonPosition2 += transEx * offsetCommonSpace;\n\n      // calculate arrow position in the common space by interpolating the 2 line points position\n      vec3 arrowPosition = mix(commonPosition1, commonPosition2, interpolationValue);\n\n      // calculate rotation angle for aligning the arrow with the line segment\n      // it has to be done in the common space to get the right angle!!!\n      mat3 rotation = calculateRotation(commonPosition1, commonPosition2);\n\n      // calculate vertex position in the clipspace\n      vec3 offset = positions * project_pixel_size(sizePixels) * rotation;\n      vec4 vertexPosition = project_common_position_to_clipspace(vec4(arrowPosition + offset, 1));\n\n      // vertex shader output\n      gl_Position = vertexPosition;\n\n      // arrow fill color for fragment shader \n      vFillColor = vec4(instanceColor.rgb, opacity);\n      shouldDiscard = 0.0;\n  }\n}\n";

const DEFAULT_COLOR = [0, 0, 0, 255];
const MAX_LINE_POINT_COUNT = 2 ** 15;
var ArrowDirection = /* @__PURE__ */ ((ArrowDirection2) => {
  ArrowDirection2["NONE"] = "none";
  ArrowDirection2["FROM_SIDE_1_TO_SIDE_2"] = "fromSide1ToSide2";
  ArrowDirection2["FROM_SIDE_2_TO_SIDE_1"] = "fromSide2ToSide1";
  return ArrowDirection2;
})(ArrowDirection || {});
const defaultProps$5 = {
  sizeMinPixels: { type: "number", min: 0, value: 0 },
  //  min size in pixels
  sizeMaxPixels: { type: "number", min: 0, value: Number.MAX_SAFE_INTEGER },
  // max size in pixels
  // getDistance: { type: 'accessor', value: (arrow: Arrow) => arrow.distance },
  getLine: { type: "function", value: (arrow) => arrow.line },
  // getLinePositions: {
  //     type: 'function',
  //     value: (line: Line) => line.positions,
  // },
  getSize: { type: "accessor", value: 1 },
  getColor: { type: "accessor", value: DEFAULT_COLOR },
  getSpeedFactor: { type: "accessor", value: 1 },
  getDirection: { type: "accessor", value: "none" /* NONE */ },
  animated: { type: "boolean", value: true },
  getLineParallelIndex: { type: "accessor", value: 0 },
  getLineAngles: { type: "accessor", value: [0, 0, 0] },
  maxParallelOffset: { type: "number", value: 100 },
  minParallelOffset: { type: "number", value: 3 },
  opacity: { type: "number", value: 1 },
  getDistanceBetweenLines: { type: "accessor", value: 1e3 }
};
class ArrowLayer extends Layer {
  static layerName = "ArrowLayer";
  static defaultProps = defaultProps$5;
  getShaders() {
    return super.getShaders({ vs, fs, modules: [project32, picking] });
  }
  getArrowLineAttributes(arrow) {
    const line = this.props.getLine(arrow);
    if (!line) {
      throw new Error("Invalid line");
    }
    const attributes = this.state.lineAttributes.get(line);
    if (!attributes) {
      throw new Error(`Line ${line.id} not found`);
    }
    return attributes;
  }
  initializeState() {
    const { device } = this.context;
    if (!device.features.has("texture-blend-float-webgl")) {
      throw new Error("Arrow layer not supported on this browser");
    }
    const maxTextureSize = device.getParametersWebGL(
      GL.MAX_TEXTURE_SIZE
    );
    this.state = {
      maxTextureSize
    };
    this.getAttributeManager()?.addInstanced({
      instanceSize: {
        size: 1,
        type: "float32",
        transition: true,
        accessor: "getSize",
        defaultValue: 1
      },
      instanceColor: {
        size: this.props.colorFormat.length,
        transition: true,
        type: "unorm8",
        // normalized: true,
        accessor: "getColor",
        defaultValue: [0, 0, 0, 255]
      },
      instanceSpeedFactor: {
        size: 1,
        type: "float32",
        transition: true,
        accessor: "getSpeedFactor",
        defaultValue: 1
      },
      instanceArrowDistance: {
        size: 1,
        transition: true,
        accessor: "getDistance",
        type: "float32",
        defaultValue: 0
      },
      instanceArrowDirection: {
        size: 1,
        type: "float32",
        transition: true,
        accessor: "getDirection",
        transform: (direction) => {
          switch (direction) {
            case "none" /* NONE */:
              return 0;
            case "fromSide1ToSide2" /* FROM_SIDE_1_TO_SIDE_2 */:
              return 1;
            case "fromSide2ToSide1" /* FROM_SIDE_2_TO_SIDE_1 */:
              return 2;
            default:
              throw new Error("impossible");
          }
        },
        defaultValue: 0
      },
      instanceLineDistance: {
        size: 1,
        transition: true,
        type: "float32",
        accessor: (arrow) => this.getArrowLineAttributes(arrow).distance
      },
      instanceLinePositionsTextureOffset: {
        size: 1,
        transition: true,
        type: "sint32",
        accessor: (arrow) => this.getArrowLineAttributes(arrow).positionsTextureOffset
      },
      instanceLineDistancesTextureOffset: {
        size: 1,
        transition: true,
        type: "sint32",
        accessor: (arrow) => this.getArrowLineAttributes(arrow).distancesTextureOffset
      },
      instanceLinePointCount: {
        size: 1,
        transition: true,
        type: "sint32",
        accessor: (arrow) => this.getArrowLineAttributes(arrow).pointCount
      },
      instanceLineParallelIndex: {
        size: 1,
        accessor: "getLineParallelIndex",
        type: "float32"
      },
      instanceLineAngles: {
        size: 3,
        accessor: "getLineAngles",
        type: "float32"
      },
      instanceProximityFactors: {
        size: 2,
        accessor: "getProximityFactors",
        //TODO where is it ???
        type: "float32"
      },
      instanceDistanceBetweenLines: {
        size: 1,
        transition: true,
        accessor: "getDistanceBetweenLines",
        type: "float32",
        defaultValue: 1e3
      }
    });
  }
  finalizeState(context) {
    super.finalizeState(context);
    this.state.stop = true;
  }
  createTexture2D(device, data, elementSize, format) {
    const start = performance.now();
    const { maxTextureSize } = this.state;
    const elementCount = data.length / elementSize;
    const width = Math.min(maxTextureSize, elementCount);
    const height = Math.ceil(elementCount / width);
    if (height > maxTextureSize) {
      throw new Error(
        `Texture size ${width}*${height} cannot be greater than ${maxTextureSize}`
      );
    }
    const newLength = width * height * elementSize;
    if (data.length < newLength) {
      const oldLength = data.length;
      data.length = newLength;
      data.fill(0, oldLength, newLength);
    }
    const texture2d = device.createTexture({
      width,
      height,
      format,
      type: GL.FLOAT,
      data: new Float32Array(data),
      parameters: {
        [GL.TEXTURE_MAG_FILTER]: GL.NEAREST,
        [GL.TEXTURE_MIN_FILTER]: GL.NEAREST,
        [GL.TEXTURE_WRAP_S]: GL.CLAMP_TO_EDGE,
        [GL.TEXTURE_WRAP_T]: GL.CLAMP_TO_EDGE
      },
      mipmaps: false
    });
    const stop = performance.now();
    console.info(
      `Texture of ${newLength} elements (${width} * ${height}) created in ${stop - start} ms`
    );
    return texture2d;
  }
  createTexturesStructure(props) {
    const start = performance.now();
    const linePositionsTextureData = [];
    const lineDistancesTextureData = [];
    const lineAttributes = /* @__PURE__ */ new Map();
    let lineDistance = 0;
    const lines = [
      ...new Set(props.data.map((arrow) => this.props.getLine(arrow)))
    ];
    lines.forEach((line) => {
      const positions = props.getLinePositions(line);
      if (!positions) {
        throw new Error(`Invalid positions for line ${line.id}`);
      }
      const linePositionsTextureOffset = linePositionsTextureData.length / 2;
      const lineDistancesTextureOffset = lineDistancesTextureData.length;
      let linePointCount = 0;
      if (positions.length > 0) {
        positions.forEach((position) => {
          linePositionsTextureData.push(position[0]);
          linePositionsTextureData.push(position[1]);
          linePointCount++;
        });
        lineDistancesTextureData.push(...line.cumulativeDistances);
        lineDistance = line.cumulativeDistances[line.cumulativeDistances.length - 1];
      }
      if (linePointCount > MAX_LINE_POINT_COUNT) {
        throw new Error(
          `Too many line point count (${linePointCount}), maximum is ${MAX_LINE_POINT_COUNT}`
        );
      }
      lineAttributes.set(line, {
        distance: lineDistance,
        positionsTextureOffset: linePositionsTextureOffset,
        distancesTextureOffset: lineDistancesTextureOffset,
        pointCount: linePointCount
      });
    });
    const stop = performance.now();
    console.info(`Texture data created in ${stop - start} ms`);
    return {
      linePositionsTextureData,
      lineDistancesTextureData,
      lineAttributes
    };
  }
  updateGeometry({ props, changeFlags }) {
    const geometryChanged = changeFlags.dataChanged || changeFlags.updateTriggersChanged && (changeFlags.updateTriggersChanged.all || changeFlags.updateTriggersChanged.getLinePositions);
    if (geometryChanged) {
      const { device } = this.context;
      const {
        linePositionsTextureData,
        lineDistancesTextureData,
        lineAttributes
      } = this.createTexturesStructure(props);
      const linePositionsTexture = this.createTexture2D(
        device,
        linePositionsTextureData,
        2,
        "rg32float"
        //GL.RG32F,
      );
      const lineDistancesTexture = this.createTexture2D(
        device,
        lineDistancesTextureData,
        1,
        "r32float"
        //GL.R32F,
      );
      this.setState({
        linePositionsTexture,
        lineDistancesTexture,
        lineAttributes
      });
      if (!changeFlags.dataChanged) {
        this.getAttributeManager()?.invalidateAll();
      }
    }
  }
  updateModel({ changeFlags }) {
    if (changeFlags.somethingChanged) {
      const { device } = this.context;
      const { model } = this.state;
      if (model) {
        model.destroy();
      }
      this.setState({
        model: this._getModel(device)
      });
      this.getAttributeManager()?.invalidateAll();
    }
  }
  updateState(updateParams) {
    super.updateState(updateParams);
    this.updateGeometry(updateParams);
    this.updateModel(updateParams);
    const { props, oldProps } = updateParams;
    if (props.animated !== oldProps.animated) {
      this.setState({
        stop: !props.animated,
        timestamp: 0
      });
      if (props.animated) {
        this.startAnimation();
      }
    }
  }
  animate(timestamp) {
    if (this.state.stop) {
      return;
    }
    this.setState({
      timestamp
    });
    this.startAnimation();
  }
  startAnimation() {
    window.requestAnimationFrame((timestamp) => this.animate(timestamp));
  }
  draw({
    uniforms,
    renderPass
  }) {
    const { sizeMinPixels, sizeMaxPixels, opacity } = this.props;
    const {
      model,
      linePositionsTexture,
      lineDistancesTexture,
      timestamp
      // maxTextureSize,
    } = this.state;
    model.setBindings({
      linePositionsTexture,
      lineDistancesTexture
    });
    model.setUniforms({
      ...uniforms,
      sizeMinPixels,
      sizeMaxPixels,
      // maxTextureSize,
      linePositionsTextureSize: [
        linePositionsTexture.width,
        linePositionsTexture.height
      ],
      opacity,
      lineDistancesTextureSize: [
        lineDistancesTexture.width,
        lineDistancesTexture.height
      ],
      timestamp,
      maxParallelOffset: this.props.maxParallelOffset,
      minParallelOffset: this.props.minParallelOffset
    });
    model.draw(renderPass);
  }
  _getModel(device) {
    const positions = [
      -1,
      -1,
      0,
      0,
      1,
      0,
      0,
      -0.6,
      0,
      1,
      -1,
      0,
      0,
      1,
      0,
      0,
      -0.6,
      0
    ];
    return new Model(
      device,
      Object.assign(this.getShaders(), {
        id: this.props.id,
        bufferLayout: this.getAttributeManager().getBufferLayouts(),
        geometry: new Geometry({
          topology: "triangle-list",
          vertexCount: 6,
          attributes: {
            positions: {
              size: 3,
              value: new Float32Array(positions)
            }
          }
        }),
        isInstanced: true
      })
    );
  }
}

const substationPositionByIdIndexer = (map, substation) => {
  map.set(substation.id, substation.coordinate);
  return map;
};
const linePositionByIdIndexer = (map, line) => {
  map.set(line.id, line.coordinates);
  return map;
};
class GeoData {
  substationPositionsById = /* @__PURE__ */ new Map();
  linePositionsById = /* @__PURE__ */ new Map();
  constructor(substationPositionsById, linePositionsById) {
    this.substationPositionsById = substationPositionsById;
    this.linePositionsById = linePositionsById;
  }
  setSubstationPositions(positions) {
    this.substationPositionsById = positions.reduce(
      substationPositionByIdIndexer,
      /* @__PURE__ */ new Map()
    );
  }
  updateSubstationPositions(substationIdsToUpdate, fetchedPositions) {
    fetchedPositions.forEach(
      (pos) => this.substationPositionsById.set(pos.id, pos.coordinate)
    );
    substationIdsToUpdate.filter((id) => !fetchedPositions.map((pos) => pos.id).includes(id)).forEach((id) => this.substationPositionsById.delete(id));
  }
  getSubstationPosition(substationId) {
    const position = this.substationPositionsById.get(substationId);
    if (!position) {
      console.warn(`Position not found for ${substationId}`);
      return [0, 0];
    }
    return [position.lon, position.lat];
  }
  setLinePositions(positions) {
    this.linePositionsById = positions.reduce(
      linePositionByIdIndexer,
      /* @__PURE__ */ new Map()
    );
  }
  updateLinePositions(lineIdsToUpdate, fetchedPositions) {
    fetchedPositions.forEach((pos) => {
      this.linePositionsById.set(pos.id, pos.coordinates);
    });
    lineIdsToUpdate.filter((id) => !fetchedPositions.map((pos) => pos.id).includes(id)).forEach((id) => this.linePositionsById.delete(id));
  }
  /**
   * Get line positions always ordered from side 1 to side 2.
   */
  getLinePositions(network, line, detailed = true) {
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
    if (substationPosition1[0] === 0 && substationPosition1[1] === 0 || substationPosition2[0] === 0 && substationPosition2[1] === 0) {
      return [
        [0, 0],
        [0, 0]
      ];
    }
    if (detailed) {
      const linePositions = this.linePositionsById.get(line.id);
      if (linePositions) {
        const positions = new Array(linePositions.length);
        for (const [index, position] of linePositions.entries()) {
          positions[index] = [position.lon, position.lat];
        }
        return positions;
      }
    }
    return [substationPosition1, substationPosition2];
  }
  getLineDistances(positions) {
    if (positions !== null && positions.length > 1) {
      const cumulativeDistanceArray = [0];
      let cumulativeDistance = 0;
      let segmentDistance;
      let ruler;
      for (let i = 0; i < positions.length - 1; i++) {
        ruler = new CheapRuler(positions[i][1], "meters");
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
  findSegment(positions, cumulativeDistances, wantedDistance) {
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
      segment: positions.slice(lowerBound, lowerBound + 2),
      remainingDistance: wantedDistance - cumulativeDistances[lowerBound]
    };
  }
  labelDisplayPosition(positions, cumulativeDistances, arrowPosition, arrowDirection, lineParallelIndex, lineAngle, proximityAngle, distanceBetweenLines, proximityFactor) {
    if (arrowPosition > 1 || arrowPosition < 0) {
      throw new Error(
        "Proportional position value incorrect: " + arrowPosition
      );
    }
    if (cumulativeDistances === null || cumulativeDistances.length < 2 || cumulativeDistances[cumulativeDistances.length - 1] === 0) {
      return null;
    }
    const lineDistance = cumulativeDistances[cumulativeDistances.length - 1];
    let wantedDistance = lineDistance * arrowPosition;
    if (cumulativeDistances.length === 2) {
      wantedDistance = wantedDistance - 2 * distanceBetweenLines * arrowPosition * proximityFactor;
    }
    const goodSegment = this.findSegment(
      positions,
      cumulativeDistances,
      wantedDistance
    );
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
        throw new Error("impossible");
    }
    const remainingDistance = goodSegment.remainingDistance * multiplier;
    const angle = this.getMapAngle(
      goodSegment.segment[0],
      goodSegment.segment[1]
    );
    const neededOffset = this.getLabelOffset(angle, 20, arrowDirection);
    const position = {
      position: es.computeDestinationPoint(
        goodSegment.segment[0],
        remainingDistance,
        angle
      ),
      angle,
      offset: neededOffset
    };
    position.position = es.computeDestinationPoint(
      position.position,
      distanceBetweenLines * lineParallelIndex,
      lineAngle + 90
    );
    if (cumulativeDistances.length === 2) {
      position.position = es.computeDestinationPoint(
        position.position,
        -distanceBetweenLines * proximityFactor,
        lineAngle
      );
    } else if (goodSegment.idx === 0 || goodSegment.idx === cumulativeDistances.length - 2) {
      const segmentDistance = cumulativeDistances[goodSegment.idx + 1] - cumulativeDistances[goodSegment.idx];
      const alreadyDoneDistance = segmentDistance - remainingDistance;
      let labelDistanceInSegment;
      if (goodSegment.idx === 0) {
        labelDistanceInSegment = -alreadyDoneDistance;
      } else {
        labelDistanceInSegment = remainingDistance;
      }
      const labelPercentage = labelDistanceInSegment / segmentDistance;
      position.position = es.computeDestinationPoint(
        position.position,
        distanceBetweenLines * labelPercentage,
        proximityAngle
      );
    }
    return position;
  }
  getLabelOffset(angle, offsetDistance, arrowDirection) {
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
        throw new Error("impossible");
    }
    return [
      Math.cos(radiantAngle) * offsetDistance * direction,
      -Math.sin(radiantAngle) * offsetDistance * direction
    ];
  }
  //returns the angle between point1 and point2 in degrees [0-360)
  getMapAngle(point1, point2) {
    let angle = es.getRhumbLineBearing(point1, point2);
    const angle2 = es.getGreatCircleBearing(point1, point2);
    const coeff = 0.1;
    angle = coeff * angle + (1 - coeff) * angle2;
    return angle;
  }
}

const SUBSTATION_RADIUS = 500;
const SUBSTATION_RADIUS_MAX_PIXEL = 5;
const SUBSTATION_RADIUS_MIN_PIXEL = 1;

var react = {exports: {}};

var react_production_min = {};

/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var hasRequiredReact_production_min;

function requireReact_production_min () {
	if (hasRequiredReact_production_min) return react_production_min;
	hasRequiredReact_production_min = 1;
var l=Symbol.for("react.element"),n=Symbol.for("react.portal"),p=Symbol.for("react.fragment"),q=Symbol.for("react.strict_mode"),r=Symbol.for("react.profiler"),t=Symbol.for("react.provider"),u=Symbol.for("react.context"),v=Symbol.for("react.forward_ref"),w=Symbol.for("react.suspense"),x=Symbol.for("react.memo"),y=Symbol.for("react.lazy"),z=Symbol.iterator;function A(a){if(null===a||"object"!==typeof a)return null;a=z&&a[z]||a["@@iterator"];return "function"===typeof a?a:null}
	var B={isMounted:function(){return !1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},C=Object.assign,D={};function E(a,b,e){this.props=a;this.context=b;this.refs=D;this.updater=e||B;}E.prototype.isReactComponent={};
	E.prototype.setState=function(a,b){if("object"!==typeof a&&"function"!==typeof a&&null!=a)throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,a,b,"setState");};E.prototype.forceUpdate=function(a){this.updater.enqueueForceUpdate(this,a,"forceUpdate");};function F(){}F.prototype=E.prototype;function G(a,b,e){this.props=a;this.context=b;this.refs=D;this.updater=e||B;}var H=G.prototype=new F;
	H.constructor=G;C(H,E.prototype);H.isPureReactComponent=!0;var I=Array.isArray,J=Object.prototype.hasOwnProperty,K={current:null},L={key:!0,ref:!0,__self:!0,__source:!0};
	function M(a,b,e){var d,c={},k=null,h=null;if(null!=b)for(d in void 0!==b.ref&&(h=b.ref),void 0!==b.key&&(k=""+b.key),b)J.call(b,d)&&!L.hasOwnProperty(d)&&(c[d]=b[d]);var g=arguments.length-2;if(1===g)c.children=e;else if(1<g){for(var f=Array(g),m=0;m<g;m++)f[m]=arguments[m+2];c.children=f;}if(a&&a.defaultProps)for(d in g=a.defaultProps,g)void 0===c[d]&&(c[d]=g[d]);return {$$typeof:l,type:a,key:k,ref:h,props:c,_owner:K.current}}
	function N(a,b){return {$$typeof:l,type:a.type,key:b,ref:a.ref,props:a.props,_owner:a._owner}}function O(a){return "object"===typeof a&&null!==a&&a.$$typeof===l}function escape(a){var b={"=":"=0",":":"=2"};return "$"+a.replace(/[=:]/g,function(a){return b[a]})}var P=/\/+/g;function Q(a,b){return "object"===typeof a&&null!==a&&null!=a.key?escape(""+a.key):b.toString(36)}
	function R(a,b,e,d,c){var k=typeof a;if("undefined"===k||"boolean"===k)a=null;var h=!1;if(null===a)h=!0;else switch(k){case "string":case "number":h=!0;break;case "object":switch(a.$$typeof){case l:case n:h=!0;}}if(h)return h=a,c=c(h),a=""===d?"."+Q(h,0):d,I(c)?(e="",null!=a&&(e=a.replace(P,"$&/")+"/"),R(c,b,e,"",function(a){return a})):null!=c&&(O(c)&&(c=N(c,e+(!c.key||h&&h.key===c.key?"":(""+c.key).replace(P,"$&/")+"/")+a)),b.push(c)),1;h=0;d=""===d?".":d+":";if(I(a))for(var g=0;g<a.length;g++){k=
	a[g];var f=d+Q(k,g);h+=R(k,b,e,f,c);}else if(f=A(a),"function"===typeof f)for(a=f.call(a),g=0;!(k=a.next()).done;)k=k.value,f=d+Q(k,g++),h+=R(k,b,e,f,c);else if("object"===k)throw b=String(a),Error("Objects are not valid as a React child (found: "+("[object Object]"===b?"object with keys {"+Object.keys(a).join(", ")+"}":b)+"). If you meant to render a collection of children, use an array instead.");return h}
	function S(a,b,e){if(null==a)return a;var d=[],c=0;R(a,d,"","",function(a){return b.call(e,a,c++)});return d}function T(a){if(-1===a._status){var b=a._result;b=b();b.then(function(b){if(0===a._status||-1===a._status)a._status=1,a._result=b;},function(b){if(0===a._status||-1===a._status)a._status=2,a._result=b;});-1===a._status&&(a._status=0,a._result=b);}if(1===a._status)return a._result.default;throw a._result;}
	var U={current:null},V={transition:null},W={ReactCurrentDispatcher:U,ReactCurrentBatchConfig:V,ReactCurrentOwner:K};function X(){throw Error("act(...) is not supported in production builds of React.");}
	react_production_min.Children={map:S,forEach:function(a,b,e){S(a,function(){b.apply(this,arguments);},e);},count:function(a){var b=0;S(a,function(){b++;});return b},toArray:function(a){return S(a,function(a){return a})||[]},only:function(a){if(!O(a))throw Error("React.Children.only expected to receive a single React element child.");return a}};react_production_min.Component=E;react_production_min.Fragment=p;react_production_min.Profiler=r;react_production_min.PureComponent=G;react_production_min.StrictMode=q;react_production_min.Suspense=w;
	react_production_min.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=W;react_production_min.act=X;
	react_production_min.cloneElement=function(a,b,e){if(null===a||void 0===a)throw Error("React.cloneElement(...): The argument must be a React element, but you passed "+a+".");var d=C({},a.props),c=a.key,k=a.ref,h=a._owner;if(null!=b){void 0!==b.ref&&(k=b.ref,h=K.current);void 0!==b.key&&(c=""+b.key);if(a.type&&a.type.defaultProps)var g=a.type.defaultProps;for(f in b)J.call(b,f)&&!L.hasOwnProperty(f)&&(d[f]=void 0===b[f]&&void 0!==g?g[f]:b[f]);}var f=arguments.length-2;if(1===f)d.children=e;else if(1<f){g=Array(f);
	for(var m=0;m<f;m++)g[m]=arguments[m+2];d.children=g;}return {$$typeof:l,type:a.type,key:c,ref:k,props:d,_owner:h}};react_production_min.createContext=function(a){a={$$typeof:u,_currentValue:a,_currentValue2:a,_threadCount:0,Provider:null,Consumer:null,_defaultValue:null,_globalName:null};a.Provider={$$typeof:t,_context:a};return a.Consumer=a};react_production_min.createElement=M;react_production_min.createFactory=function(a){var b=M.bind(null,a);b.type=a;return b};react_production_min.createRef=function(){return {current:null}};
	react_production_min.forwardRef=function(a){return {$$typeof:v,render:a}};react_production_min.isValidElement=O;react_production_min.lazy=function(a){return {$$typeof:y,_payload:{_status:-1,_result:a},_init:T}};react_production_min.memo=function(a,b){return {$$typeof:x,type:a,compare:void 0===b?null:b}};react_production_min.startTransition=function(a){var b=V.transition;V.transition={};try{a();}finally{V.transition=b;}};react_production_min.unstable_act=X;react_production_min.useCallback=function(a,b){return U.current.useCallback(a,b)};react_production_min.useContext=function(a){return U.current.useContext(a)};
	react_production_min.useDebugValue=function(){};react_production_min.useDeferredValue=function(a){return U.current.useDeferredValue(a)};react_production_min.useEffect=function(a,b){return U.current.useEffect(a,b)};react_production_min.useId=function(){return U.current.useId()};react_production_min.useImperativeHandle=function(a,b,e){return U.current.useImperativeHandle(a,b,e)};react_production_min.useInsertionEffect=function(a,b){return U.current.useInsertionEffect(a,b)};react_production_min.useLayoutEffect=function(a,b){return U.current.useLayoutEffect(a,b)};
	react_production_min.useMemo=function(a,b){return U.current.useMemo(a,b)};react_production_min.useReducer=function(a,b,e){return U.current.useReducer(a,b,e)};react_production_min.useRef=function(a){return U.current.useRef(a)};react_production_min.useState=function(a){return U.current.useState(a)};react_production_min.useSyncExternalStore=function(a,b,e){return U.current.useSyncExternalStore(a,b,e)};react_production_min.useTransition=function(){return U.current.useTransition()};react_production_min.version="18.3.1";
	return react_production_min;
}

var react_development = {exports: {}};

/**
 * @license React
 * react.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
react_development.exports;

var hasRequiredReact_development;

function requireReact_development () {
	if (hasRequiredReact_development) return react_development.exports;
	hasRequiredReact_development = 1;
	(function (module, exports) {

		if (process.env.NODE_ENV !== "production") {
		  (function() {

		/* global __REACT_DEVTOOLS_GLOBAL_HOOK__ */
		if (
		  typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined' &&
		  typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart ===
		    'function'
		) {
		  __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(new Error());
		}
		          var ReactVersion = '18.3.1';

		// ATTENTION
		// When adding new symbols to this file,
		// Please consider also adding to 'react-devtools-shared/src/backend/ReactSymbols'
		// The Symbol used to tag the ReactElement-like types.
		var REACT_ELEMENT_TYPE = Symbol.for('react.element');
		var REACT_PORTAL_TYPE = Symbol.for('react.portal');
		var REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');
		var REACT_STRICT_MODE_TYPE = Symbol.for('react.strict_mode');
		var REACT_PROFILER_TYPE = Symbol.for('react.profiler');
		var REACT_PROVIDER_TYPE = Symbol.for('react.provider');
		var REACT_CONTEXT_TYPE = Symbol.for('react.context');
		var REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
		var REACT_SUSPENSE_TYPE = Symbol.for('react.suspense');
		var REACT_SUSPENSE_LIST_TYPE = Symbol.for('react.suspense_list');
		var REACT_MEMO_TYPE = Symbol.for('react.memo');
		var REACT_LAZY_TYPE = Symbol.for('react.lazy');
		var REACT_OFFSCREEN_TYPE = Symbol.for('react.offscreen');
		var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
		var FAUX_ITERATOR_SYMBOL = '@@iterator';
		function getIteratorFn(maybeIterable) {
		  if (maybeIterable === null || typeof maybeIterable !== 'object') {
		    return null;
		  }

		  var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];

		  if (typeof maybeIterator === 'function') {
		    return maybeIterator;
		  }

		  return null;
		}

		/**
		 * Keeps track of the current dispatcher.
		 */
		var ReactCurrentDispatcher = {
		  /**
		   * @internal
		   * @type {ReactComponent}
		   */
		  current: null
		};

		/**
		 * Keeps track of the current batch's configuration such as how long an update
		 * should suspend for if it needs to.
		 */
		var ReactCurrentBatchConfig = {
		  transition: null
		};

		var ReactCurrentActQueue = {
		  current: null,
		  // Used to reproduce behavior of `batchedUpdates` in legacy mode.
		  isBatchingLegacy: false,
		  didScheduleLegacyUpdate: false
		};

		/**
		 * Keeps track of the current owner.
		 *
		 * The current owner is the component who should own any components that are
		 * currently being constructed.
		 */
		var ReactCurrentOwner = {
		  /**
		   * @internal
		   * @type {ReactComponent}
		   */
		  current: null
		};

		var ReactDebugCurrentFrame = {};
		var currentExtraStackFrame = null;
		function setExtraStackFrame(stack) {
		  {
		    currentExtraStackFrame = stack;
		  }
		}

		{
		  ReactDebugCurrentFrame.setExtraStackFrame = function (stack) {
		    {
		      currentExtraStackFrame = stack;
		    }
		  }; // Stack implementation injected by the current renderer.


		  ReactDebugCurrentFrame.getCurrentStack = null;

		  ReactDebugCurrentFrame.getStackAddendum = function () {
		    var stack = ''; // Add an extra top frame while an element is being validated

		    if (currentExtraStackFrame) {
		      stack += currentExtraStackFrame;
		    } // Delegate to the injected renderer-specific implementation


		    var impl = ReactDebugCurrentFrame.getCurrentStack;

		    if (impl) {
		      stack += impl() || '';
		    }

		    return stack;
		  };
		}

		// -----------------------------------------------------------------------------

		var enableScopeAPI = false; // Experimental Create Event Handle API.
		var enableCacheElement = false;
		var enableTransitionTracing = false; // No known bugs, but needs performance testing

		var enableLegacyHidden = false; // Enables unstable_avoidThisFallback feature in Fiber
		// stuff. Intended to enable React core members to more easily debug scheduling
		// issues in DEV builds.

		var enableDebugTracing = false; // Track which Fiber(s) schedule render work.

		var ReactSharedInternals = {
		  ReactCurrentDispatcher: ReactCurrentDispatcher,
		  ReactCurrentBatchConfig: ReactCurrentBatchConfig,
		  ReactCurrentOwner: ReactCurrentOwner
		};

		{
		  ReactSharedInternals.ReactDebugCurrentFrame = ReactDebugCurrentFrame;
		  ReactSharedInternals.ReactCurrentActQueue = ReactCurrentActQueue;
		}

		// by calls to these methods by a Babel plugin.
		//
		// In PROD (or in packages without access to React internals),
		// they are left as they are instead.

		function warn(format) {
		  {
		    {
		      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
		        args[_key - 1] = arguments[_key];
		      }

		      printWarning('warn', format, args);
		    }
		  }
		}
		function error(format) {
		  {
		    {
		      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
		        args[_key2 - 1] = arguments[_key2];
		      }

		      printWarning('error', format, args);
		    }
		  }
		}

		function printWarning(level, format, args) {
		  // When changing this logic, you might want to also
		  // update consoleWithStackDev.www.js as well.
		  {
		    var ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;
		    var stack = ReactDebugCurrentFrame.getStackAddendum();

		    if (stack !== '') {
		      format += '%s';
		      args = args.concat([stack]);
		    } // eslint-disable-next-line react-internal/safe-string-coercion


		    var argsWithFormat = args.map(function (item) {
		      return String(item);
		    }); // Careful: RN currently depends on this prefix

		    argsWithFormat.unshift('Warning: ' + format); // We intentionally don't use spread (or .apply) directly because it
		    // breaks IE9: https://github.com/facebook/react/issues/13610
		    // eslint-disable-next-line react-internal/no-production-logging

		    Function.prototype.apply.call(console[level], console, argsWithFormat);
		  }
		}

		var didWarnStateUpdateForUnmountedComponent = {};

		function warnNoop(publicInstance, callerName) {
		  {
		    var _constructor = publicInstance.constructor;
		    var componentName = _constructor && (_constructor.displayName || _constructor.name) || 'ReactClass';
		    var warningKey = componentName + "." + callerName;

		    if (didWarnStateUpdateForUnmountedComponent[warningKey]) {
		      return;
		    }

		    error("Can't call %s on a component that is not yet mounted. " + 'This is a no-op, but it might indicate a bug in your application. ' + 'Instead, assign to `this.state` directly or define a `state = {};` ' + 'class property with the desired state in the %s component.', callerName, componentName);

		    didWarnStateUpdateForUnmountedComponent[warningKey] = true;
		  }
		}
		/**
		 * This is the abstract API for an update queue.
		 */


		var ReactNoopUpdateQueue = {
		  /**
		   * Checks whether or not this composite component is mounted.
		   * @param {ReactClass} publicInstance The instance we want to test.
		   * @return {boolean} True if mounted, false otherwise.
		   * @protected
		   * @final
		   */
		  isMounted: function (publicInstance) {
		    return false;
		  },

		  /**
		   * Forces an update. This should only be invoked when it is known with
		   * certainty that we are **not** in a DOM transaction.
		   *
		   * You may want to call this when you know that some deeper aspect of the
		   * component's state has changed but `setState` was not called.
		   *
		   * This will not invoke `shouldComponentUpdate`, but it will invoke
		   * `componentWillUpdate` and `componentDidUpdate`.
		   *
		   * @param {ReactClass} publicInstance The instance that should rerender.
		   * @param {?function} callback Called after component is updated.
		   * @param {?string} callerName name of the calling function in the public API.
		   * @internal
		   */
		  enqueueForceUpdate: function (publicInstance, callback, callerName) {
		    warnNoop(publicInstance, 'forceUpdate');
		  },

		  /**
		   * Replaces all of the state. Always use this or `setState` to mutate state.
		   * You should treat `this.state` as immutable.
		   *
		   * There is no guarantee that `this.state` will be immediately updated, so
		   * accessing `this.state` after calling this method may return the old value.
		   *
		   * @param {ReactClass} publicInstance The instance that should rerender.
		   * @param {object} completeState Next state.
		   * @param {?function} callback Called after component is updated.
		   * @param {?string} callerName name of the calling function in the public API.
		   * @internal
		   */
		  enqueueReplaceState: function (publicInstance, completeState, callback, callerName) {
		    warnNoop(publicInstance, 'replaceState');
		  },

		  /**
		   * Sets a subset of the state. This only exists because _pendingState is
		   * internal. This provides a merging strategy that is not available to deep
		   * properties which is confusing. TODO: Expose pendingState or don't use it
		   * during the merge.
		   *
		   * @param {ReactClass} publicInstance The instance that should rerender.
		   * @param {object} partialState Next partial state to be merged with state.
		   * @param {?function} callback Called after component is updated.
		   * @param {?string} Name of the calling function in the public API.
		   * @internal
		   */
		  enqueueSetState: function (publicInstance, partialState, callback, callerName) {
		    warnNoop(publicInstance, 'setState');
		  }
		};

		var assign = Object.assign;

		var emptyObject = {};

		{
		  Object.freeze(emptyObject);
		}
		/**
		 * Base class helpers for the updating state of a component.
		 */


		function Component(props, context, updater) {
		  this.props = props;
		  this.context = context; // If a component has string refs, we will assign a different object later.

		  this.refs = emptyObject; // We initialize the default updater but the real one gets injected by the
		  // renderer.

		  this.updater = updater || ReactNoopUpdateQueue;
		}

		Component.prototype.isReactComponent = {};
		/**
		 * Sets a subset of the state. Always use this to mutate
		 * state. You should treat `this.state` as immutable.
		 *
		 * There is no guarantee that `this.state` will be immediately updated, so
		 * accessing `this.state` after calling this method may return the old value.
		 *
		 * There is no guarantee that calls to `setState` will run synchronously,
		 * as they may eventually be batched together.  You can provide an optional
		 * callback that will be executed when the call to setState is actually
		 * completed.
		 *
		 * When a function is provided to setState, it will be called at some point in
		 * the future (not synchronously). It will be called with the up to date
		 * component arguments (state, props, context). These values can be different
		 * from this.* because your function may be called after receiveProps but before
		 * shouldComponentUpdate, and this new state, props, and context will not yet be
		 * assigned to this.
		 *
		 * @param {object|function} partialState Next partial state or function to
		 *        produce next partial state to be merged with current state.
		 * @param {?function} callback Called after state is updated.
		 * @final
		 * @protected
		 */

		Component.prototype.setState = function (partialState, callback) {
		  if (typeof partialState !== 'object' && typeof partialState !== 'function' && partialState != null) {
		    throw new Error('setState(...): takes an object of state variables to update or a ' + 'function which returns an object of state variables.');
		  }

		  this.updater.enqueueSetState(this, partialState, callback, 'setState');
		};
		/**
		 * Forces an update. This should only be invoked when it is known with
		 * certainty that we are **not** in a DOM transaction.
		 *
		 * You may want to call this when you know that some deeper aspect of the
		 * component's state has changed but `setState` was not called.
		 *
		 * This will not invoke `shouldComponentUpdate`, but it will invoke
		 * `componentWillUpdate` and `componentDidUpdate`.
		 *
		 * @param {?function} callback Called after update is complete.
		 * @final
		 * @protected
		 */


		Component.prototype.forceUpdate = function (callback) {
		  this.updater.enqueueForceUpdate(this, callback, 'forceUpdate');
		};
		/**
		 * Deprecated APIs. These APIs used to exist on classic React classes but since
		 * we would like to deprecate them, we're not going to move them over to this
		 * modern base class. Instead, we define a getter that warns if it's accessed.
		 */


		{
		  var deprecatedAPIs = {
		    isMounted: ['isMounted', 'Instead, make sure to clean up subscriptions and pending requests in ' + 'componentWillUnmount to prevent memory leaks.'],
		    replaceState: ['replaceState', 'Refactor your code to use setState instead (see ' + 'https://github.com/facebook/react/issues/3236).']
		  };

		  var defineDeprecationWarning = function (methodName, info) {
		    Object.defineProperty(Component.prototype, methodName, {
		      get: function () {
		        warn('%s(...) is deprecated in plain JavaScript React classes. %s', info[0], info[1]);

		        return undefined;
		      }
		    });
		  };

		  for (var fnName in deprecatedAPIs) {
		    if (deprecatedAPIs.hasOwnProperty(fnName)) {
		      defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
		    }
		  }
		}

		function ComponentDummy() {}

		ComponentDummy.prototype = Component.prototype;
		/**
		 * Convenience component with default shallow equality check for sCU.
		 */

		function PureComponent(props, context, updater) {
		  this.props = props;
		  this.context = context; // If a component has string refs, we will assign a different object later.

		  this.refs = emptyObject;
		  this.updater = updater || ReactNoopUpdateQueue;
		}

		var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
		pureComponentPrototype.constructor = PureComponent; // Avoid an extra prototype jump for these methods.

		assign(pureComponentPrototype, Component.prototype);
		pureComponentPrototype.isPureReactComponent = true;

		// an immutable object with a single mutable value
		function createRef() {
		  var refObject = {
		    current: null
		  };

		  {
		    Object.seal(refObject);
		  }

		  return refObject;
		}

		var isArrayImpl = Array.isArray; // eslint-disable-next-line no-redeclare

		function isArray(a) {
		  return isArrayImpl(a);
		}

		/*
		 * The `'' + value` pattern (used in in perf-sensitive code) throws for Symbol
		 * and Temporal.* types. See https://github.com/facebook/react/pull/22064.
		 *
		 * The functions in this module will throw an easier-to-understand,
		 * easier-to-debug exception with a clear errors message message explaining the
		 * problem. (Instead of a confusing exception thrown inside the implementation
		 * of the `value` object).
		 */
		// $FlowFixMe only called in DEV, so void return is not possible.
		function typeName(value) {
		  {
		    // toStringTag is needed for namespaced types like Temporal.Instant
		    var hasToStringTag = typeof Symbol === 'function' && Symbol.toStringTag;
		    var type = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || 'Object';
		    return type;
		  }
		} // $FlowFixMe only called in DEV, so void return is not possible.


		function willCoercionThrow(value) {
		  {
		    try {
		      testStringCoercion(value);
		      return false;
		    } catch (e) {
		      return true;
		    }
		  }
		}

		function testStringCoercion(value) {
		  // If you ended up here by following an exception call stack, here's what's
		  // happened: you supplied an object or symbol value to React (as a prop, key,
		  // DOM attribute, CSS property, string ref, etc.) and when React tried to
		  // coerce it to a string using `'' + value`, an exception was thrown.
		  //
		  // The most common types that will cause this exception are `Symbol` instances
		  // and Temporal objects like `Temporal.Instant`. But any object that has a
		  // `valueOf` or `[Symbol.toPrimitive]` method that throws will also cause this
		  // exception. (Library authors do this to prevent users from using built-in
		  // numeric operators like `+` or comparison operators like `>=` because custom
		  // methods are needed to perform accurate arithmetic or comparison.)
		  //
		  // To fix the problem, coerce this object or symbol value to a string before
		  // passing it to React. The most reliable way is usually `String(value)`.
		  //
		  // To find which value is throwing, check the browser or debugger console.
		  // Before this exception was thrown, there should be `console.error` output
		  // that shows the type (Symbol, Temporal.PlainDate, etc.) that caused the
		  // problem and how that type was used: key, atrribute, input value prop, etc.
		  // In most cases, this console output also shows the component and its
		  // ancestor components where the exception happened.
		  //
		  // eslint-disable-next-line react-internal/safe-string-coercion
		  return '' + value;
		}
		function checkKeyStringCoercion(value) {
		  {
		    if (willCoercionThrow(value)) {
		      error('The provided key is an unsupported type %s.' + ' This value must be coerced to a string before before using it here.', typeName(value));

		      return testStringCoercion(value); // throw (to help callers find troubleshooting comments)
		    }
		  }
		}

		function getWrappedName(outerType, innerType, wrapperName) {
		  var displayName = outerType.displayName;

		  if (displayName) {
		    return displayName;
		  }

		  var functionName = innerType.displayName || innerType.name || '';
		  return functionName !== '' ? wrapperName + "(" + functionName + ")" : wrapperName;
		} // Keep in sync with react-reconciler/getComponentNameFromFiber


		function getContextName(type) {
		  return type.displayName || 'Context';
		} // Note that the reconciler package should generally prefer to use getComponentNameFromFiber() instead.


		function getComponentNameFromType(type) {
		  if (type == null) {
		    // Host root, text node or just invalid type.
		    return null;
		  }

		  {
		    if (typeof type.tag === 'number') {
		      error('Received an unexpected object in getComponentNameFromType(). ' + 'This is likely a bug in React. Please file an issue.');
		    }
		  }

		  if (typeof type === 'function') {
		    return type.displayName || type.name || null;
		  }

		  if (typeof type === 'string') {
		    return type;
		  }

		  switch (type) {
		    case REACT_FRAGMENT_TYPE:
		      return 'Fragment';

		    case REACT_PORTAL_TYPE:
		      return 'Portal';

		    case REACT_PROFILER_TYPE:
		      return 'Profiler';

		    case REACT_STRICT_MODE_TYPE:
		      return 'StrictMode';

		    case REACT_SUSPENSE_TYPE:
		      return 'Suspense';

		    case REACT_SUSPENSE_LIST_TYPE:
		      return 'SuspenseList';

		  }

		  if (typeof type === 'object') {
		    switch (type.$$typeof) {
		      case REACT_CONTEXT_TYPE:
		        var context = type;
		        return getContextName(context) + '.Consumer';

		      case REACT_PROVIDER_TYPE:
		        var provider = type;
		        return getContextName(provider._context) + '.Provider';

		      case REACT_FORWARD_REF_TYPE:
		        return getWrappedName(type, type.render, 'ForwardRef');

		      case REACT_MEMO_TYPE:
		        var outerName = type.displayName || null;

		        if (outerName !== null) {
		          return outerName;
		        }

		        return getComponentNameFromType(type.type) || 'Memo';

		      case REACT_LAZY_TYPE:
		        {
		          var lazyComponent = type;
		          var payload = lazyComponent._payload;
		          var init = lazyComponent._init;

		          try {
		            return getComponentNameFromType(init(payload));
		          } catch (x) {
		            return null;
		          }
		        }

		      // eslint-disable-next-line no-fallthrough
		    }
		  }

		  return null;
		}

		var hasOwnProperty = Object.prototype.hasOwnProperty;

		var RESERVED_PROPS = {
		  key: true,
		  ref: true,
		  __self: true,
		  __source: true
		};
		var specialPropKeyWarningShown, specialPropRefWarningShown, didWarnAboutStringRefs;

		{
		  didWarnAboutStringRefs = {};
		}

		function hasValidRef(config) {
		  {
		    if (hasOwnProperty.call(config, 'ref')) {
		      var getter = Object.getOwnPropertyDescriptor(config, 'ref').get;

		      if (getter && getter.isReactWarning) {
		        return false;
		      }
		    }
		  }

		  return config.ref !== undefined;
		}

		function hasValidKey(config) {
		  {
		    if (hasOwnProperty.call(config, 'key')) {
		      var getter = Object.getOwnPropertyDescriptor(config, 'key').get;

		      if (getter && getter.isReactWarning) {
		        return false;
		      }
		    }
		  }

		  return config.key !== undefined;
		}

		function defineKeyPropWarningGetter(props, displayName) {
		  var warnAboutAccessingKey = function () {
		    {
		      if (!specialPropKeyWarningShown) {
		        specialPropKeyWarningShown = true;

		        error('%s: `key` is not a prop. Trying to access it will result ' + 'in `undefined` being returned. If you need to access the same ' + 'value within the child component, you should pass it as a different ' + 'prop. (https://reactjs.org/link/special-props)', displayName);
		      }
		    }
		  };

		  warnAboutAccessingKey.isReactWarning = true;
		  Object.defineProperty(props, 'key', {
		    get: warnAboutAccessingKey,
		    configurable: true
		  });
		}

		function defineRefPropWarningGetter(props, displayName) {
		  var warnAboutAccessingRef = function () {
		    {
		      if (!specialPropRefWarningShown) {
		        specialPropRefWarningShown = true;

		        error('%s: `ref` is not a prop. Trying to access it will result ' + 'in `undefined` being returned. If you need to access the same ' + 'value within the child component, you should pass it as a different ' + 'prop. (https://reactjs.org/link/special-props)', displayName);
		      }
		    }
		  };

		  warnAboutAccessingRef.isReactWarning = true;
		  Object.defineProperty(props, 'ref', {
		    get: warnAboutAccessingRef,
		    configurable: true
		  });
		}

		function warnIfStringRefCannotBeAutoConverted(config) {
		  {
		    if (typeof config.ref === 'string' && ReactCurrentOwner.current && config.__self && ReactCurrentOwner.current.stateNode !== config.__self) {
		      var componentName = getComponentNameFromType(ReactCurrentOwner.current.type);

		      if (!didWarnAboutStringRefs[componentName]) {
		        error('Component "%s" contains the string ref "%s". ' + 'Support for string refs will be removed in a future major release. ' + 'This case cannot be automatically converted to an arrow function. ' + 'We ask you to manually fix this case by using useRef() or createRef() instead. ' + 'Learn more about using refs safely here: ' + 'https://reactjs.org/link/strict-mode-string-ref', componentName, config.ref);

		        didWarnAboutStringRefs[componentName] = true;
		      }
		    }
		  }
		}
		/**
		 * Factory method to create a new React element. This no longer adheres to
		 * the class pattern, so do not use new to call it. Also, instanceof check
		 * will not work. Instead test $$typeof field against Symbol.for('react.element') to check
		 * if something is a React Element.
		 *
		 * @param {*} type
		 * @param {*} props
		 * @param {*} key
		 * @param {string|object} ref
		 * @param {*} owner
		 * @param {*} self A *temporary* helper to detect places where `this` is
		 * different from the `owner` when React.createElement is called, so that we
		 * can warn. We want to get rid of owner and replace string `ref`s with arrow
		 * functions, and as long as `this` and owner are the same, there will be no
		 * change in behavior.
		 * @param {*} source An annotation object (added by a transpiler or otherwise)
		 * indicating filename, line number, and/or other information.
		 * @internal
		 */


		var ReactElement = function (type, key, ref, self, source, owner, props) {
		  var element = {
		    // This tag allows us to uniquely identify this as a React Element
		    $$typeof: REACT_ELEMENT_TYPE,
		    // Built-in properties that belong on the element
		    type: type,
		    key: key,
		    ref: ref,
		    props: props,
		    // Record the component responsible for creating this element.
		    _owner: owner
		  };

		  {
		    // The validation flag is currently mutative. We put it on
		    // an external backing store so that we can freeze the whole object.
		    // This can be replaced with a WeakMap once they are implemented in
		    // commonly used development environments.
		    element._store = {}; // To make comparing ReactElements easier for testing purposes, we make
		    // the validation flag non-enumerable (where possible, which should
		    // include every environment we run tests in), so the test framework
		    // ignores it.

		    Object.defineProperty(element._store, 'validated', {
		      configurable: false,
		      enumerable: false,
		      writable: true,
		      value: false
		    }); // self and source are DEV only properties.

		    Object.defineProperty(element, '_self', {
		      configurable: false,
		      enumerable: false,
		      writable: false,
		      value: self
		    }); // Two elements created in two different places should be considered
		    // equal for testing purposes and therefore we hide it from enumeration.

		    Object.defineProperty(element, '_source', {
		      configurable: false,
		      enumerable: false,
		      writable: false,
		      value: source
		    });

		    if (Object.freeze) {
		      Object.freeze(element.props);
		      Object.freeze(element);
		    }
		  }

		  return element;
		};
		/**
		 * Create and return a new ReactElement of the given type.
		 * See https://reactjs.org/docs/react-api.html#createelement
		 */

		function createElement(type, config, children) {
		  var propName; // Reserved names are extracted

		  var props = {};
		  var key = null;
		  var ref = null;
		  var self = null;
		  var source = null;

		  if (config != null) {
		    if (hasValidRef(config)) {
		      ref = config.ref;

		      {
		        warnIfStringRefCannotBeAutoConverted(config);
		      }
		    }

		    if (hasValidKey(config)) {
		      {
		        checkKeyStringCoercion(config.key);
		      }

		      key = '' + config.key;
		    }

		    self = config.__self === undefined ? null : config.__self;
		    source = config.__source === undefined ? null : config.__source; // Remaining properties are added to a new props object

		    for (propName in config) {
		      if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
		        props[propName] = config[propName];
		      }
		    }
		  } // Children can be more than one argument, and those are transferred onto
		  // the newly allocated props object.


		  var childrenLength = arguments.length - 2;

		  if (childrenLength === 1) {
		    props.children = children;
		  } else if (childrenLength > 1) {
		    var childArray = Array(childrenLength);

		    for (var i = 0; i < childrenLength; i++) {
		      childArray[i] = arguments[i + 2];
		    }

		    {
		      if (Object.freeze) {
		        Object.freeze(childArray);
		      }
		    }

		    props.children = childArray;
		  } // Resolve default props


		  if (type && type.defaultProps) {
		    var defaultProps = type.defaultProps;

		    for (propName in defaultProps) {
		      if (props[propName] === undefined) {
		        props[propName] = defaultProps[propName];
		      }
		    }
		  }

		  {
		    if (key || ref) {
		      var displayName = typeof type === 'function' ? type.displayName || type.name || 'Unknown' : type;

		      if (key) {
		        defineKeyPropWarningGetter(props, displayName);
		      }

		      if (ref) {
		        defineRefPropWarningGetter(props, displayName);
		      }
		    }
		  }

		  return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
		}
		function cloneAndReplaceKey(oldElement, newKey) {
		  var newElement = ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);
		  return newElement;
		}
		/**
		 * Clone and return a new ReactElement using element as the starting point.
		 * See https://reactjs.org/docs/react-api.html#cloneelement
		 */

		function cloneElement(element, config, children) {
		  if (element === null || element === undefined) {
		    throw new Error("React.cloneElement(...): The argument must be a React element, but you passed " + element + ".");
		  }

		  var propName; // Original props are copied

		  var props = assign({}, element.props); // Reserved names are extracted

		  var key = element.key;
		  var ref = element.ref; // Self is preserved since the owner is preserved.

		  var self = element._self; // Source is preserved since cloneElement is unlikely to be targeted by a
		  // transpiler, and the original source is probably a better indicator of the
		  // true owner.

		  var source = element._source; // Owner will be preserved, unless ref is overridden

		  var owner = element._owner;

		  if (config != null) {
		    if (hasValidRef(config)) {
		      // Silently steal the ref from the parent.
		      ref = config.ref;
		      owner = ReactCurrentOwner.current;
		    }

		    if (hasValidKey(config)) {
		      {
		        checkKeyStringCoercion(config.key);
		      }

		      key = '' + config.key;
		    } // Remaining properties override existing props


		    var defaultProps;

		    if (element.type && element.type.defaultProps) {
		      defaultProps = element.type.defaultProps;
		    }

		    for (propName in config) {
		      if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
		        if (config[propName] === undefined && defaultProps !== undefined) {
		          // Resolve default props
		          props[propName] = defaultProps[propName];
		        } else {
		          props[propName] = config[propName];
		        }
		      }
		    }
		  } // Children can be more than one argument, and those are transferred onto
		  // the newly allocated props object.


		  var childrenLength = arguments.length - 2;

		  if (childrenLength === 1) {
		    props.children = children;
		  } else if (childrenLength > 1) {
		    var childArray = Array(childrenLength);

		    for (var i = 0; i < childrenLength; i++) {
		      childArray[i] = arguments[i + 2];
		    }

		    props.children = childArray;
		  }

		  return ReactElement(element.type, key, ref, self, source, owner, props);
		}
		/**
		 * Verifies the object is a ReactElement.
		 * See https://reactjs.org/docs/react-api.html#isvalidelement
		 * @param {?object} object
		 * @return {boolean} True if `object` is a ReactElement.
		 * @final
		 */

		function isValidElement(object) {
		  return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
		}

		var SEPARATOR = '.';
		var SUBSEPARATOR = ':';
		/**
		 * Escape and wrap key so it is safe to use as a reactid
		 *
		 * @param {string} key to be escaped.
		 * @return {string} the escaped key.
		 */

		function escape(key) {
		  var escapeRegex = /[=:]/g;
		  var escaperLookup = {
		    '=': '=0',
		    ':': '=2'
		  };
		  var escapedString = key.replace(escapeRegex, function (match) {
		    return escaperLookup[match];
		  });
		  return '$' + escapedString;
		}
		/**
		 * TODO: Test that a single child and an array with one item have the same key
		 * pattern.
		 */


		var didWarnAboutMaps = false;
		var userProvidedKeyEscapeRegex = /\/+/g;

		function escapeUserProvidedKey(text) {
		  return text.replace(userProvidedKeyEscapeRegex, '$&/');
		}
		/**
		 * Generate a key string that identifies a element within a set.
		 *
		 * @param {*} element A element that could contain a manual key.
		 * @param {number} index Index that is used if a manual key is not provided.
		 * @return {string}
		 */


		function getElementKey(element, index) {
		  // Do some typechecking here since we call this blindly. We want to ensure
		  // that we don't block potential future ES APIs.
		  if (typeof element === 'object' && element !== null && element.key != null) {
		    // Explicit key
		    {
		      checkKeyStringCoercion(element.key);
		    }

		    return escape('' + element.key);
		  } // Implicit key determined by the index in the set


		  return index.toString(36);
		}

		function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
		  var type = typeof children;

		  if (type === 'undefined' || type === 'boolean') {
		    // All of the above are perceived as null.
		    children = null;
		  }

		  var invokeCallback = false;

		  if (children === null) {
		    invokeCallback = true;
		  } else {
		    switch (type) {
		      case 'string':
		      case 'number':
		        invokeCallback = true;
		        break;

		      case 'object':
		        switch (children.$$typeof) {
		          case REACT_ELEMENT_TYPE:
		          case REACT_PORTAL_TYPE:
		            invokeCallback = true;
		        }

		    }
		  }

		  if (invokeCallback) {
		    var _child = children;
		    var mappedChild = callback(_child); // If it's the only child, treat the name as if it was wrapped in an array
		    // so that it's consistent if the number of children grows:

		    var childKey = nameSoFar === '' ? SEPARATOR + getElementKey(_child, 0) : nameSoFar;

		    if (isArray(mappedChild)) {
		      var escapedChildKey = '';

		      if (childKey != null) {
		        escapedChildKey = escapeUserProvidedKey(childKey) + '/';
		      }

		      mapIntoArray(mappedChild, array, escapedChildKey, '', function (c) {
		        return c;
		      });
		    } else if (mappedChild != null) {
		      if (isValidElement(mappedChild)) {
		        {
		          // The `if` statement here prevents auto-disabling of the safe
		          // coercion ESLint rule, so we must manually disable it below.
		          // $FlowFixMe Flow incorrectly thinks React.Portal doesn't have a key
		          if (mappedChild.key && (!_child || _child.key !== mappedChild.key)) {
		            checkKeyStringCoercion(mappedChild.key);
		          }
		        }

		        mappedChild = cloneAndReplaceKey(mappedChild, // Keep both the (mapped) and old keys if they differ, just as
		        // traverseAllChildren used to do for objects as children
		        escapedPrefix + ( // $FlowFixMe Flow incorrectly thinks React.Portal doesn't have a key
		        mappedChild.key && (!_child || _child.key !== mappedChild.key) ? // $FlowFixMe Flow incorrectly thinks existing element's key can be a number
		        // eslint-disable-next-line react-internal/safe-string-coercion
		        escapeUserProvidedKey('' + mappedChild.key) + '/' : '') + childKey);
		      }

		      array.push(mappedChild);
		    }

		    return 1;
		  }

		  var child;
		  var nextName;
		  var subtreeCount = 0; // Count of children found in the current subtree.

		  var nextNamePrefix = nameSoFar === '' ? SEPARATOR : nameSoFar + SUBSEPARATOR;

		  if (isArray(children)) {
		    for (var i = 0; i < children.length; i++) {
		      child = children[i];
		      nextName = nextNamePrefix + getElementKey(child, i);
		      subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
		    }
		  } else {
		    var iteratorFn = getIteratorFn(children);

		    if (typeof iteratorFn === 'function') {
		      var iterableChildren = children;

		      {
		        // Warn about using Maps as children
		        if (iteratorFn === iterableChildren.entries) {
		          if (!didWarnAboutMaps) {
		            warn('Using Maps as children is not supported. ' + 'Use an array of keyed ReactElements instead.');
		          }

		          didWarnAboutMaps = true;
		        }
		      }

		      var iterator = iteratorFn.call(iterableChildren);
		      var step;
		      var ii = 0;

		      while (!(step = iterator.next()).done) {
		        child = step.value;
		        nextName = nextNamePrefix + getElementKey(child, ii++);
		        subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
		      }
		    } else if (type === 'object') {
		      // eslint-disable-next-line react-internal/safe-string-coercion
		      var childrenString = String(children);
		      throw new Error("Objects are not valid as a React child (found: " + (childrenString === '[object Object]' ? 'object with keys {' + Object.keys(children).join(', ') + '}' : childrenString) + "). " + 'If you meant to render a collection of children, use an array ' + 'instead.');
		    }
		  }

		  return subtreeCount;
		}

		/**
		 * Maps children that are typically specified as `props.children`.
		 *
		 * See https://reactjs.org/docs/react-api.html#reactchildrenmap
		 *
		 * The provided mapFunction(child, index) will be called for each
		 * leaf child.
		 *
		 * @param {?*} children Children tree container.
		 * @param {function(*, int)} func The map function.
		 * @param {*} context Context for mapFunction.
		 * @return {object} Object containing the ordered map of results.
		 */
		function mapChildren(children, func, context) {
		  if (children == null) {
		    return children;
		  }

		  var result = [];
		  var count = 0;
		  mapIntoArray(children, result, '', '', function (child) {
		    return func.call(context, child, count++);
		  });
		  return result;
		}
		/**
		 * Count the number of children that are typically specified as
		 * `props.children`.
		 *
		 * See https://reactjs.org/docs/react-api.html#reactchildrencount
		 *
		 * @param {?*} children Children tree container.
		 * @return {number} The number of children.
		 */


		function countChildren(children) {
		  var n = 0;
		  mapChildren(children, function () {
		    n++; // Don't return anything
		  });
		  return n;
		}

		/**
		 * Iterates through children that are typically specified as `props.children`.
		 *
		 * See https://reactjs.org/docs/react-api.html#reactchildrenforeach
		 *
		 * The provided forEachFunc(child, index) will be called for each
		 * leaf child.
		 *
		 * @param {?*} children Children tree container.
		 * @param {function(*, int)} forEachFunc
		 * @param {*} forEachContext Context for forEachContext.
		 */
		function forEachChildren(children, forEachFunc, forEachContext) {
		  mapChildren(children, function () {
		    forEachFunc.apply(this, arguments); // Don't return anything.
		  }, forEachContext);
		}
		/**
		 * Flatten a children object (typically specified as `props.children`) and
		 * return an array with appropriately re-keyed children.
		 *
		 * See https://reactjs.org/docs/react-api.html#reactchildrentoarray
		 */


		function toArray(children) {
		  return mapChildren(children, function (child) {
		    return child;
		  }) || [];
		}
		/**
		 * Returns the first child in a collection of children and verifies that there
		 * is only one child in the collection.
		 *
		 * See https://reactjs.org/docs/react-api.html#reactchildrenonly
		 *
		 * The current implementation of this function assumes that a single child gets
		 * passed without a wrapper, but the purpose of this helper function is to
		 * abstract away the particular structure of children.
		 *
		 * @param {?object} children Child collection structure.
		 * @return {ReactElement} The first and only `ReactElement` contained in the
		 * structure.
		 */


		function onlyChild(children) {
		  if (!isValidElement(children)) {
		    throw new Error('React.Children.only expected to receive a single React element child.');
		  }

		  return children;
		}

		function createContext(defaultValue) {
		  // TODO: Second argument used to be an optional `calculateChangedBits`
		  // function. Warn to reserve for future use?
		  var context = {
		    $$typeof: REACT_CONTEXT_TYPE,
		    // As a workaround to support multiple concurrent renderers, we categorize
		    // some renderers as primary and others as secondary. We only expect
		    // there to be two concurrent renderers at most: React Native (primary) and
		    // Fabric (secondary); React DOM (primary) and React ART (secondary).
		    // Secondary renderers store their context values on separate fields.
		    _currentValue: defaultValue,
		    _currentValue2: defaultValue,
		    // Used to track how many concurrent renderers this context currently
		    // supports within in a single renderer. Such as parallel server rendering.
		    _threadCount: 0,
		    // These are circular
		    Provider: null,
		    Consumer: null,
		    // Add these to use same hidden class in VM as ServerContext
		    _defaultValue: null,
		    _globalName: null
		  };
		  context.Provider = {
		    $$typeof: REACT_PROVIDER_TYPE,
		    _context: context
		  };
		  var hasWarnedAboutUsingNestedContextConsumers = false;
		  var hasWarnedAboutUsingConsumerProvider = false;
		  var hasWarnedAboutDisplayNameOnConsumer = false;

		  {
		    // A separate object, but proxies back to the original context object for
		    // backwards compatibility. It has a different $$typeof, so we can properly
		    // warn for the incorrect usage of Context as a Consumer.
		    var Consumer = {
		      $$typeof: REACT_CONTEXT_TYPE,
		      _context: context
		    }; // $FlowFixMe: Flow complains about not setting a value, which is intentional here

		    Object.defineProperties(Consumer, {
		      Provider: {
		        get: function () {
		          if (!hasWarnedAboutUsingConsumerProvider) {
		            hasWarnedAboutUsingConsumerProvider = true;

		            error('Rendering <Context.Consumer.Provider> is not supported and will be removed in ' + 'a future major release. Did you mean to render <Context.Provider> instead?');
		          }

		          return context.Provider;
		        },
		        set: function (_Provider) {
		          context.Provider = _Provider;
		        }
		      },
		      _currentValue: {
		        get: function () {
		          return context._currentValue;
		        },
		        set: function (_currentValue) {
		          context._currentValue = _currentValue;
		        }
		      },
		      _currentValue2: {
		        get: function () {
		          return context._currentValue2;
		        },
		        set: function (_currentValue2) {
		          context._currentValue2 = _currentValue2;
		        }
		      },
		      _threadCount: {
		        get: function () {
		          return context._threadCount;
		        },
		        set: function (_threadCount) {
		          context._threadCount = _threadCount;
		        }
		      },
		      Consumer: {
		        get: function () {
		          if (!hasWarnedAboutUsingNestedContextConsumers) {
		            hasWarnedAboutUsingNestedContextConsumers = true;

		            error('Rendering <Context.Consumer.Consumer> is not supported and will be removed in ' + 'a future major release. Did you mean to render <Context.Consumer> instead?');
		          }

		          return context.Consumer;
		        }
		      },
		      displayName: {
		        get: function () {
		          return context.displayName;
		        },
		        set: function (displayName) {
		          if (!hasWarnedAboutDisplayNameOnConsumer) {
		            warn('Setting `displayName` on Context.Consumer has no effect. ' + "You should set it directly on the context with Context.displayName = '%s'.", displayName);

		            hasWarnedAboutDisplayNameOnConsumer = true;
		          }
		        }
		      }
		    }); // $FlowFixMe: Flow complains about missing properties because it doesn't understand defineProperty

		    context.Consumer = Consumer;
		  }

		  {
		    context._currentRenderer = null;
		    context._currentRenderer2 = null;
		  }

		  return context;
		}

		var Uninitialized = -1;
		var Pending = 0;
		var Resolved = 1;
		var Rejected = 2;

		function lazyInitializer(payload) {
		  if (payload._status === Uninitialized) {
		    var ctor = payload._result;
		    var thenable = ctor(); // Transition to the next state.
		    // This might throw either because it's missing or throws. If so, we treat it
		    // as still uninitialized and try again next time. Which is the same as what
		    // happens if the ctor or any wrappers processing the ctor throws. This might
		    // end up fixing it if the resolution was a concurrency bug.

		    thenable.then(function (moduleObject) {
		      if (payload._status === Pending || payload._status === Uninitialized) {
		        // Transition to the next state.
		        var resolved = payload;
		        resolved._status = Resolved;
		        resolved._result = moduleObject;
		      }
		    }, function (error) {
		      if (payload._status === Pending || payload._status === Uninitialized) {
		        // Transition to the next state.
		        var rejected = payload;
		        rejected._status = Rejected;
		        rejected._result = error;
		      }
		    });

		    if (payload._status === Uninitialized) {
		      // In case, we're still uninitialized, then we're waiting for the thenable
		      // to resolve. Set it as pending in the meantime.
		      var pending = payload;
		      pending._status = Pending;
		      pending._result = thenable;
		    }
		  }

		  if (payload._status === Resolved) {
		    var moduleObject = payload._result;

		    {
		      if (moduleObject === undefined) {
		        error('lazy: Expected the result of a dynamic imp' + 'ort() call. ' + 'Instead received: %s\n\nYour code should look like: \n  ' + // Break up imports to avoid accidentally parsing them as dependencies.
		        'const MyComponent = lazy(() => imp' + "ort('./MyComponent'))\n\n" + 'Did you accidentally put curly braces around the import?', moduleObject);
		      }
		    }

		    {
		      if (!('default' in moduleObject)) {
		        error('lazy: Expected the result of a dynamic imp' + 'ort() call. ' + 'Instead received: %s\n\nYour code should look like: \n  ' + // Break up imports to avoid accidentally parsing them as dependencies.
		        'const MyComponent = lazy(() => imp' + "ort('./MyComponent'))", moduleObject);
		      }
		    }

		    return moduleObject.default;
		  } else {
		    throw payload._result;
		  }
		}

		function lazy(ctor) {
		  var payload = {
		    // We use these fields to store the result.
		    _status: Uninitialized,
		    _result: ctor
		  };
		  var lazyType = {
		    $$typeof: REACT_LAZY_TYPE,
		    _payload: payload,
		    _init: lazyInitializer
		  };

		  {
		    // In production, this would just set it on the object.
		    var defaultProps;
		    var propTypes; // $FlowFixMe

		    Object.defineProperties(lazyType, {
		      defaultProps: {
		        configurable: true,
		        get: function () {
		          return defaultProps;
		        },
		        set: function (newDefaultProps) {
		          error('React.lazy(...): It is not supported to assign `defaultProps` to ' + 'a lazy component import. Either specify them where the component ' + 'is defined, or create a wrapping component around it.');

		          defaultProps = newDefaultProps; // Match production behavior more closely:
		          // $FlowFixMe

		          Object.defineProperty(lazyType, 'defaultProps', {
		            enumerable: true
		          });
		        }
		      },
		      propTypes: {
		        configurable: true,
		        get: function () {
		          return propTypes;
		        },
		        set: function (newPropTypes) {
		          error('React.lazy(...): It is not supported to assign `propTypes` to ' + 'a lazy component import. Either specify them where the component ' + 'is defined, or create a wrapping component around it.');

		          propTypes = newPropTypes; // Match production behavior more closely:
		          // $FlowFixMe

		          Object.defineProperty(lazyType, 'propTypes', {
		            enumerable: true
		          });
		        }
		      }
		    });
		  }

		  return lazyType;
		}

		function forwardRef(render) {
		  {
		    if (render != null && render.$$typeof === REACT_MEMO_TYPE) {
		      error('forwardRef requires a render function but received a `memo` ' + 'component. Instead of forwardRef(memo(...)), use ' + 'memo(forwardRef(...)).');
		    } else if (typeof render !== 'function') {
		      error('forwardRef requires a render function but was given %s.', render === null ? 'null' : typeof render);
		    } else {
		      if (render.length !== 0 && render.length !== 2) {
		        error('forwardRef render functions accept exactly two parameters: props and ref. %s', render.length === 1 ? 'Did you forget to use the ref parameter?' : 'Any additional parameter will be undefined.');
		      }
		    }

		    if (render != null) {
		      if (render.defaultProps != null || render.propTypes != null) {
		        error('forwardRef render functions do not support propTypes or defaultProps. ' + 'Did you accidentally pass a React component?');
		      }
		    }
		  }

		  var elementType = {
		    $$typeof: REACT_FORWARD_REF_TYPE,
		    render: render
		  };

		  {
		    var ownName;
		    Object.defineProperty(elementType, 'displayName', {
		      enumerable: false,
		      configurable: true,
		      get: function () {
		        return ownName;
		      },
		      set: function (name) {
		        ownName = name; // The inner component shouldn't inherit this display name in most cases,
		        // because the component may be used elsewhere.
		        // But it's nice for anonymous functions to inherit the name,
		        // so that our component-stack generation logic will display their frames.
		        // An anonymous function generally suggests a pattern like:
		        //   React.forwardRef((props, ref) => {...});
		        // This kind of inner function is not used elsewhere so the side effect is okay.

		        if (!render.name && !render.displayName) {
		          render.displayName = name;
		        }
		      }
		    });
		  }

		  return elementType;
		}

		var REACT_MODULE_REFERENCE;

		{
		  REACT_MODULE_REFERENCE = Symbol.for('react.module.reference');
		}

		function isValidElementType(type) {
		  if (typeof type === 'string' || typeof type === 'function') {
		    return true;
		  } // Note: typeof might be other than 'symbol' or 'number' (e.g. if it's a polyfill).


		  if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || enableDebugTracing  || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden  || type === REACT_OFFSCREEN_TYPE || enableScopeAPI  || enableCacheElement  || enableTransitionTracing ) {
		    return true;
		  }

		  if (typeof type === 'object' && type !== null) {
		    if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || // This needs to include all possible module reference object
		    // types supported by any Flight configuration anywhere since
		    // we don't know which Flight build this will end up being used
		    // with.
		    type.$$typeof === REACT_MODULE_REFERENCE || type.getModuleId !== undefined) {
		      return true;
		    }
		  }

		  return false;
		}

		function memo(type, compare) {
		  {
		    if (!isValidElementType(type)) {
		      error('memo: The first argument must be a component. Instead ' + 'received: %s', type === null ? 'null' : typeof type);
		    }
		  }

		  var elementType = {
		    $$typeof: REACT_MEMO_TYPE,
		    type: type,
		    compare: compare === undefined ? null : compare
		  };

		  {
		    var ownName;
		    Object.defineProperty(elementType, 'displayName', {
		      enumerable: false,
		      configurable: true,
		      get: function () {
		        return ownName;
		      },
		      set: function (name) {
		        ownName = name; // The inner component shouldn't inherit this display name in most cases,
		        // because the component may be used elsewhere.
		        // But it's nice for anonymous functions to inherit the name,
		        // so that our component-stack generation logic will display their frames.
		        // An anonymous function generally suggests a pattern like:
		        //   React.memo((props) => {...});
		        // This kind of inner function is not used elsewhere so the side effect is okay.

		        if (!type.name && !type.displayName) {
		          type.displayName = name;
		        }
		      }
		    });
		  }

		  return elementType;
		}

		function resolveDispatcher() {
		  var dispatcher = ReactCurrentDispatcher.current;

		  {
		    if (dispatcher === null) {
		      error('Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for' + ' one of the following reasons:\n' + '1. You might have mismatching versions of React and the renderer (such as React DOM)\n' + '2. You might be breaking the Rules of Hooks\n' + '3. You might have more than one copy of React in the same app\n' + 'See https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.');
		    }
		  } // Will result in a null access error if accessed outside render phase. We
		  // intentionally don't throw our own error because this is in a hot path.
		  // Also helps ensure this is inlined.


		  return dispatcher;
		}
		function useContext(Context) {
		  var dispatcher = resolveDispatcher();

		  {
		    // TODO: add a more generic warning for invalid values.
		    if (Context._context !== undefined) {
		      var realContext = Context._context; // Don't deduplicate because this legitimately causes bugs
		      // and nobody should be using this in existing code.

		      if (realContext.Consumer === Context) {
		        error('Calling useContext(Context.Consumer) is not supported, may cause bugs, and will be ' + 'removed in a future major release. Did you mean to call useContext(Context) instead?');
		      } else if (realContext.Provider === Context) {
		        error('Calling useContext(Context.Provider) is not supported. ' + 'Did you mean to call useContext(Context) instead?');
		      }
		    }
		  }

		  return dispatcher.useContext(Context);
		}
		function useState(initialState) {
		  var dispatcher = resolveDispatcher();
		  return dispatcher.useState(initialState);
		}
		function useReducer(reducer, initialArg, init) {
		  var dispatcher = resolveDispatcher();
		  return dispatcher.useReducer(reducer, initialArg, init);
		}
		function useRef(initialValue) {
		  var dispatcher = resolveDispatcher();
		  return dispatcher.useRef(initialValue);
		}
		function useEffect(create, deps) {
		  var dispatcher = resolveDispatcher();
		  return dispatcher.useEffect(create, deps);
		}
		function useInsertionEffect(create, deps) {
		  var dispatcher = resolveDispatcher();
		  return dispatcher.useInsertionEffect(create, deps);
		}
		function useLayoutEffect(create, deps) {
		  var dispatcher = resolveDispatcher();
		  return dispatcher.useLayoutEffect(create, deps);
		}
		function useCallback(callback, deps) {
		  var dispatcher = resolveDispatcher();
		  return dispatcher.useCallback(callback, deps);
		}
		function useMemo(create, deps) {
		  var dispatcher = resolveDispatcher();
		  return dispatcher.useMemo(create, deps);
		}
		function useImperativeHandle(ref, create, deps) {
		  var dispatcher = resolveDispatcher();
		  return dispatcher.useImperativeHandle(ref, create, deps);
		}
		function useDebugValue(value, formatterFn) {
		  {
		    var dispatcher = resolveDispatcher();
		    return dispatcher.useDebugValue(value, formatterFn);
		  }
		}
		function useTransition() {
		  var dispatcher = resolveDispatcher();
		  return dispatcher.useTransition();
		}
		function useDeferredValue(value) {
		  var dispatcher = resolveDispatcher();
		  return dispatcher.useDeferredValue(value);
		}
		function useId() {
		  var dispatcher = resolveDispatcher();
		  return dispatcher.useId();
		}
		function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
		  var dispatcher = resolveDispatcher();
		  return dispatcher.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
		}

		// Helpers to patch console.logs to avoid logging during side-effect free
		// replaying on render function. This currently only patches the object
		// lazily which won't cover if the log function was extracted eagerly.
		// We could also eagerly patch the method.
		var disabledDepth = 0;
		var prevLog;
		var prevInfo;
		var prevWarn;
		var prevError;
		var prevGroup;
		var prevGroupCollapsed;
		var prevGroupEnd;

		function disabledLog() {}

		disabledLog.__reactDisabledLog = true;
		function disableLogs() {
		  {
		    if (disabledDepth === 0) {
		      /* eslint-disable react-internal/no-production-logging */
		      prevLog = console.log;
		      prevInfo = console.info;
		      prevWarn = console.warn;
		      prevError = console.error;
		      prevGroup = console.group;
		      prevGroupCollapsed = console.groupCollapsed;
		      prevGroupEnd = console.groupEnd; // https://github.com/facebook/react/issues/19099

		      var props = {
		        configurable: true,
		        enumerable: true,
		        value: disabledLog,
		        writable: true
		      }; // $FlowFixMe Flow thinks console is immutable.

		      Object.defineProperties(console, {
		        info: props,
		        log: props,
		        warn: props,
		        error: props,
		        group: props,
		        groupCollapsed: props,
		        groupEnd: props
		      });
		      /* eslint-enable react-internal/no-production-logging */
		    }

		    disabledDepth++;
		  }
		}
		function reenableLogs() {
		  {
		    disabledDepth--;

		    if (disabledDepth === 0) {
		      /* eslint-disable react-internal/no-production-logging */
		      var props = {
		        configurable: true,
		        enumerable: true,
		        writable: true
		      }; // $FlowFixMe Flow thinks console is immutable.

		      Object.defineProperties(console, {
		        log: assign({}, props, {
		          value: prevLog
		        }),
		        info: assign({}, props, {
		          value: prevInfo
		        }),
		        warn: assign({}, props, {
		          value: prevWarn
		        }),
		        error: assign({}, props, {
		          value: prevError
		        }),
		        group: assign({}, props, {
		          value: prevGroup
		        }),
		        groupCollapsed: assign({}, props, {
		          value: prevGroupCollapsed
		        }),
		        groupEnd: assign({}, props, {
		          value: prevGroupEnd
		        })
		      });
		      /* eslint-enable react-internal/no-production-logging */
		    }

		    if (disabledDepth < 0) {
		      error('disabledDepth fell below zero. ' + 'This is a bug in React. Please file an issue.');
		    }
		  }
		}

		var ReactCurrentDispatcher$1 = ReactSharedInternals.ReactCurrentDispatcher;
		var prefix;
		function describeBuiltInComponentFrame(name, source, ownerFn) {
		  {
		    if (prefix === undefined) {
		      // Extract the VM specific prefix used by each line.
		      try {
		        throw Error();
		      } catch (x) {
		        var match = x.stack.trim().match(/\n( *(at )?)/);
		        prefix = match && match[1] || '';
		      }
		    } // We use the prefix to ensure our stacks line up with native stack frames.


		    return '\n' + prefix + name;
		  }
		}
		var reentry = false;
		var componentFrameCache;

		{
		  var PossiblyWeakMap = typeof WeakMap === 'function' ? WeakMap : Map;
		  componentFrameCache = new PossiblyWeakMap();
		}

		function describeNativeComponentFrame(fn, construct) {
		  // If something asked for a stack inside a fake render, it should get ignored.
		  if ( !fn || reentry) {
		    return '';
		  }

		  {
		    var frame = componentFrameCache.get(fn);

		    if (frame !== undefined) {
		      return frame;
		    }
		  }

		  var control;
		  reentry = true;
		  var previousPrepareStackTrace = Error.prepareStackTrace; // $FlowFixMe It does accept undefined.

		  Error.prepareStackTrace = undefined;
		  var previousDispatcher;

		  {
		    previousDispatcher = ReactCurrentDispatcher$1.current; // Set the dispatcher in DEV because this might be call in the render function
		    // for warnings.

		    ReactCurrentDispatcher$1.current = null;
		    disableLogs();
		  }

		  try {
		    // This should throw.
		    if (construct) {
		      // Something should be setting the props in the constructor.
		      var Fake = function () {
		        throw Error();
		      }; // $FlowFixMe


		      Object.defineProperty(Fake.prototype, 'props', {
		        set: function () {
		          // We use a throwing setter instead of frozen or non-writable props
		          // because that won't throw in a non-strict mode function.
		          throw Error();
		        }
		      });

		      if (typeof Reflect === 'object' && Reflect.construct) {
		        // We construct a different control for this case to include any extra
		        // frames added by the construct call.
		        try {
		          Reflect.construct(Fake, []);
		        } catch (x) {
		          control = x;
		        }

		        Reflect.construct(fn, [], Fake);
		      } else {
		        try {
		          Fake.call();
		        } catch (x) {
		          control = x;
		        }

		        fn.call(Fake.prototype);
		      }
		    } else {
		      try {
		        throw Error();
		      } catch (x) {
		        control = x;
		      }

		      fn();
		    }
		  } catch (sample) {
		    // This is inlined manually because closure doesn't do it for us.
		    if (sample && control && typeof sample.stack === 'string') {
		      // This extracts the first frame from the sample that isn't also in the control.
		      // Skipping one frame that we assume is the frame that calls the two.
		      var sampleLines = sample.stack.split('\n');
		      var controlLines = control.stack.split('\n');
		      var s = sampleLines.length - 1;
		      var c = controlLines.length - 1;

		      while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
		        // We expect at least one stack frame to be shared.
		        // Typically this will be the root most one. However, stack frames may be
		        // cut off due to maximum stack limits. In this case, one maybe cut off
		        // earlier than the other. We assume that the sample is longer or the same
		        // and there for cut off earlier. So we should find the root most frame in
		        // the sample somewhere in the control.
		        c--;
		      }

		      for (; s >= 1 && c >= 0; s--, c--) {
		        // Next we find the first one that isn't the same which should be the
		        // frame that called our sample function and the control.
		        if (sampleLines[s] !== controlLines[c]) {
		          // In V8, the first line is describing the message but other VMs don't.
		          // If we're about to return the first line, and the control is also on the same
		          // line, that's a pretty good indicator that our sample threw at same line as
		          // the control. I.e. before we entered the sample frame. So we ignore this result.
		          // This can happen if you passed a class to function component, or non-function.
		          if (s !== 1 || c !== 1) {
		            do {
		              s--;
		              c--; // We may still have similar intermediate frames from the construct call.
		              // The next one that isn't the same should be our match though.

		              if (c < 0 || sampleLines[s] !== controlLines[c]) {
		                // V8 adds a "new" prefix for native classes. Let's remove it to make it prettier.
		                var _frame = '\n' + sampleLines[s].replace(' at new ', ' at '); // If our component frame is labeled "<anonymous>"
		                // but we have a user-provided "displayName"
		                // splice it in to make the stack more readable.


		                if (fn.displayName && _frame.includes('<anonymous>')) {
		                  _frame = _frame.replace('<anonymous>', fn.displayName);
		                }

		                {
		                  if (typeof fn === 'function') {
		                    componentFrameCache.set(fn, _frame);
		                  }
		                } // Return the line we found.


		                return _frame;
		              }
		            } while (s >= 1 && c >= 0);
		          }

		          break;
		        }
		      }
		    }
		  } finally {
		    reentry = false;

		    {
		      ReactCurrentDispatcher$1.current = previousDispatcher;
		      reenableLogs();
		    }

		    Error.prepareStackTrace = previousPrepareStackTrace;
		  } // Fallback to just using the name if we couldn't make it throw.


		  var name = fn ? fn.displayName || fn.name : '';
		  var syntheticFrame = name ? describeBuiltInComponentFrame(name) : '';

		  {
		    if (typeof fn === 'function') {
		      componentFrameCache.set(fn, syntheticFrame);
		    }
		  }

		  return syntheticFrame;
		}
		function describeFunctionComponentFrame(fn, source, ownerFn) {
		  {
		    return describeNativeComponentFrame(fn, false);
		  }
		}

		function shouldConstruct(Component) {
		  var prototype = Component.prototype;
		  return !!(prototype && prototype.isReactComponent);
		}

		function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {

		  if (type == null) {
		    return '';
		  }

		  if (typeof type === 'function') {
		    {
		      return describeNativeComponentFrame(type, shouldConstruct(type));
		    }
		  }

		  if (typeof type === 'string') {
		    return describeBuiltInComponentFrame(type);
		  }

		  switch (type) {
		    case REACT_SUSPENSE_TYPE:
		      return describeBuiltInComponentFrame('Suspense');

		    case REACT_SUSPENSE_LIST_TYPE:
		      return describeBuiltInComponentFrame('SuspenseList');
		  }

		  if (typeof type === 'object') {
		    switch (type.$$typeof) {
		      case REACT_FORWARD_REF_TYPE:
		        return describeFunctionComponentFrame(type.render);

		      case REACT_MEMO_TYPE:
		        // Memo may contain any component type so we recursively resolve it.
		        return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);

		      case REACT_LAZY_TYPE:
		        {
		          var lazyComponent = type;
		          var payload = lazyComponent._payload;
		          var init = lazyComponent._init;

		          try {
		            // Lazy may contain any component type so we recursively resolve it.
		            return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
		          } catch (x) {}
		        }
		    }
		  }

		  return '';
		}

		var loggedTypeFailures = {};
		var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;

		function setCurrentlyValidatingElement(element) {
		  {
		    if (element) {
		      var owner = element._owner;
		      var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
		      ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
		    } else {
		      ReactDebugCurrentFrame$1.setExtraStackFrame(null);
		    }
		  }
		}

		function checkPropTypes(typeSpecs, values, location, componentName, element) {
		  {
		    // $FlowFixMe This is okay but Flow doesn't know it.
		    var has = Function.call.bind(hasOwnProperty);

		    for (var typeSpecName in typeSpecs) {
		      if (has(typeSpecs, typeSpecName)) {
		        var error$1 = void 0; // Prop type validation may throw. In case they do, we don't want to
		        // fail the render phase where it didn't fail before. So we log it.
		        // After these have been cleaned up, we'll let them throw.

		        try {
		          // This is intentionally an invariant that gets caught. It's the same
		          // behavior as without this statement except with a better message.
		          if (typeof typeSpecs[typeSpecName] !== 'function') {
		            // eslint-disable-next-line react-internal/prod-error-codes
		            var err = Error((componentName || 'React class') + ': ' + location + ' type `' + typeSpecName + '` is invalid; ' + 'it must be a function, usually from the `prop-types` package, but received `' + typeof typeSpecs[typeSpecName] + '`.' + 'This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.');
		            err.name = 'Invariant Violation';
		            throw err;
		          }

		          error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED');
		        } catch (ex) {
		          error$1 = ex;
		        }

		        if (error$1 && !(error$1 instanceof Error)) {
		          setCurrentlyValidatingElement(element);

		          error('%s: type specification of %s' + ' `%s` is invalid; the type checker ' + 'function must return `null` or an `Error` but returned a %s. ' + 'You may have forgotten to pass an argument to the type checker ' + 'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' + 'shape all require an argument).', componentName || 'React class', location, typeSpecName, typeof error$1);

		          setCurrentlyValidatingElement(null);
		        }

		        if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
		          // Only monitor this failure once because there tends to be a lot of the
		          // same error.
		          loggedTypeFailures[error$1.message] = true;
		          setCurrentlyValidatingElement(element);

		          error('Failed %s type: %s', location, error$1.message);

		          setCurrentlyValidatingElement(null);
		        }
		      }
		    }
		  }
		}

		function setCurrentlyValidatingElement$1(element) {
		  {
		    if (element) {
		      var owner = element._owner;
		      var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
		      setExtraStackFrame(stack);
		    } else {
		      setExtraStackFrame(null);
		    }
		  }
		}

		var propTypesMisspellWarningShown;

		{
		  propTypesMisspellWarningShown = false;
		}

		function getDeclarationErrorAddendum() {
		  if (ReactCurrentOwner.current) {
		    var name = getComponentNameFromType(ReactCurrentOwner.current.type);

		    if (name) {
		      return '\n\nCheck the render method of `' + name + '`.';
		    }
		  }

		  return '';
		}

		function getSourceInfoErrorAddendum(source) {
		  if (source !== undefined) {
		    var fileName = source.fileName.replace(/^.*[\\\/]/, '');
		    var lineNumber = source.lineNumber;
		    return '\n\nCheck your code at ' + fileName + ':' + lineNumber + '.';
		  }

		  return '';
		}

		function getSourceInfoErrorAddendumForProps(elementProps) {
		  if (elementProps !== null && elementProps !== undefined) {
		    return getSourceInfoErrorAddendum(elementProps.__source);
		  }

		  return '';
		}
		/**
		 * Warn if there's no key explicitly set on dynamic arrays of children or
		 * object keys are not valid. This allows us to keep track of children between
		 * updates.
		 */


		var ownerHasKeyUseWarning = {};

		function getCurrentComponentErrorInfo(parentType) {
		  var info = getDeclarationErrorAddendum();

		  if (!info) {
		    var parentName = typeof parentType === 'string' ? parentType : parentType.displayName || parentType.name;

		    if (parentName) {
		      info = "\n\nCheck the top-level render call using <" + parentName + ">.";
		    }
		  }

		  return info;
		}
		/**
		 * Warn if the element doesn't have an explicit key assigned to it.
		 * This element is in an array. The array could grow and shrink or be
		 * reordered. All children that haven't already been validated are required to
		 * have a "key" property assigned to it. Error statuses are cached so a warning
		 * will only be shown once.
		 *
		 * @internal
		 * @param {ReactElement} element Element that requires a key.
		 * @param {*} parentType element's parent's type.
		 */


		function validateExplicitKey(element, parentType) {
		  if (!element._store || element._store.validated || element.key != null) {
		    return;
		  }

		  element._store.validated = true;
		  var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);

		  if (ownerHasKeyUseWarning[currentComponentErrorInfo]) {
		    return;
		  }

		  ownerHasKeyUseWarning[currentComponentErrorInfo] = true; // Usually the current owner is the offender, but if it accepts children as a
		  // property, it may be the creator of the child that's responsible for
		  // assigning it a key.

		  var childOwner = '';

		  if (element && element._owner && element._owner !== ReactCurrentOwner.current) {
		    // Give the component that originally created this child.
		    childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
		  }

		  {
		    setCurrentlyValidatingElement$1(element);

		    error('Each child in a list should have a unique "key" prop.' + '%s%s See https://reactjs.org/link/warning-keys for more information.', currentComponentErrorInfo, childOwner);

		    setCurrentlyValidatingElement$1(null);
		  }
		}
		/**
		 * Ensure that every element either is passed in a static location, in an
		 * array with an explicit keys property defined, or in an object literal
		 * with valid key property.
		 *
		 * @internal
		 * @param {ReactNode} node Statically passed child of any type.
		 * @param {*} parentType node's parent's type.
		 */


		function validateChildKeys(node, parentType) {
		  if (typeof node !== 'object') {
		    return;
		  }

		  if (isArray(node)) {
		    for (var i = 0; i < node.length; i++) {
		      var child = node[i];

		      if (isValidElement(child)) {
		        validateExplicitKey(child, parentType);
		      }
		    }
		  } else if (isValidElement(node)) {
		    // This element was passed in a valid location.
		    if (node._store) {
		      node._store.validated = true;
		    }
		  } else if (node) {
		    var iteratorFn = getIteratorFn(node);

		    if (typeof iteratorFn === 'function') {
		      // Entry iterators used to provide implicit keys,
		      // but now we print a separate warning for them later.
		      if (iteratorFn !== node.entries) {
		        var iterator = iteratorFn.call(node);
		        var step;

		        while (!(step = iterator.next()).done) {
		          if (isValidElement(step.value)) {
		            validateExplicitKey(step.value, parentType);
		          }
		        }
		      }
		    }
		  }
		}
		/**
		 * Given an element, validate that its props follow the propTypes definition,
		 * provided by the type.
		 *
		 * @param {ReactElement} element
		 */


		function validatePropTypes(element) {
		  {
		    var type = element.type;

		    if (type === null || type === undefined || typeof type === 'string') {
		      return;
		    }

		    var propTypes;

		    if (typeof type === 'function') {
		      propTypes = type.propTypes;
		    } else if (typeof type === 'object' && (type.$$typeof === REACT_FORWARD_REF_TYPE || // Note: Memo only checks outer props here.
		    // Inner props are checked in the reconciler.
		    type.$$typeof === REACT_MEMO_TYPE)) {
		      propTypes = type.propTypes;
		    } else {
		      return;
		    }

		    if (propTypes) {
		      // Intentionally inside to avoid triggering lazy initializers:
		      var name = getComponentNameFromType(type);
		      checkPropTypes(propTypes, element.props, 'prop', name, element);
		    } else if (type.PropTypes !== undefined && !propTypesMisspellWarningShown) {
		      propTypesMisspellWarningShown = true; // Intentionally inside to avoid triggering lazy initializers:

		      var _name = getComponentNameFromType(type);

		      error('Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?', _name || 'Unknown');
		    }

		    if (typeof type.getDefaultProps === 'function' && !type.getDefaultProps.isReactClassApproved) {
		      error('getDefaultProps is only used on classic React.createClass ' + 'definitions. Use a static property named `defaultProps` instead.');
		    }
		  }
		}
		/**
		 * Given a fragment, validate that it can only be provided with fragment props
		 * @param {ReactElement} fragment
		 */


		function validateFragmentProps(fragment) {
		  {
		    var keys = Object.keys(fragment.props);

		    for (var i = 0; i < keys.length; i++) {
		      var key = keys[i];

		      if (key !== 'children' && key !== 'key') {
		        setCurrentlyValidatingElement$1(fragment);

		        error('Invalid prop `%s` supplied to `React.Fragment`. ' + 'React.Fragment can only have `key` and `children` props.', key);

		        setCurrentlyValidatingElement$1(null);
		        break;
		      }
		    }

		    if (fragment.ref !== null) {
		      setCurrentlyValidatingElement$1(fragment);

		      error('Invalid attribute `ref` supplied to `React.Fragment`.');

		      setCurrentlyValidatingElement$1(null);
		    }
		  }
		}
		function createElementWithValidation(type, props, children) {
		  var validType = isValidElementType(type); // We warn in this case but don't throw. We expect the element creation to
		  // succeed and there will likely be errors in render.

		  if (!validType) {
		    var info = '';

		    if (type === undefined || typeof type === 'object' && type !== null && Object.keys(type).length === 0) {
		      info += ' You likely forgot to export your component from the file ' + "it's defined in, or you might have mixed up default and named imports.";
		    }

		    var sourceInfo = getSourceInfoErrorAddendumForProps(props);

		    if (sourceInfo) {
		      info += sourceInfo;
		    } else {
		      info += getDeclarationErrorAddendum();
		    }

		    var typeString;

		    if (type === null) {
		      typeString = 'null';
		    } else if (isArray(type)) {
		      typeString = 'array';
		    } else if (type !== undefined && type.$$typeof === REACT_ELEMENT_TYPE) {
		      typeString = "<" + (getComponentNameFromType(type.type) || 'Unknown') + " />";
		      info = ' Did you accidentally export a JSX literal instead of a component?';
		    } else {
		      typeString = typeof type;
		    }

		    {
		      error('React.createElement: type is invalid -- expected a string (for ' + 'built-in components) or a class/function (for composite ' + 'components) but got: %s.%s', typeString, info);
		    }
		  }

		  var element = createElement.apply(this, arguments); // The result can be nullish if a mock or a custom function is used.
		  // TODO: Drop this when these are no longer allowed as the type argument.

		  if (element == null) {
		    return element;
		  } // Skip key warning if the type isn't valid since our key validation logic
		  // doesn't expect a non-string/function type and can throw confusing errors.
		  // We don't want exception behavior to differ between dev and prod.
		  // (Rendering will throw with a helpful message and as soon as the type is
		  // fixed, the key warnings will appear.)


		  if (validType) {
		    for (var i = 2; i < arguments.length; i++) {
		      validateChildKeys(arguments[i], type);
		    }
		  }

		  if (type === REACT_FRAGMENT_TYPE) {
		    validateFragmentProps(element);
		  } else {
		    validatePropTypes(element);
		  }

		  return element;
		}
		var didWarnAboutDeprecatedCreateFactory = false;
		function createFactoryWithValidation(type) {
		  var validatedFactory = createElementWithValidation.bind(null, type);
		  validatedFactory.type = type;

		  {
		    if (!didWarnAboutDeprecatedCreateFactory) {
		      didWarnAboutDeprecatedCreateFactory = true;

		      warn('React.createFactory() is deprecated and will be removed in ' + 'a future major release. Consider using JSX ' + 'or use React.createElement() directly instead.');
		    } // Legacy hook: remove it


		    Object.defineProperty(validatedFactory, 'type', {
		      enumerable: false,
		      get: function () {
		        warn('Factory.type is deprecated. Access the class directly ' + 'before passing it to createFactory.');

		        Object.defineProperty(this, 'type', {
		          value: type
		        });
		        return type;
		      }
		    });
		  }

		  return validatedFactory;
		}
		function cloneElementWithValidation(element, props, children) {
		  var newElement = cloneElement.apply(this, arguments);

		  for (var i = 2; i < arguments.length; i++) {
		    validateChildKeys(arguments[i], newElement.type);
		  }

		  validatePropTypes(newElement);
		  return newElement;
		}

		function startTransition(scope, options) {
		  var prevTransition = ReactCurrentBatchConfig.transition;
		  ReactCurrentBatchConfig.transition = {};
		  var currentTransition = ReactCurrentBatchConfig.transition;

		  {
		    ReactCurrentBatchConfig.transition._updatedFibers = new Set();
		  }

		  try {
		    scope();
		  } finally {
		    ReactCurrentBatchConfig.transition = prevTransition;

		    {
		      if (prevTransition === null && currentTransition._updatedFibers) {
		        var updatedFibersCount = currentTransition._updatedFibers.size;

		        if (updatedFibersCount > 10) {
		          warn('Detected a large number of updates inside startTransition. ' + 'If this is due to a subscription please re-write it to use React provided hooks. ' + 'Otherwise concurrent mode guarantees are off the table.');
		        }

		        currentTransition._updatedFibers.clear();
		      }
		    }
		  }
		}

		var didWarnAboutMessageChannel = false;
		var enqueueTaskImpl = null;
		function enqueueTask(task) {
		  if (enqueueTaskImpl === null) {
		    try {
		      // read require off the module object to get around the bundlers.
		      // we don't want them to detect a require and bundle a Node polyfill.
		      var requireString = ('require' + Math.random()).slice(0, 7);
		      var nodeRequire = module && module[requireString]; // assuming we're in node, let's try to get node's
		      // version of setImmediate, bypassing fake timers if any.

		      enqueueTaskImpl = nodeRequire.call(module, 'timers').setImmediate;
		    } catch (_err) {
		      // we're in a browser
		      // we can't use regular timers because they may still be faked
		      // so we try MessageChannel+postMessage instead
		      enqueueTaskImpl = function (callback) {
		        {
		          if (didWarnAboutMessageChannel === false) {
		            didWarnAboutMessageChannel = true;

		            if (typeof MessageChannel === 'undefined') {
		              error('This browser does not have a MessageChannel implementation, ' + 'so enqueuing tasks via await act(async () => ...) will fail. ' + 'Please file an issue at https://github.com/facebook/react/issues ' + 'if you encounter this warning.');
		            }
		          }
		        }

		        var channel = new MessageChannel();
		        channel.port1.onmessage = callback;
		        channel.port2.postMessage(undefined);
		      };
		    }
		  }

		  return enqueueTaskImpl(task);
		}

		var actScopeDepth = 0;
		var didWarnNoAwaitAct = false;
		function act(callback) {
		  {
		    // `act` calls can be nested, so we track the depth. This represents the
		    // number of `act` scopes on the stack.
		    var prevActScopeDepth = actScopeDepth;
		    actScopeDepth++;

		    if (ReactCurrentActQueue.current === null) {
		      // This is the outermost `act` scope. Initialize the queue. The reconciler
		      // will detect the queue and use it instead of Scheduler.
		      ReactCurrentActQueue.current = [];
		    }

		    var prevIsBatchingLegacy = ReactCurrentActQueue.isBatchingLegacy;
		    var result;

		    try {
		      // Used to reproduce behavior of `batchedUpdates` in legacy mode. Only
		      // set to `true` while the given callback is executed, not for updates
		      // triggered during an async event, because this is how the legacy
		      // implementation of `act` behaved.
		      ReactCurrentActQueue.isBatchingLegacy = true;
		      result = callback(); // Replicate behavior of original `act` implementation in legacy mode,
		      // which flushed updates immediately after the scope function exits, even
		      // if it's an async function.

		      if (!prevIsBatchingLegacy && ReactCurrentActQueue.didScheduleLegacyUpdate) {
		        var queue = ReactCurrentActQueue.current;

		        if (queue !== null) {
		          ReactCurrentActQueue.didScheduleLegacyUpdate = false;
		          flushActQueue(queue);
		        }
		      }
		    } catch (error) {
		      popActScope(prevActScopeDepth);
		      throw error;
		    } finally {
		      ReactCurrentActQueue.isBatchingLegacy = prevIsBatchingLegacy;
		    }

		    if (result !== null && typeof result === 'object' && typeof result.then === 'function') {
		      var thenableResult = result; // The callback is an async function (i.e. returned a promise). Wait
		      // for it to resolve before exiting the current scope.

		      var wasAwaited = false;
		      var thenable = {
		        then: function (resolve, reject) {
		          wasAwaited = true;
		          thenableResult.then(function (returnValue) {
		            popActScope(prevActScopeDepth);

		            if (actScopeDepth === 0) {
		              // We've exited the outermost act scope. Recursively flush the
		              // queue until there's no remaining work.
		              recursivelyFlushAsyncActWork(returnValue, resolve, reject);
		            } else {
		              resolve(returnValue);
		            }
		          }, function (error) {
		            // The callback threw an error.
		            popActScope(prevActScopeDepth);
		            reject(error);
		          });
		        }
		      };

		      {
		        if (!didWarnNoAwaitAct && typeof Promise !== 'undefined') {
		          // eslint-disable-next-line no-undef
		          Promise.resolve().then(function () {}).then(function () {
		            if (!wasAwaited) {
		              didWarnNoAwaitAct = true;

		              error('You called act(async () => ...) without await. ' + 'This could lead to unexpected testing behaviour, ' + 'interleaving multiple act calls and mixing their ' + 'scopes. ' + 'You should - await act(async () => ...);');
		            }
		          });
		        }
		      }

		      return thenable;
		    } else {
		      var returnValue = result; // The callback is not an async function. Exit the current scope
		      // immediately, without awaiting.

		      popActScope(prevActScopeDepth);

		      if (actScopeDepth === 0) {
		        // Exiting the outermost act scope. Flush the queue.
		        var _queue = ReactCurrentActQueue.current;

		        if (_queue !== null) {
		          flushActQueue(_queue);
		          ReactCurrentActQueue.current = null;
		        } // Return a thenable. If the user awaits it, we'll flush again in
		        // case additional work was scheduled by a microtask.


		        var _thenable = {
		          then: function (resolve, reject) {
		            // Confirm we haven't re-entered another `act` scope, in case
		            // the user does something weird like await the thenable
		            // multiple times.
		            if (ReactCurrentActQueue.current === null) {
		              // Recursively flush the queue until there's no remaining work.
		              ReactCurrentActQueue.current = [];
		              recursivelyFlushAsyncActWork(returnValue, resolve, reject);
		            } else {
		              resolve(returnValue);
		            }
		          }
		        };
		        return _thenable;
		      } else {
		        // Since we're inside a nested `act` scope, the returned thenable
		        // immediately resolves. The outer scope will flush the queue.
		        var _thenable2 = {
		          then: function (resolve, reject) {
		            resolve(returnValue);
		          }
		        };
		        return _thenable2;
		      }
		    }
		  }
		}

		function popActScope(prevActScopeDepth) {
		  {
		    if (prevActScopeDepth !== actScopeDepth - 1) {
		      error('You seem to have overlapping act() calls, this is not supported. ' + 'Be sure to await previous act() calls before making a new one. ');
		    }

		    actScopeDepth = prevActScopeDepth;
		  }
		}

		function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
		  {
		    var queue = ReactCurrentActQueue.current;

		    if (queue !== null) {
		      try {
		        flushActQueue(queue);
		        enqueueTask(function () {
		          if (queue.length === 0) {
		            // No additional work was scheduled. Finish.
		            ReactCurrentActQueue.current = null;
		            resolve(returnValue);
		          } else {
		            // Keep flushing work until there's none left.
		            recursivelyFlushAsyncActWork(returnValue, resolve, reject);
		          }
		        });
		      } catch (error) {
		        reject(error);
		      }
		    } else {
		      resolve(returnValue);
		    }
		  }
		}

		var isFlushing = false;

		function flushActQueue(queue) {
		  {
		    if (!isFlushing) {
		      // Prevent re-entrance.
		      isFlushing = true;
		      var i = 0;

		      try {
		        for (; i < queue.length; i++) {
		          var callback = queue[i];

		          do {
		            callback = callback(true);
		          } while (callback !== null);
		        }

		        queue.length = 0;
		      } catch (error) {
		        // If something throws, leave the remaining callbacks on the queue.
		        queue = queue.slice(i + 1);
		        throw error;
		      } finally {
		        isFlushing = false;
		      }
		    }
		  }
		}

		var createElement$1 =  createElementWithValidation ;
		var cloneElement$1 =  cloneElementWithValidation ;
		var createFactory =  createFactoryWithValidation ;
		var Children = {
		  map: mapChildren,
		  forEach: forEachChildren,
		  count: countChildren,
		  toArray: toArray,
		  only: onlyChild
		};

		exports.Children = Children;
		exports.Component = Component;
		exports.Fragment = REACT_FRAGMENT_TYPE;
		exports.Profiler = REACT_PROFILER_TYPE;
		exports.PureComponent = PureComponent;
		exports.StrictMode = REACT_STRICT_MODE_TYPE;
		exports.Suspense = REACT_SUSPENSE_TYPE;
		exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactSharedInternals;
		exports.act = act;
		exports.cloneElement = cloneElement$1;
		exports.createContext = createContext;
		exports.createElement = createElement$1;
		exports.createFactory = createFactory;
		exports.createRef = createRef;
		exports.forwardRef = forwardRef;
		exports.isValidElement = isValidElement;
		exports.lazy = lazy;
		exports.memo = memo;
		exports.startTransition = startTransition;
		exports.unstable_act = act;
		exports.useCallback = useCallback;
		exports.useContext = useContext;
		exports.useDebugValue = useDebugValue;
		exports.useDeferredValue = useDeferredValue;
		exports.useEffect = useEffect;
		exports.useId = useId;
		exports.useImperativeHandle = useImperativeHandle;
		exports.useInsertionEffect = useInsertionEffect;
		exports.useLayoutEffect = useLayoutEffect;
		exports.useMemo = useMemo;
		exports.useReducer = useReducer;
		exports.useRef = useRef;
		exports.useState = useState;
		exports.useSyncExternalStore = useSyncExternalStore;
		exports.useTransition = useTransition;
		exports.version = ReactVersion;
		          /* global __REACT_DEVTOOLS_GLOBAL_HOOK__ */
		if (
		  typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined' &&
		  typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop ===
		    'function'
		) {
		  __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(new Error());
		}
		        
		  })();
		} 
	} (react_development, react_development.exports));
	return react_development.exports;
}

if (process.env.NODE_ENV === 'production') {
  react.exports = requireReact_production_min();
} else {
  react.exports = requireReact_development();
}

var reactExports = react.exports;

const SvgBoltBlack24Dp = (props) => /* @__PURE__ */ reactExports.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", enableBackground: "new 0 0 24 24", height: "24px", viewBox: "0 0 24 24", width: "24px", fill: "#000000", ...props }, /* @__PURE__ */ reactExports.createElement("g", null, /* @__PURE__ */ reactExports.createElement("rect", { fill: "none", height: 24, width: 24 })), /* @__PURE__ */ reactExports.createElement("g", null, /* @__PURE__ */ reactExports.createElement("path", { d: "M11,21h-1l1-7H7.5c-0.88,0-0.33-0.75-0.31-0.78C8.48,10.94,10.42,7.54,13.01,3h1l-1,7h3.51c0.4,0,0.62,0.19,0.4,0.66 C12.97,17.55,11,21,11,21z" })));

const SvgLockBlack24Dp = (props) => /* @__PURE__ */ reactExports.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", height: "24px", viewBox: "0 0 24 24", width: "24px", fill: "#000000", ...props }, /* @__PURE__ */ reactExports.createElement("g", { fill: "none" }, /* @__PURE__ */ reactExports.createElement("path", { d: "M0 0h24v24H0V0z" }), /* @__PURE__ */ reactExports.createElement("path", { d: "M0 0h24v24H0V0z", opacity: 0.87 })), /* @__PURE__ */ reactExports.createElement("path", { d: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" }));

function getNominalVoltageColor(nominalVoltage) {
  if (nominalVoltage >= 300) {
    return [255, 0, 0];
  } else if (nominalVoltage >= 170 && nominalVoltage < 300) {
    return [34, 139, 34];
  } else if (nominalVoltage >= 120 && nominalVoltage < 170) {
    return [1, 175, 175];
  } else if (nominalVoltage >= 70 && nominalVoltage < 120) {
    return [204, 85, 0];
  } else if (nominalVoltage >= 50 && nominalVoltage < 70) {
    return [160, 32, 240];
  } else if (nominalVoltage >= 30 && nominalVoltage < 50) {
    return [255, 130, 144];
  } else {
    return [171, 175, 40];
  }
}
const INVALID_FLOW_OPACITY = 0.2;

const defaultProps$4 = {
  getLineParallelIndex: { type: "accessor", value: 0 },
  getLineAngle: { type: "accessor", value: 0 },
  distanceBetweenLines: { type: "number", value: 1e3 },
  maxParallelOffset: { type: "number", value: 100 },
  minParallelOffset: { type: "number", value: 3 },
  substationRadius: { type: "number", value: 500 },
  substationMaxPixel: { type: "number", value: 5 },
  minSubstationRadiusPixel: { type: "number", value: 1 }
};
class ForkLineLayer extends LineLayer$1 {
  static layerName = "ForkLineLayer";
  static defaultProps = defaultProps$4;
  // declare state: LineLayer['state'];
  getShaders() {
    const shaders = super.getShaders();
    shaders.inject = {
      "vs:#decl": `
in float instanceLineParallelIndex;
in float instanceLineAngle;
in float instanceOffsetStart;
in float instanceProximityFactor;
uniform float distanceBetweenLines;
uniform float maxParallelOffset;
uniform float minParallelOffset;
uniform float substationRadius;
uniform float substationMaxPixel;
uniform float minSubstationRadiusPixel;
            `,
      "float segmentIndex = positions.x": `;
    target = source ;
    float offsetPixels = clamp(project_size_to_pixel( distanceBetweenLines), minParallelOffset, maxParallelOffset );
    float offsetCommonSpace = project_pixel_size(offsetPixels);

    float offsetSubstation = clamp(project_size_to_pixel(substationRadius*instanceOffsetStart ), 
                                    minSubstationRadiusPixel, 
                                    substationMaxPixel * instanceOffsetStart );
    float offsetSubstationCommonSpace = project_pixel_size(offsetSubstation) ;

    vec4 trans = vec4(cos(instanceLineAngle), -sin(instanceLineAngle ), 0, 0.) * instanceLineParallelIndex;

    trans.x -= sin(instanceLineAngle) * instanceProximityFactor;
    trans.y -= cos(instanceLineAngle) * instanceProximityFactor;

    source+=project_common_position_to_clipspace(trans * (offsetSubstationCommonSpace / sqrt(trans.x*trans.x+trans.y*trans.y))) - project_uCenter;
    target+=project_common_position_to_clipspace(trans * offsetCommonSpace) - project_uCenter;

            `
    };
    return shaders;
  }
  initializeState() {
    super.initializeState();
    this.getAttributeManager()?.addInstanced({
      instanceLineParallelIndex: {
        size: 1,
        type: "float32",
        accessor: "getLineParallelIndex"
      },
      instanceLineAngle: {
        size: 1,
        type: "float32",
        accessor: "getLineAngle"
      },
      instanceOffsetStart: {
        size: 1,
        type: "float32",
        accessor: "getSubstationOffset"
      },
      instanceProximityFactor: {
        size: 1,
        type: "float32",
        accessor: "getProximityFactor"
      }
    });
  }
  draw({
    uniforms
  }) {
    super.draw({
      uniforms: {
        ...uniforms,
        distanceBetweenLines: this.props.getDistanceBetweenLines,
        maxParallelOffset: this.props.getMaxParallelOffset,
        minParallelOffset: this.props.getMinParallelOffset,
        substationRadius: this.props.getSubstationRadius,
        substationMaxPixel: this.props.getSubstationMaxPixel,
        minSubstationRadiusPixel: this.props.getMinSubstationRadiusPixel
      }
    });
  }
}

const defaultProps$3 = {
  getLineParallelIndex: { type: "accessor", value: 0 },
  getLineAngle: { type: "accessor", value: 0 },
  distanceBetweenLines: { type: "number", value: 1e3 },
  maxParallelOffset: { type: "number", value: 100 },
  minParallelOffset: { type: "number", value: 3 }
};
class ParallelPathLayer extends PathLayer {
  static layerName = "ParallelPathLayer";
  static defaultProps = defaultProps$3;
  getShaders() {
    const shaders = super.getShaders();
    shaders.inject = Object.assign({}, shaders.inject, {
      "vs:#decl": shaders.inject["vs:#decl"] + `//Note: with the following attribute, we have reached the limit (16 on most platforms) of the number of attributes.
//      with webgl2, this might be raised in the future to 32 on most platforms...
//      The PathLayer that this class extends already uses 13 attributes (and 15 with the dash extension).
//      we have packed all our attributes together in a single attribute to
//      workaround the low limit of the number of vertex attrbutes...
//      To pack the attributes, for now we use a very simple system. If needed, we can change it to a more efficient packing.
//      We just add an extra float to the line angles vec3. The
//      extra float contains the previous attributes:
//          parallelIndex (an half integer, between -15.5 and +15.5 (32 lines max..))
//          proximityFactors (two floats, between 0 and 1)
//
//          To simplify further, we use only positive integers for
//          this extra float, ie values only from 0 to 2^24. For parallelIndex, we encode the half integers from -15.5 to 15.5
//          to 0..62, which fits in 6 bits.
//          For proximityFactors, We switch from floating to a fixed precision of 9 bits
//          without the 0 (ie multiples of 512: 1/512, 2/512, ..., 1).
//          So in the 24 bits of the integer value of the float, we have 6 bits of parallel index,
//          9 bits of proximity factor start, 9 bits of proximity factor end, for a total of 24 bits.
//Note2: packing the attributes together, in addition to not beeing very readable,
//       also has the downside that you can't update one attribute and reconstruct
//       only its buffer, so it hurts performance a bit in this case.
//       But this is a rare case for us (changing parameters) so it doesn't matter much.
in vec4 instanceExtraAttributes;
uniform float distanceBetweenLines;
uniform float maxParallelOffset;
uniform float minParallelOffset;
`,
      "vs:#main-end": shaders.inject["vs:#main-end"] + `
bool isSegmentEnd = isEnd > EPSILON;
bool isFirstSegment = (instanceTypes == 1.0 || instanceTypes == 3.0);
bool isLastSegment = (instanceTypes == 2.0 || instanceTypes == 3.0);

float instanceLineAngle = instanceExtraAttributes[1];
if ( !isSegmentEnd && isFirstSegment ){
    instanceLineAngle = instanceExtraAttributes[0];
}
else if ( isSegmentEnd && isLastSegment){
    instanceLineAngle = instanceExtraAttributes[2];
}
float instanceLineParallelIndex = (mod(instanceExtraAttributes[3], 64.0) - 31.0) / 2.0;
 
float offsetPixels = clamp(project_size_to_pixel(distanceBetweenLines), minParallelOffset, maxParallelOffset);
float offsetCommonSpace = project_pixel_size(offsetPixels);
vec4 trans = vec4(cos(instanceLineAngle), -sin(instanceLineAngle), 0, 0.) * instanceLineParallelIndex;

if(isSegmentEnd && isLastSegment) {
  float pf = (mod(instanceExtraAttributes[3] / 64.0, 512.0) + 1.0) / 512.0;
  trans.x += sin(instanceLineAngle) * pf ;
  trans.y += cos(instanceLineAngle) * pf;
}
else if (!isSegmentEnd && isFirstSegment)
{
  float pf = (mod(instanceExtraAttributes[3] / 32768.0, 512.0) + 1.0) / 512.0;
  trans.x -= sin(instanceLineAngle) * pf;
  trans.y -= cos(instanceLineAngle) * pf;
}

trans = trans * offsetCommonSpace;
gl_Position += project_common_position_to_clipspace(trans) - project_uCenter;
`
    });
    return shaders;
  }
  initializeState() {
    super.initializeState();
    this.getAttributeManager()?.addInstanced({
      // too much instances variables need to compact some...
      instanceExtraAttributes: {
        size: 4,
        type: "float32",
        accessor: "getExtraAttributes"
      }
    });
  }
  draw({
    uniforms
  }) {
    super.draw({
      uniforms: {
        ...uniforms,
        distanceBetweenLines: this.props.distanceBetweenLines,
        maxParallelOffset: this.props.maxParallelOffset,
        minParallelOffset: this.props.minParallelOffset
      }
    });
  }
}

const DISTANCE_BETWEEN_ARROWS = 1e4;
const START_ARROW_POSITION = 0.1;
const END_ARROW_POSITION = 0.9;
var LineFlowMode = /* @__PURE__ */ ((LineFlowMode2) => {
  LineFlowMode2["STATIC_ARROWS"] = "staticArrows";
  LineFlowMode2["ANIMATED_ARROWS"] = "animatedArrows";
  LineFlowMode2["FEEDERS"] = "feeders";
  return LineFlowMode2;
})(LineFlowMode || {});
var LineFlowColorMode = /* @__PURE__ */ ((LineFlowColorMode2) => {
  LineFlowColorMode2["NOMINAL_VOLTAGE"] = "nominalVoltage";
  LineFlowColorMode2["OVERLOADS"] = "overloads";
  return LineFlowColorMode2;
})(LineFlowColorMode || {});
const noDashArray = [0, 0];
const dashArray = [15, 10];
function doDash(lineConnection) {
  return !lineConnection.terminal1Connected || !lineConnection.terminal2Connected;
}
function getArrowDirection(p) {
  if (p < 0) {
    return ArrowDirection.FROM_SIDE_2_TO_SIDE_1;
  } else if (p > 0) {
    return ArrowDirection.FROM_SIDE_1_TO_SIDE_2;
  } else {
    return ArrowDirection.NONE;
  }
}
function getLineLoadingZoneOfSide(limit, intensity, lineFlowAlertThreshold) {
  if (limit === void 0 || intensity === void 0 || intensity === 0) {
    return 0 /* UNKNOWN */;
  } else {
    const threshold = lineFlowAlertThreshold * limit / 100;
    if (intensity > 0 && intensity < threshold) {
      return 1 /* SAFE */;
    } else if (intensity >= threshold && intensity < limit) {
      return 2 /* WARNING */;
    } else {
      return 3 /* OVERLOAD */;
    }
  }
}
function getLineLoadingZone(line, lineFlowAlertThreshold) {
  const zone1 = getLineLoadingZoneOfSide(
    line.currentLimits1?.permanentLimit,
    line.i1,
    lineFlowAlertThreshold
  );
  const zone2 = getLineLoadingZoneOfSide(
    line.currentLimits2?.permanentLimit,
    line.i2,
    lineFlowAlertThreshold
  );
  return Math.max(zone1, zone2);
}
function getLineLoadingZoneColor(zone) {
  if (zone === 0 /* UNKNOWN */) {
    return [128, 128, 128];
  } else if (zone === 1 /* SAFE */) {
    return [107, 178, 40];
  } else if (zone === 2 /* WARNING */) {
    return [210, 179, 63];
  } else if (zone === 3 /* OVERLOAD */) {
    return [255, 0, 0];
  } else {
    throw new Error("Unsupported line loading zone: " + zone);
  }
}
function getLineColor(line, nominalVoltageColor, props, lineConnection) {
  if (props.lineFlowColorMode === "nominalVoltage" /* NOMINAL_VOLTAGE */) {
    if (!lineConnection || !lineConnection.terminal1Connected && !lineConnection.terminal2Connected) {
      return props.disconnectedLineColor;
    } else {
      return nominalVoltageColor;
    }
  } else if (props.lineFlowColorMode === "overloads" /* OVERLOADS */) {
    const zone = getLineLoadingZone(line, props.lineFlowAlertThreshold);
    return getLineLoadingZoneColor(zone);
  } else {
    return nominalVoltageColor;
  }
}
function getLineIcon(lineStatus) {
  return {
    url: lineStatus === "PLANNED_OUTAGE" ? SvgLockBlack24Dp : lineStatus === "FORCED_OUTAGE" ? SvgBoltBlack24Dp : void 0,
    height: 24,
    width: 24,
    mask: true
  };
}
const ArrowSpeed = {
  STOPPED: 0,
  SLOW: 1,
  MEDIUM: 2,
  FAST: 3,
  CRAZY: 4
};
function getArrowSpeedOfSide(limit, intensity) {
  if (limit === void 0 || intensity === void 0 || intensity === 0) {
    return ArrowSpeed.STOPPED;
  } else {
    if (intensity > 0 && intensity < limit / 3) {
      return ArrowSpeed.SLOW;
    } else if (intensity >= limit / 3 && intensity < limit * 2 / 3) {
      return ArrowSpeed.MEDIUM;
    } else if (intensity >= limit * 2 / 3 && intensity < limit) {
      return ArrowSpeed.FAST;
    } else {
      return ArrowSpeed.CRAZY;
    }
  }
}
function getArrowSpeed(line) {
  const speed1 = getArrowSpeedOfSide(
    line.currentLimits1?.permanentLimit,
    line.i1
  );
  const speed2 = getArrowSpeedOfSide(
    line.currentLimits2?.permanentLimit,
    line.i2
  );
  return Math.max(speed1, speed2);
}
function getArrowSpeedFactor(speed) {
  switch (speed) {
    case ArrowSpeed.STOPPED:
      return 0;
    case ArrowSpeed.SLOW:
      return 0.5;
    case ArrowSpeed.MEDIUM:
      return 2;
    case ArrowSpeed.FAST:
      return 4;
    case ArrowSpeed.CRAZY:
      return 10;
    default:
      throw new Error("Unknown arrow speed: " + speed);
  }
}
const defaultProps$2 = {
  network: null,
  geoData: null,
  getNominalVoltageColor: { type: "accessor", value: [255, 255, 255] },
  disconnectedLineColor: { type: "color", value: [255, 255, 255] },
  filteredNominalVoltages: null,
  lineFlowMode: "feeders" /* FEEDERS */,
  lineFlowColorMode: "nominalVoltage" /* NOMINAL_VOLTAGE */,
  lineFlowAlertThreshold: 100,
  showLineFlow: true,
  lineFullPath: true,
  lineParallelPath: true,
  labelSize: 12,
  iconSize: 48,
  distanceBetweenLines: 1e3,
  maxParallelOffset: 100,
  minParallelOffset: 3,
  substationRadius: { type: "number", value: SUBSTATION_RADIUS },
  substationMaxPixel: { type: "number", value: SUBSTATION_RADIUS_MAX_PIXEL },
  minSubstationRadiusPixel: {
    type: "number",
    value: SUBSTATION_RADIUS_MIN_PIXEL
  }
};
class LineLayer extends CompositeLayer {
  static layerName = "LineLayer";
  static defaultProps = defaultProps$2;
  initializeState(context) {
    super.initializeState(context);
    this.state = {
      compositeData: [],
      linesConnection: /* @__PURE__ */ new Map(),
      linesStatus: /* @__PURE__ */ new Map()
    };
  }
  getVoltageLevelIndex(voltageLevelId) {
    const { network } = this.props;
    const vl = network.getVoltageLevel(voltageLevelId);
    if (vl === void 0) {
      return void 0;
    }
    const substation = network.getSubstation(vl.substationId);
    if (substation === void 0) {
      return void 0;
    }
    return [
      ...new Set(
        substation.voltageLevels.map((vl2) => vl2.nominalV)
        // only one voltage level
      )
    ].sort((a, b) => {
      return a - b;
    }).indexOf(vl.nominalV) + 1;
  }
  //TODO this is a huge function, refactor
  updateState({ props, oldProps, changeFlags }) {
    let compositeData;
    let linesConnection;
    let linesStatus;
    if (changeFlags.dataChanged) {
      compositeData = [];
      linesConnection = /* @__PURE__ */ new Map();
      linesStatus = /* @__PURE__ */ new Map();
      if (props.network != null && props.network.substations && props.data.length !== 0 && props.geoData != null) {
        const lineNominalVoltageIndexer = (map, line) => {
          const network = props.network;
          const vl1 = network.getVoltageLevel(line.voltageLevelId1);
          const vl2 = network.getVoltageLevel(line.voltageLevelId2);
          const vl = vl1 || vl2;
          let list = map.get(vl.nominalV);
          if (!list) {
            list = [];
            map.set(vl.nominalV, list);
          }
          if (vl1.substationId !== vl2.substationId) {
            list.push(line);
          }
          return map;
        };
        const linesByNominalVoltage = props.data.reduce(
          lineNominalVoltageIndexer,
          /* @__PURE__ */ new Map()
        );
        compositeData = Array.from(linesByNominalVoltage.entries()).map(([nominalV, lines]) => {
          return { nominalV, lines };
        }).sort((a, b) => b.nominalV - a.nominalV);
        compositeData.forEach((c) => {
          const mapOriginDestination = /* @__PURE__ */ new Map();
          c.mapOriginDestination = mapOriginDestination;
          c.lines.forEach((line) => {
            linesConnection.set(line.id, {
              terminal1Connected: line.terminal1Connected,
              terminal2Connected: line.terminal2Connected
            });
            linesStatus.set(line.id, {
              operatingStatus: line.operatingStatus
            });
            const key = this.genLineKey(line);
            const val = mapOriginDestination.get(key);
            if (val == null) {
              mapOriginDestination.set(key, /* @__PURE__ */ new Set([line]));
            } else {
              mapOriginDestination.set(key, val.add(line));
            }
          });
        });
      }
    } else {
      compositeData = this.state.compositeData;
      linesConnection = this.state.linesConnection;
      linesStatus = this.state.linesStatus;
      if (props.updatedLines !== oldProps.updatedLines) {
        props.updatedLines.forEach((line1) => {
          linesConnection.set(line1.id, {
            terminal1Connected: line1.terminal1Connected,
            terminal2Connected: line1.terminal2Connected
          });
          linesStatus.set(line1.id, {
            operatingStatus: line1.operatingStatus
          });
        });
      }
    }
    if (changeFlags.dataChanged || changeFlags.propsChanged && (oldProps.lineFullPath !== props.lineFullPath || props.lineParallelPath !== oldProps.lineParallelPath || props.geoData !== oldProps.geoData)) {
      this.recomputeParallelLinesIndex(
        compositeData,
        props
      );
    }
    if (changeFlags.dataChanged || changeFlags.propsChanged && (oldProps.lineFullPath !== props.lineFullPath || oldProps.geoData !== props.geoData)) {
      compositeData.forEach((c) => {
        const lineMap = /* @__PURE__ */ new Map();
        c.lines.forEach((line) => {
          const positions = props.geoData.getLinePositions(
            props.network,
            line,
            props.lineFullPath
          );
          const cumulativeDistances = props.geoData.getLineDistances(positions);
          lineMap.set(line.id, {
            positions,
            cumulativeDistances,
            line
          });
        });
        c.lineMap = lineMap;
      });
    }
    if (changeFlags.dataChanged || changeFlags.propsChanged && (props.lineFullPath !== oldProps.lineFullPath || props.lineParallelPath !== oldProps.lineParallelPath || props.geoData !== oldProps.geoData)) {
      this.recomputeForkLines(compositeData, props);
    }
    if (changeFlags.dataChanged || changeFlags.propsChanged && (oldProps.lineFullPath !== props.lineFullPath || props.lineParallelPath !== oldProps.lineParallelPath || props.geoData !== oldProps.geoData)) {
      compositeData.forEach((cData) => {
        cData.activePower = [];
        cData.lines.forEach((line) => {
          const lineData = cData.lineMap.get(line.id);
          const arrowDirection = getArrowDirection(line.p1);
          const coordinates1 = props.geoData.labelDisplayPosition(
            lineData.positions,
            lineData.cumulativeDistances,
            START_ARROW_POSITION,
            arrowDirection,
            line.parallelIndex,
            line.angle * 180 / Math.PI,
            line.angleStart * 180 / Math.PI,
            props.distanceBetweenLines,
            line.proximityFactorStart
          );
          const coordinates2 = props.geoData.labelDisplayPosition(
            lineData.positions,
            lineData.cumulativeDistances,
            END_ARROW_POSITION,
            arrowDirection,
            line.parallelIndex,
            line.angle * 180 / Math.PI,
            line.angleEnd * 180 / Math.PI,
            props.distanceBetweenLines,
            line.proximityFactorEnd
          );
          if (coordinates1 !== null && coordinates2 !== null) {
            cData.activePower.push({
              line,
              p: line.p1,
              printPosition: [
                coordinates1.position.longitude,
                coordinates1.position.latitude
              ],
              offset: coordinates1.offset
            });
            cData.activePower.push({
              line,
              p: line.p2,
              printPosition: [
                coordinates2.position.longitude,
                coordinates2.position.latitude
              ],
              offset: coordinates2.offset
            });
          }
        });
      });
    }
    if (changeFlags.dataChanged || changeFlags.propsChanged && (props.updatedLines !== oldProps.updatedLines || oldProps.lineFullPath !== props.lineFullPath || props.lineParallelPath !== oldProps.lineParallelPath || props.geoData !== oldProps.geoData)) {
      compositeData.forEach((cData) => {
        cData.operatingStatus = [];
        cData.lines.forEach((line) => {
          const lineStatus = linesStatus.get(line.id);
          if (lineStatus !== void 0 && lineStatus.operatingStatus !== void 0 && lineStatus.operatingStatus !== "IN_OPERATION") {
            const lineData = cData.lineMap.get(line.id);
            const coordinatesIcon = props.geoData.labelDisplayPosition(
              lineData.positions,
              lineData.cumulativeDistances,
              0.5,
              ArrowDirection.NONE,
              line.parallelIndex,
              line.angle * 180 / Math.PI,
              line.angleEnd * 180 / Math.PI,
              props.distanceBetweenLines,
              line.proximityFactorEnd
            );
            if (coordinatesIcon !== null) {
              cData.operatingStatus.push({
                status: lineStatus.operatingStatus,
                printPosition: [
                  coordinatesIcon.position.longitude,
                  coordinatesIcon.position.latitude
                ],
                offset: coordinatesIcon.offset
              });
            }
          }
        });
      });
    }
    if (changeFlags.dataChanged || changeFlags.propsChanged && (oldProps.lineFullPath !== props.lineFullPath || props.geoData !== oldProps.geoData || //For lineFlowMode, recompute only if mode goes to or from LineFlowMode.FEEDERS
    //because for LineFlowMode.STATIC_ARROWS and LineFlowMode.ANIMATED_ARROWS it's the same
    props.lineFlowMode !== oldProps.lineFlowMode && (props.lineFlowMode === "feeders" /* FEEDERS */ || oldProps.lineFlowMode === "feeders" /* FEEDERS */))) {
      compositeData.forEach((cData) => {
        const lineMap = cData.lineMap;
        cData.arrows = cData.lines.flatMap((line) => {
          const lineData = lineMap.get(line.id);
          line.cumulativeDistances = lineData.cumulativeDistances;
          line.positions = lineData.positions;
          if (props.lineFlowMode === "feeders" /* FEEDERS */) {
            return [
              {
                distance: START_ARROW_POSITION,
                line
              },
              {
                distance: END_ARROW_POSITION,
                line
              }
            ];
          }
          const directLinePositions = props.geoData.getLinePositions(
            props.network,
            line,
            false
          );
          const directLineDistance = es.getDistance(
            {
              latitude: directLinePositions[0][1],
              longitude: directLinePositions[0][0]
            },
            {
              latitude: directLinePositions[1][1],
              longitude: directLinePositions[1][0]
            }
          );
          const arrowCount = Math.ceil(
            directLineDistance / DISTANCE_BETWEEN_ARROWS
          );
          return [...new Array(arrowCount).keys()].map((index) => {
            return {
              distance: index / arrowCount,
              line
            };
          });
        });
      });
    }
    this.setState({ compositeData, linesConnection, linesStatus });
  }
  genLineKey(line) {
    return line.voltageLevelId1 > line.voltageLevelId2 ? line.voltageLevelId1 + "##" + line.voltageLevelId2 : line.voltageLevelId2 + "##" + line.voltageLevelId1;
  }
  recomputeParallelLinesIndex(compositeData, props) {
    compositeData.forEach((cData) => {
      const mapOriginDestination = cData.mapOriginDestination;
      mapOriginDestination.forEach((samePathLine, key) => {
        let truncatedSize = samePathLine.size;
        if (truncatedSize > 32) {
          console.warn(
            "Warning, more than 32 parallel lines between vls " + key + ". The map will only show 32 parallel lines."
          );
          truncatedSize = 32;
        }
        let index = -(truncatedSize - 1) / 2;
        samePathLine.forEach((line) => {
          line.parallelIndex = props.lineParallelPath ? index : 0;
          if (index < 15) {
            index += 1;
          }
        });
      });
    });
  }
  recomputeForkLines(compositeData, props) {
    const mapMinProximityFactor = /* @__PURE__ */ new Map();
    compositeData.forEach((cData) => {
      cData.lines.forEach((line) => {
        const positions = cData?.lineMap?.get(line.id)?.positions;
        if (!positions) {
          return;
        }
        line.origin = positions[0];
        line.end = positions[positions.length - 1];
        line.substationIndexStart = this.getVoltageLevelIndex(
          line.voltageLevelId1
        );
        line.substationIndexEnd = this.getVoltageLevelIndex(
          line.voltageLevelId2
        );
        line.angle = this.computeAngle(
          props,
          positions[0],
          positions[positions.length - 1]
        );
        line.angleStart = this.computeAngle(
          props,
          positions[0],
          positions[1]
        );
        line.angleEnd = this.computeAngle(
          props,
          positions[positions.length - 2],
          positions[positions.length - 1]
        );
        line.proximityFactorStart = this.getProximityFactor(
          positions[0],
          positions[1]
        );
        line.proximityFactorEnd = this.getProximityFactor(
          positions[positions.length - 2],
          positions[positions.length - 1]
        );
        const key = this.genLineKey(line);
        const val = mapMinProximityFactor.get(key);
        if (val == null) {
          mapMinProximityFactor.set(key, {
            lines: [line],
            start: line.proximityFactorStart,
            end: line.proximityFactorEnd
          });
        } else {
          val.lines.push(line);
          val.start = Math.min(val.start, line.proximityFactorStart);
          val.end = Math.min(val.end, line.proximityFactorEnd);
          mapMinProximityFactor.set(key, val);
        }
      });
    });
    mapMinProximityFactor.forEach(
      (samePathLine) => samePathLine.lines.forEach((line) => {
        line.proximityFactorStart = samePathLine.start;
        line.proximityFactorEnd = samePathLine.end;
      })
    );
  }
  getProximityFactor(firstPosition, secondPosition) {
    let factor = es.getDistance(firstPosition, secondPosition) / (3 * this.props.distanceBetweenLines);
    if (factor > 1) {
      factor = 1;
    }
    return factor;
  }
  computeAngle(props, position1, position2) {
    let angle = props.geoData.getMapAngle(position1, position2);
    angle = angle * Math.PI / 180 + Math.PI;
    if (angle < 0) {
      angle += 2 * Math.PI;
    }
    return angle;
  }
  renderLayers() {
    const layers = [];
    const linePathUpdateTriggers = [
      this.props.lineFullPath,
      this.props.geoData.linePositionsById,
      this.props.network.lines
    ];
    this.state.compositeData.forEach((cData) => {
      const nominalVoltageColor = this.props.getNominalVoltageColor(
        cData.nominalV
      );
      const lineLayer = new ParallelPathLayer(
        this.getSubLayerProps({
          id: "LineNominalVoltage" + cData.nominalV,
          data: cData.lines,
          widthScale: 20,
          widthMinPixels: 1,
          widthMaxPixels: 2,
          getPath: (line) => this.props.geoData.getLinePositions(
            this.props.network,
            line,
            this.props.lineFullPath
          ),
          getColor: (line) => getLineColor(
            line,
            nominalVoltageColor,
            this.props,
            this.state.linesConnection.get(line.id)
          ),
          getWidth: 2,
          getLineParallelIndex: (line) => line.parallelIndex,
          getExtraAttributes: (line) => [
            line.angleStart,
            line.angle,
            line.angleEnd,
            line.parallelIndex * 2 + 31 + 64 * (Math.ceil(line.proximityFactorStart * 512) - 1) + 64 * 512 * (Math.ceil(line.proximityFactorEnd * 512) - 1)
          ],
          distanceBetweenLines: this.props.distanceBetweenLines,
          maxParallelOffset: this.props.maxParallelOffset,
          minParallelOffset: this.props.minParallelOffset,
          visible: !this.props.filteredNominalVoltages || this.props.filteredNominalVoltages.includes(
            cData.nominalV
          ),
          updateTriggers: {
            getPath: linePathUpdateTriggers,
            getExtraAttributes: [
              this.props.lineParallelPath,
              linePathUpdateTriggers
            ],
            getColor: [
              this.props.disconnectedLineColor,
              this.props.lineFlowColorMode,
              this.props.lineFlowAlertThreshold,
              this.props.updatedLines
            ],
            getDashArray: [this.props.updatedLines]
          },
          getDashArray: (line) => doDash(this.state.linesConnection.get(line.id)) ? dashArray : noDashArray,
          extensions: [new PathStyleExtension({ dash: true })]
        })
      );
      layers.push(lineLayer);
      const arrowLayer = new ArrowLayer(
        this.getSubLayerProps({
          id: "ArrowNominalVoltage" + cData.nominalV,
          data: cData.arrows,
          sizeMinPixels: 3,
          sizeMaxPixels: 7,
          getDistance: (arrow) => arrow.distance,
          getLine: (arrow) => arrow.line,
          getLinePositions: (line) => this.props.geoData.getLinePositions(
            this.props.network,
            line,
            this.props.lineFullPath
          ),
          getColor: (arrow) => getLineColor(
            arrow.line,
            nominalVoltageColor,
            this.props,
            this.state.linesConnection.get(arrow.line.id)
          ),
          getSize: 700,
          getSpeedFactor: (arrow) => getArrowSpeedFactor(getArrowSpeed(arrow.line)),
          getLineParallelIndex: (arrow) => arrow.line.parallelIndex,
          getLineAngles: (arrow) => [
            arrow.line.angleStart,
            arrow.line.angle,
            arrow.line.angleEnd
          ],
          getProximityFactors: (arrow) => [
            arrow.line.proximityFactorStart,
            arrow.line.proximityFactorEnd
          ],
          getDistanceBetweenLines: () => this.props.distanceBetweenLines,
          maxParallelOffset: this.props.maxParallelOffset,
          minParallelOffset: this.props.minParallelOffset,
          getDirection: (arrow) => {
            return getArrowDirection(arrow.line.p1);
          },
          animated: this.props.showLineFlow && this.props.lineFlowMode === "animatedArrows" /* ANIMATED_ARROWS */,
          visible: this.props.showLineFlow && (!this.props.filteredNominalVoltages || this.props.filteredNominalVoltages.includes(
            cData.nominalV
          )),
          opacity: this.props.areFlowsValid ? 1 : INVALID_FLOW_OPACITY,
          updateTriggers: {
            getLinePositions: linePathUpdateTriggers,
            getLineParallelIndex: [this.props.lineParallelPath],
            getLineAngles: linePathUpdateTriggers,
            getColor: [
              this.props.disconnectedLineColor,
              this.props.lineFlowColorMode,
              this.props.lineFlowAlertThreshold,
              this.props.updatedLines
            ],
            opacity: [this.props.areFlowsValid]
          }
        })
      );
      layers.push(arrowLayer);
      const startFork = new ForkLineLayer(
        this.getSubLayerProps({
          id: "LineForkStart" + cData.nominalV,
          getSourcePosition: (line) => line.origin,
          getTargetPosition: (line) => line.end,
          getSubstationOffset: (line) => line.substationIndexStart,
          data: cData.lines,
          widthScale: 20,
          widthMinPixels: 1,
          widthMaxPixels: 2,
          getColor: (line) => getLineColor(
            line,
            nominalVoltageColor,
            this.props,
            this.state.linesConnection.get(line.id)
          ),
          getWidth: 2,
          getProximityFactor: (line) => line.proximityFactorStart,
          getLineParallelIndex: (line) => line.parallelIndex,
          getLineAngle: (line) => line.angleStart,
          getDistanceBetweenLines: this.props.distanceBetweenLines,
          getMaxParallelOffset: this.props.maxParallelOffset,
          getMinParallelOffset: this.props.minParallelOffset,
          getSubstationRadius: this.props.substationRadius,
          getSubstationMaxPixel: this.props.substationMaxPixel,
          getMinSubstationRadiusPixel: this.props.minSubstationRadiusPixel,
          visible: !this.props.filteredNominalVoltages || this.props.filteredNominalVoltages.includes(
            cData.nominalV
          ),
          updateTriggers: {
            getLineParallelIndex: linePathUpdateTriggers,
            getSourcePosition: linePathUpdateTriggers,
            getTargetPosition: linePathUpdateTriggers,
            getLineAngle: linePathUpdateTriggers,
            getProximityFactor: linePathUpdateTriggers,
            getColor: [
              this.props.disconnectedLineColor,
              this.props.lineFlowColorMode,
              this.props.lineFlowAlertThreshold,
              this.props.updatedLines
            ]
          }
        })
      );
      layers.push(startFork);
      const endFork = new ForkLineLayer(
        this.getSubLayerProps({
          id: "LineForkEnd" + cData.nominalV,
          getSourcePosition: (line) => line.end,
          getTargetPosition: (line) => line.origin,
          getSubstationOffset: (line) => line.substationIndexEnd,
          data: cData.lines,
          widthScale: 20,
          widthMinPixels: 1,
          widthMaxPixels: 2,
          getColor: (line) => getLineColor(
            line,
            nominalVoltageColor,
            this.props,
            this.state.linesConnection.get(line.id)
          ),
          getWidth: 2,
          getProximityFactor: (line) => line.proximityFactorEnd,
          getLineParallelIndex: (line) => -line.parallelIndex,
          getLineAngle: (line) => line.angleEnd + Math.PI,
          getDistanceBetweenLines: this.props.distanceBetweenLines,
          getMaxParallelOffset: this.props.maxParallelOffset,
          getMinParallelOffset: this.props.minParallelOffset,
          getSubstationRadius: this.props.substationRadius,
          getSubstationMaxPixel: this.props.substationMaxPixel,
          getMinSubstationRadiusPixel: this.props.minSubstationRadiusPixel,
          visible: !this.props.filteredNominalVoltages || this.props.filteredNominalVoltages.includes(
            cData.nominalV
          ),
          updateTriggers: {
            getLineParallelIndex: [this.props.lineParallelPath],
            getSourcePosition: linePathUpdateTriggers,
            getTargetPosition: linePathUpdateTriggers,
            getLineAngle: linePathUpdateTriggers,
            getProximityFactor: linePathUpdateTriggers,
            getColor: [
              this.props.disconnectedLineColor,
              this.props.lineFlowColorMode,
              this.props.lineFlowAlertThreshold,
              this.props.updatedLines
            ]
          }
        })
      );
      layers.push(endFork);
      const lineActivePowerLabelsLayer = new TextLayer(
        this.getSubLayerProps({
          id: "ActivePower" + cData.nominalV,
          data: cData.activePower,
          getText: (activePower) => activePower.p !== void 0 ? Math.round(activePower.p).toString() : "",
          // The position passed to this layer causes a bug when zooming and maxParallelOffset is reached:
          // the label is not correctly positioned on the lines, they are slightly off.
          // In the custom layers, we clamp the distanceBetweenLines. This is not done in the deck.gl TextLayer
          // and IconLayer or in the position calculated here.
          getPosition: (activePower) => activePower.printPosition,
          getColor: this.props.labelColor,
          fontFamily: "Roboto",
          getSize: this.props.labelSize,
          getAngle: 0,
          getPixelOffset: (activePower) => activePower.offset.map((x) => x),
          getTextAnchor: "middle",
          visible: (!this.props.filteredNominalVoltages || this.props.filteredNominalVoltages.includes(
            cData.nominalV
          )) && this.props.labelsVisible,
          opacity: this.props.areFlowsValid ? 1 : INVALID_FLOW_OPACITY,
          updateTriggers: {
            getPosition: [
              this.props.lineParallelPath,
              linePathUpdateTriggers
            ],
            getPixelOffset: linePathUpdateTriggers,
            opacity: [this.props.areFlowsValid]
          }
        })
      );
      layers.push(lineActivePowerLabelsLayer);
      const lineStatusIconLayer = new IconLayer(
        this.getSubLayerProps({
          id: "OperatingStatus" + cData.nominalV,
          data: cData.operatingStatus,
          // The position passed to this layer causes a bug when zooming and maxParallelOffset is reached:
          // the icon is not correctly positioned on the lines, they are slightly off.
          // In the custom layers, we clamp the distanceBetweenLines. This is not done in the deck.gl TextLayer
          // and IconLayer or in the position calculated here.
          getPosition: (operatingStatus) => operatingStatus.printPosition,
          getIcon: (operatingStatus) => getLineIcon(operatingStatus.status),
          getSize: this.props.iconSize,
          getColor: () => this.props.labelColor,
          getPixelOffset: (operatingStatus) => operatingStatus.offset,
          visible: (!this.props.filteredNominalVoltages || this.props.filteredNominalVoltages.includes(
            cData.nominalV
          )) && this.props.labelsVisible,
          updateTriggers: {
            getPosition: [
              this.props.lineParallelPath,
              linePathUpdateTriggers
            ],
            getPixelOffset: linePathUpdateTriggers,
            getIcon: [this.state.linesStatus],
            getColor: [this.props.labelColor]
          }
        })
      );
      layers.push(lineStatusIconLayer);
    });
    return layers;
  }
}

const EQUIPMENT_INFOS_TYPES = {
  LIST: { type: "LIST" },
  MAP: { type: "MAP" },
  FORM: { type: "FORM" },
  TAB: { type: "TAB" },
  TOOLTIP: { type: "TOOLTIP" }
};
var EQUIPMENT_TYPES = /* @__PURE__ */ ((EQUIPMENT_TYPES2) => {
  EQUIPMENT_TYPES2["SUBSTATION"] = "SUBSTATION";
  EQUIPMENT_TYPES2["VOLTAGE_LEVEL"] = "VOLTAGE_LEVEL";
  EQUIPMENT_TYPES2["LINE"] = "LINE";
  EQUIPMENT_TYPES2["TWO_WINDINGS_TRANSFORMER"] = "TWO_WINDINGS_TRANSFORMER";
  EQUIPMENT_TYPES2["THREE_WINDINGS_TRANSFORMER"] = "THREE_WINDINGS_TRANSFORMER";
  EQUIPMENT_TYPES2["HVDC_LINE"] = "HVDC_LINE";
  EQUIPMENT_TYPES2["GENERATOR"] = "GENERATOR";
  EQUIPMENT_TYPES2["BATTERY"] = "BATTERY";
  EQUIPMENT_TYPES2["LOAD"] = "LOAD";
  EQUIPMENT_TYPES2["SHUNT_COMPENSATOR"] = "SHUNT_COMPENSATOR";
  EQUIPMENT_TYPES2["TIE_LINE"] = "TIE_LINE";
  EQUIPMENT_TYPES2["DANGLING_LINE"] = "DANGLING_LINE";
  EQUIPMENT_TYPES2["STATIC_VAR_COMPENSATOR"] = "STATIC_VAR_COMPENSATOR";
  EQUIPMENT_TYPES2["HVDC_CONVERTER_STATION"] = "HVDC_CONVERTER_STATION";
  EQUIPMENT_TYPES2["VSC_CONVERTER_STATION"] = "VSC_CONVERTER_STATION";
  EQUIPMENT_TYPES2["LCC_CONVERTER_STATION"] = "LCC_CONVERTER_STATION";
  EQUIPMENT_TYPES2["SWITCH"] = "SWITCH";
  return EQUIPMENT_TYPES2;
})(EQUIPMENT_TYPES || {});
const isVoltageLevel = (object) => "substationId" in object;
const isSubstation = (object) => "voltageLevels" in object;
const isLine = (object) => "id" in object && "voltageLevelId1" in object && "voltageLevelId2" in object;
var ConvertersMode = /* @__PURE__ */ ((ConvertersMode2) => {
  ConvertersMode2[ConvertersMode2["SIDE_1_RECTIFIER_SIDE_2_INVERTER"] = 0] = "SIDE_1_RECTIFIER_SIDE_2_INVERTER";
  ConvertersMode2[ConvertersMode2["SIDE_1_INVERTER_SIDE_2_RECTIFIER"] = 1] = "SIDE_1_INVERTER_SIDE_2_RECTIFIER";
  return ConvertersMode2;
})(ConvertersMode || {});

const elementIdIndexer = (map, element) => {
  map.set(element.id, element);
  return map;
};
class MapEquipments {
  substations = [];
  substationsById = /* @__PURE__ */ new Map();
  lines = [];
  linesById = /* @__PURE__ */ new Map();
  tieLines = [];
  tieLinesById = /* @__PURE__ */ new Map();
  hvdcLines = [];
  hvdcLinesById = /* @__PURE__ */ new Map();
  voltageLevels = [];
  voltageLevelsById = /* @__PURE__ */ new Map();
  nominalVoltages = [];
  intlRef = void 0;
  constructor() {
  }
  newMapEquipmentForUpdate() {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }
  checkAndGetValues(equipments) {
    return equipments ? equipments : [];
  }
  completeSubstationsInfos(equipementsToIndex) {
    const nominalVoltagesSet = new Set(this.nominalVoltages);
    if (equipementsToIndex?.length === 0) {
      this.substationsById = /* @__PURE__ */ new Map();
      this.voltageLevelsById = /* @__PURE__ */ new Map();
    }
    const substations = equipementsToIndex?.length > 0 ? equipementsToIndex : this.substations;
    substations.forEach((substation) => {
      substation.voltageLevels = substation.voltageLevels.sort(
        (voltageLevel1, voltageLevel2) => voltageLevel1.nominalV - voltageLevel2.nominalV
      );
      this.substationsById.set(substation.id, substation);
      substation.voltageLevels.forEach((voltageLevel) => {
        voltageLevel.substationId = substation.id;
        voltageLevel.substationName = substation.name;
        this.voltageLevelsById.set(voltageLevel.id, voltageLevel);
        nominalVoltagesSet.add(voltageLevel.nominalV);
      });
    });
    this.voltageLevels = Array.from(this.voltageLevelsById.values());
    this.nominalVoltages = Array.from(nominalVoltagesSet).sort(
      (a, b) => b - a
    );
  }
  updateEquipments(currentEquipments, newEquipements, _equipmentType) {
    currentEquipments.forEach((equipment1, index) => {
      const found = newEquipements.filter(
        (equipment2) => equipment2.id === equipment1.id
      );
      currentEquipments[index] = found.length > 0 ? found[0] : equipment1;
    });
    const eqptsToAdd = newEquipements.filter(
      (eqpt) => !currentEquipments.some((otherEqpt) => otherEqpt.id === eqpt.id)
    );
    if (eqptsToAdd.length === 0) {
      return currentEquipments;
    }
    return [...currentEquipments, ...eqptsToAdd];
  }
  updateSubstations(substations, fullReload) {
    if (fullReload) {
      this.substations = [];
    }
    let voltageLevelAdded = false;
    this.substations.forEach((substation1, index) => {
      const found = substations.filter(
        (substation2) => substation2.id === substation1.id
      );
      if (found.length > 0) {
        if (found[0].voltageLevels.length > substation1.voltageLevels.length) {
          voltageLevelAdded = true;
        }
        this.substations[index] = found[0];
      }
    });
    let substationAdded = false;
    substations.forEach((substation1) => {
      const found = this.substations.find(
        (substation2) => substation2.id === substation1.id
      );
      if (found === void 0) {
        this.substations.push(substation1);
        substationAdded = true;
      }
    });
    if (substationAdded || voltageLevelAdded) {
      this.substations = [...this.substations];
    }
    this.completeSubstationsInfos(fullReload ? [] : substations);
  }
  completeLinesInfos(equipementsToIndex) {
    if (equipementsToIndex?.length > 0) {
      equipementsToIndex.forEach((line) => {
        this.linesById?.set(line.id, line);
      });
    } else {
      this.linesById = this.lines.reduce(elementIdIndexer, /* @__PURE__ */ new Map());
    }
  }
  completeTieLinesInfos(equipementsToIndex) {
    if (equipementsToIndex?.length > 0) {
      equipementsToIndex.forEach((tieLine) => {
        this.tieLinesById?.set(tieLine.id, tieLine);
      });
    } else {
      this.tieLinesById = this.tieLines.reduce(
        elementIdIndexer,
        /* @__PURE__ */ new Map()
      );
    }
  }
  updateLines(lines, fullReload) {
    if (fullReload) {
      this.lines = [];
    }
    this.lines = this.updateEquipments(
      this.lines,
      lines,
      EQUIPMENT_TYPES.LINE
    );
    this.completeLinesInfos(fullReload ? [] : lines);
  }
  updateTieLines(tieLines, fullReload) {
    if (fullReload) {
      this.tieLines = [];
    }
    this.tieLines = this.updateEquipments(
      this.tieLines,
      tieLines,
      EQUIPMENT_TYPES.TIE_LINE
    );
    this.completeTieLinesInfos(fullReload ? [] : tieLines);
  }
  updateHvdcLines(hvdcLines, fullReload) {
    if (fullReload) {
      this.hvdcLines = [];
    }
    this.hvdcLines = this.updateEquipments(
      this.hvdcLines,
      hvdcLines,
      EQUIPMENT_TYPES.HVDC_LINE
    );
    this.completeHvdcLinesInfos(fullReload ? [] : hvdcLines);
  }
  completeHvdcLinesInfos(equipementsToIndex) {
    if (equipementsToIndex?.length > 0) {
      equipementsToIndex.forEach((hvdcLine) => {
        this.hvdcLinesById?.set(hvdcLine.id, hvdcLine);
      });
    } else {
      this.hvdcLinesById = this.hvdcLines.reduce(
        elementIdIndexer,
        /* @__PURE__ */ new Map()
      );
    }
  }
  removeBranchesOfVoltageLevel(branchesList, voltageLevelId) {
    const remainingLines = branchesList.filter(
      (l) => l.voltageLevelId1 !== voltageLevelId && l.voltageLevelId2 !== voltageLevelId
    );
    branchesList.filter((l) => !remainingLines.includes(l)).map((l) => this.linesById.delete(l.id));
    return remainingLines;
  }
  removeEquipment(equipmentType, equipmentId) {
    switch (equipmentType) {
      case EQUIPMENT_TYPES.LINE: {
        this.lines = this.lines.filter((l) => l.id !== equipmentId);
        this.linesById.delete(equipmentId);
        break;
      }
      case EQUIPMENT_TYPES.VOLTAGE_LEVEL: {
        const substationId = this.voltageLevelsById.get(equipmentId)?.substationId;
        if (substationId === void 0) {
          return;
        }
        const substation = this.substationsById.get(substationId);
        if (substation === void 0) {
          return;
        }
        substation.voltageLevels = substation.voltageLevels.filter(
          (l) => l.id !== equipmentId
        );
        this.removeBranchesOfVoltageLevel(this.lines, equipmentId);
        this.substations = [...this.substations];
        break;
      }
      case EQUIPMENT_TYPES.SUBSTATION: {
        this.substations = this.substations.filter(
          (l) => l.id !== equipmentId
        );
        const substation = this.substationsById.get(equipmentId);
        if (substation === void 0) {
          return;
        }
        substation.voltageLevels.map(
          (vl) => this.removeEquipment(EQUIPMENT_TYPES.VOLTAGE_LEVEL, vl.id)
        );
        this.completeSubstationsInfos([substation]);
        break;
      }
    }
  }
  getVoltageLevels() {
    return this.voltageLevels;
  }
  getVoltageLevel(id) {
    return this.voltageLevelsById.get(id);
  }
  getSubstations() {
    return this.substations;
  }
  getSubstation(id) {
    return this.substationsById.get(id);
  }
  getNominalVoltages() {
    return this.nominalVoltages;
  }
  getLines() {
    return this.lines;
  }
  getLine(id) {
    return this.linesById.get(id);
  }
  getHvdcLines() {
    return this.hvdcLines;
  }
  getHvdcLine(id) {
    return this.hvdcLinesById.get(id);
  }
  getTieLines() {
    return this.tieLines;
  }
  getTieLine(id) {
    return this.tieLinesById.get(id);
  }
}

const defaultProps$1 = {
  getRadiusMaxPixels: { type: "accessor", value: 1 }
};
class ScatterplotLayerExt extends ScatterplotLayer {
  static layerName = "ScatterplotLayerExt";
  static defaultProps = defaultProps$1;
  getShaders() {
    const shaders = super.getShaders();
    return Object.assign({}, shaders, {
      vs: shaders.vs.replace(
        ", radiusMaxPixels",
        ", instanceRadiusMaxPixels"
      ),
      // hack to replace the uniform variable to corresponding attribute
      inject: {
        "vs:#decl": `in float instanceRadiusMaxPixels;
`
      }
    });
  }
  initializeState() {
    super.initializeState();
    this.getAttributeManager()?.addInstanced({
      instanceRadiusMaxPixels: {
        size: 1,
        transition: true,
        accessor: "getRadiusMaxPixels",
        type: "float32",
        defaultValue: 0
      }
    });
  }
}

const voltageLevelNominalVoltageIndexer = (map, voltageLevel) => {
  let list = map.get(voltageLevel.nominalV);
  if (!list) {
    list = [];
    map.set(voltageLevel.nominalV, list);
  }
  list.push(voltageLevel);
  return map;
};
const defaultProps = {
  getNominalVoltageColor: { type: "function", value: () => [255, 255, 255] },
  filteredNominalVoltages: null,
  labelsVisible: false,
  labelColor: { type: "color", value: [255, 255, 255] },
  labelSize: 12
};
class SubstationLayer extends CompositeLayer {
  static layerName = "SubstationLayer";
  static defaultProps = defaultProps;
  initializeState(context) {
    super.initializeState(context);
    this.state = {
      compositeData: [],
      substationsLabels: []
    };
  }
  updateState({
    props: { data, filteredNominalVoltages, geoData, getNameOrId, network },
    oldProps,
    changeFlags
  }) {
    if (changeFlags.dataChanged) {
      const metaVoltageLevelsByNominalVoltage = /* @__PURE__ */ new Map();
      if (network != null && geoData != null) {
        data.forEach((substation) => {
          const voltageLevelsByNominalVoltage = substation.voltageLevels.reduce(
            voltageLevelNominalVoltageIndexer,
            /* @__PURE__ */ new Map()
          );
          const nominalVoltages = [
            ...new Set(
              substation.voltageLevels.map((voltageLevel) => voltageLevel.nominalV).sort(
                (nominalVoltage1, nominalVoltage2) => nominalVoltage1 - nominalVoltage2
              )
            )
          ];
          Array.from(voltageLevelsByNominalVoltage.entries()).forEach(
            ([nominalV, voltageLevels]) => {
              let metaVoltageLevels = metaVoltageLevelsByNominalVoltage.get(nominalV);
              if (!metaVoltageLevels) {
                metaVoltageLevels = [];
                metaVoltageLevelsByNominalVoltage.set(
                  nominalV,
                  metaVoltageLevels
                );
              }
              metaVoltageLevels.push({
                voltageLevels,
                nominalVoltageIndex: nominalVoltages.indexOf(nominalV)
              });
            }
          );
        });
      }
      const metaVoltageLevelsByNominalVoltageArray = Array.from(
        metaVoltageLevelsByNominalVoltage
      ).map((e) => {
        return { nominalV: e[0], metaVoltageLevels: e[1] };
      }).sort((a, b) => b.nominalV - a.nominalV);
      this.setState({
        metaVoltageLevelsByNominalVoltage: metaVoltageLevelsByNominalVoltageArray
      });
    }
    if (changeFlags.dataChanged || getNameOrId !== oldProps.getNameOrId || filteredNominalVoltages !== oldProps.filteredNominalVoltages) {
      let substationsLabels = data;
      if (network != null && geoData != null && filteredNominalVoltages != null) {
        substationsLabels = substationsLabels.filter(
          (substation) => substation.voltageLevels.find(
            (v) => filteredNominalVoltages.includes(v.nominalV)
          ) !== void 0
        );
      }
      this.setState({ substationsLabels });
    }
  }
  renderLayers() {
    const layers = [];
    this.state.metaVoltageLevelsByNominalVoltage?.forEach((e) => {
      const substationsLayer = new ScatterplotLayerExt(
        this.getSubLayerProps({
          id: "NominalVoltage" + e.nominalV,
          data: e.metaVoltageLevels,
          radiusMinPixels: SUBSTATION_RADIUS_MIN_PIXEL,
          getRadiusMaxPixels: (metaVoltageLevel) => SUBSTATION_RADIUS_MAX_PIXEL * (metaVoltageLevel.nominalVoltageIndex + 1),
          getPosition: (metaVoltageLevel) => this.props.geoData.getSubstationPosition(
            metaVoltageLevel.voltageLevels[0].substationId
          ),
          getFillColor: this.props.getNominalVoltageColor(e.nominalV),
          getRadius: (voltageLevel) => SUBSTATION_RADIUS * (voltageLevel.nominalVoltageIndex + 1),
          visible: !this.props.filteredNominalVoltages || this.props.filteredNominalVoltages.includes(e.nominalV),
          updateTriggers: {
            getPosition: [
              this.props?.geoData?.substationPositionsById,
              this.props?.network?.substations
            ]
          }
        })
      );
      layers.push(substationsLayer);
    });
    const substationLabelsLayer = new TextLayer(
      this.getSubLayerProps({
        id: "Label",
        data: this.state.substationsLabels,
        getPosition: (substation) => this.props.geoData.getSubstationPosition(substation.id),
        getText: (substation) => this.props.getNameOrId(substation),
        getColor: this.props.labelColor,
        fontFamily: "Roboto",
        getSize: this.props.labelSize,
        getAngle: 0,
        getTextAnchor: "start",
        getAlignmentBaseline: "center",
        getPixelOffset: [20 / 1.5, 0],
        visible: this.props.labelsVisible,
        updateTriggers: {
          getText: [this.props.getNameOrId],
          getPosition: [
            this.props.geoData.substationPositionsById,
            this.props.network.substations
          ]
        }
      })
    );
    layers.push(substationLabelsLayer);
    return layers;
  }
}

export { ConvertersMode, EQUIPMENT_INFOS_TYPES, EQUIPMENT_TYPES, GeoData, LineFlowColorMode, LineFlowMode, LineLayer, MapEquipments, SubstationLayer, getNominalVoltageColor, isLine, isSubstation, isVoltageLevel };
