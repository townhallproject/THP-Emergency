import { find } from 'lodash';

import Point from './point';
import states from '../data/state-centers';
import bboxes from '../data/bboxes';

import {
    mapColors,
    deSaturatedMapColors,
} from '../constants';

import {
    showSenatorTooltip,
    showStateTooltip,
    showTooltip,
} from './tooltip';

import {
    setUsState,
    userSelections,
    addFilter,
    clearStateFilter
} from '../script';

const center = [37.8, -96]

function calculateZoom() {
    let sw = screen.width;

    return sw >= 1700 ? 4.7 :
        sw >= 1600 ? 4.3 :
        4.5;
}
export default class CongressMap {
    static getFillColor(district) {
        if (userSelections.selectedUsState) {
            if (district.properties.ABR === userSelections.selectedUsState) {
                return mapColors[district.properties.crisisMode] || '#c6c6c6';
            }
            return deSaturatedMapColors[district.properties.crisisMode] || '#c6c6c6';
        }
        return mapColors[district.properties.crisisMode] || '#c6c6c6';
    }

    static setStyle(district) {
        return {
            color: 'white',
            fillColor: CongressMap.getFillColor(district),
            fillOpacity: 1,
            opacity: 1,
            weight: 1,
        };
    }

    static districtTHPAdapter(district) {
        let formattedDistrict = district.properties.GEOID.substring(2);
        // Change -00 districts to -At-Large
        // remove leading zeros to numbers
        formattedDistrict = formattedDistrict === '00' ? formattedDistrict.replace('00', 'At-Large') : Number(formattedDistrict);
        formattedDistrict = `${district.properties.ABR}-${formattedDistrict}`;
        district.properties.DISTRICT = formattedDistrict;
        return district;
    }

    constructor(map, senatorsByState, MoCsByDistrict) {
        this.map = map;
        this.MoCsByDistrict = MoCsByDistrict;
        this.senatorsByState = senatorsByState;
        this.featuresHome = this.createFeatures(states, senatorsByState);
        this.addSenatorsToState = this.addSenatorsToState.bind(this);
        this.addMoCsToDistrict = this.addMoCsToDistrict.bind(this);
        this.reset = this.reset.bind(this);
        L.control.zoom({
            position: 'topright'
        }).addTo(map);
        this.makeZoomToNationalButton();
    }


    addSenateLayer() {
        this.stateLayer.bindTooltip(showStateTooltip, {
            sticky: true,
        }).addTo(this.map);
    }

    addDistrictLayer() {
        const { map, districtLayer} = this;
        this.districtLayer.bindTooltip(showTooltip, {
            sticky: true,
        }).addTo(this.map);
          this.districtLayer.on('click', (e) => {
            const state = e.layer.feature.properties.ABR;
            const boundingBox = bboxes[state];
            setUsState(state);
            districtLayer.setStyle(CongressMap.setStyle);
            clearStateFilter();
            addFilter('state', state, state);
            map.flyToBounds([
                [boundingBox[1], boundingBox[0]],
                [boundingBox[3], boundingBox[2]]
            ], {
                padding: [100, 100],
                // maxZoom: 6,
            })
        })
    }

    createLayers() {
        this.stateLayer = new L.GeoJSON.AJAX("../data/states.geojson", {
            interactive: true,
            middleware: this.addSenatorsToState,
            style: function (state) {
                return CongressMap.setStyle(state);
            }
        })
        this.districtLayer = new L.GeoJSON.AJAX("../data/districts.geojson", {
            interactive: true,
            middleware: this.addMoCsToDistrict,
            style: function (state) {
                return CongressMap.setStyle(state);
            }
        });
        this.addDistrictLayer();    
    }

    toggleChamber(chamber) {
        if (chamber === 'upper') {
            this.districtLayer.remove();
            this.addSenateLayer();
        } else {
            this.stateLayer.remove();
            this.markerLayer.remove();
            this.addDistrictLayer();
        }
    }

    clearStateSelectedStyling() {
        this.districtLayer.setStyle(CongressMap.setStyle);
    }

    addSenatorsToState(statesGeoJson) {
        let { senatorsByState } = this;
        statesGeoJson.features.forEach(function (stateFeature) {
            const stateData = find(states, (stateInfo) => stateInfo.stateName === stateFeature.properties.name);
            if (stateData) {
                stateFeature.properties.SENATORS = senatorsByState[stateData.state];
            }
        })
        return statesGeoJson;
    }

    zoomToNational() {
        this.map.flyTo(center, calculateZoom());
    }

    reset() {
        setUsState('');
        clearStateFilter();
        this.zoomToNational()
        this.clearStateSelectedStyling();
    }


    addMoCsToDistrict(districtGeoJson) {
        let { MoCsByDistrict } = this;
        districtGeoJson.features.forEach(function (district) {
            district = CongressMap.districtTHPAdapter(district);
            district.properties.MoCs = MoCsByDistrict[district.properties.DISTRICT];
            if (!district.properties.MoCs) {
                return;
            }

            // Calculate the value that occurs the most often in the dataset
            let crisisCount = MoCsByDistrict[district.properties.DISTRICT].map(function (MoC) {
                return MoC.crisis_status
            });
            district.properties.crisisMode = crisisCount.sort(function (a, b) {
                return crisisCount.filter(function (val) {
                    return val === a
                }).length - crisisCount.filter(function (val) {
                    return val === b
                }).length;
            }).pop();
        });
        return districtGeoJson;
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
        this.addLayer(this.featuresHome);
    }

    // Creates the button in our zoom controls to go to the national view
    makeZoomToNationalButton() {
        const usaButton = document.createElement('button');
        usaButton.className = 'mapboxgl-ctrl-icon mapboxgl-ctrl-usa ant-btn';

        usaButton.innerHTML = '<span class="usa-icon"></span>';
    
        usaButton.addEventListener('click', this.reset);
        document.querySelector('.leaflet-control-zoom').appendChild(usaButton);
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
         this.markerLayer.bindTooltip(showSenatorTooltip, {
             sticky: true,
         }).addTo(this.map);
     }
}