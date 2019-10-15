import {
    mapColors,
} from '../constants';

class Point {
    constructor(state, leftOrRight, senator) {
        this.type = 'Feature';
        this.geometry = {
            coordinates: [Number(state.lng) + leftOrRight, Number(state.lat)],
            type: 'Point',
        };
        this.properties = {
            senator,
            state: state.state,
            color: mapColors[senator.crisis_status],
            stateName: state.stateName,
            crisis_status: senator.crisis_status,
        };
    }
}

export default Point;