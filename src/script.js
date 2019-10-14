// window.alert("NB:  This site is currently in testing mode.  Data is incomplete, and may be inaccurate.")
import {
  responseClass,
  mapColors,
  responseDict,
  responseDictPopover,
  responseDictGroups,
} from './constants';

import {
  get116thCongress,
} from './mocs';

import "./scss/style.scss";

let map;
let MoCs = [];
let MoCsByDistrict;
let senatorsByState;
const filters = {};
let searchName;

// Wait for the DOM to be ready then add the Map and restrict movement
document.addEventListener("DOMContentLoaded", function() {
  map = L.map('map', { zoomControl: false, zoomSnap: 0.1, attributionControl: false }).setView([37.8, -96], calculateZoom());
  map.dragging.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
  map.scrollWheelZoom.disable();
});

get116thCongress()
.then(function (returnedMoCs) {
  MoCs = returnedMoCs;
  MoCsByDistrict = mapToDistrictDict(MoCs);
  senatorsByState = mapToStateDict(MoCs);
  let districtLayer = new L.GeoJSON.AJAX("/data/districts.geojson", {
    middleware: addMoCsToDistrict,
    style: function(state) { return setStyle(state); }
  });

  districtLayer.bindTooltip(showTooltip, {
    sticky: true,
  }).addTo(map);

  // Fill out the MoC stance groups, add photos, and generate all MoC cards
  const groups = mapToGroups(MoCs)
  populateGroups(groups);
  populateHouseBars(groups);
  populateSenateBars(groups);
  bindFilterEvents();
  addMoCCards();
  $('[data-toggle="tooltip"]').tooltip()
});

// Data mapping
function mapToDistrictDict(MoCs) {
  return MoCs.reduce(function(res, MoC) {
    if (!MoC.district) { return res; }
    const district = `${MoC.state}-${MoC.district}`;
    if (!res.hasOwnProperty(district)) {
        res[district] = [];
    }
    res[district].push(MoC);
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
  return MoCs.reduce(function(acc, curr){
    var statusName = responseClass[curr.crisis_status];
    if (statusName) {
      if (!acc[statusName]){
        acc[statusName] = [];
      }
      acc[statusName].push(curr);
    }
    return acc;
  }, {})
}

// View Helpers
function scrollToAnchor(target) {
  $('html, body').animate({
    scrollTop: $(target).offset().top,
  }, 1000);
}

$('.scroll-link').on('click', (e) => {
    e.preventDefault()
    const link = $(e.target).attr('data-link')
    scrollToAnchor(link)
})

function makeRow(name, status){
  if (!status) {
   return '<div class="d-flex justify-content-between"><span>' + name + '</span><span class="response background-' + 'NA' + '"> ' + 'NA' + '</span></div > ';
  }
   return '<div class="d-flex justify-content-between"><span>' + name + '</span><span class="response background-' + responseClass[status] + '"> ' + responseDictPopover[status] + '</span></div > ';
}

function showTooltip(e) {
  if (!e.feature.properties.MoCs || !e.feature.properties.MoCs.length) {
      let tooltip =
        '<div class="tooltip-container"><div class="d-flex justify-content-between"><h4 class="title">' + e.feature.properties.DISTRICT + '</h4><h4>Position</h4></div>';
      tooltip += '<div class="subtitle">HOUSE</div>'
      tooltip += makeRow('vacant')
      tooltip += '<div class="subtitle">SENATE</div>'
      senatorsByState[e.feature.properties.DISTRICT.slice(0, 2)].forEach(function (senator) {
        tooltip += makeRow(senator.displayName, senator.crisis_status)
      });
      tooltip += '</div>'
    return tooltip;
  }
  let tooltip = 
    '<div class="tooltip-container"><div class="d-flex justify-content-between"><h4 class="title">' + e.feature.properties.DISTRICT + '</h4><h4>Position</h4></div>';
  tooltip += '<div class="subtitle">HOUSE</div>'
  tooltip += makeRow(e.feature.properties.MoCs[0].displayName, e.feature.properties.MoCs[0].crisis_status);
  tooltip += '<div class="subtitle">SENATE</div>'
  senatorsByState[e.feature.properties.DISTRICT.slice(0, 2)].forEach(function(senator) {
    tooltip += makeRow(senator.displayName, senator.crisis_status)
  });
  tooltip += '</div>'
  return tooltip;
}

function populateHouseBars(groups) {
    const total = MoCs.filter((moc) => moc.chamber === 'lower').length;
    Object.keys(groups).forEach(function (key) {
      const className = `.bar-house-${key}`
      const el = $(className);
      const length = groups[key]
        .filter(function (MoC) {
          return MoC.chamber === 'lower';
        }).length;
      const percentage = length / total * 100;
      el.width(`${percentage}%`);
      el.attr('title', `${length} reps ${responseDictGroups[key]}`)
    });
}

function populateSenateBars(groups) {
  const total = MoCs.filter((moc) => moc.chamber === 'upper').length;
  Object.keys(groups).forEach(function (key) {
    const className = `.bar-senate-${key}`
    const el = $(className);
    const length = groups[key]
      .filter(function (MoC) {
        return MoC.chamber === 'upper';
      }).length;
    const percentage = length / total * 100;
    el.width(`${percentage}%`);
    el.attr('title', `${length} senators ${responseDictGroups[key]}`)
  });
}


function populateGroups(groups) {
  Object.keys(groups).forEach(function(key) {
    const id = `count-${key}`
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = groups[key].length;
    }
    let photoContainer = document.getElementById("photos-" + key);
    if (!photoContainer) {
      return;
    }
    groups[key].sort(function(a, b){
      return parseInt(b.seniority) - parseInt(a.seniority)})
               .slice(0, 8)
               .forEach(function(MoC) {
                 if (MoC.govtrack_id){
                   photoContainer.innerHTML += '<img src="//www.govtrack.us/static/legislator-photos/' + MoC.govtrack_id + '-50px.jpeg" />';
                 }
    });
  });
}


// Map Helpers

function calculateZoom() {
  let sw = screen.width;

  return sw >= 1700 ? 4.7 :
         sw >= 1600 ? 4.3 :
                      4.5 ;
}

function addMoCsToDistrict(districtGeoJson) {
  districtGeoJson.features.forEach(function(district) {
    district = districtTHPAdapter(district);
    district.properties.MoCs = MoCsByDistrict[district.properties.DISTRICT];
    if (!district.properties.MoCs) { 
      return; 
    }

    // Calculate the value that occurs the most often in the dataset
    let crisisCount = MoCsByDistrict[district.properties.DISTRICT].map(function(MoC) { return MoC.crisis_status });
    district.properties.crisisMode = crisisCount.sort(function(a, b) {
      return crisisCount.filter(function(val) { return val === a }).length - crisisCount.filter(function(val) { return val === b }).length;
    }).pop();
  });
  return districtGeoJson;
}

// Takes a district and transforms all field names and data to THP standards
function districtTHPAdapter(district) {
  let formattedDistrict = district.properties.GEOID.substring(2);
  // Change -00 districts to -At-Large
  // remove leading zeros to numbers
  formattedDistrict = formattedDistrict === '00' ? formattedDistrict.replace('00', 'At-Large') : Number(formattedDistrict);
  formattedDistrict = `${district.properties.ABR}-${formattedDistrict}`;
  district.properties.DISTRICT = formattedDistrict;
  return district;
}

function setStyle(district) {
  return {
    color: 'white',
    fillColor: fillColor(district),
    fillOpacity: 1,
    opacity: 1,
    weight: 1,
  };
}

function fillColor(district) {
  return mapColors[district.properties.crisisMode] || '#c6c6c6';
}

// MoC section
function addMoCCards() {
  let container = $('#MoCCardContainer');
  container.empty();
  // Filter MoCs and render results
  filterMoCs().forEach(function(MoC) {
    container.append(createMoCCard(MoC));
  })
}

function createMoCCard(MoC) {
  // TODO break this out into template
  let facebook = MoC.facebook_official_account || MoC.facebook_account || MoC.facebook;
  let twitter = MoC.twitter_account || MoC.twitter;
  let website = MoC.contact_form || MoC.url;
  let res = '<div class="card">' +
      '<div class="card-header p-0">' +
        '<div class="row background-' + responseClass[MoC.crisis_status] + ' m-0">' +
          '<div class="col-4 col-sm-3 p-0"><img src="https://www.govtrack.us/static/legislator-photos/' + MoC.govtrack_id + '-100px.jpeg"></div>' +
          '<div class="col-8 col-sm-9">' +
            '<h4>' + MoC.displayName + '</h4>' +
            '<small class="rep-card-position">'
      
    res += responseDict[MoC.crisis_status] ? 
      '<a href="' + MoC.crisis_status_source + '" target="blank">' + responseDict[MoC.crisis_status] + '</a></small>' : '';

    res += '<small class="rep-card-subtitle">' +
              (!MoC.district ? 'Sen. ' : '' ) + MoC.state + (MoC.district ? '-' + MoC.district : '') +
            '</small>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="row m-0 pt-2">';
  
  res += `<div class="col-12 col-sm-5 p-0">${MoC.phone ? 'D.C. Office Phone:' : ' '}<div>${MoC.phone || ' '}</div></div>`;

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
  $('#onTheRecord .search-name').click(setNameSearch);
  $('#search-name-input').on('keyup', function(e) {
    if (e.keyCode === 13) setNameSearch(e);
  });
  $(document).on('click', '#filter-info > button > i.fa-times', removeFilter);
  // name search clear hide/show
  $('.has-clear input[type="text"]').on('input propertychange', function() {
    var $this = $(this);
    $this.siblings('.search-name-clear').toggleClass('d-none', !Boolean($this.val()));
  }).trigger('propertychange');
  $('.search-name-clear').click(function() {
    $(this).siblings('input[type="text"]').val('')
      .trigger('propertychange').focus();
    clearNameSearch();
  });
}

function setNameSearch(e) {
  searchName = $('#search-name-input').val();
  addMoCCards();
}

function clearNameSearch() {
  searchName = '';
  addMoCCards();
}

function setFilter(e) {
  let type  = e.currentTarget.getAttribute('data-type');
  let value = e.currentTarget.getAttribute('data-value');
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
  let type  = e.currentTarget.parentElement.getAttribute('data-type');
  let value = e.currentTarget.parentElement.getAttribute('data-value');
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
  let filteredMoCs = MoCs;
  Object.keys(filters).forEach(function(key) {
    filteredMoCs = filteredMoCs.filter(function(MoC) {
      return filters[key].indexOf(MoC[key]) !== -1;
    })
  });
  if (searchName) {
    filteredMoCs = filteredMoCs.filter(function(MoC) {
      return MoC.displayName.toUpperCase().includes(searchName.toUpperCase());
    });
  }
  return filteredMoCs;
}

function signUp(form) {
  let zipcodeRegEx = /^(\d{5}-\d{4}|\d{5}|\d{9})$|^([a-zA-Z]\d[a-zA-Z] \d[a-zA-Z]\d)$/g;
  let emailRegEx = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
  let phoneRegEx = /^(\d{11})$/;
  let errors = [];

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

  let person = {
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