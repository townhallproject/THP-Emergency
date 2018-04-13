var map;

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

  var statesLayer = new L.GeoJSON.AJAX("states.geojson", {
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
  var outlineLayer = new L.GeoJSON.AJAX("outline.geojson", {
    style: {
      weight: 2,
      opacity: 0.25,
      color: 'black',
      className: 'filter-dropshadow'
    }
  });
  statesLayer.bindTooltip(showTooltip).addTo(map);
  outlineLayer.addTo(map);


  function showTooltip(e) {
    return '<h4>' + e.feature.properties.name + ' Reacts:</h4>' +
    '<h6><b>' + e.feature.properties.MoCs.filter(filterOpposed).length + '</b> reps are opposed.</h6>' +
    '<h6><b>' + e.feature.properties.MoCs.filter(filterConcerned).length + '</b> reps are concerned.</h6>' +
    '<h6><b>' + e.feature.properties.MoCs.filter(filterUnknown).length + '</b> reps are not on record.</h6>' +
    '<h6><b>' + e.feature.properties.MoCs.filter(filterSupport).length + '</b> reps are supportive.</h6>';
  }

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


  return  d > 0.75  ? '#ff5f00' :
          d > 0.50  ? '#e8e1dd' :
          d > 0.25  ? '#a22397' :
                      '#6809c8' ;
}

function mapToGroups(MoCs) {
  return {
    opposed: MoCs.filter(filterOpposed),
    concerned: MoCs.filter(filterConcerned),
    unknown: MoCs.filter(filterUnknown),
    support: MoCs.filter(filterSupport)
  };
}

function filterOpposed(MoC) {
  return MoC.party === "Democratic" && MoC.type === "rep";
}

function filterConcerned(MoC) {
  return MoC.party === "Democratic" && MoC.type === "sen";
}

function filterUnknown(MoC) {
  return MoC.party === "Republican" && MoC.type === "sen";
}

function filterSupport(MoC) {
  return MoC.party === "Republican" && MoC.type === "rep";
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

function scrollToAnchor(element, to, duration) {
  var difference = to - element.scrollTop;
  var perTick = difference / duration * 10;

  setTimeout(function() {
    element.scrollTop = element.scrollTop + perTick;
    console.log(element.scrollTop, to);
    if (element.scrollTop >= to) { console.log('done'); return; }
    console.log('next')
    scrollToAnchor(element, to, duration - 10);
  }, 10);
}