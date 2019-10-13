let fbconfig = {
    apiKey: 'AIzaSyCXyjAOvBKDEX5pckTwuI7LODWKNlL21gc',
    authDomain: 'townhallproject-86312.firebaseapp.com',
    databaseURL: 'https://townhallproject-86312.firebaseio.com',
    messagingSenderId: '208752196071',
    storageBucket: 'townhallproject-86312.appspot.com',
};
firebase.initializeApp(fbconfig);
const firebasedb = firebase.database();

export default firebasedb;