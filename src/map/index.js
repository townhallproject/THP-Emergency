import Point from './point';
import states from '../data/state-centers';
import {
    responseClass,
    mapColors,
    responseDict,
    responseDictPopover,
    responseDictGroups,
    FULL_CONGRESS,
} from '../constants';

function makeRow(name, status) {
    if (!status) {
        return '<div class="d-flex justify-content-between"><span>' + name + '</span><span class="response background-' + 'NA' + '"> ' + 'NA' + '</span></div > ';
    }
    return '<div class="d-flex justify-content-between"><span>' + name + '</span><span class="response background-' + responseClass[status] + '"> ' + responseDictPopover[status] + '</span></div > ';
}
export default class Map {
    constructor(map, senatorsByState) {
        this.map = map;
        this.senatorsByState = senatorsByState;
        this.featuresHome = this.createFeatures(states, senatorsByState);
    }

    createFeatures(items, senatorsByState) {
          const featuresHome = {
              features: [],
              type: 'FeatureCollection',
          };
          featuresHome.features = items.reduce((acc, state) => {
              const newFeatureLeft = new Point(state, -.5, senatorsByState[state.state][0]);
              const newFeatureRight = new Point(state, .5, senatorsByState[state.state][1]);
              if (state.lat) {
                  acc.push(newFeatureLeft);
                  acc.push(newFeatureRight);
              }
              return acc;
          }, []);
          return featuresHome;
      }
      
    
    addStateLayer() {
        // this.markerLayer.remove();
        this.addLayer(this.featuresHome);
    }

    showStateTooltip(e) {
        console.log(e.feature.properties)
        // return senateToolTip(e.feature.properties.name, e.feature.properties.SENATORS)
        return makeRow(e.feature.properties.senator.displayName, e.feature.properties.crisis_status);
    }

     addLayer(featuresHome) {
         this.markerLayer = L.geoJSON(featuresHome, {
             pointToLayer(geoJsonPoint, latlng) {
                 return L.circleMarker(latlng, {
                        color: geoJsonPoint.properties.color,
                        fillColor: geoJsonPoint.properties.color,
                        fillOpacity: 0.5,
                        radius: 5
                 });
             },
         });
         this.markerLayer.bindTooltip(this.showStateTooltip, {
             sticky: true,
         }).addTo(this.map);
     }
}