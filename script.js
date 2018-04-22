// TODO add babel so we can use ES6 like sane people
var map;
var MoCs;
var MoCsByDistrict;
var senatorsByState;
var filters = {};

// Wait for the DOM to be ready then add the Map and restrict movement
document.addEventListener("DOMContentLoaded", function(event) {
  map = L.map('map', { zoomControl: false, zoomSnap: 0.1, attributionControl: false }).setView([37.8, -96], calculateZoom());
  map.dragging.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
  map.scrollWheelZoom.disable();
});

// TODO break this out into setup file
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
    // TODO: Remove once we have real values for crisis stance
    return Object.assign({}, MoCs[key], {crisis: Math.floor(Math.random() * 5) + 1});
  }).filter(function(MoC) {
    return MoC.hasOwnProperty('in_office') && MoC.in_office === true;
  });
  MoCsByDistrict = mapToDistrictDict(MoCs);
  senatorsByState = mapToStateDict(MoCs);
  var districtLayer = new L.GeoJSON.AJAX("districts.geojson", {
    middleware: addMoCsToDistrict,
    style: function(state) { return setStyle(state); }
  });

  var outlineLayer = new L.GeoJSON.AJAX("outline.geojson", {
    style: layerOutlineStyle
  });

  districtLayer.bindTooltip(showTooltip).addTo(map);
  outlineLayer.addTo(map);

  // Fill out the MoC stance groups, add photos, and generate all MoC cards
  populateGroups(mapToGroups(MoCs));
  bindFilterEvents();
  addMoCCards();
});

// Static Dicts
var responseDict = {
  1: 'supports impeachment.',
  2: 'supports another action.',
  3: 'is not on record.',
  4: 'has voiced concerns.',
  5: 'supports Trump.',
}

var responseClass = {
  1: 'impeachment',
  2: 'action',
  3: 'unknown',
  4: 'concerned',
  5: 'support'
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

function mapToStateDict(MoCs) {
  return MoCs.reduce(function(res, MoC) {
    if (MoC.district) { return res; }
    if (!res.hasOwnProperty(MoC.state)) {
        res[MoC.state] = [];
    }
    res[MoC.state].push(MoC);
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
function scrollToAnchor(target) {
  $('html, body').animate({
    scrollTop: $(target).offset().top,
  }, 1000);
}

function showTooltip(e) {
  var tooltip = '<h4>' + e.feature.properties.DISTRICT + ' Representatives:</h4>';
  senatorsByState[e.feature.properties.DISTRICT.slice(0, 2)].forEach(function(senator) {
    tooltip += '<h6>Sen <b>' + senator.displayName + '</b> ' + responseDict[senator.crisis];
  });
  return tooltip += '<h6>Rep <b>' + e.feature.properties.MoCs[0].displayName + '</b> ' + responseDict[e.feature.properties.MoCs[0].crisis];
}

function populateGroups(groups) {
  Object.keys(groups).forEach(function(key) {
    document.getElementById("count-" + key).innerHTML = groups[key].length;
    var photoContainer = document.getElementById("photos-" + key);
    var membersToDisplay = groups[key].sort(function(a, b){return parseInt(b.seniority) - parseInt(a.seniority)})
               .slice(0, 8)
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

function calculateZoom() {
  var sw = screen.width;

  return sw >= 1700 ? 4.7 :
         sw >= 1600 ? 4.3 :
                      4.5 ;
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

// MoC section
function addMoCCards() {
  var container = $('#MoCCardContainer');
  container.empty();
  // Filtering goes here
  filterMoCs().forEach(function(MoC) {
    container.append(createMoCCard(MoC));
  })
}

function createMoCCard(MoC) {
  // TODO break this out into template
  var facebook = MoC.facebook_official_account || MoC.facebook_account || MoC.facebook;
  var twitter = MoC.twitter_account || MoC.twitter;
  var website = MoC.contact_form || MoC.url;
  
  var res = '<div class="col card">' + 
      '<div class="card-header p-0">' +
        '<div class="row background-' + responseClass[MoC.crisis] + '">' +
          '<div class="col-4 col-sm-3 p-0"><img src="https://www.govtrack.us/data/photos/' + MoC.govtrack_id + '-50px.jpeg"></div>' +
          '<div class="col-8 col-sm-9 p-0">' +
            '<h4>' + MoC.displayName + '</h4>' +
            '<small class="rep-card-position">' + responseDict[MoC.crisis] + '</small>' +
            '<small class="rep-card-subtitle">' + 
              (!MoC.district ? 'Sen. ' : '' ) + MoC.state + (MoC.district ? '-' + MoC.district : '') +
            '</small>' + 
          '</div>' + 
        '</div>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="row">';
  
  if (MoC.phone) {
    res += '<div class="col-12 col-sm-5 p-0">D.C. Office Phone:<div>' + MoC.phone + '</div></div>';
  }

  res += '<div class="col-12 col-sm-7 p-0 text-right">';

  if (twitter && twitter.length) {
    res += '<a href="//twitter.com/' + twitter + '" class="social-icon" target="_blank">' +
              '<i class="fa fa-twitter-square" aria-hidden="true"></i>' +
            '</a>'
  }

  if (facebook && facebook.length) {
    res += '<a href="//facebook.com/' + facebook + '" class="social-icon" target="_blank">' +
              '<i class="fa fa-facebook-square" aria-hidden="true"></i>' +
            '</a>'
  }

  if (website && website.length) {
    res += '<a href="' + website + '" class="social-icon" target="_blank">' +
              '<i class="fa fa fa-external-link-square" aria-hidden="true"></i>' +
            '</a>'
  }

  return res += '</div></div></div>';
}

function bindFilterEvents() {
  $('#onTheRecord .dropdown .dropdown-item').click(setFilter);
  $(document).on('click', '#filter-info > button > i.fa-times', removeFilter);
}

function setFilter(e) {
  var type  = e.currentTarget.getAttribute('data-type');
  var value = e.currentTarget.getAttribute('data-value');
      value = parseInt(value) || value;
  
  if (Object.keys(filters).indexOf(type) === -1) {
    filters[type] = [];
  }
  
  if (filters[type].indexOf(value) === -1) {
    filters[type].push(value);
    $('#filter-info').append(
      '<button class="btn btn-secondary btn-xs" data-type="' + type + '" data-value="' + value + '">' +
      e.currentTarget.innerText + '<i class="fa fa-times" aria-hidden="true"></i></button>'
    )
    addMoCCards();
  }
}

function removeFilter(e) {
  var type  = e.currentTarget.parentElement.getAttribute('data-type');
  var value = e.currentTarget.parentElement.getAttribute('data-value');
      value = parseInt(value) || value;
  if (filters.hasOwnProperty(type) && filters[type].indexOf(value) !== -1 ) {
    filters[type].splice(filters[type].indexOf(value), 1);
  }
  if (filters.hasOwnProperty(type) && filters[type].length === 0) {
    delete filters[type];
  }
  e.currentTarget.parentElement.remove();
  addMoCCards();
}

function filterMoCs() {
  var filteredMoCs = MoCs;
  Object.keys(filters).forEach(function(key) {
    filteredMoCs = filteredMoCs.filter(function(MoC) {
      return filters[key].indexOf(MoC[key]) !== -1;
    })
  })
  return filteredMoCs;
}
