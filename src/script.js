import { find } from 'lodash';
import {
  responseClass,
  responseDict,
  responseDictGroups,
  FULL_CONGRESS,
} from './constants';

import {
  get116thCongress,
} from './mocs';

import states from './data/state-centers';
import CongressMap from './map';

import firebasedb from './utils/setup-firebase';

import "./scss/style.scss";

let map;
let mapContainer;
let searchName;

export const data = {
  MoCsByDistrict: {},
  allMoCs: [],
  senatorsByState: {},
}

export const userSelections = {
  filters: {},
  selectedTab: FULL_CONGRESS,
  selectedUsState: '',
}

export const setUsState = (state) => {
  userSelections.selectedUsState = state;
}

export const getMocsForTab = () => {
  const {
    allMoCs
  } = data;
  return userSelections.selectedTab === FULL_CONGRESS ? allMoCs : allMoCs.filter(moc => moc.chamber === userSelections.selectedTab)
}

$('.congress-toggle a').on('click', function (e) {
  e.preventDefault()
  $('.congress-toggle a').removeClass('active');
  $(this).addClass('active');

  let newSelectedTab = $(this).attr('data-value');
  if (newSelectedTab !== userSelections.selectedTab) {
    userSelections.selectedTab = newSelectedTab;
    let mocList = getMocsForTab();
    const groups = mapToGroups(mocList);
    render(mocList, groups, newSelectedTab);
    mapContainer.toggleChamber(newSelectedTab);

    if (userSelections.selectedTab === 'upper') {
      mapContainer.districtLayer.remove();
      mapContainer.addStateLayer();
    }
  }
})
// Wait for the DOM to be ready then add the Map and restrict movement
document.addEventListener("DOMContentLoaded", function() {
  map = L.map('map', { 
    attributionControl: false,
    zoomControl: false, 
    zoomSnap: 0.1, 
  }).fitBounds([
    [23.6, -134.846217],
    [50.2, -65.4]
  ]);
  // map.dragging.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
  map.scrollWheelZoom.disable();
});

function render(MocList, groups, selectedTab) {
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
    var latlngs = [
      [ 
        [[32.4, -135],[41, -135],[41, -127],[32.4, -123]], // outer ring
        [[32.4, -135],[41, -135],[41, -127],[32.4, -123]] // hole
      ],
      [ 
        [[27, -135],[32.4, -135],[32.4, -123],[27, -123]],
        [[27, -135],[32.4, -135],[32.4, -123],[27, -123]]
      ]
    ];
    const polygon = L.polygon(latlngs, {color: 'grey'}).addTo(map);
}

get116thCongress()
.then(function (returnedMoCs) {
  $('.loading').hide();
  $('body').removeClass('no-scroll');
  data.allMoCs = returnedMoCs;
  data.MoCsByDistrict = mapToDistrictDict(returnedMoCs);
  data.senatorsByState = mapToStateDict(returnedMoCs);
  
  mapContainer = new CongressMap(map, data.senatorsByState, data.MoCsByDistrict);
  mapContainer.createLayers();

  // Fill out the MoC stance groups, add photos, and generate all MoC cards
  const groups = mapToGroups(data.allMoCs)
  render(data.allMoCs, groups, userSelections.selectedTab)
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
  const { allMoCs } = data; 
   $('.bar-graph-house').show();
    const total = allMoCs.filter((moc) => moc.chamber === 'lower').length;
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
  const {
    allMoCs
  } = data;
  $('.bar-graph-senate').show();
  const total = allMoCs.filter((moc) => moc.chamber === 'upper').length;
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
export function addMoCCards(MoCs) {
  let container = $('#MoCCardContainer');
  container.empty();
  // Filter MoCs and render results

  const filteredMoCs = filterMoCs(MoCs).sort(sortReps);
  filteredMoCs.forEach(function(MoC) {
    container.append(createMoCCard(MoC));
  });
  container.append(
    '<div class="card" style="border: none; height: 0;"></div>' + 
    '<div class="card" style="border: none; height: 0;"></div>');
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
  $('#onTheRecord .dropdown .dropdown-item').click(onSelectFilter);
  $('#onTheRecord .search-name').click(setNameSearch);
  $('.search-zip').click(searchByZip);
  $('#search-zip-input').on('keyup', function (e) {
    if (e.keyCode === 13) searchByZip();
  });
  $('#search-name-input').on('keyup', function(e) {
    if (e.keyCode === 13) setNameSearch(e);
  });
  $(document).on('click', '#filter-info > button > i.fa-times', removeFilter);
  // name search clear hide/show
  $('.has-clear input[type="text"]').on('input propertychange', function() {
    var $this = $(this);
    $this.siblings('.search-name-clear').toggleClass('d-none', !($this.val()));
  }).trigger('propertychange');
  $('.search-name-clear').click(function() {
    $(this).siblings('input[type="text"]').val('')
      .trigger('propertychange').focus();
    clearNameSearch();
  });
}

function setNameSearch() {
  searchName = $('#search-name-input').val();
  addMoCCards(getMocsForTab());
}

function clearNameSearch() {
  searchName = '';
  addMoCCards(getMocsForTab());
}

export function isZipCode(query) {
  const zipCodeRegEx = /^(\d{5}-\d{4}|\d{5}|\d{9})$|^([a-zA-Z]\d[a-zA-Z] \d[a-zA-Z]\d)$/g;
  return query.match(zipCodeRegEx);
}

export function isState(query) {
  return find(states, state =>
    state.state.toLowerCase().trim() === query.toLowerCase().trim() ||
    state.stateName.toLowerCase().trim() === query.toLowerCase().trim());
}

export function resetSearch() {
  $('#search-zip-input').val('');
}

function searchByZip() {
  let value = $('#search-zip-input').val();
  if (isZipCode(value)) {
    userSelections.zip = value;
    firebasedb.ref(`zipToDistrict/${value}`).once('value')
      .then((snapshot) => {
        var districts = [];
        if (snapshot.exists()) {
          snapshot.forEach(function (ele) {
            districts.push(ele.val());
          });
        }
        mapContainer.getBoundingBoxes(districts)
        return districts;
      })
  }
  if (isState(value)) {
    userSelections.selectedUsState = value.toUpperCase();
    return mapContainer.zoomToSelectedState(userSelections.selectedUsState);
  }
  $('#search-zip-input').val('');
}

export function clearStateFilter() {
  delete userSelections.filters.state;
   $('.btn[data-type=state]').remove()
}

export function addFilter(type, value, text) {
  const {
    filters,
  } = userSelections;
  if (Object.keys(userSelections.filters).indexOf(type) === -1) {
    filters[type] = [];
  }

  if (filters[type].indexOf(value) === -1) {
    filters[type].push(value);
    $('#filter-info').append(
      '<button class="btn btn-secondary btn-xs" data-type="' + type + '" data-value="' + value + '">' +
      text + '<i class="fa fa-times" aria-hidden="true"></i></button>'
    )
    addMoCCards(getMocsForTab());
  }
}

function onSelectFilter(e) {
  let type  = e.currentTarget.getAttribute('data-type');
  let value = e.currentTarget.getAttribute('data-value');
      value = parseInt(value) || value;

  addFilter(type, value, e.currentTarget.innerText);
}

function removeFilter(e) {
    const {
      filters,
    } = userSelections;
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
  addMoCCards(getMocsForTab());
}

function filterMoCs(MoCs) {
  const {
    filters,
  } = userSelections;
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
