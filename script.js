window.alert("NB:  This site is currently in testing mode.  Data is incomplete, and may be inaccurate.")

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
    // TODO once all MoCs have crisis values remove this stub
    var MoC = MoCs[key];
    MoC.crisis_status = MoC.crisis_status || 6;
    return MoC;
  }).filter(function(MoC) {
    // Remove out of office people, and test data
    return MoC.hasOwnProperty('in_office') && MoC.in_office === true && MoC.ballotpedia_id !== 'Testing McTesterson';
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
  1: 'supports impeachment',
  2: 'supports Trump&apos;s resignation',
  3: 'supports other action(s)',
  4: 'has voiced concerns',
  5: 'opposes impeachment',
  6: 'not yet on record',
}

var responseClass = {
  1: 'impeachment',
  2: 'resignation',
  3: 'action',
  4: 'concerned',
  5: 'support',
  6: 'unknown',
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
    resignation: MoCs.filter(filterResignation),
    action: MoCs.filter(filterAction),
    concerned: MoCs.filter(filterConcerned),
    support: MoCs.filter(filterSupport),
    unknown: MoCs.filter(filterUnknown),
  };
}

// Filters
function filterImpeachment(MoC) {
  return MoC.crisis_status === 1;
}

function filterResignation(MoC) {
  return MoC.crisis_status === 2;
}

function filterAction(MoC) {
  return MoC.crisis_status === 3;
}

function filterConcerned(MoC) {
  return MoC.crisis_status === 4;
}

function filterSupport(MoC) {
  return MoC.crisis_status === 5;
}

function filterUnknown(MoC) {
  return MoC.crisis_status === 6;
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
    tooltip += '<h6>Sen <b>' + senator.displayName + '</b> ' + responseDict[senator.crisis_status];
  });
  return tooltip += '<h6>Rep <b>' + e.feature.properties.MoCs[0].displayName + '</b> ' + responseDict[e.feature.properties.MoCs[0].crisis_status];
}

function populateGroups(groups) {
  Object.keys(groups).forEach(function(key) {
    document.getElementById("count-" + key).innerHTML = groups[key].length;
    var photoContainer = document.getElementById("photos-" + key);
    groups[key].sort(function(a, b){return parseInt(b.seniority) - parseInt(a.seniority)})
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
    var crisisCount = MoCsByDistrict[district.properties.DISTRICT].map(function(MoC) { return MoC.crisis_status });
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
         district.properties.crisisMode === 3 ? '#ddcae5' :
         district.properties.crisisMode === 6 ? '#e8e1dd' :
         district.properties.crisisMode === 4 ? '#edeb6b' :
         district.properties.crisisMode === 5 ? '#e66101' :
                                                '#ffffff';
}

// MoC section
function addMoCCards() {
  var container = $('#MoCCardContainer');
  container.empty();
  // Filter MoCs and render results
  filterMoCs().forEach(function(MoC) {
    container.append(createMoCCard(MoC));
  })
}

function createMoCCard(MoC) {
  // TODO break this out into template
  var facebook = MoC.facebook_official_account || MoC.facebook_account || MoC.facebook;
  var twitter = MoC.twitter_account || MoC.twitter;
  var website = MoC.contact_form || MoC.url;

  var res = '<div class="card">' +
      '<div class="card-header p-0">' +
        '<div class="row background-' + responseClass[MoC.crisis_status] + ' m-0">' +
          '<div class="col-4 col-sm-3 p-0"><img src="https://www.govtrack.us/data/photos/' + MoC.govtrack_id + '-50px.jpeg"></div>' +
          '<div class="col-8 col-sm-9">' +
            '<h4>' + MoC.displayName + '</h4>' +
            '<small class="rep-card-position">'
      
    res += MoC.crisis_status === 6 ? responseDict[MoC.crisis_status] + '</small>' : 
                                    '<a href="' + MoC.crisis_status_source + '" target="blank">' +
                                    responseDict[MoC.crisis_status] + '</a></small>';

    res += '<small class="rep-card-subtitle">' +
              (!MoC.district ? 'Sen. ' : '' ) + MoC.state + (MoC.district ? '-' + MoC.district : '') +
            '</small>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="row m-0 pt-2">';

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

function signUp(form) {
  var zipcodeRegEx = /^(\d{5}-\d{4}|\d{5}|\d{9})$|^([a-zA-Z]\d[a-zA-Z] \d[a-zA-Z]\d)$/g;
  var emailRegEx = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
  var phoneRegEx = /^(\d{11})$/;
  var errors = [];

  if (!form.last.value || !form.first.value || !form.zipcode.value || !form.email.value || !form.phone.value) {
    errors.push("Please fill in all fields.")
  }

  if (!emailRegEx.test(form.email.value)) {
    errors.push("Please enter a valid email.")
  }

  if (!zipcodeRegEx.test(form.zipcode.value)) {
    errors.push("Please enter a valid zipcode.")
  }

  if (!phoneRegEx.test(form.phone.value)) {
    errors.push("Please enter an 11 digit phone number. Do not include hyphens, parentheses, or spaces.")
  }

  if (errors.length !== 0) {
    $('#email-signup-form-errors > .col').html(errors.join('<br />'))
    return false;
  }

  var person = {
    'person' : {
      'family_name': form.last.value,
      'given_name': form.first.value,
      'postal_addresses': [{ 'postal_code': form.zipcode.value}],
      'email_addresses': [{ 'address': form.email.value }],
      'phone_numbers': [{ 'number': form.phone.value }]
    }
  };

  $.ajax({
    url: 'https://actionnetwork.org/api/v2/forms/47264a33-be61-4e91-aa5d-2a66b4a207d7/submissions',
    method: 'POST',
    dataType: 'json',
    contentType: 'application/json',
    data: JSON.stringify(person),
    success: function() {
      $('#email-signup').html('<div class="container container-fluid container-light pl-5 pr-5 pb-2">' +
                                '<h1 class="text-center pb-3">Thanks for signing up. We&rsquo;ll be in touch!</h1>' +
                              '</div>');
    },
    error: function() {
      $('#email-signup').html('<div class="container container-fluid container-light pl-5 pr-5 pb-2">' +
                                '<h1 class="text-center pb-3">An error has occured, please try again later.</h1>' +
                              '</div>');
    }
  });

  return false;
}