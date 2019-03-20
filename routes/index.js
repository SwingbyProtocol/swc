'use strict';

const relayer = require('../controllers/relayerCtrl')
const keep = require('../controllers/keepCtrl')


const routes = [{
        method: 'POST',
        url: '/api/v1/metaTxRelay/:tokenAddress',
        handler: relayer.postMetaTx
    }
]

module.exports = routes