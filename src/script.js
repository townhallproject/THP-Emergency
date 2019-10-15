import { find } from 'lodash';
import {
  responseClass,
  mapColors,
  responseDict,
  responseDictGroups,
  FULL_CONGRESS,
} from './constants';
import states from './data/state-centers';

import {
  get116thCongress,
} from './mocs';

import {
  showTooltip,
  showStateTooltip,
} from './map/tooltip';

import Map from './map';

import "./scss/style.scss";

let map;
let mapContainer;
let MoCs = [];
let MoCsByDistrict;
export let senatorsByState;
export let selectedTab = FULL_CONGRESS;
let districtLayer;
let stateLayer;

const filters = {};
let searchName;

$('.congress-toggle a').on('click', function (e) {
  e.preventDefault()
  $('.congress-toggle a').removeClass('active');
  $(this).addClass('active');
  let newSelectedTab = $(this).attr('data-value');
  if (newSelectedTab !== selectedTab) {
    let mocList = newSelectedTab === 'full' ? MoCs : MoCs.filter((moc) => moc.chamber === newSelectedTab);
    const groups = mapToGroups(mocList)
    render(mocList, groups, newSelectedTab);
    selectedTab = newSelectedTab;
    if (selectedTab === 'upper') {
      districtLayer.remove();
      mapContainer.addStateLayer();
      
    }
  }
})
// Wait for the DOM to be ready then add the Map and restrict movement
document.addEventListener("DOMContentLoaded", function() {
  map = L.map('map', { zoomControl: false, zoomSnap: 0.1, attributionControl: false }).setView([37.8, -96], calculateZoom());
  map.dragging.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
  map.scrollWheelZoom.disable();
});

function render(MocList, groups, selectedTab) {
    districtLayer.bindTooltip(showTooltip, {
      sticky: true,
    }).addTo(map);

    populateGroups(groups);
    $('.bar-graph').hide();
    $('.chamber-filter').hide();
    if (selectedTab === 'upper') {
      populateSenateBars(groups);
    } else if (selectedTab === 'lower') {
      populateHouseBars(groups);
    } else {
      $('.chamber-filter').show();
      populateSenateBars(groups);
      populateHouseBars(groups);
    }
    bindFilterEvents();
    addMoCCards(MocList);
    $('[data-toggle="tooltip"]').tooltip()
}
get116thCongress()
.then(function (returnedMoCs) {
  MoCs = returnedMoCs;
  MoCsByDistrict = mapToDistrictDict(MoCs);
  senatorsByState = mapToStateDict(MoCs);

  stateLayer = new L.GeoJSON.AJAX("/data/states.geojson", {
    middleware: addSenatorsToState,
    style: function (state) {
      return setStyle(state);
    }
  });
  districtLayer = new L.GeoJSON.AJAX("/data/districts.geojson", {
    middleware: addMoCsToDistrict,
    style: function(state) { return setStyle(state); }
  });
  
  mapContainer = new Map(map, senatorsByState);
  stateLayer.bindTooltip(showStateTooltip, {
    sticky: true,
  }).addTo(map);
  districtLayer.bindTooltip(showTooltip, {
    sticky: true,
  }).addTo(map);

  // Fill out the MoC stance groups, add photos, and generate all MoC cards
  const groups = mapToGroups(MoCs)
  render(MoCs, groups, selectedTab)
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

function populateHouseBars(groups) {
   $('.bar-graph-house').show();
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
  $('.bar-graph-senate').show();
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
    // clear previous images
    photoContainer.innerHTML = '';
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

function addSenatorsToState(statesGeoJson) {
  statesGeoJson.features.forEach(function (stateFeature) {
    const stateData = find(states, (stateInfo) => stateInfo.stateName === stateFeature.properties.name);
    if (stateData) {
      stateFeature.properties.SENATORS = senatorsByState[stateData.state];
    }
  })
  return statesGeoJson;
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

const sortReps = (a, b) => {
  if (a.stateName > b.stateName) {
    return 1;
  } else if (a.stateName < b.stateName) {
    return -1;
  } else if (a.stateName === b.stateName) {
    if (a.chamber === 'upper' && b.chamber === 'lower') {
      return -1;
    } else if (b.chamber === 'upper' && a.chamber === 'lower') {
      return 1;
    } else if (a.chamber === 'lower' && b.chamber === 'lower') {
      return Number(a.district) - Number(b.district);
    }
  }
  return 0;
}
// MoC section
function addMoCCards(MoCs) {
  let container = $('#MoCCardContainer');
  container.empty();
  // Filter MoCs and render results

  const filteredMoCs = filterMoCs(MoCs).sort(sortReps);
  filteredMoCs.forEach(function(MoC) {
    container.append(createMoCCard(MoC));
  });
  if (filteredMoCs.length % 2 !== 0) {
    container.append('<div class="card" style="border: none; height: 0;"></div>');
  }
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
            '<h4>' + MoC.displayName + ' ('+ MoC.party + ')' + '</h4>' +
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
    addMoCCards(selectedTab === FULL_CONGRESS ? MoCs : MoCs.filter(moc => moc.chamber === selectedTab));
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
    addMoCCards(selectedTab === FULL_CONGRESS ? MoCs : MoCs.filter(moc => moc.chamber === selectedTab));
}

function filterMoCs(MoCs) {
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
