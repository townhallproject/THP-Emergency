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
    style: function(state) {
      return setStyle(state);
    }
  });
  geoJsonLayer.addTo(map);

  populateGroups(mapToGroups(MoCs));
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
  // TODO Replace with field relating to crisis
  var d = state.properties.MoCs.filter(function(MoC) {
        return MoC.party === "Republican";
    }).length / state.properties.MoCs.length;

  return  d > 0.75  ? '#c1001a' :
          d > 0.50  ? '#cecece' :
          d > 0.25  ? '#84b4d6' :
                      '#2a70b1';
}

function mapToGroups(MoCs) {
  return {
    opposed: MoCs.filter(function(MoC) { return MoC.party === "Democratic" && MoC.type === "rep"; }),
    concerned: MoCs.filter(function(MoC) { return MoC.party === "Democratic" && MoC.type === "sen"; }),
    unknown: MoCs.filter(function(MoC) { return MoC.party === "Republican" && MoC.type === "sen"; }),
    support: MoCs.filter(function(MoC) { return MoC.party === "Republican" && MoC.type === "rep"; })
  };
}

function populateGroups(groups) {
  console.log(groups)
  Object.keys(groups).forEach(function(key) {
    document.getElementById("count-" + key).innerHTML = groups[key].length;
    var photoContainer = document.getElementById("photos-" + key);
    var membersToDisplay = groups[key].sort(function(a, b){return parseInt(b.seniority) - parseInt(a.seniority)})
               .slice(0, 15)
               .forEach(function(MoC) {
                  photoContainer.innerHTML += '<img src="//www.govtrack.us/data/photos/' + MoC.govtrack_id + '-50px.jpeg" />';
    });
  });
}