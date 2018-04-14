var map;
var MoCs;
var MoCsByDistrict;

// Wait for the DOM to be ready then add the Map and restrict movement
document.addEventListener("DOMContentLoaded", function(event) {
  map = L.map('map', { zoomControl: false, zoomSnap: 0.1, attributionControl: false }).setView([37.8, -96], 4.7);
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
  MoCsByDistrict = mapToDistrictDict(MoCs);
  var districtLayer = new L.GeoJSON.AJAX("districts.geojson", {
    middleware: addMoCsToDistrict,
    style: function(state) { return setStyle(state); }
  });

  var outlineLayer = new L.GeoJSON.AJAX("outline.geojson", {
    style: layerOutlineStyle
  });

  districtLayer.bindTooltip(showTooltip).addTo(map);
  outlineLayer.addTo(map);

  // Fill out the MoC count groups and photos
  populateGroups(mapToGroups(MoCs));
});

// Static Dicts
var responseDict = {
  1: 'supports impeachment.',
  2: 'supports another action.',
  3: 'is not on record.',
  4: 'has voiced concerns.',
  5: 'supports Trump.',
}

// Data mapping
function mapToDistrictDict(MoCs) {
  return MoCs.reduce(function(res, MoC) {
    if (!MoC.district) { return res; }
    if (!res.hasOwnProperty(MoC.state + '-' + MoC.district)) {
        res[MoC.state + '-' + MoC.district] = [];
    }
    res[MoC.state + '-' + MoC.district].push(MoC);
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
  return '<h4>' + e.feature.properties.DISTRICT + ' Representatives:</h4>' +
         '<h6><b>Rep ' + e.feature.properties.MoCs[0].displayName + '</b> ' + responseDict[e.feature.properties.MoCs[0].crisis];
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

function addMoCsToDistrict(districtGeoJson) {
  districtGeoJson.features.forEach(function(district) {
    district = districtTHPAdapter(district);
    district.properties.MoCs = MoCsByDistrict[district.properties.DISTRICT];
    if (!district.properties.MoCs) { return; }

    // Calculate the value that occurs the most often in the dataset
    var crisisCount = MoCsByDistrict[district.properties.DISTRICT].map(function(MoC) { return MoC.crisis });
    district.properties.crisisMode = crisisCount.sort(function(a, b) {
      return crisisCount.filter(function(val) { return val === a }).length - crisisCount.filter(function(val) { return val === b }).length;
    }).pop();
  });

  return districtGeoJson;
}

// Takes a district and transforms all field names and data to THP standards
function districtTHPAdapter(district) {
  // Change -00 districts to -At-Large
  district.properties.DISTRICT = district.properties.DISTRICT.replace("-00", "-At-Large");
  // Remove leading 0 in district names
  if (/^.{2}-0\d$/m.test(district.properties.DISTRICT)) {
    district.properties.DISTRICT = district.properties.DISTRICT.replace("0", "");
  }
  return district;
}

function setStyle(state) {
  return {
    fillColor: fillColor(state),
    weight: 1,
    opacity: 1,
    color: 'white',
    fillOpacity: 1
  };
}

function fillColor(district) {
  return district.properties.crisisMode === 1 ? '#5e3c99' :
         district.properties.crisisMode === 2 ? '#b2abd2' :
         district.properties.crisisMode === 3 ? '#e8e1dd' :
         district.properties.crisisMode === 4 ? '#fdb863' :
                                                '#e66101' ;
}
