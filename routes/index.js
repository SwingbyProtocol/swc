'use strict';

const relayer = require('../controllers/relayerCtrl')
const keep = require('../controllers/keepCtrl')


const routes = [{
        method: 'POST',
        url: '/api/v1/metaTxRelay/:tokenAddress',
        handler: relayer.postMetaTx
    },
    {
        method: 'GET',
        url: '/api/v1/metaTxRelay/:tokenAddress',
        handler: relayer.getMetaTx
    }
]

module.exports = routes