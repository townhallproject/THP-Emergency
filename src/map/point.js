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
            color: mapColors[senator.crisis_status],
            crisis_status: senator.crisis_status,
            senator,
            state: state.state,
            stateName: state.stateName,
        };
    }
}

export default Point;