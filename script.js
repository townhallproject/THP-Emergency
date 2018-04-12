var map = {};

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
  var MoCs = snapshot.val();
  MoCs = Object.keys(MoCs).map(function(key) { 
    return MoCs[key]; 
  }).filter(function(MoC) {
    return MoC.hasOwnProperty('in_office') && MoC.in_office === true;
  });
  var MoCsByState = mapToStateDict(MoCs);

  var geoJsonLayer = new L.GeoJSON.AJAX("states.geojson", {
    middleware:function(stateGeoJson) {
      stateGeoJson.features.forEach(function(state) {
        state.properties.MoCs = MoCsByState[state.properties.name];
      });
      return stateGeoJson;
    },
  });
  geoJsonLayer.addTo(map);

});

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
    opposed: MoCs.filter(function(MoC) { return MoC.party === "Democratic" && MoC.type === "rep"; }),
    concerned: MoCs.filter(function(MoC) { return MoC.party === "Democratic" && MoC.type === "sen"; }),
    unknown: MoCs.filter(function(MoC) { return MoC.party === "Republican" && MoC.type === "sen"; }),
    support: MoCs.filter(function(MoC) { return MoC.party === "Republican" && MoC.type === "rep"; })
  };
}
