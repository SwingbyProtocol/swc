'use strict';

// Import our Controllers
const relayer = require('../controllers/relayerCtrl')
const keep = require('../controllers/keepCtrl')


const routes = [{
        method: 'POST',
        url: '/api/v1/metaTxRelay',
        handler: relayer.postMetaTx
    },
    {
        method: 'GET',
        url: '/api/v1/keep',
        handler: keep.postMetaTx
    }
]

module.exports = routes