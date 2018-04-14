var map;
var MoCs;
var MoCsByState;

// Wait for the DOM to be ready then add the Map and restrict movement
document.addEventListener("DOMContentLoaded", function(event) {
  map = L.map('map', { zoomControl: false, attributionControl: false }).setView([37.8, -96], 4);
  map.dragging.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
  map.scrollWheelZoom.disable();
});

var fbconfig = {
  apiKey: 'AIzaSyDwZ41RWIytGELNBnVpDr7Y_k1ox2F2Heg',
  authDomain: 'townhallproject-86312.firebaseapp.com',
  databaseURL: 'https://townhallproject-86312.firebaseio.com',
  storageBucket: 'townhallproject-86312.appspot.com',
  messagingSenderId: '208752196071'
};
firebase.initializeApp(fbconfig);
var firebasedb = firebase.database();

firebasedb.ref('mocData/').once('value').then(function(snapshot) {
  // Get MoCs and flatten into array
  MoCs = snapshot.val();
  MoCs = Object.keys(MoCs).map(function(key) {
    // Add randomly generated values for crisis
    // TODO: Remove once we have real values
    return Object.assign({}, MoCs[key], {crisis: Math.floor(Math.random() * 5) + 1});
  }).filter(function(MoC) {
    return MoC.hasOwnProperty('in_office') && MoC.in_office === true;
  });
  MoCsByState = mapToStateDict(MoCs);

  var statesLayer = new L.GeoJSON.AJAX("states.geojson", {
    middleware: addMoCsToState,
    style: function(state) { return setStyle(state); }
  });

  var outlineLayer = new L.GeoJSON.AJAX("outline.geojson", {
    style: layerOutlineStyle
  });

  statesLayer.bindTooltip(showTooltip).addTo(map);
  outlineLayer.addTo(map);

  // Fill out the MoC count groups and photos
  populateGroups(mapToGroups(MoCs));
});


// Data mapping
function mapToStateDict(MoCs) {
  return MoCs.reduce(function(res, MoC) {
    if (!res.hasOwnProperty(MoC.stateName)) {
        res[MoC.stateName] = [];
    }
    res[MoC.stateName].push(MoC);
    return res;
  }, {});
}

function mapToGroups(MoCs) {
  return {
    impeachment: MoCs.filter(filterImpeachment),
    action: MoCs.filter(filterAction),
    unknown: MoCs.filter(filterUnknown),
    concerned: MoCs.filter(filterConcerned),
    support: MoCs.filter(filterSupport)
  };
}

// Filters
function filterImpeachment(MoC) {
  return MoC.crisis === 1;
}

function filterAction(MoC) {
  return MoC.crisis === 2;
}

function filterUnknown(MoC) {
  return MoC.crisis === 3;
}

function filterConcerned(MoC) {
  return MoC.crisis === 4;
}

function filterSupport(MoC) {
  return MoC.crisis === 5;
}

// View Helpers
function scrollToAnchor(element, to, duration) {
  if (duration < 10) { return; }
  var difference = to - element.scrollTop;
  var perTick = difference / duration * 10;

  setTimeout(function() {
    element.scrollTop = element.scrollTop + perTick;
    if (element.scrollTop < to) {
      scrollToAnchor(element, to, duration - 10);
    }
  }, 10);
}

function showTooltip(e) {
  return '<h4>' + e.feature.properties.name + ' Reacts:</h4>' +
  '<h6><b>' + e.feature.properties.MoCs.filter(filterImpeachment).length + '</b> reps support impeachment.</h6>' +  
  '<h6><b>' + e.feature.properties.MoCs.filter(filterAction).length + '</b> reps support other action.</h6>' +
  '<h6><b>' + e.feature.properties.MoCs.filter(filterUnknown).length + '</b> reps are not on record.</h6>' +
  '<h6><b>' + e.feature.properties.MoCs.filter(filterConcerned).length + '</b> reps voiced concerns.</h6>' +
  '<h6><b>' + e.feature.properties.MoCs.filter(filterSupport).length + '</b> reps support Trump.</h6>';
}

function populateGroups(groups) {
  Object.keys(groups).forEach(function(key) {
    document.getElementById("count-" + key).innerHTML = groups[key].length;
    var photoContainer = document.getElementById("photos-" + key);
    var membersToDisplay = groups[key].sort(function(a, b){return parseInt(b.seniority) - parseInt(a.seniority)})
               .slice(0, 12)
               .forEach(function(MoC) {
                  photoContainer.innerHTML += '<img src="//www.govtrack.us/data/photos/' + MoC.govtrack_id + '-50px.jpeg" />';
    });
  });
}


// Map Helpers
var layerOutlineStyle = {
  weight: 2,
  opacity: 0.25,
  color: 'black',
  className: 'filter-dropshadow'
}

function addMoCsToState(stateGeoJson) {
  stateGeoJson.features.forEach(function(state) {
    state.properties.MoCs = MoCsByState[state.properties.name];

    // Calculate the value that occurs the most often in the dataset
    var crisisCount = MoCsByState[state.properties.name].map(function(MoC) { return MoC.crisis });
    state.properties.crisisMode = crisisCount.sort(function(a, b) {
      return crisisCount.filter(function(val) { return val === a }).length - crisisCount.filter(function(val) { return val === b }).length;
    }).pop();
  });
  return stateGeoJson;
}

function setStyle(state) {
  return {
    fillColor: fillColor(state),
    weight: 2,
    opacity: 1,
    color: 'white',
    fillOpacity: 1
  };
}

function fillColor(state) {
  return state.properties.crisisMode === 1 ? '#5b7111' :
         state.properties.crisisMode === 2 ? '#f9c200' :
         state.properties.crisisMode === 3 ? '#e8e1dd' :
         state.properties.crisisMode === 4 ? '#f67617' :
                                             '#f53c00' ;
}
