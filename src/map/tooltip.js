import {
    responseClass,
    responseDictPopover,
} from '../constants';

import {
    userSelections,
    data,
} from '../script';

const wrapper = (title, content) => {
    return `<div class="tooltip-container">
      <div class="d-flex justify-content-between">
        <h4 class="title">${title}</h4>
        <h4>Position</h4>
      </div>
      ${content}
    </div>`
}

function makeRow(name, status) {
    if (!status) {
        return `<div class="d-flex justify-content-between"><span>${name}</span><span class="response background-NA">NA</span></div >`;
    }
    return `<div class="d-flex justify-content-between"><span>${name}</span><span class="response background-${responseClass[status]}">${responseDictPopover[status]}</span></div>`;
}

const senatorName = (senator) => `Sen. ${senator.displayName} (${senator.party})`;
const repName = (rep) => `Rep. ${rep.displayName} (${rep.party})`;

const senateViewTooltip = (state, senators) =>
    `${wrapper(state, `
      ${senators.map((senator) => makeRow(senatorName(senator), senator.crisis_status)).join('')}`)}`

const houseToolTip = (district, rep) => `${wrapper(district, `${makeRow(rep.displayName, rep.crisis_status)}`)}`

export function showTooltip(e) {
    const {
        selectedTab,
    } = userSelections;

    const {
        senatorsByState
    } = data;
    if (selectedTab === 'lower' && e.feature.properties.MoCs) {
        return houseToolTip(e.feature.properties.DISTRICT, e.feature.properties.MoCs[0])
    } else if (selectedTab === 'upper') {
        return senateViewTooltip(e.feature.properties.ABR, senatorsByState[e.feature.properties.DISTRICT.slice(0, 2)])
    }
    const senators = `<div class="subtitle">SENATE</div>
      ${senatorsByState[e.feature.properties.DISTRICT.slice(0, 2)].map(function (senator) {
        return makeRow(senatorName(senator), senator.crisis_status)
      }).join('')}`

    if (!e.feature.properties.MoCs || !e.feature.properties.MoCs.length) {
        return `${wrapper(e.feature.properties.DISTRICT, `<div class="subtitle">HOUSE</div>
      ${makeRow('vacant')}
      ${senators}`)}`
    }

    return `${wrapper(e.feature.properties.DISTRICT, `<div class="subtitle">HOUSE</div>
        ${makeRow(repName(e.feature.properties.MoCs[0]), e.feature.properties.MoCs[0].crisis_status)}
        ${senators}`)}`
    }

export function showStateTooltip(e) {
    return senateViewTooltip(e.feature.properties.name, e.feature.properties.SENATORS)
}

export function showSenatorTooltip(e) {
    return senateViewTooltip(e.feature.properties.stateName, [e.feature.properties.senator])
}