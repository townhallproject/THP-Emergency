import firebasedb from '../utils/setup-firebase';

export const get116thCongress = () => {
    return firebasedb.ref('moc_by_congress/116').once('value')
        .then(snapshot => {
            const allIds = [];
            snapshot.forEach(ele => {
                allIds.push(ele.val())
            })
            return allIds
        })
        .then((allIds) => {
            return firebasedb.ref('mocData/').once('value')
                .then(function (snapshot) {
                        let MoCs = [];
                        // Get MoCs and flatten into array
                        snapshot.forEach(function (ele) {
                            let MoC = ele.val();
                            if (!MoC.displayName) {
                                return;
                            }
                            if (MoC.party && MoC.party.length > 1) {
                                MoC.party = MoC.party.substring(0, 1);
                            }

                            MoCs.push(MoC);
                        })
                        return MoCs.filter(function (MoC) {
                            // Remove out of office people, and test data
                            return MoC.hasOwnProperty('in_office') &&
                                MoC.in_office === true &&
                                MoC.crisis_status &&
                                allIds.indexOf(MoC.govtrack_id) !== -1 &&
                                MoC.ballotpedia_id !== 'Testing McTesterson';
                        });
        })
    })
}