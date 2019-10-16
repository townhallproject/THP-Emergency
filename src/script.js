import {
  responseClass,
  responseDict,
  responseDictGroups,
  FULL_CONGRESS,
} from './constants';

import {
  get116thCongress,
} from './mocs';

import CongressMap from './map';

import "./scss/style.scss";

let map;
let mapContainer;
let searchName;

export const data = {
  allMoCs: [],
  MoCsByDistrict: {},
  senatorsByState: {},
}

export const userSelections = {
  selectedTab: FULL_CONGRESS,
  filters: {},
  selectedUsState: '',
}

function getMocsForTab() {
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
  map = L.map('map', { zoomControl: false, zoomSnap: 0.1, attributionControl: false }).setView([37.8, -96], calculateZoom());
  map.dragging.disable();
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
}

get116thCongress()
.then(function (returnedMoCs) {
  $('.loading').hide();
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

function calculateZoom() {
  let sw = screen.width;

  return sw >= 1700 ? 4.7 :
         sw >= 1600 ? 4.3 :
                      4.5 ;
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
  $('#onTheRecord .dropdown .dropdown-item').click(setFilter);
  $('#onTheRecord .search-name').click(setNameSearch);
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

function setFilter(e) {
  let type  = e.currentTarget.getAttribute('data-type');
  let value = e.currentTarget.getAttribute('data-value');
      value = parseInt(value) || value;

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
      e.currentTarget.innerText + '<i class="fa fa-times" aria-hidden="true"></i></button>'
    )
    addMoCCards(getMocsForTab());
  }
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
