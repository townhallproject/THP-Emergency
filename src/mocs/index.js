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
                            // TODO once all MoCs have crisis values remove this stub
                            let MoC = ele.val();
                            // MoC.crisis_status = Number(MoC.crisis_status) || 6;
                            MoCs.push(MoC);
                        })
                        MoCs = MoCs.filter(function (MoC) {
                            // Remove out of office people, and test data
                            return MoC.hasOwnProperty('in_office') &&
                                MoC.in_office === true &&
                                MoC.crisis_status &&
                                allIds.indexOf(MoC.govtrack_id) !== -1 &&
                                MoC.ballotpedia_id !== 'Testing McTesterson';
                        });
                        return MoCs;
        })
    })
}