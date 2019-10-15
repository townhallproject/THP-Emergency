import {
    responseClass,
    responseDictPopover,
} from '../constants';

import {
    senatorsByState,
    selectedTab,
} from '../script';

function makeRow(name, status) {
    if (!status) {
        return `<div class="d-flex justify-content-between"><span>${name}</span><span class="response background-NA">NA</span></div >`;
    }
    return `<div class="d-flex justify-content-between"><span>${name}</span><span class="response background-${responseClass[status]}">${responseDictPopover[status]}</span></div>`;
}

const senateViewTooltip = (state, senators) => `<div class="tooltip-container">
      <div class="d-flex justify-content-between">
        <h4 class="title">${state}</h4>
        <h4>Position</h4>
      </div>
    <div class="subtitle">SENATE</div>
      ${senators.map((senator) => makeRow(senator.displayName, senator.crisis_status)).join('')}
    </div>`

const houseToolTip = (district, rep) => `
    <div class="tooltip-container">
      <div class="d-flex justify-content-between">
        <h4 class="title">${district}</h4>
        <h4>Position</h4>
      </div>
      ${makeRow(rep.displayName, rep.crisis_status)}
    </div>
`

export function showTooltip(e) {
    if (selectedTab === 'lower' && e.feature.properties.MoCs) {
        return houseToolTip(e.feature.properties.DISTRICT, e.feature.properties.MoCs[0])
    } else if (selectedTab === 'upper') {
        return senateViewTooltip(e.feature.properties.ABR, senatorsByState[e.feature.properties.DISTRICT.slice(0, 2)])
    }
    if (!e.feature.properties.MoCs || !e.feature.properties.MoCs.length) {
        return `<div class="tooltip-container"><div class="d-flex justify-content-between"><h4 class="title">${e.feature.properties.DISTRICT}</h4><h4>Position</h4></div>
      <div class="subtitle">HOUSE</div>
      ${makeRow('vacant')}
      <div class="subtitle">SENATE</div>
      ${senatorsByState[e.feature.properties.DISTRICT.slice(0, 2)].map(function (senator) {
        return makeRow(senator.displayName, senator.crisis_status)
      }).join('')}</div>`
    }
    return `<div class="tooltip-container"><div class="d-flex justify-content-between"><h4 class="title">${e.feature.properties.DISTRICT}</h4><h4>Position</h4></div>
  <div class="subtitle">HOUSE</div>
  ${makeRow(e.feature.properties.MoCs[0].displayName, e.feature.properties.MoCs[0].crisis_status)}
  <div class="subtitle">SENATE</div>
  ${senatorsByState[e.feature.properties.DISTRICT.slice(0, 2)].map(function(senator) {
    return makeRow(senator.displayName, senator.crisis_status)
  }).join('')}</div>`
}

export function showStateTooltip(e) {
    console.log(e.feature)
    return senateViewTooltip(e.feature.properties.name, e.feature.properties.SENATORS)
}

